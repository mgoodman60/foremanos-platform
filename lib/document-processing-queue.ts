/**
 * Document Processing Queue System
 * Handles large documents with batched processing and resumability
 */

import { prisma } from './db';
import { processDocumentBatch } from './document-processor-batch';
import { triggerAutoTakeoffAfterProcessing } from './auto-takeoff-generator';
import { triggerEnhancementAfterProcessing } from './project-data-enhancer';
import { ProcessingQueueStatus } from '@prisma/client';

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
        processorType: processorType || 'gpt-4o-vision',
        queuedAt: new Date().toISOString(),
      },
    },
  });

  console.log(`[QUEUE] Document ${documentId} queued: ${totalPages} pages in ${totalBatches} batches (type: ${processorType || 'default'})`);
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
    console.log('[QUEUE] No documents in queue');
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
    const processorType = metadata?.processorType || 'gpt-4o-vision';
    const startPage = entry.currentBatch * batchSize + 1;
    const endPage = Math.min(startPage + batchSize - 1, entry.totalPages);

    console.log(`[QUEUE] Processing ${entry.documentId} batch ${entry.currentBatch + 1}/${entry.totalBatches} (pages ${startPage}-${endPage})`);
    console.log(`[QUEUE] Document classification: ${processorType}`);

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
        console.log(`[QUEUE] ✅ Document ${entry.documentId} completed (${newPagesProcessed}/${entry.totalPages} pages)`);
        
        // Mark document as processed
        await prisma.document.update({
          where: { id: entry.documentId },
          data: {
            processed: true,
            pagesProcessed: newPagesProcessed,
          },
        });

        // Trigger intelligence extraction (Phase A, B, C)
        // This runs asynchronously after vision processing completes
        try {
          const document = await prisma.document.findUnique({
            where: { id: entry.documentId },
            include: { Project: true },
          });

          if (document?.Project?.slug) {
            const projectSlug = document.Project.slug;
            console.log(`[QUEUE] 🧠 Starting intelligence extraction for ${entry.documentId}...`);
            
            // Import and run extraction in background (don't await)
            import('./intelligence-orchestrator').then(({ runIntelligenceExtraction }) => {
              runIntelligenceExtraction({
                documentId: entry.documentId,
                projectSlug,
                phases: ['A', 'B', 'C'],
              })
                .then(result => {
                  console.log(`[QUEUE] ✅ Intelligence extraction completed: ${result.phasesRun.join(', ')}`);
                  
                  // Chain room extraction and takeoff extraction
                  console.log(`[QUEUE] 🏠 Starting room extraction...`);
                  import('./room-extractor').then(({ extractRoomsFromDocuments, saveExtractedRooms }) => {
                    extractRoomsFromDocuments(projectSlug)
                      .then(async (roomResult) => {
                        if (roomResult.rooms.length > 0) {
                          const saveResult = await saveExtractedRooms(projectSlug, roomResult.rooms);
                          console.log(`[QUEUE] 🏠 Room extraction: ${saveResult.created} created`);
                        }
                        
                        // Auto-extract takeoffs
                        console.log(`[QUEUE] 📐 Starting auto takeoff extraction...`);
                        import('./takeoff-extractor').then(({ autoExtractTakeoffs }) => {
                          prisma.project.findUnique({ where: { slug: projectSlug }, select: { id: true } })
                            .then((proj: any) => {
                              if (proj) {
                                autoExtractTakeoffs(proj.id, projectSlug)
                                  .then(takeoffResult => {
                                    if (takeoffResult.itemCount > 0) {
                                      console.log(`[QUEUE] 📐 Takeoffs: ${takeoffResult.itemCount} items extracted`);
                                    }
                                  })
                                  .catch(err => console.error('[QUEUE] Takeoff error:', err));
                              }
                            });
                        });
                      })
                      .catch(err => console.error('[QUEUE] Room extraction error:', err));
                  });
                })
                .catch(error => {
                  console.error(`[QUEUE] ❌ Intelligence extraction failed:`, error);
                });
            });
          }
        } catch (extractionError) {
          console.error(`[QUEUE] Warning: Could not trigger intelligence extraction:`, extractionError);
          // Don't fail the whole process if extraction fails
        }
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
        console.error(`[QUEUE] ❌ Document ${entry.documentId} failed after ${maxRetries} retries`);
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
        console.log(`[QUEUE] ⏳ Document ${entry.documentId} batch failed, retry ${newRetries}/${maxRetries}`);
      }

      return false; // Stop processing for now
    }
  } catch (error: any) {
    console.error(`[QUEUE] Error processing batch:`, error);
    
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

  console.log(`[QUEUE] Resumed processing for ${documentId}`);
}

/**
 * Process all batches for a specific document
 * This is called after a document is queued to actually process it
 */
export async function processQueuedDocument(documentId: string): Promise<void> {
  console.log(`[QUEUE] Starting full processing for document ${documentId}`);
  
  // Find the queue entry for this document
  const entry = await prisma.processingQueue.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) {
    console.error(`[QUEUE] No queue entry found for document ${documentId}`);
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
      console.error(`[QUEUE] Queue entry disappeared for ${documentId}`);
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
      console.log(`[QUEUE] Batch failed for ${documentId}, consecutive failures: ${consecutiveFailures}`);
      
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
    console.log(`[QUEUE] ✅ Document ${documentId} fully processed`);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        queueStatus: 'completed',
        processedAt: new Date(),
      },
    });
    
    // Trigger automatic takeoff generation after document processing completes
    console.log(`[QUEUE] 🚀 Triggering auto-takeoff generation for document ${documentId}`);
    triggerAutoTakeoffAfterProcessing(documentId).catch(err => {
      console.error(`[QUEUE] Auto-takeoff trigger failed:`, err);
    });
    
    // Trigger project-wide data enhancement after document processing
    // This improves all aspects: budget, takeoffs, schedule links, room data
    const processedDoc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { Project: true },
    });
    if (processedDoc?.Project?.slug) {
      console.log(`[QUEUE] 🔄 Triggering project data enhancement for ${processedDoc.Project.slug}`);
      triggerEnhancementAfterProcessing(processedDoc.Project.slug, processedDoc.name).catch(err => {
        console.error(`[QUEUE] Project enhancement failed:`, err);
      });
    }
  } else if (consecutiveFailures >= maxConsecutiveFailures || finalEntry?.status === ProcessingQueueStatus.failed) {
    console.error(`[QUEUE] ❌ Document ${documentId} processing failed`);
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
    const processorType = metadata?.processorType || 'gpt-4o-vision';
    const startPage = entry.currentBatch * batchSize + 1;
    const endPage = Math.min(startPage + batchSize - 1, entry.totalPages);

    console.log(`[QUEUE] Processing ${documentId} batch ${entry.currentBatch + 1}/${entry.totalBatches} (pages ${startPage}-${endPage})`);
    console.log(`[QUEUE] Document classification: ${processorType}`);

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
        console.log(`[QUEUE] ✅ All batches complete for ${documentId}`);
        
        // Mark document as processed
        await prisma.document.update({
          where: { id: documentId },
          data: {
            processed: true,
            pagesProcessed: newPagesProcessed,
          },
        });

        // Trigger intelligence extraction and room extraction in background
        try {
          const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: { Project: true },
          });

          if (document?.Project?.slug) {
            const projectSlug = document.Project.slug;
            
            // 1. Intelligence extraction (Phase A, B, C)
            console.log(`[QUEUE] 🧠 Starting intelligence extraction...`);
            import('./intelligence-orchestrator').then(({ runIntelligenceExtraction }) => {
              runIntelligenceExtraction({
                documentId,
                projectSlug,
                phases: ['A', 'B', 'C'],
              })
                .then(() => {
                  console.log(`[QUEUE] ✅ Intelligence extraction completed`);
                  
                  // 2. Room extraction (after intelligence is done)
                  console.log(`[QUEUE] 🏠 Starting room extraction for project ${projectSlug}...`);
                  import('./room-extractor').then(({ extractRoomsFromDocuments, saveExtractedRooms }) => {
                    extractRoomsFromDocuments(projectSlug)
                      .then(async (result) => {
                        if (result.rooms.length > 0) {
                          const saveResult = await saveExtractedRooms(projectSlug, result.rooms);
                          console.log(`[QUEUE] 🏠 Room extraction complete: ${saveResult.created} created, ${saveResult.updated} updated`);
                        } else {
                          console.log(`[QUEUE] 🏠 No rooms found in documents`);
                        }
                        
                        // 3. Auto-extract material takeoffs (after room extraction)
                        console.log(`[QUEUE] 📐 Starting auto takeoff extraction...`);
                        import('./takeoff-extractor').then(({ autoExtractTakeoffs }) => {
                          // Get project ID from slug
                          prisma.project.findUnique({ where: { slug: projectSlug }, select: { id: true } })
                            .then((proj: any) => {
                              if (proj) {
                                autoExtractTakeoffs(proj.id, projectSlug)
                                  .then(takeoffResult => {
                                    if (takeoffResult.success && takeoffResult.itemCount > 0) {
                                      console.log(`[QUEUE] 📐 Takeoff extraction complete: ${takeoffResult.itemCount} items`);
                                    } else {
                                      console.log(`[QUEUE] 📐 No takeoff quantities extracted`);
                                    }
                                  })
                                  .catch(err => console.error('[QUEUE] Takeoff extraction error:', err));
                              }
                            });
                        });
                      })
                      .catch(err => console.error('[QUEUE] Room extraction error:', err));
                  });
                })
                .catch(err => console.error('[QUEUE] Intelligence extraction error:', err));
            });
          }
        } catch (err) {
          console.error('[QUEUE] Could not start post-processing:', err);
        }
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
    console.error(`[QUEUE] Error processing batch for ${documentId}:`, error);
    
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
