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
 * Run concurrency-limited parallel tasks
 * Executes up to maxConcurrency tasks simultaneously, queueing the rest
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  const executing: Set<Promise<void>> = new Set();
  let index = 0;
  let aborted = false;

  for (const task of tasks) {
    if (aborted) {
      // Skip remaining tasks — one already triggered timeout continuation
      results[index] = { status: 'rejected', reason: new Error('Skipped — earlier batch triggered timeout') };
      index++;
      continue;
    }

    const i = index++;
    const p = task().then(
      (value) => { results[i] = { status: 'fulfilled', value }; },
      (reason) => {
        results[i] = { status: 'rejected', reason };
        // If this was a timeout error, abort remaining tasks
        if (reason?.message?.includes('continuation scheduled')) {
          aborted = true;
        }
      }
    ).finally(() => executing.delete(p));
    executing.add(p);

    if (executing.size >= maxConcurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
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
 * Process all batches for a specific document using concurrent dispatch
 * Downloads the PDF once, then fires batches in parallel up to maxConcurrency
 */
export async function processQueuedDocument(
  documentId: string,
  maxDurationMs: number = 240000,
  maxConcurrency: number = 1,
  staleBatchTimeoutMs: number = 5 * 60 * 1000,
  preloadedPdfBuffer?: Buffer
): Promise<void> {
  const startTime = Date.now();
  logger.info('PROCESS_QUEUE', `Starting concurrent processing for document ${documentId}`, { maxConcurrency, staleBatchTimeoutMs });

  // Task 12 fix: Reset any stale batches stuck in 'processing' from previous timeouts
  await resetStaleBatches(documentId, staleBatchTimeoutMs);

  // Find the queue entry for this document
  const entry = await prisma.processingQueue.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) {
    logger.error('PROCESS_QUEUE', `No queue entry found for document ${documentId}`);
    return;
  }

  // Check if already completed or failed
  if (entry.status === ProcessingQueueStatus.completed || entry.status === ProcessingQueueStatus.failed) {
    logger.info('PROCESS_QUEUE', `Document ${documentId} already in terminal state: ${entry.status}`);
    return;
  }

  // Check if all batches are already done
  if (entry.currentBatch >= entry.totalBatches) {
    logger.info('PROCESS_QUEUE', `All batches already processed for ${documentId}`);
    return;
  }

  // Atomic claim: set to processing to prevent concurrent processQueuedDocument calls
  const claimed = await prisma.processingQueue.updateMany({
    where: { id: entry.id, status: { not: ProcessingQueueStatus.processing } },
    data: { status: ProcessingQueueStatus.processing, updatedAt: new Date() },
  });
  if (claimed.count === 0) {
    logger.info('PROCESS_QUEUE', `Document ${documentId} already being processed by another worker`);
    return;
  }

  // Mark document as processing
  await prisma.document.update({
    where: { id: documentId },
    data: { queueStatus: 'processing' },
  });

  const metadata = entry.metadata as any;
  const batchSize = metadata?.batchSize || 1;
  const processorType = metadata?.processorType || 'vision-ai';

  // Heartbeat: periodically update updatedAt so stale-batch recovery doesn't reset us
  const heartbeatIntervalMs = 60 * 1000; // Every 60 seconds
  const heartbeatTimer = setInterval(async () => {
    try {
      await prisma.processingQueue.update({
        where: { id: entry.id },
        data: { updatedAt: new Date() },
      });
      logger.info('PROCESS_QUEUE', `Heartbeat for ${documentId}`, { elapsed: Math.round((Date.now() - startTime) / 1000) });
    } catch (heartbeatError) {
      // Non-fatal: heartbeat failure shouldn't stop processing
      logger.warn('PROCESS_QUEUE', 'Heartbeat update failed', {
        documentId,
        error: (heartbeatError as Error).message,
        elapsed: Math.round((Date.now() - startTime) / 1000),
      });
    }
  }, heartbeatIntervalMs);

  try {
    // Use preloaded buffer if provided, otherwise download PDF ONCE upfront and share across all batches
    const pdfBuffer = preloadedPdfBuffer || await downloadDocumentPdf(documentId);
    if (preloadedPdfBuffer) {
      logger.info('PROCESS_QUEUE', `Using preloaded PDF buffer for ${documentId} (${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
    } else {
      logger.info('PROCESS_QUEUE', `Downloaded PDF for ${documentId} (${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
    }

    // Check if download consumed most of the time budget
    const downloadDurationMs = Date.now() - startTime;
    const remainingMs = maxDurationMs - downloadDurationMs;
    if (remainingMs < 60000) {
      logger.warn('PROCESS_QUEUE', `PDF download consumed ${Math.round(downloadDurationMs / 1000)}s — insufficient time for batch processing, scheduling continuation`, {
        documentId,
        downloadDurationMs,
        remainingMs,
        pdfSizeMB: (pdfBuffer.length / 1024 / 1024).toFixed(1),
      });

      // Set back to queued so QStash continuation picks it up
      await prisma.$transaction([
        prisma.processingQueue.update({
          where: { id: entry.id },
          data: {
            status: ProcessingQueueStatus.queued,
            lastError: `PDF download took ${Math.round(downloadDurationMs / 1000)}s — will resume in next invocation`,
            updatedAt: new Date(),
          },
        }),
        prisma.document.update({
          where: { id: documentId },
          data: { queueStatus: 'queued' },
        }),
      ]);

      await scheduleProcessingContinuation(documentId);
      return; // Clean exit — QStash will re-invoke processQueuedDocument
    }

    // Calculate ALL remaining batch ranges upfront
    const batchRanges: { batchIndex: number; startPage: number; endPage: number }[] = [];
    for (let batch = entry.currentBatch; batch < entry.totalBatches; batch++) {
      const startPage = batch * batchSize + 1;
      const endPage = Math.min(startPage + batchSize - 1, entry.totalPages);
      batchRanges.push({ batchIndex: batch, startPage, endPage });
    }

    logger.info('PROCESS_QUEUE', `Dispatching ${batchRanges.length} batches concurrently (max ${maxConcurrency})`, {
      documentId,
      batchRanges: batchRanges.map(b => `${b.startPage}-${b.endPage}`),
    });

    // Create task functions for each batch, with incremental progress updates
    const batchTasks = batchRanges.map((range) => {
      return async (): Promise<{ batchIndex: number; result: BatchResult }> => {
        // Check timeout before starting each batch
        if (Date.now() - startTime > maxDurationMs) {
          throw new Error(`Approaching timeout after ${Math.round((Date.now() - startTime) / 1000)}s — continuation scheduled`);
        }

        const result = await processDocumentBatch(
          documentId,
          range.startPage,
          range.endPage,
          processorType,
          pdfBuffer
        );

        // Incremental progress update: write pagesProcessed to DB as each batch completes
        // This prevents the UI from showing "Scanning 0 pages" during long concurrent runs
        if (result.success && result.pagesProcessed > 0) {
          try {
            await prisma.$executeRawUnsafe(
              `UPDATE "ProcessingQueue" SET "pagesProcessed" = LEAST("pagesProcessed" + $1, "totalPages"), "currentBatch" = LEAST("currentBatch" + 1, "totalBatches"), "updatedAt" = NOW() WHERE id = $2`,
              result.pagesProcessed,
              entry.id
            );
            await prisma.$executeRawUnsafe(
              `UPDATE "Document" SET "pagesProcessed" = LEAST("pagesProcessed" + $1, $2) WHERE id = $3`,
              result.pagesProcessed,
              entry.totalPages,
              documentId
            );
            logger.info('PROCESS_QUEUE', `Batch ${range.batchIndex + 1} progress saved`, {
              documentId,
              batchPages: result.pagesProcessed,
              pageRange: `${range.startPage}-${range.endPage}`,
            });
          } catch (progressError) {
            logger.warn('PROCESS_QUEUE', 'Incremental progress update failed', {
              documentId,
              batchIndex: range.batchIndex,
              error: (progressError as Error).message,
            });
          }
        }

        // Update processing cost incrementally
        if (result.estimatedCost && result.estimatedCost > 0) {
          try {
            await prisma.document.update({
              where: { id: documentId },
              data: {
                processingCost: { increment: result.estimatedCost }
              }
            });
          } catch (costError) {
            logger.warn('PROCESS_QUEUE', 'Failed to update processing cost', { documentId, cost: result.estimatedCost });
          }
        }

        return { batchIndex: range.batchIndex, result };
      };
    });

    // Run batches with concurrency limit
    const settledResults = await runWithConcurrency(batchTasks, maxConcurrency);

    // Aggregate results
    let totalPagesProcessed = entry.pagesProcessed;
    let highestCompletedBatch = entry.currentBatch;
    const successfulResults: BatchResult[] = [];
    const failedBatches: { batchIndex: number; error: string }[] = [];

    for (const settled of settledResults) {
      if (settled.status === 'fulfilled') {
        const { batchIndex, result } = settled.value;
        if (result.success) {
          totalPagesProcessed += result.pagesProcessed;
          successfulResults.push(result);
          if (batchIndex + 1 > highestCompletedBatch) {
            highestCompletedBatch = batchIndex + 1;
          }
        } else {
          failedBatches.push({
            batchIndex,
            error: result.error || 'Unknown batch error',
          });
        }
      } else {
        // Promise was rejected (timeout or unexpected error)
        const reason = settled.reason?.message || String(settled.reason);
        failedBatches.push({
          batchIndex: -1, // Unknown which batch failed
          error: reason,
        });
      }
    }

    // Schedule ONE continuation if any batches timed out
    const timeoutBatches = failedBatches.filter(f =>
      f.error.includes('continuation scheduled') || f.error.includes('Skipped')
    );
    const realFailures = failedBatches.filter(f =>
      !f.error.includes('continuation scheduled') && !f.error.includes('Skipped')
    );

    if (timeoutBatches.length > 0) {
      logger.info('PROCESS_QUEUE', `${timeoutBatches.length} batch(es) timed out, scheduling single continuation`, {
        documentId,
        successfulBatches: successfulResults.length,
        timedOutBatches: timeoutBatches.length,
        realFailures: realFailures.length,
      });

      await prisma.$transaction([
        prisma.processingQueue.update({
          where: { id: entry.id },
          data: { status: ProcessingQueueStatus.queued, updatedAt: new Date() },
        }),
        prisma.document.update({
          where: { id: documentId },
          data: { queueStatus: 'queued' },
        }),
      ]);

      await scheduleProcessingContinuation(documentId);
    }

    // Accumulate provider stats from all successful batches
    const currentProviderBreakdown = metadata?.providerBreakdown || [];
    const updatedProviderBreakdown = accumulateProviderStats(successfulResults, currentProviderBreakdown);

    const isComplete = realFailures.length === 0 && timeoutBatches.length === 0 && highestCompletedBatch >= entry.totalBatches;
    const isTimeoutOnly = timeoutBatches.length > 0 && realFailures.length === 0;

    logger.info('PROCESS_QUEUE', `Batch dispatch complete for ${documentId}`, {
      succeeded: successfulResults.length,
      failed: failedBatches.length,
      timeoutBatches: timeoutBatches.length,
      realFailures: realFailures.length,
      totalPagesProcessed,
      isComplete,
      isTimeoutOnly,
    });

    // Determine final status
    let finalStatus: ProcessingQueueStatus;
    if (isComplete) {
      finalStatus = ProcessingQueueStatus.completed;
    } else if (isTimeoutOnly) {
      finalStatus = ProcessingQueueStatus.queued; // Timeout = continuation via QStash, not failure
    } else if (realFailures.length > 0 && successfulResults.length === 0) {
      finalStatus = ProcessingQueueStatus.failed; // Only real failures with zero success
    } else {
      finalStatus = ProcessingQueueStatus.queued; // Partial success or mixed — retry
    }

    // Build error message: only surface real errors, not timeouts
    const lastErrorMessage = realFailures.length > 0
      ? `${realFailures.length} batch(es) failed: ${realFailures.map(f => f.error).join('; ').slice(0, 500)}`
      : timeoutBatches.length > 0
        ? `Processing paused after ${successfulResults.length} page(s) — will resume automatically via QStash`
        : null;

    // Single atomic update with all accumulated results
    await prisma.processingQueue.update({
      where: { id: entry.id },
      data: {
        pagesProcessed: totalPagesProcessed,
        currentBatch: highestCompletedBatch,
        status: finalStatus,
        lastError: lastErrorMessage,
        updatedAt: new Date(),
        metadata: {
          ...metadata,
          concurrency: maxConcurrency,
          processingMode: 'concurrent',
          lastBatchAt: new Date().toISOString(),
          providerBreakdown: updatedProviderBreakdown,
          ...(realFailures.length > 0 ? {
            failedBatchRanges: realFailures
              .filter(f => f.batchIndex >= 0)
              .map(f => {
                const range = batchRanges.find(r => r.batchIndex === f.batchIndex);
                return range ? { startPage: range.startPage, endPage: range.endPage, error: f.error } : null;
              })
              .filter(Boolean),
          } : {}),
        },
      },
    });

    // Update document with progress
    await prisma.document.update({
      where: { id: documentId },
      data: { pagesProcessed: totalPagesProcessed },
    });

    // Handle completion
    if (isComplete) {
      logger.info('PROCESS_QUEUE', `Document ${documentId} fully processed`, { totalPagesProcessed });
      await prisma.document.update({
        where: { id: documentId },
        data: {
          queueStatus: 'completed',
          processedAt: new Date(),
        },
      });

      // Run consolidated post-processing
      try {
        await runPostProcessing(documentId, totalPagesProcessed);
      } catch (postError) {
        logger.error('PROCESS_QUEUE', 'Post-processing failed', postError as Error, { documentId });
      }

      // Trigger project-wide data enhancement
      const processedDoc = await prisma.document.findUnique({
        where: { id: documentId },
        include: { Project: true },
      });
      if (processedDoc?.Project?.slug) {
        logger.info('PROCESS_QUEUE', `Triggering project data enhancement for ${processedDoc.Project.slug}`);
        triggerEnhancementAfterProcessing(processedDoc.Project.slug, processedDoc.name).catch(err => {
          logger.error('PROCESS_QUEUE', 'Project enhancement failed', err, { documentId });
        });
      }
    } else if (isTimeoutOnly) {
      // Timeout — QStash continuation already scheduled above
      logger.info('PROCESS_QUEUE', `Document ${documentId} processing paused — QStash continuation scheduled`, {
        pagesProcessed: totalPagesProcessed,
        totalPages: entry.totalPages,
        willResumeAutomatically: true,
      });
    } else if (realFailures.length > 0 && successfulResults.length === 0) {
      // All batches genuinely failed (not timeout)
      logger.error('PROCESS_QUEUE', `Document ${documentId} processing failed — all batches failed with real errors`);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          queueStatus: 'failed',
          lastProcessingError: `All ${realFailures.length} batches failed`,
        },
      });
    } else if (realFailures.length > 0) {
      // Partial failure — some batches succeeded, some genuinely failed
      logger.warn('PROCESS_QUEUE', `Document ${documentId} partial failure`, {
        succeeded: successfulResults.length,
        failed: realFailures.length,
        willRetry: true,
      });
      // Leave in 'queued' status for cron/QStash to retry
    } else {
      // No failures or timeouts but not complete — shouldn't happen, but handle gracefully
      logger.info('PROCESS_QUEUE', `Document ${documentId} processing paused, cron will resume`, {
        pagesProcessed: totalPagesProcessed,
        totalPages: entry.totalPages,
      });
    }
  } catch (error: any) {
    const isDownloadTimeout = error.name === 'AbortError' || error.message?.includes('download timeout');

    if (isDownloadTimeout) {
      logger.warn('PROCESS_QUEUE', `PDF download timed out for ${documentId}, scheduling QStash continuation`, {
        errorName: error.name,
        errorMessage: error.message,
      });

      // Set to queued — the finally block will schedule QStash continuation
      await prisma.processingQueue.update({
        where: { id: entry.id },
        data: {
          status: ProcessingQueueStatus.queued,
          lastError: `PDF download timed out — will retry in next invocation`,
          updatedAt: new Date(),
        },
      });

      await prisma.document.update({
        where: { id: documentId },
        data: { queueStatus: 'queued' },
      });
    } else {
      logger.error('PROCESS_QUEUE', `Fatal error processing document ${documentId}`, error);

      await prisma.processingQueue.update({
        where: { id: entry.id },
        data: {
          status: ProcessingQueueStatus.failed,
          lastError: error.message,
          updatedAt: new Date(),
        },
      });

      await prisma.document.update({
        where: { id: documentId },
        data: {
          queueStatus: 'failed',
          lastProcessingError: error.message,
        },
      });
    }
  } finally {
    clearInterval(heartbeatTimer);

    // Safety net: if processing ended without completing all batches, schedule QStash continuation
    try {
      const finalEntry = await prisma.processingQueue.findUnique({
        where: { id: entry.id },
        select: { status: true, currentBatch: true, totalBatches: true }
      });
      if (finalEntry && finalEntry.status !== ProcessingQueueStatus.completed && finalEntry.status !== ProcessingQueueStatus.failed &&
          finalEntry.currentBatch < finalEntry.totalBatches) {
        // Schedule continuation via QStash (guaranteed delivery)
        await scheduleProcessingContinuation(documentId);
        await prisma.document.update({
          where: { id: documentId },
          data: { queueStatus: 'queued' }
        });
        logger.info('PROCESS_QUEUE', 'Safety-net continuation scheduled via finally block', { documentId });
      }
    } catch (e) {
      // Best-effort — don't throw in finally
      logger.warn('PROCESS_QUEUE', 'Failed to schedule continuation in finally block', { documentId });
    }

    logger.info('PROCESS_QUEUE', `Heartbeat stopped for ${documentId}`);
  }
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
