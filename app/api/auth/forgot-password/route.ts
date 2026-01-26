import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email-service';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
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
      console.log(`Password reset requested for non-existent email: ${email}`);
      return NextResponse.json(
        { message: 'If the email exists, a password reset link has been sent.' },
        { status: 200 }
      );
    }

    // Check if user has a password (not a guest account)
    if (!user.password) {
      console.log(`Password reset requested for guest account: ${email}`);
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

    console.log(`Password reset email sent to: ${email}`);

    return NextResponse.json(
      { message: 'If the email exists, a password reset link has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in forgot-password:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
