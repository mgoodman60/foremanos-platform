import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { validatePassword } from '@/lib/password-validator';
import { checkRateLimit, getClientIp, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, RATE_LIMITS.AUTH);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { User: true },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token is already used
    if (resetToken.used) {
      return NextResponse.json(
        { error: 'This reset token has already been used' },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: 'This reset token has expired' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    console.log(`Password reset successful for user: ${resetToken.User.email}`);

    return NextResponse.json(
      { message: 'Password reset successful. You can now login with your new password.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in reset-password:', error);
    return NextResponse.json(
      { error: 'An error occurred while resetting your password' },
      { status: 500 }
    );
  }
}
