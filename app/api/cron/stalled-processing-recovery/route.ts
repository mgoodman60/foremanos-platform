import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ProcessingQueueStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { getCached, setCached } from '@/lib/redis';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processDocumentTask } from '@/src/trigger/process-document';

export const dynamic = 'force-dynamic';

const STALL_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('CRON_STALLED_RECOVERY', 'Cron auth failed', {
        hasCronSecret: !!cronSecret,
        hasAuthHeader: !!authHeader,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Idempotency lock: prevent concurrent execution (10-minute TTL auto-expires if job crashes)
    const lockKey = 'cron:stalled-recovery:lock';
    const existingLock = await getCached<string>(lockKey);
    if (existingLock) {
      logger.info('CRON_STALLED_RECOVERY', 'Cron job already running, skipping');
      return NextResponse.json({ status: 'skipped', reason: 'already_running' });
    }
    await setCached(lockKey, Date.now().toString(), 600);

    try {
      const stalledThreshold = new Date(Date.now() - STALL_THRESHOLD_MS);

      // Find processing queue entries that have been stuck in 'processing' for too long
      const stalledEntries = await prisma.processingQueue.findMany({
        where: {
          status: ProcessingQueueStatus.processing,
          updatedAt: { lt: stalledThreshold },
        },
        include: {
          Document: {
            select: {
              id: true,
              name: true,
              processorType: true,
            },
          },
        },
      });

      if (stalledEntries.length === 0) {
        logger.info('CRON_STALLED_RECOVERY', 'No stalled entries found');
        return NextResponse.json({ success: true, recovered: 0 });
      }

      logger.info('CRON_STALLED_RECOVERY', `Found ${stalledEntries.length} stalled entries`, {
        entries: stalledEntries.map(e => ({
          id: e.id,
          documentId: e.documentId,
          updatedAt: e.updatedAt.toISOString(),
        })),
      });

      let recovered = 0;
      const errors: { documentId: string; error: string }[] = [];

      for (const entry of stalledEntries) {
        try {
          const documentId = entry.documentId;
          // totalPages lives on ProcessingQueue (not on Document)
          const totalPages = entry.totalPages || 1;
          // processorType only exists on Document (not on ProcessingQueue)
          const processorType = entry.Document?.processorType || 'vision-ai';

          // Reset queue and document status
          await prisma.$transaction([
            prisma.processingQueue.update({
              where: { id: entry.id },
              data: {
                status: ProcessingQueueStatus.queued,
                updatedAt: new Date(),
              },
            }),
            prisma.document.update({
              where: { id: documentId },
              data: {
                queueStatus: 'queued',
                lastProcessingError: null,
              },
            }),
          ]);

          // Re-trigger Trigger.dev task
          const handle = await tasks.trigger<typeof processDocumentTask>('process-document', {
            documentId,
            totalPages,
            processorType,
          });

          logger.info('CRON_STALLED_RECOVERY', `Recovered stalled document`, {
            documentId,
            documentName: entry.Document?.name,
            runId: handle.id,
            stalledSince: entry.updatedAt.toISOString(),
          });

          recovered++;
        } catch (entryError: unknown) {
          const errorMsg = entryError instanceof Error ? entryError.message : String(entryError);
          logger.error('CRON_STALLED_RECOVERY', `Failed to recover entry`, entryError as Error, {
            entryId: entry.id,
            documentId: entry.documentId,
          });
          errors.push({ documentId: entry.documentId, error: errorMsg });
        }
      }

      logger.info('CRON_STALLED_RECOVERY', `Recovery complete`, {
        total: stalledEntries.length,
        recovered,
        failed: errors.length,
      });

      return NextResponse.json({
        success: true,
        total: stalledEntries.length,
        recovered,
        errors: errors.length > 0 ? errors : undefined,
      });
    } finally {
      // Release lock
      setCached(lockKey, '', 1).catch(() => {});
    }
  } catch (error) {
    logger.error('CRON_STALLED_RECOVERY', 'Stalled processing recovery failed', error as Error);
    return NextResponse.json({ error: 'Recovery failed' }, { status: 500 });
  }
}
