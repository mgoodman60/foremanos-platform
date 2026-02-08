/**
 * Document Processing Queue System
 * Handles large documents with batched processing and resumability
 */

import { prisma } from './db';
import { processDocumentBatch } from './document-processor-batch';
import { triggerAutoTakeoffAfterProcessing } from './auto-takeoff-generator';
import { triggerEnhancementAfterProcessing } from './project-data-enhancer';
import { ProcessingQueueStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

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
  batchSize: number = 5,
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
  // Find next document to process
  // Note: We need to find entries where currentBatch < totalBatches
  // Since Prisma doesn't support column comparison, we fetch and filter
  const entries = await prisma.processingQueue.findMany({
    where: {
      OR: [
        { status: ProcessingQueueStatus.queued },
        { status: ProcessingQueueStatus.processing },
      ],
    },
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
    // Mark as processing
    await prisma.processingQueue.update({
      where: { id: entry.id },
      data: { 
        status: ProcessingQueueStatus.processing,
        updatedAt: new Date(),
      },
    });

    const metadata = entry.metadata as any;
    const batchSize = metadata?.batchSize || 5;
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

      // Accumulate provider stats
      const currentProviderBreakdown = metadata?.providerBreakdown || [];
      const updatedProviderBreakdown = [...currentProviderBreakdown];

      if (result.providerStats) {
        Object.entries(result.providerStats).forEach(([providerName, stats]) => {
          const existingIndex = updatedProviderBreakdown.findIndex(
            (p: any) => p.provider === providerName
          );

          if (existingIndex >= 0) {
            // Update existing provider stats
            const existing = updatedProviderBreakdown[existingIndex];
            const totalPages = existing.pagesProcessed + (stats as any).pagesProcessed;
            const totalTime = (existing.pagesProcessed * existing.avgTimePerPage) + ((stats as any).pagesProcessed * (stats as any).avgTimePerPage);
            
            updatedProviderBreakdown[existingIndex] = {
              provider: providerName,
              pagesProcessed: totalPages,
              avgTimePerPage: totalPages > 0 ? totalTime / totalPages : 0,
            };
          } else {
            // Add new provider stats
            updatedProviderBreakdown.push({
              provider: providerName,
              pagesProcessed: (stats as any).pagesProcessed,
              avgTimePerPage: (stats as any).avgTimePerPage,
            });
          }
        });
      }

      await prisma.processingQueue.update({
        where: { id: entry.id },
        data: {
          pagesProcessed: newPagesProcessed,
          currentBatch: newCurrentBatch,
          status: isComplete ? ProcessingQueueStatus.completed : ProcessingQueueStatus.processing,
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

        // Run intelligence extraction BEFORE marking as processed
        try {
          const document = await prisma.document.findUnique({
            where: { id: entry.documentId },
            include: { Project: true },
          });

          if (document?.Project?.slug) {
            const projectSlug = document.Project.slug;

            // 1. Intelligence extraction (Phase A, B, C)
            try {
              logger.info('PROCESS_QUEUE', `Starting intelligence extraction for ${entry.documentId}`);
              const { runIntelligenceExtraction } = await import('./intelligence-orchestrator');
              const extractionResult = await runIntelligenceExtraction({
                documentId: entry.documentId,
                projectSlug,
                phases: ['A', 'B', 'C'],
              });
              logger.info('PROCESS_QUEUE', 'Intelligence extraction completed', { phasesRun: extractionResult.phasesRun });
            } catch (error) {
              logger.error('PROCESS_QUEUE', 'Intelligence extraction failed', error as Error, { documentId: entry.documentId });
            }

            // 2. Room extraction
            try {
              logger.info('PROCESS_QUEUE', 'Starting room extraction');
              const { extractRoomsFromDocuments, saveExtractedRooms } = await import('./room-extractor');
              const roomResult = await extractRoomsFromDocuments(projectSlug);
              if (roomResult.rooms.length > 0) {
                const saveResult = await saveExtractedRooms(projectSlug, roomResult.rooms);
                logger.info('PROCESS_QUEUE', 'Room extraction complete', { created: saveResult.created });
              }
            } catch (error) {
              logger.error('PROCESS_QUEUE', 'Room extraction failed', error as Error, { documentId: entry.documentId });
            }

            // 3. Auto-extract takeoffs
            try {
              logger.info('PROCESS_QUEUE', 'Starting auto takeoff extraction');
              const { autoExtractTakeoffs } = await import('./takeoff-extractor');
              const proj = await prisma.project.findUnique({ where: { slug: projectSlug }, select: { id: true } });
              if (proj) {
                const takeoffResult = await autoExtractTakeoffs(proj.id, projectSlug);
                if (takeoffResult.itemCount > 0) {
                  logger.info('PROCESS_QUEUE', 'Takeoff extraction complete', { itemCount: takeoffResult.itemCount });
                }
              }
            } catch (error) {
              logger.error('PROCESS_QUEUE', 'Takeoff extraction failed', error as Error, { documentId: entry.documentId });
            }
          }
        } catch (extractionError) {
          logger.error('PROCESS_QUEUE', 'Post-processing failed', extractionError as Error, { documentId: entry.documentId });
        }

        // Mark document as processed AFTER intelligence extraction
        await prisma.document.update({
          where: { id: entry.documentId },
          data: {
            processed: true,
            pagesProcessed: newPagesProcessed,
          },
        });
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
 * Process all batches for a specific document
 * This is called after a document is queued to actually process it
 */
export async function processQueuedDocument(documentId: string): Promise<void> {
  logger.info('PROCESS_QUEUE', `Starting full processing for document ${documentId}`);
  
  // Find the queue entry for this document
  const entry = await prisma.processingQueue.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) {
    logger.error('PROCESS_QUEUE', `No queue entry found for document ${documentId}`);
    return;
  }

  // Mark document as processing
  await prisma.document.update({
    where: { id: documentId },
    data: { queueStatus: 'processing' },
  });

  let hasMoreBatches = true;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3;

  while (hasMoreBatches && consecutiveFailures < maxConsecutiveFailures) {
    // Get current status
    const currentEntry = await prisma.processingQueue.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });

    if (!currentEntry) {
      logger.error('PROCESS_QUEUE', `Queue entry disappeared for ${documentId}`);
      break;
    }

    // Check if complete or failed
    if (currentEntry.status === ProcessingQueueStatus.completed || currentEntry.status === ProcessingQueueStatus.failed) {
      hasMoreBatches = false;
      break;
    }

    // Check if all batches done
    if (currentEntry.currentBatch >= currentEntry.totalBatches) {
      hasMoreBatches = false;
      break;
    }

    // Process next batch
    const success = await processNextBatchForDocument(documentId);
    
    if (success) {
      consecutiveFailures = 0; // Reset on success
      
      // Small delay between batches to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      consecutiveFailures++;
      logger.warn('PROCESS_QUEUE', `Batch failed for ${documentId}`, { consecutiveFailures });
      
      // Wait longer after failures
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Final status update
  const finalEntry = await prisma.processingQueue.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });

  if (finalEntry?.status === ProcessingQueueStatus.completed) {
    logger.info('PROCESS_QUEUE', `Document ${documentId} fully processed`);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        queueStatus: 'completed',
        processedAt: new Date(),
      },
    });

    // Trigger automatic takeoff generation after document processing completes
    logger.info('PROCESS_QUEUE', `Triggering auto-takeoff generation for document ${documentId}`);
    triggerAutoTakeoffAfterProcessing(documentId).catch(err => {
      logger.error('PROCESS_QUEUE', 'Auto-takeoff trigger failed', err, { documentId });
    });

    // Trigger project-wide data enhancement after document processing
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
  } else if (consecutiveFailures >= maxConsecutiveFailures || finalEntry?.status === ProcessingQueueStatus.failed) {
    logger.error('PROCESS_QUEUE', `Document ${documentId} processing failed`);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        queueStatus: 'failed',
        lastProcessingError: finalEntry?.lastError || 'Max retries exceeded',
      },
    });
  }
}

/**
 * Process next batch for a specific document
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
    // Mark as processing
    await prisma.processingQueue.update({
      where: { id: entry.id },
      data: { 
        status: ProcessingQueueStatus.processing,
        updatedAt: new Date(),
      },
    });

    const metadata = entry.metadata as any;
    const batchSize = metadata?.batchSize || 5;
    const processorType = metadata?.processorType || 'vision-ai';
    const startPage = entry.currentBatch * batchSize + 1;
    const endPage = Math.min(startPage + batchSize - 1, entry.totalPages);

    logger.info('PROCESS_QUEUE', `Processing batch ${entry.currentBatch + 1}/${entry.totalBatches}`, { documentId, startPage, endPage, processorType });

    // Process batch with smart routing based on document classification
    const result = await processDocumentBatch(documentId, startPage, endPage, processorType);

    if (result.success) {
      const newPagesProcessed = entry.pagesProcessed + result.pagesProcessed;
      const newCurrentBatch = entry.currentBatch + 1;
      const isComplete = newCurrentBatch >= entry.totalBatches;

      await prisma.processingQueue.update({
        where: { id: entry.id },
        data: {
          pagesProcessed: newPagesProcessed,
          currentBatch: newCurrentBatch,
          status: isComplete ? ProcessingQueueStatus.completed : ProcessingQueueStatus.processing,
          updatedAt: new Date(),
          metadata: {
            ...metadata,
            lastBatchAt: new Date().toISOString(),
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

        // Run intelligence extraction BEFORE marking as processed
        try {
          const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: { Project: true },
          });

          if (document?.Project?.slug) {
            const projectSlug = document.Project.slug;

            // 1. Intelligence extraction (Phase A, B, C)
            try {
              logger.info('PROCESS_QUEUE', 'Starting intelligence extraction', { documentId });
              const { runIntelligenceExtraction } = await import('./intelligence-orchestrator');
              await runIntelligenceExtraction({
                documentId,
                projectSlug,
                phases: ['A', 'B', 'C'],
              });
              logger.info('PROCESS_QUEUE', 'Intelligence extraction completed', { documentId });
            } catch (error) {
              logger.error('PROCESS_QUEUE', 'Intelligence extraction failed', error as Error, { documentId });
            }

            // 2. Room extraction
            try {
              logger.info('PROCESS_QUEUE', 'Starting room extraction', { projectSlug });
              const { extractRoomsFromDocuments, saveExtractedRooms } = await import('./room-extractor');
              const roomResult = await extractRoomsFromDocuments(projectSlug);
              if (roomResult.rooms.length > 0) {
                const saveResult = await saveExtractedRooms(projectSlug, roomResult.rooms);
                logger.info('PROCESS_QUEUE', 'Room extraction complete', { created: saveResult.created, updated: saveResult.updated });
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
        } catch (err) {
          logger.error('PROCESS_QUEUE', 'Post-processing failed', err as Error, { documentId });
        }

        // Mark document as processed AFTER intelligence extraction
        await prisma.document.update({
          where: { id: documentId },
          data: {
            processed: true,
            pagesProcessed: newPagesProcessed,
          },
        });
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
