import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { 
  checkRateLimit, 
  getRateLimitIdentifier,
  getClientIp,
  createRateLimitHeaders,
  RATE_LIMITS 
} from '@/lib/rate-limiter';
import { logActivity } from '@/lib/audit-log';
import { sendEmailVerification, sendNewSignupNotification } from '@/lib/email-service';
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

type SubscriptionTier = 'free' | 'starter' | 'pro' | 'team' | 'business' | 'enterprise';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for signup
    const clientIp = getClientIp(request);
    const rateLimitId = getRateLimitIdentifier(null, clientIp);
    const rateLimitResult = await checkRateLimit(rateLimitId, RATE_LIMITS.AUTH);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many signup attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter 
        },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      );
    }

    const body = await request.json();
    const { email, username, password, confirmPassword, selectedTier, billingPeriod } = body;

    // Validation
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Email, username, and password are required' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    if (password.length < 3) {
      return NextResponse.json(
        { error: 'Password must be at least 3 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { username: { equals: username, mode: 'insensitive' } },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email or username already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token (24 hour expiry)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Determine tier and approval status
    const tier: SubscriptionTier = selectedTier || 'free';
    const isPaidTier = tier !== 'free';

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        subscriptionTier: tier,
        // For free tier: pending email verification
        // For paid tiers: pending payment verification
        role: 'pending',
        approved: false,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Log the signup activity
    await logActivity({
      userId: user.id,
      action: 'user_signup',
      resource: 'user',
      resourceId: user.id,
      details: {
        email: user.email,
        username: user.username,
        tier: tier,
        requiresEmailVerification: !isPaidTier,
      },
      request,
    });

    // Send admin notification about new signup
    await sendNewSignupNotification(
      user.email || 'N/A',
      user.username,
      `${tier} (${isPaidTier ? 'payment pending' : 'email verification pending'})`
    ).catch(error => {
      console.error('Error sending signup notification to admins:', error);
    });

    // Handle Free Tier: Send email verification
    if (tier === 'free') {
      await sendEmailVerification(user.email!, user.username, verificationToken);

      return NextResponse.json(
        {
          message: 'Signup successful! Please check your email to verify your account.',
          requiresEmailVerification: true,
          User: {
            id: user.id,
            email: user.email,
            username: user.username,
            tier: 'free',
          },
        },
        { status: 201 }
      );
    }

    // Handle Paid Tiers: Create Stripe checkout session
    try {
      // Determine price ID based on tier and billing period
      let priceId: string;
      const isAnnual = billingPeriod === 'annual';

      switch (tier) {
        case 'starter':
          priceId = isAnnual ? STRIPE_PRICE_IDS.starter_annual : STRIPE_PRICE_IDS.starter_monthly;
          break;
        case 'pro':
          priceId = isAnnual ? STRIPE_PRICE_IDS.pro_annual : STRIPE_PRICE_IDS.pro_monthly;
          break;
        case 'team':
          priceId = STRIPE_PRICE_IDS.team_monthly;
          break;
        case 'business':
          priceId = STRIPE_PRICE_IDS.business_monthly;
          break;
        case 'enterprise':
          priceId = STRIPE_PRICE_IDS.enterprise_monthly;
          break;
        default:
          throw new Error('Invalid subscription tier');
      }

      // Create Stripe checkout session
      const origin = request.headers.get('origin') || 'https://foremanos.site';
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${origin}/dashboard?payment=success`,
        cancel_url: `${origin}/signup?payment=cancelled`,
        customer_email: user.email!,
        client_reference_id: user.id,
        metadata: {
          userId: user.id,
          tier: tier,
        },
      });

      console.log(`Stripe checkout session created for user ${user.username} (${tier})`);

      return NextResponse.json(
        {
          message: 'Account created! Redirecting to payment...',
          requiresPayment: true,
          checkoutUrl: session.url,
          User: {
            id: user.id,
            email: user.email,
            username: user.username,
            tier: tier,
          },
        },
        { status: 201 }
      );
    } catch (stripeError) {
      console.error('Stripe checkout creation error:', stripeError);
      
      // Rollback: Delete the user since we couldn't create checkout
      await prisma.user.delete({ where: { id: user.id } });

      return NextResponse.json(
        { error: 'Failed to create payment session. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
