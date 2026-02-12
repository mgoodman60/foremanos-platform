import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { processQueuedDocument } from '@/lib/document-processing-queue';
import { recoverAllOrphanedDocuments } from '@/lib/orphaned-document-recovery';
import { prisma } from '@/lib/db';
import { ProcessingQueueStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes (Vercel Pro max: 800s; queue runs every 5 min via cron)

// Must be less than staleBatchTimeoutMs (5min) to avoid resetting active batches
const STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes — with sequential processing, batches complete in <60s

/**
 * Reset stale documents and queue entries stuck in 'processing' state.
 * Returns count of reset documents.
 */
async function resetStaleEntries(): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
  let resetCount = 0;

  // Reset stale Document records
  const staleReset = await prisma.document.updateMany({
    where: {
      queueStatus: 'processing',
      processed: false,
      updatedAt: { lt: staleThreshold },
    },
    data: { queueStatus: 'queued' },
  });
  resetCount += staleReset.count;
  if (staleReset.count > 0) {
    logger.info('PROCESS_QUEUE', `Reset ${staleReset.count} stale processing documents`);
  }

  // Reset stale ProcessingQueue entries to resume from where they left off
  const queueReset = await prisma.processingQueue.updateMany({
    where: {
      status: ProcessingQueueStatus.processing,
      updatedAt: { lt: staleThreshold },
    },
    data: {
      status: ProcessingQueueStatus.queued,
      updatedAt: new Date(),
    },
  });
  if (queueReset.count > 0) {
    logger.info('PROCESS_QUEUE', `Reset ${queueReset.count} stale queue entries`);
  }

  return resetCount;
}

/**
 * Process all queued documents using concurrent batch dispatch.
 * Returns total documents processed.
 */
async function processQueuedDocuments(): Promise<number> {
  // Find all queued documents (not already processing)
  const queuedEntries = await prisma.processingQueue.findMany({
    where: {
      status: ProcessingQueueStatus.queued,
    },
    orderBy: { createdAt: 'asc' },
    take: 5, // Process up to 5 documents per cron invocation
    select: { documentId: true, id: true, currentBatch: true, totalBatches: true },
  });

  // Filter to entries with pending batches
  const pendingEntries = queuedEntries.filter(e => e.currentBatch < e.totalBatches);

  if (pendingEntries.length === 0) {
    logger.info('PROCESS_QUEUE', 'No documents in queue');
    return 0;
  }

  logger.info('PROCESS_QUEUE', `Processing ${pendingEntries.length} queued document(s)`, {
    documentIds: pendingEntries.map(e => e.documentId),
  });

  let processed = 0;

  // Process documents sequentially (each one uses concurrent batches internally)
  // Sequential across documents prevents overloading the vision API
  for (const entry of pendingEntries) {
    try {
      // processQueuedDocument uses concurrent batch dispatch (3 at a time)
      // with a 270s max duration and built-in heartbeat
      await processQueuedDocument(entry.documentId);
      processed++;
    } catch (error) {
      logger.error('PROCESS_QUEUE', `Failed to process document ${entry.documentId}`, error as Error);
      // Continue with next document
    }
  }

  return processed;
}

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
    const isContinuation = request.headers.get('x-continuation') === 'true';

    if (!isAdmin && !isValidCron && !isContinuation) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('PROCESS_QUEUE', isContinuation ? 'Continuation-triggered queue processing' : 'Manual queue processing triggered');

    // Recover stuck/orphaned documents first
    try {
      const recovered = await recoverAllOrphanedDocuments();
      if (recovered > 0) {
        logger.info('PROCESS_QUEUE', `Recovered ${recovered} orphaned documents`);
      }
    } catch (recoveryError) {
      logger.error('PROCESS_QUEUE', 'Orphan recovery error (non-blocking)', recoveryError as Error);
    }

    // Reset stale entries
    try {
      await resetStaleEntries();
    } catch (staleError) {
      logger.error('PROCESS_QUEUE', 'Stale reset error (non-blocking)', staleError as Error);
    }

    // Process queued documents with concurrent batch dispatch
    const totalProcessed = await processQueuedDocuments();

    return NextResponse.json({
      success: true,
      documentsProcessed: totalProcessed,
      message: `Processed ${totalProcessed} document(s)`,
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
    if (!cronSecret) {
      logger.warn('PROCESS_QUEUE', 'CRON_SECRET not set — cron queue processing disabled');
    }
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

      // Reset stale entries
      try {
        await resetStaleEntries();
      } catch (staleError) {
        logger.error('PROCESS_QUEUE', 'Stale reset error (non-blocking)', staleError as Error);
      }

      // Process queued documents with concurrent batch dispatch
      const totalProcessed = await processQueuedDocuments();

      return NextResponse.json({
        success: true,
        documentsProcessed: totalProcessed,
        message: `Cron processed ${totalProcessed} document(s)`,
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
