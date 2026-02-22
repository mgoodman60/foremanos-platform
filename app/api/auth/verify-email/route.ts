import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { checkRateLimit, getClientIp, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { createLogger } from '@/lib/logger';

const logger = createLogger('verify-email');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request) ?? 'unknown';
    const rateLimitResult = await checkRateLimit(ip, RATE_LIMITS.AUTH);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Find user with this verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date(), // Token must not be expired
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Update user: verify email, approve account, activate client role
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        approved: true,
        role: 'client',
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    // Log the verification activity
    await logActivity({
      userId: user.id,
      action: 'email_verified',
      resource: 'user',
      resourceId: user.id,
      details: {
        email: user.email,
        username: user.username,
      },
      request,
    });

    logger.info('Email verified', { username: user.username, email: user.email });

    return NextResponse.json(
      {
        success: true,
        message: 'Email verified successfully! You can now login.',
        User: {
          email: user.email,
          username: user.username,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Email verification error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
