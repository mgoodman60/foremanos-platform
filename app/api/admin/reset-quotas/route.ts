import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS, getClientIp, getRateLimitIdentifier } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Reset monthly processing quotas for all users
 * Should be called on the 1st of each month (can be automated with cron)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Only admins can reset quotas
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      );
    }

    // Rate limit
    const rateLimitId = getRateLimitIdentifier(session.user.id, getClientIp(request));
    const rateLimitResult = await checkRateLimit(rateLimitId, RATE_LIMITS.AUTH);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all users who need quota reset
    const users = await prisma.user.findMany({
      where: {
        processingResetAt: {
          lt: firstOfMonth,
        },
      },
      select: {
        id: true,
        email: true,
        pagesProcessedThisMonth: true,
        processingResetAt: true,
      },
    });

    logger.info('ADMIN_QUOTAS', `Resetting quotas for ${users.length} users`);

    // Reset each user's monthly quota
    const resetPromises = users.map((user: any) =>
      prisma.user.update({
        where: { id: user.id },
        data: {
          pagesProcessedThisMonth: 0,
          processingResetAt: now,
        },
      })
    );

    await Promise.all(resetPromises);

    return NextResponse.json({
      success: true,
      message: `Reset quotas for ${users.length} users`,
      resetDate: now.toISOString(),
      users: users.map((u: any) => ({
        email: u.email,
        previousUsage: u.pagesProcessedThisMonth,
        lastReset: u.processingResetAt?.toISOString() || 'Never',
      })),
    });
  } catch (error) {
    logger.error('ADMIN_QUOTAS', 'Error resetting quotas', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to reset quotas' },
      { status: 500 }
    );
  }
}

/**
 * Get quota reset status and next reset date
 */
export async function GET(request: Request) {
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
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      );
    }

    const now = new Date();
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Get users who haven't been reset this month
    const needsReset = await prisma.user.count({
      where: {
        processingResetAt: {
          lt: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      },
    });

    // Get total processing stats for this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const processingCosts = await prisma.processingCost.aggregate({
      where: {
        createdAt: {
          gte: monthStart,
        },
      },
      _sum: {
        pages: true,
        cost: true,
      },
      _count: {
        id: true,
      },
    });

    return NextResponse.json({
      currentMonth: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      nextResetDate: firstOfNextMonth.toISOString(),
      usersNeedingReset: needsReset,
      monthlyStats: {
        totalDocuments: processingCosts._count.id || 0,
        totalPages: processingCosts._sum.pages || 0,
        totalCost: processingCosts._sum.cost || 0,
      },
    });
  } catch (error) {
    logger.error('ADMIN_QUOTAS', 'Error getting quota status', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to get quota status' },
      { status: 500 }
    );
  }
}
