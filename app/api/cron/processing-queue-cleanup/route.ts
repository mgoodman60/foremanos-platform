import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ProcessingQueueStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('CRON_QUEUE_CLEANUP', 'Cron auth failed', { hasCronSecret: !!cronSecret, hasAuthHeader: !!authHeader });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await prisma.processingQueue.deleteMany({
      where: {
        status: { in: [ProcessingQueueStatus.completed, ProcessingQueueStatus.failed] },
        updatedAt: { lt: thirtyDaysAgo },
      },
    });

    logger.info('CRON_QUEUE_CLEANUP', `Deleted ${result.count} old processing queue entries`, {
      deletedCount: result.count,
      threshold: thirtyDaysAgo.toISOString(),
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      threshold: thirtyDaysAgo.toISOString(),
    });
  } catch (error) {
    logger.error('CRON_QUEUE_CLEANUP', 'Failed to clean up processing queue', error as Error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
