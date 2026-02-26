import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import { apiError } from '@/lib/api-error';

const log = createScopedLogger('ADMIN_UPDATE_TIER');

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Only admins can update user tiers
    if (session.user.role !== 'admin') {
      return apiError('Only admins can update subscription tiers', 403, 'FORBIDDEN');
    }

    const { userId, tier } = await request.json();

    if (!userId || !tier) {
      return apiError('User ID and tier are required', 400, 'VALIDATION_ERROR');
    }

    // Validate tier
    const validTiers = ['free', 'starter', 'pro', 'team', 'business', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return apiError('Invalid subscription tier', 400, 'VALIDATION_ERROR');
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
      return apiError('User not found', 404, 'NOT_FOUND');
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

    log.info(`User tier updated`, { userId, email: user.email, oldTier: user.subscriptionTier, newTier: tier, updatedBy: session.user?.email });

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
  } catch (error: unknown) {
    log.error('Failed to update subscription tier', error);
    return apiError('Failed to update subscription tier', 500, 'INTERNAL_ERROR');
  }
}
