import { prisma } from './db';
import { SUBSCRIPTION_LIMITS, SubscriptionTier } from './stripe';

/**
 * Check if user has reached their query limit
 * Uses a serializable transaction to prevent race conditions during reset window
 */
export async function checkQueryLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  tier: string;
}> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        queriesUsedThisMonth: true,
        queriesResetAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    const resetDate = new Date(user.queriesResetAt);
    let used = user.queriesUsedThisMonth;

    // Reset queries if it's a new month — atomic within this transaction
    if (now > resetDate) {
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);

      await tx.user.update({
        where: { id: userId },
        data: {
          queriesUsedThisMonth: 0,
          queriesResetAt: nextMonth,
        },
      });

      used = 0;
    }

    const limits = SUBSCRIPTION_LIMITS[user.subscriptionTier as SubscriptionTier];
    const limit = limits.queriesPerMonth;

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        remaining: -1,
        limit: -1,
        tier: user.subscriptionTier,
      };
    }

    const remaining = Math.max(0, limit - used);
    const allowed = remaining > 0;

    return {
      allowed,
      remaining,
      limit,
      tier: user.subscriptionTier,
    };
  });
}

/**
 * Increment user's query count
 */
export async function incrementQueryCount(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      queriesUsedThisMonth: {
        increment: 1,
      },
    },
  });
}

/**
 * Check if user can create more projects
 */
export async function checkProjectLimit(userId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      Project_Project_ownerIdToUser: {
        select: { id: true },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const limits = SUBSCRIPTION_LIMITS[user.subscriptionTier as SubscriptionTier];
  const limit = limits.projects;
  const current = user.Project_Project_ownerIdToUser.length;

  // -1 means unlimited
  if (limit === -1) {
    return {
      allowed: true,
      current,
      limit: -1,
    };
  }

  return {
    allowed: current < limit,
    current,
    limit,
  };
}

/**
 * Get user's subscription info
 */
export async function getSubscriptionInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStart: true,
      subscriptionEnd: true,
      cancelAtPeriodEnd: true,
      queriesUsedThisMonth: true,
      queriesResetAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const limits = SUBSCRIPTION_LIMITS[user.subscriptionTier as SubscriptionTier];

  return {
    tier: user.subscriptionTier,
    status: user.subscriptionStatus,
    limits,
    usage: {
      queries: user.queriesUsedThisMonth,
      queriesLimit: limits.queriesPerMonth,
      resetAt: user.queriesResetAt,
    },
    billing: {
      customerId: user.stripeCustomerId,
      subscriptionId: user.stripeSubscriptionId,
      start: user.subscriptionStart,
      end: user.subscriptionEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    },
  };
}

/**
 * Update user's subscription tier
 */
export async function updateSubscriptionTier({
  userId,
  tier,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  status,
}: {
  userId: string;
  tier: SubscriptionTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status?: string;
}) {
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: status as any || 'active',
      stripeCustomerId: stripeCustomerId || undefined,
      stripeSubscriptionId: stripeSubscriptionId || undefined,
      stripePriceId: stripePriceId || undefined,
      subscriptionStart: now,
      subscriptionEnd: nextMonth,
      queriesUsedThisMonth: 0,
      queriesResetAt: nextMonth,
    },
  });
}
