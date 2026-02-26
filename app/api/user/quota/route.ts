import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getProcessingLimits, getRemainingPages, shouldResetQuota, getNextResetDate } from '@/lib/processing-limits';
import { createLogger } from '@/lib/logger';

const logger = createLogger('USER_QUOTA');

export const dynamic = 'force-dynamic';

/**
 * Get current user's processing quota information
 */
export async function GET(_request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's current usage and subscription
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        pagesProcessedThisMonth: true,
        processingResetAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // CRITICAL FIX: Check if quota needs to be reset before returning info
    if (await shouldResetQuota(user)) {
      logger.info('Resetting quota for user in quota check', { userId, previousPages: user.pagesProcessedThisMonth });
      
      // Reset quota and update reset date
      await prisma.user.update({
        where: { id: userId },
        data: {
          pagesProcessedThisMonth: 0,
          processingResetAt: getNextResetDate(),
        },
      });

      // Update local user object
      user = {
        ...user,
        pagesProcessedThisMonth: 0,
        processingResetAt: getNextResetDate(),
      };
    }

    // Get tier limits
    const limits = getProcessingLimits(user.subscriptionTier);

    // Get remaining pages (after reset if needed) - must await async function
    const remainingPages = await getRemainingPages(user.pagesProcessedThisMonth, user.subscriptionTier);

    return NextResponse.json({
      tier: user.subscriptionTier,
      monthlyLimit: limits.monthlyPageLimit,
      pagesProcessed: user.pagesProcessedThisMonth,
      remainingPages: remainingPages,
      resetDate: user.processingResetAt instanceof Date 
        ? user.processingResetAt.toISOString() 
        : new Date(user.processingResetAt).toISOString(),
      isUnlimited: limits.monthlyPageLimit === Infinity,
    });
  } catch (error) {
    logger.error('Failed to get user quota', error);
    return NextResponse.json(
      { error: 'Failed to get quota information' },
      { status: 500 }
    );
  }
}
