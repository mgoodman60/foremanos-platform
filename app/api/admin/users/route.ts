import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendWelcomeEmail as sendWelcomeEmailService } from '@/lib/email-service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('admin-users');

// Generate cryptographically secure password
function generateSecurePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const bytes = crypto.randomBytes(16);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        approved: true,
        subscriptionTier: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            Project_Project_ownerIdToUser: true,
            ChatMessage: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    logger.error('Error fetching users', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Only admins can create users.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      email, 
      username, 
      password, 
      role = 'client', 
      subscriptionTier = 'free',
      autoApprove = true,
      sendWelcomeEmail = true 
    } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Generate username if not provided (from email prefix)
    const finalUsername = username || email.split('@')[0];

    // Check if username is taken
    const existingUsername = await prisma.user.findUnique({
      where: { username: finalUsername },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username already taken. Please provide a different username.' },
        { status: 409 }
      );
    }

    // Generate cryptographically secure password if not provided
    const finalPassword = password || generateSecurePassword();
    
    // Hash password
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // Validate role
    if (!['admin', 'client', 'guest'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, client, or guest.' },
        { status: 400 }
      );
    }

    // Validate subscription tier
    const validTiers = ['free', 'starter', 'pro', 'team', 'business', 'enterprise'];
    if (!validTiers.includes(subscriptionTier)) {
      return NextResponse.json(
        { error: `Invalid subscription tier. Must be one of: ${validTiers.join(', ')}` },
        { status: 400 }
      );
    }

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: finalUsername,
        password: hashedPassword,
        role: role,
        approved: autoApprove,
        subscriptionTier: subscriptionTier,
        emailVerified: autoApprove, // Auto-verify if auto-approved
        pagesProcessedThisMonth: 0,
        totalProcessingCost: 0,
        processingResetAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        approved: true,
        subscriptionTier: true,
        createdAt: true,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'admin_created_user',
        details: `Admin created new user: ${newUser.email} (${newUser.role})`,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Send welcome email if requested
    if (sendWelcomeEmail && newUser.email) {
      try {
        await sendWelcomeEmailService(newUser.email, newUser.username, newUser.id);
        logger.info('Welcome email sent', { email: newUser.email });
      } catch (emailError) {
        // Don't fail user creation if email fails - it's not critical
        logger.error('Failed to send welcome email', emailError as Error);
      }
    }

    return NextResponse.json(
      {
        user: newUser,
        credentials: {
          email: newUser.email,
          username: newUser.username,
          password: password ? '(custom password set)' : finalPassword, // Only show generated password
        },
        message: 'User created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating user', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
