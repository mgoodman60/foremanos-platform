/**
 * Trigger.dev Document Processing Task
 *
 * Processes construction documents (PDFs) through vision AI extraction pipeline.
 * Handles long-running document processing (up to 1 hour) with per-page progress tracking.
 *
 * Replaces Vercel serverless timeout workarounds (QStash, cron) with native long-running tasks.
 */

import { task, logger as triggerLogger } from "@trigger.dev/sdk/v3";
import { processDocumentBatch } from "@/lib/document-processor-batch";
import {
  downloadDocumentPdf,
  queueDocumentForProcessing,
  accumulateProviderStats,
  runDocumentPostProcessing
} from "@/lib/document-processing-queue";
import { prisma } from "@/lib/db";
import { ProcessingQueueStatus } from "@prisma/client";
import { logger } from "@/lib/logger";

interface ProcessDocumentPayload {
  documentId: string;
  totalPages: number;
  processorType?: string;
  batchSize?: number;
}

export const processDocumentTask = task({
  id: "process-document",
  maxDuration: 7200, // 2 hours max — enough for 100+ page documents at ~60s/page (Opus 600s timeout)
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: ProcessDocumentPayload) => {
    const { documentId, totalPages, processorType = 'vision-ai', batchSize = 1 } = payload;

    triggerLogger.log(`Starting document processing`, { documentId, totalPages, processorType });
    logger.info('TRIGGER_PROCESS', `Task started for document ${documentId}`, { totalPages, processorType });

    // 0. Verify document still exists (may have been deleted while queued)
    const docCheck = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true } });
    if (!docCheck) {
      triggerLogger.warn(`Document ${documentId} not found (deleted?), skipping`, { documentId });
      logger.warn('TRIGGER_PROCESS', `Document not found, aborting`, { documentId });
      return { documentId, pagesProcessed: 0, totalPages, status: 'cancelled' as const };
    }

    try {
      // 1. Create ProcessingQueue entry if not exists
      const existingEntry = await prisma.processingQueue.findFirst({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
      });

      if (!existingEntry || existingEntry.status === ProcessingQueueStatus.failed) {
        await queueDocumentForProcessing(documentId, totalPages, batchSize, processorType);
        triggerLogger.log(`Queue entry created`, { documentId });
      }

      // Get the queue entry for tracking
      const queueEntry = await prisma.processingQueue.findFirst({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
      });

      if (!queueEntry) {
        throw new Error(`Failed to create queue entry for document ${documentId}`);
      }

      // 2. Set document and queue status to processing
      await prisma.$transaction([
        prisma.document.update({
          where: { id: documentId },
          data: { queueStatus: 'processing' },
        }),
        prisma.processingQueue.update({
          where: { id: queueEntry.id },
          data: {
            status: ProcessingQueueStatus.processing,
            updatedAt: new Date(),
          },
        }),
      ]);

      // 3. Download PDF from R2 (once, reuse for all pages)
      triggerLogger.log(`Downloading PDF`, { documentId });
      const pdfBuffer = await downloadDocumentPdf(documentId);
      const fileSizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(1);
      triggerLogger.log(`PDF downloaded: ${fileSizeMB}MB`, { documentId });
      logger.info('TRIGGER_PROCESS', `PDF downloaded`, { documentId, sizeMB: fileSizeMB });

      // 4. Process each page sequentially with progress tracking
      let pagesProcessed = 0;
      let providerBreakdown: any[] = [];
      const metadata = queueEntry.metadata as any;
      const errors: { page: number; error: string }[] = [];

      for (let page = 1; page <= totalPages; page++) {
        try {
          triggerLogger.log(`Processing page ${page}/${totalPages}`, { documentId });

          const result = await processDocumentBatch(
            documentId,
            page,
            page,
            processorType,
            pdfBuffer
          );

          if (result.success) {
            pagesProcessed += result.pagesProcessed;
            providerBreakdown = accumulateProviderStats([result], providerBreakdown);

            // Update progress in DB after each page
            await prisma.$transaction([
              prisma.document.update({
                where: { id: documentId },
                data: { pagesProcessed },
              }),
              prisma.processingQueue.update({
                where: { id: queueEntry.id },
                data: {
                  pagesProcessed,
                  currentBatch: page,
                  updatedAt: new Date(),
                  metadata: {
                    ...metadata,
                    providerBreakdown,
                    lastBatchAt: new Date().toISOString(),
                  },
                },
              }),
            ]);

            // Update cost incrementally
            if (result.estimatedCost && result.estimatedCost > 0) {
              await prisma.document.update({
                where: { id: documentId },
                data: { processingCost: { increment: result.estimatedCost } },
              });
            }

            triggerLogger.log(`Page ${page} completed`, {
              documentId,
              pagesProcessed,
              cost: result.estimatedCost,
            });
          } else {
            // Log error but continue to next page
            const errorMsg = result.error || 'Unknown error';
            errors.push({ page, error: errorMsg });
            logger.warn('TRIGGER_PROCESS', `Page ${page} failed, continuing`, {
              documentId,
              error: errorMsg,
            });
            triggerLogger.warn(`Page ${page} failed: ${errorMsg}`, { documentId });
          }
        } catch (pageError: any) {
          // Log error and continue to next page
          const errorMsg = pageError.message || String(pageError);
          errors.push({ page, error: errorMsg });
          logger.error('TRIGGER_PROCESS', `Page ${page} processing error`, pageError, { documentId });
          triggerLogger.error(`Page ${page} error: ${errorMsg}`, { documentId });
        }
      }

      // 5. Determine final status
      const hasErrors = errors.length > 0;
      const allPagesFailed = errors.length === totalPages;
      const finalStatus = allPagesFailed
        ? ProcessingQueueStatus.failed
        : ProcessingQueueStatus.completed;

      triggerLogger.log(`Processing finished`, {
        documentId,
        pagesProcessed,
        totalPages,
        errors: errors.length,
        status: finalStatus,
      });

      // 6. Mark completed/failed in database
      await prisma.$transaction([
        prisma.processingQueue.update({
          where: { id: queueEntry.id },
          data: {
            status: finalStatus,
            pagesProcessed: totalPages,
            currentBatch: totalPages,
            updatedAt: new Date(),
            lastError: hasErrors
              ? `${errors.length} page(s) failed: ${errors.slice(0, 3).map(e => `p${e.page}: ${e.error}`).join('; ')}`
              : null,
            metadata: {
              ...metadata,
              providerBreakdown,
              completedAt: new Date().toISOString(),
              errors: hasErrors ? errors : undefined,
            },
          },
        }),
        prisma.document.update({
          where: { id: documentId },
          data: {
            queueStatus: allPagesFailed ? 'failed' : 'completed',
            processedAt: new Date(),
            pagesProcessed: totalPages,
            processed: true,
            lastProcessingError: allPagesFailed
              ? `All ${totalPages} pages failed`
              : hasErrors
                ? `${errors.length} of ${totalPages} pages failed`
                : null,
          },
        }),
      ]);

      // 7. Run post-processing (intelligence extraction, rooms, takeoffs, project enhancement)
      // Only run if we successfully processed at least some pages
      if (!allPagesFailed) {
        try {
          triggerLogger.log(`Running post-processing`, { documentId });
          logger.info('TRIGGER_PROCESS', `Starting post-processing`, { documentId });

          await runDocumentPostProcessing(documentId, pagesProcessed);

          triggerLogger.log(`Post-processing completed`, { documentId });
          logger.info('TRIGGER_PROCESS', `Post-processing completed`, { documentId });
        } catch (postError: any) {
          // Log but don't fail the task — vision extraction succeeded
          logger.error('TRIGGER_PROCESS', `Post-processing failed`, postError, { documentId });
          triggerLogger.error(`Post-processing failed: ${postError.message}`, { documentId });
        }
      }

      // 8. Return summary
      return {
        documentId,
        pagesProcessed,
        totalPages,
        status: finalStatus,
        errors: errors.length > 0 ? errors : undefined,
      };

    } catch (error: any) {
      // Fatal error — mark document and queue as failed
      logger.error('TRIGGER_PROCESS', `Fatal error processing document`, error, { documentId });
      triggerLogger.error(`Fatal error: ${error.message}`, { documentId });

      try {
        await prisma.$transaction([
          prisma.processingQueue.updateMany({
            where: { documentId },
            data: {
              status: ProcessingQueueStatus.failed,
              lastError: error.message || String(error),
              updatedAt: new Date(),
            },
          }),
          prisma.document.update({
            where: { id: documentId },
            data: {
              queueStatus: 'failed',
              lastProcessingError: error.message || String(error),
            },
          }),
        ]);
      } catch (dbError: any) {
        // P2025 = record not found (document was deleted mid-processing)
        if (dbError?.code === 'P2025' || dbError?.code === 'P2003') {
          logger.warn('TRIGGER_PROCESS', `Document deleted during processing, skipping DB update`, { documentId });
          triggerLogger.warn(`Document deleted mid-processing, exiting cleanly`, { documentId });
          return { documentId, pagesProcessed: 0, totalPages, status: 'cancelled' as const };
        }
        logger.error('TRIGGER_PROCESS', `Failed to update database after error`, dbError as Error, { documentId });
      }

      // Re-throw so Trigger.dev can retry if configured
      throw error;
    }
  },
});
