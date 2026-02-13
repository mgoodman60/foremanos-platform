/**
 * Document Processing Queue System
 * Handles large documents with batched processing and resumability
 */

import { prisma } from './db';
import { processDocumentBatch, type BatchResult } from './document-processor-batch';
import { triggerEnhancementAfterProcessing } from './project-data-enhancer';
import { ProcessingQueueStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { getFileUrl } from './s3';

export type ProcessingStatus = ProcessingQueueStatus;

export interface ProcessingQueueEntry {
  id: string;
  documentId: string;
  status: ProcessingStatus;
  totalPages: number;
  pagesProcessed: number;
  currentBatch: number;
  totalBatches: number;
  lastError?: string;
  retriesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Add document to processing queue
 */
export async function queueDocumentForProcessing(
  documentId: string,
  totalPages: number,
  batchSize: number = 1,
  processorType?: string
): Promise<void> {
  const totalBatches = Math.ceil(totalPages / batchSize);

  await prisma.processingQueue.create({
    data: {
      documentId,
      status: ProcessingQueueStatus.queued,
      totalPages,
      pagesProcessed: 0,
      currentBatch: 0,
      totalBatches,
      retriesCount: 0,
      metadata: {
        batchSize,
        processorType: processorType || 'vision-ai',
        queuedAt: new Date().toISOString(),
      },
    },
  });

  logger.info('PROCESS_QUEUE', `Document ${documentId} queued`, { totalPages, totalBatches, processorType: processorType || 'default' });
}

/**
 * Process next batch in queue
 */
export async function processNextQueuedBatch(): Promise<boolean> {
  // Reset any stale batches stuck in 'processing' before looking for work
  // This recovers documents stuck from previous timeouts
  const staleEntries = await prisma.processingQueue.findMany({
    where: { status: ProcessingQueueStatus.processing },
    select: { documentId: true },
  });
  for (const stale of staleEntries) {
    await resetStaleBatches(stale.documentId);
  }

  // Find next document to process
  // Note: We need to find entries where currentBatch < totalBatches
  // Since Prisma doesn't support column comparison, we fetch and filter
  const entries = await prisma.processingQueue.findMany({
    where: { status: ProcessingQueueStatus.queued },
    orderBy: { createdAt: 'asc' },
    take: 10, // Get first 10 to check
  });

  // Filter to find first entry with pending batches
  const entry = entries.find((e: any) => e.currentBatch < e.totalBatches);

  if (!entry) {
    logger.info('PROCESS_QUEUE', 'No documents in queue');
    return false;
  }

  try {
    // Atomic claim guard: prevent duplicate processing by concurrent workers
    const claimed = await prisma.processingQueue.updateMany({
      where: { id: entry.id, status: { not: ProcessingQueueStatus.processing } },
      data: { status: ProcessingQueueStatus.processing, updatedAt: new Date() },
    });
    if (claimed.count === 0) {
      logger.info('PROCESS_QUEUE', `Entry ${entry.id} already claimed by another process`);
      return false;
    }

    const metadata = entry.metadata as any;
    const batchSize = metadata?.batchSize || 1;
    const processorType = metadata?.processorType || 'vision-ai';
    const startPage = entry.currentBatch * batchSize + 1;
    const endPage = Math.min(startPage + batchSize - 1, entry.totalPages);

    logger.info('PROCESS_QUEUE', `Processing batch ${entry.currentBatch + 1}/${entry.totalBatches}`, { documentId: entry.documentId, startPage, endPage, processorType });

    // Process batch with smart routing based on document classification
    const result = await processDocumentBatch(
      entry.documentId,
      startPage,
      endPage,
      processorType
    );

    if (result.success) {
      // Update progress
      const newPagesProcessed = entry.pagesProcessed + result.pagesProcessed;
      const newCurrentBatch = entry.currentBatch + 1;
      const isComplete = newCurrentBatch >= entry.totalBatches;

      // Accumulate provider stats using shared helper
      const updatedProviderBreakdown = accumulateProviderStats(
        [result],
        metadata?.providerBreakdown || []
      );

      await prisma.processingQueue.update({
        where: { id: entry.id },
        data: {
          pagesProcessed: newPagesProcessed,
          currentBatch: newCurrentBatch,
          status: isComplete ? ProcessingQueueStatus.completed : ProcessingQueueStatus.queued,
          updatedAt: new Date(),
          metadata: {
            ...metadata,
            lastBatchAt: new Date().toISOString(),
            providerBreakdown: updatedProviderBreakdown,
          },
        },
      });

      if (isComplete) {
        logger.info('PROCESS_QUEUE', `Document ${entry.documentId} completed`, { pagesProcessed: newPagesProcessed, totalPages: entry.totalPages });
        await runPostProcessing(entry.documentId, newPagesProcessed);
      }

      return true; // Continue processing
    } else {
      // Handle failure
      const newRetries = entry.retriesCount + 1;
      const maxRetries = 3;

      if (newRetries >= maxRetries) {
        // Mark as failed after max retries
        await prisma.processingQueue.update({
          where: { id: entry.id },
          data: {
            status: ProcessingQueueStatus.failed,
            lastError: result.error,
            retriesCount: newRetries,
            updatedAt: new Date(),
          },
        });
        logger.error('PROCESS_QUEUE', `Document ${entry.documentId} failed after ${maxRetries} retries`);
      } else {
        // Retry later
        await prisma.processingQueue.update({
          where: { id: entry.id },
          data: {
            status: ProcessingQueueStatus.queued,
            lastError: result.error,
            retriesCount: newRetries,
            updatedAt: new Date(),
          },
        });
        logger.warn('PROCESS_QUEUE', `Batch failed, scheduling retry`, { documentId: entry.documentId, retry: newRetries, maxRetries });
      }

      return false; // Stop processing for now
    }
  } catch (error: any) {
    logger.error('PROCESS_QUEUE', 'Error processing batch', error, { documentId: entry.documentId });

    await prisma.processingQueue.update({
      where: { id: entry.id },
      data: {
        status: ProcessingQueueStatus.failed,
        lastError: error.message,
        updatedAt: new Date(),
      },
    });

    return false;
  }
}

/**
 * Get processing status for a document
 */
export async function getProcessingStatus(documentId: string): Promise<ProcessingQueueEntry | null> {
  const entry = await prisma.processingQueue.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });

  return entry as ProcessingQueueEntry | null;
}

/**
 * Resume failed processing
 */
export async function resumeFailedProcessing(documentId: string): Promise<void> {
  await prisma.processingQueue.updateMany({
    where: {
      documentId,
      status: ProcessingQueueStatus.failed,
    },
    data: {
      status: ProcessingQueueStatus.queued,
      retriesCount: 0,
      lastError: null,
      updatedAt: new Date(),
    },
  });

  logger.info('PROCESS_QUEUE', `Resumed processing for ${documentId}`);
}

/**
 * Reset stale batches that have been stuck in 'processing' status
 * This handles cases where a Vercel function timed out or the vision API hung
 */
async function resetStaleBatches(
  documentId: string,
  staleBatchTimeoutMs: number = 15 * 60 * 1000
): Promise<number> {
  const staleThreshold = new Date(Date.now() - staleBatchTimeoutMs);

  const result = await prisma.processingQueue.updateMany({
    where: {
      documentId,
      status: ProcessingQueueStatus.processing,
      updatedAt: { lt: staleThreshold },
    },
    data: {
      status: ProcessingQueueStatus.queued,
      updatedAt: new Date(),
    },
  });

  if (result.count > 0) {
    logger.warn('PROCESS_QUEUE', `Reset ${result.count} stale batch(es) for document ${documentId}`, {
      staleBatchTimeoutMs,
      thresholdTime: staleThreshold.toISOString(),
    });
  }

  return result.count;
}

/**
 * Consolidated post-processing: intelligence extraction, room extraction, takeoffs
 * Called once after all batches complete for a document
 *
 * @param skipProcessedCheck - When true, skip the CAS guard (for Trigger.dev path where processed flag is already set)
 */
export async function runPostProcessing(documentId: string, totalPagesProcessed: number, skipProcessedCheck: boolean = false): Promise<void> {
  // Atomic compare-and-swap: claim processing rights and prevent duplicate extraction
  // Skip this check when called from Trigger.dev (which already sets processed=true in its own transaction)
  if (!skipProcessedCheck) {
    const claimed = await prisma.document.updateMany({
      where: { id: documentId, processed: false },
      data: { processed: true, pagesProcessed: totalPagesProcessed },
    });

    if (claimed.count === 0) {
      logger.info('PROCESS_QUEUE', `Already processed, skipping post-processing for ${documentId}`);
      return;
    }
  } else {
    // Trigger.dev path: just update pagesProcessed if needed
    await prisma.document.update({
      where: { id: documentId },
      data: { pagesProcessed: totalPagesProcessed },
    });
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { Project: true },
  });

  if (!document?.Project?.slug) {
    logger.warn('PROCESS_QUEUE', `No project slug found for document ${documentId}, skipping post-processing`);
    return;
  }

  const projectSlug = document.Project.slug;

  // 1. Intelligence extraction (Phase A, B, C)
  try {
    logger.info('PROCESS_QUEUE', 'Starting intelligence extraction', { documentId });
    const { runIntelligenceExtraction } = await import('./intelligence-orchestrator');
    const extractionResult = await runIntelligenceExtraction({
      documentId,
      projectSlug,
      phases: ['A', 'B', 'C'],
    });
    logger.info('PROCESS_QUEUE', 'Intelligence extraction completed', { documentId, phasesRun: extractionResult.phasesRun });
  } catch (error) {
    logger.error('PROCESS_QUEUE', 'Intelligence extraction failed', error as Error, { documentId });
  }

  // 2. Room extraction (metadata-first, LLM fallback)
  try {
    logger.info('PROCESS_QUEUE', 'Starting room extraction (metadata-first)', { projectSlug, documentId });
    const { extractRoomsFromMetadata, extractRoomsFromDocuments, saveExtractedRooms } = await import('./room-extractor');

    // Try metadata extraction first (zero LLM calls)
    let rooms = await extractRoomsFromMetadata(projectSlug, documentId);
    let source = 'metadata';

    if (rooms.length === 0) {
      // Fall back to full LLM extraction
      logger.info('PROCESS_QUEUE', 'No rooms in metadata, falling back to LLM extraction', { projectSlug });
      const roomResult = await extractRoomsFromDocuments(projectSlug);
      rooms = roomResult.rooms;
      source = 'llm';
    }

    if (rooms.length > 0) {
      const saveResult = await saveExtractedRooms(projectSlug, rooms);
      logger.info('PROCESS_QUEUE', 'Room extraction complete', { source, created: saveResult.created, updated: saveResult.updated });
    } else {
      logger.info('PROCESS_QUEUE', 'No rooms found in documents');
    }
  } catch (error) {
    logger.error('PROCESS_QUEUE', 'Room extraction failed', error as Error, { documentId });
  }

  // 3. Auto-extract material takeoffs
  try {
    logger.info('PROCESS_QUEUE', 'Starting auto takeoff extraction');
    const { autoExtractTakeoffs } = await import('./takeoff-extractor');
    const proj = await prisma.project.findUnique({ where: { slug: projectSlug }, select: { id: true } });
    if (proj) {
      const takeoffResult = await autoExtractTakeoffs(proj.id, projectSlug);
      if (takeoffResult.success && takeoffResult.itemCount > 0) {
        logger.info('PROCESS_QUEUE', 'Takeoff extraction complete', { itemCount: takeoffResult.itemCount });
      } else {
        logger.info('PROCESS_QUEUE', 'No takeoff quantities extracted');
      }
    }
  } catch (error) {
    logger.error('PROCESS_QUEUE', 'Takeoff extraction failed', error as Error, { documentId });
  }
}

/**
 * Run all post-processing steps including intelligence extraction, rooms, takeoffs, and project enhancement
 * This is a wrapper that combines runPostProcessing + triggerEnhancementAfterProcessing
 *
 * @param skipProcessedCheck - When true, skip the CAS guard (for Trigger.dev path where processed flag is already set)
 */
export async function runDocumentPostProcessing(documentId: string, totalPagesProcessed: number, skipProcessedCheck: boolean = false): Promise<void> {
  // 1. Run intelligence extraction, room extraction, and takeoffs
  await runPostProcessing(documentId, totalPagesProcessed, skipProcessedCheck);

  // 2. Trigger project-wide data enhancement
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { Project: true },
  });

  if (document?.Project?.slug) {
    logger.info('PROCESS_QUEUE', `Triggering project data enhancement for ${document.Project.slug}`);
    triggerEnhancementAfterProcessing(document.Project.slug, document.name).catch(err => {
      logger.error('PROCESS_QUEUE', 'Project enhancement failed', err, { documentId });
    });
  }
}

/**
 * Download PDF buffer for a document
 */
export async function downloadDocumentPdf(documentId: string): Promise<Buffer> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { cloud_storage_path: true, isPublic: true },
  });

  if (!document?.cloud_storage_path) {
    throw new Error(`Document ${documentId} not found or has no cloud storage path`);
  }

  const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000); // 90s download timeout

  try {
    const response = await fetch(fileUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`PDF download failed with status ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Accumulate provider stats from batch results into a single breakdown array
 */
export function accumulateProviderStats(
  batchResults: BatchResult[],
  existingBreakdown: any[] = []
): any[] {
  const breakdown = [...existingBreakdown];

  for (const result of batchResults) {
    if (!result.providerStats) continue;

    for (const [providerName, stats] of Object.entries(result.providerStats)) {
      const existingIndex = breakdown.findIndex((p: any) => p.provider === providerName);

      if (existingIndex >= 0) {
        const existing = breakdown[existingIndex];
        const totalPages = existing.pagesProcessed + stats.pagesProcessed;
        const totalTime = (existing.pagesProcessed * existing.avgTimePerPage) + (stats.pagesProcessed * stats.avgTimePerPage);
        breakdown[existingIndex] = {
          provider: providerName,
          pagesProcessed: totalPages,
          avgTimePerPage: totalPages > 0 ? totalTime / totalPages : 0,
        };
      } else {
        breakdown.push({
          provider: providerName,
          pagesProcessed: stats.pagesProcessed,
          avgTimePerPage: stats.avgTimePerPage,
        });
      }
    }
  }

  return breakdown;
}

/**
 * Process next batch for a specific document (used by cron for single-batch resume)
 */
async function processNextBatchForDocument(documentId: string): Promise<boolean> {
  const entry = await prisma.processingQueue.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry || entry.currentBatch >= entry.totalBatches) {
    return false;
  }

  try {
    // Atomic claim guard: prevent duplicate processing by concurrent workers
    const claimed = await prisma.processingQueue.updateMany({
      where: { id: entry.id, status: { not: ProcessingQueueStatus.processing } },
      data: { status: ProcessingQueueStatus.processing, updatedAt: new Date() },
    });
    if (claimed.count === 0) {
      logger.info('PROCESS_QUEUE', `Entry ${entry.id} already claimed by another process`);
      return false;
    }

    const metadata = entry.metadata as any;
    const batchSize = metadata?.batchSize || 1;
    const processorType = metadata?.processorType || 'vision-ai';
    const startPage = entry.currentBatch * batchSize + 1;
    const endPage = Math.min(startPage + batchSize - 1, entry.totalPages);

    logger.info('PROCESS_QUEUE', `Processing batch ${entry.currentBatch + 1}/${entry.totalBatches}`, { documentId, startPage, endPage, processorType });

    // Process batch (no preloaded buffer — cron path downloads per batch)
    const result = await processDocumentBatch(documentId, startPage, endPage, processorType);

    if (result.success) {
      const newPagesProcessed = entry.pagesProcessed + result.pagesProcessed;
      const newCurrentBatch = entry.currentBatch + 1;
      const isComplete = newCurrentBatch >= entry.totalBatches;

      // Accumulate provider stats
      const updatedProviderBreakdown = accumulateProviderStats(
        [result],
        metadata?.providerBreakdown || []
      );

      await prisma.processingQueue.update({
        where: { id: entry.id },
        data: {
          pagesProcessed: newPagesProcessed,
          currentBatch: newCurrentBatch,
          status: isComplete ? ProcessingQueueStatus.completed : ProcessingQueueStatus.queued,
          updatedAt: new Date(),
          metadata: {
            ...metadata,
            lastBatchAt: new Date().toISOString(),
            providerBreakdown: updatedProviderBreakdown,
          },
        },
      });

      // Update document with progress
      await prisma.document.update({
        where: { id: documentId },
        data: {
          pagesProcessed: newPagesProcessed,
        },
      });

      if (isComplete) {
        logger.info('PROCESS_QUEUE', `All batches complete for ${documentId}`);
        await runPostProcessing(documentId, newPagesProcessed);
      }

      return true;
    } else {
      // Handle failure
      const newRetries = entry.retriesCount + 1;
      await prisma.processingQueue.update({
        where: { id: entry.id },
        data: {
          status: newRetries >= 3 ? ProcessingQueueStatus.failed : ProcessingQueueStatus.queued,
          lastError: result.error,
          retriesCount: newRetries,
          updatedAt: new Date(),
        },
      });
      return false;
    }
  } catch (error: any) {
    logger.error('PROCESS_QUEUE', `Error processing batch for ${documentId}`, error);

    await prisma.processingQueue.update({
      where: { id: entry.id },
      data: {
        status: ProcessingQueueStatus.failed,
        lastError: error.message,
        updatedAt: new Date(),
      },
    });

    return false;
  }
}
