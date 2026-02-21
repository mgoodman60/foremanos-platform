import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email-service';
import crypto from 'crypto';
import { checkRateLimit, getClientIp, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { withCsrf } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';

const logger = createLogger('forgot-password');

export const POST = withCsrf(async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, RATE_LIMITS.AUTH);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email (case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      logger.info('Password reset requested for non-existent email', { email });
      return NextResponse.json(
        { message: 'If the email exists, a password reset link has been sent.' },
        { status: 200 }
      );
    }

    // Check if user has a password (not a guest account)
    if (!user.password) {
      logger.info('Password reset requested for guest account', { email });
      return NextResponse.json(
        { message: 'If the email exists, a password reset link has been sent.' },
        { status: 200 }
      );
    }

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
      },
    });

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Create new reset token (expires in 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send password reset email
    await sendPasswordResetEmail(user.email!, user.username, token, user.id);

    logger.info('Password reset email sent', { email });

    // Add delay to prevent timing-based email enumeration
    await new Promise(resolve => setTimeout(resolve, 500));

    return NextResponse.json(
      { message: 'If the email exists, a password reset link has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Forgot password error', error as Error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
});
