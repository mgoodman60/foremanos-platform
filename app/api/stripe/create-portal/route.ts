import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createPortalSession } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { safeErrorMessage } from '@/lib/api-error';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { withCsrf } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';

const logger = createLogger('STRIPE_PORTAL');

export const POST = withCsrf(async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limit portal session creation
    const rateLimitResult = await checkRateLimit(
      `portal:${session.user.email}`,
      RATE_LIMITS.API
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
      select: {
        stripeCustomerId: true,
      },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Get the origin from the request headers
    const origin = request.headers.get('origin') || 'https://foremanos.site';

    // Create Stripe portal session
    const portalSession = await createPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${origin}/dashboard`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error: unknown) {
    logger.error('Failed to create portal session', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to create portal session') },
      { status: 500 }
    );
  }
});
