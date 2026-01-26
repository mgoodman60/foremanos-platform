import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can update user tiers
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update subscription tiers' },
        { status: 403 }
      );
    }

    const { userId, tier } = await request.json();

    if (!userId || !tier) {
      return NextResponse.json(
        { error: 'User ID and tier are required' },
        { status: 400 }
      );
    }

    // Validate tier
    const validTiers = ['free', 'starter', 'pro', 'team', 'business', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user's subscription tier
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: tier as any,
        subscriptionStatus: 'active', // Set to active when admin changes tier
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'tier_update',
        details: {
          targetUserId: userId,
          targetUserEmail: user.email,
          targetUsername: user.username,
          oldTier: user.subscriptionTier,
          newTier: tier,
          updatedBy: session.user?.email,
          timestamp: new Date().toISOString(),
        },
      },
    });

    console.log(`[ADMIN] User ${userId} (${user.email}) tier updated from ${user.subscriptionTier} to ${tier} by ${session.user?.email}`);

    return NextResponse.json(
      {
        success: true,
        message: `Subscription tier updated to ${tier}`,
        User: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          subscriptionTier: updatedUser.subscriptionTier,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[ADMIN ERROR] Failed to update subscription tier:', error);
    return NextResponse.json(
      {
        error: 'Failed to update subscription tier',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
