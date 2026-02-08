import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { processNextQueuedBatch } from '@/lib/document-processing-queue';
import { recoverAllOrphanedDocuments } from '@/lib/orphaned-document-recovery';
import { prisma } from '@/lib/db';
import { ProcessingQueueStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Admin endpoint to manually trigger queue processing
 * Can be called by cron job or manually
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow admin users or check for internal cron secret
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('secret');
    
    const isAdmin = session?.user?.role === 'admin';
    const isValidCron = cronSecret === process.env.CRON_SECRET;
    
    if (!isAdmin && !isValidCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('PROCESS_QUEUE', 'Manual queue processing triggered');

    // Recover stuck/orphaned documents first
    try {
      const recovered = await recoverAllOrphanedDocuments();
      if (recovered > 0) {
        logger.info('PROCESS_QUEUE', `Recovered ${recovered} orphaned documents`);
      }
    } catch (recoveryError) {
      logger.error('PROCESS_QUEUE', 'Orphan recovery error (non-blocking)', recoveryError as Error);
    }

    // Reset stale 'processing' documents (stuck for >30 min)
    // Increased from 10 min because intelligence extraction now completes before marking done
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const staleReset = await prisma.document.updateMany({
        where: {
          queueStatus: 'processing',
          processed: false,
          updatedAt: { lt: thirtyMinutesAgo },
        },
        data: { queueStatus: 'pending' },
      });
      if (staleReset.count > 0) {
        logger.info('PROCESS_QUEUE', `Reset ${staleReset.count} stale processing documents`);
      }

      // Also reset stale ProcessingQueue entries to resume from where they left off
      await prisma.processingQueue.updateMany({
        where: {
          status: ProcessingQueueStatus.processing,
          updatedAt: { lt: thirtyMinutesAgo },
        },
        data: {
          status: ProcessingQueueStatus.queued,
        },
      });
    } catch (staleError) {
      logger.error('PROCESS_QUEUE', 'Stale reset error (non-blocking)', staleError as Error);
    }

    // Process batches until queue is empty or error occurs
    let totalProcessed = 0;
    let continueProcessing = true;
    const maxIterations = 10; // Process max 10 batches per call
    let iterations = 0;

    while (continueProcessing && iterations < maxIterations) {
      continueProcessing = await processNextQueuedBatch();
      if (continueProcessing) {
        totalProcessed++;
      }
      iterations++;
    }

    return NextResponse.json({
      success: true,
      batchesProcessed: totalProcessed,
      message: `Processed ${totalProcessed} batches`,
    });
  } catch (error: any) {
    logger.error('PROCESS_QUEUE', 'Queue processing error', error);
    return NextResponse.json(
      { error: 'Failed to process queue', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get queue statistics or process queue (when called by Vercel cron)
 */
export async function GET(request: Request) {
  try {
    // Check if this is a Vercel cron invocation
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (isCronRequest) {
      // Cron invocation: process the queue
      logger.info('PROCESS_QUEUE', 'Cron-triggered queue processing');

      // Recover stuck/orphaned documents first
      try {
        const recovered = await recoverAllOrphanedDocuments();
        if (recovered > 0) {
          logger.info('PROCESS_QUEUE', `Recovered ${recovered} orphaned documents`);
        }
      } catch (recoveryError) {
        logger.error('PROCESS_QUEUE', 'Orphan recovery error (non-blocking)', recoveryError as Error);
      }

      // Reset stale 'processing' documents (stuck for >30 min)
      // Increased from 10 min because intelligence extraction now completes before marking done
      try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const staleReset = await prisma.document.updateMany({
          where: {
            queueStatus: 'processing',
            processed: false,
            updatedAt: { lt: thirtyMinutesAgo },
          },
          data: { queueStatus: 'pending' },
        });
        if (staleReset.count > 0) {
          logger.info('PROCESS_QUEUE', `Reset ${staleReset.count} stale processing documents`);
        }

        // Also reset stale ProcessingQueue entries to resume from where they left off
        await prisma.processingQueue.updateMany({
          where: {
            status: ProcessingQueueStatus.processing,
            updatedAt: { lt: thirtyMinutesAgo },
          },
          data: {
            status: ProcessingQueueStatus.queued,
          },
        });
      } catch (staleError) {
        logger.error('PROCESS_QUEUE', 'Stale reset error (non-blocking)', staleError as Error);
      }

      let totalProcessed = 0;
      let continueProcessing = true;
      const maxIterations = 10;
      let iterations = 0;

      while (continueProcessing && iterations < maxIterations) {
        continueProcessing = await processNextQueuedBatch();
        if (continueProcessing) {
          totalProcessed++;
        }
        iterations++;
      }

      return NextResponse.json({
        success: true,
        batchesProcessed: totalProcessed,
        message: `Cron processed ${totalProcessed} batches`,
      });
    }

    // Non-cron: return stats (requires admin auth)
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await prisma.processingQueue.groupBy({
      by: ['status'],
      _count: true,
    });

    return NextResponse.json({ stats });
  } catch (error: any) {
    logger.error('PROCESS_QUEUE', 'Queue stats error', error);
    return NextResponse.json(
      { error: 'Failed to get queue stats' },
      { status: 500 }
    );
  }
}
