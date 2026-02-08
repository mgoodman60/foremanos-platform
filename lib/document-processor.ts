import { prisma } from './db';
import { getFileUrl } from './s3';
import { logger } from '@/lib/logger';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs';
import { classifyDocument, ProcessorType, DocumentClassification } from './document-classifier';
import { calculateProcessingCost, canProcessDocument } from './processing-limits';
import { extractTitleBlock, storeTitleBlockData } from './title-block-extractor';
import { markDocumentProcessed } from './onboarding-tracker';
// Scale detection now handled by dedicated scale-detector module
import { classifyDrawingWithPatterns, storeDrawingClassification } from './drawing-classifier';
import mammoth from 'mammoth';
import { convertSinglePage, convertPdfToImages } from './pdf-to-image';

/**
 * Process a document by downloading it from S3 and running appropriate processing
 * Uses hybrid model with smart routing based on document classification
 * @param documentId The document ID to process
 * @param classification Optional classification (if already determined)
 * @returns Promise<void>
 */
export async function processDocument(
  documentId: string, 
  classification?: DocumentClassification
): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.info('DOCUMENT_PROCESSOR', `Starting processing for document ${documentId}`);

    // Get document with project info
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        Project: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    if (document.processed) {
      logger.info('DOCUMENT_PROCESSOR', `Document ${documentId} already processed, skipping`);
      return;
    }

    if (!document.cloud_storage_path) {
      throw new Error(`Document ${documentId} has no cloud storage path`);
    }

    // Get project owner for quota tracking
    if (!document.Project) {
      throw new Error(`Document ${documentId} has no associated project`);
    }
    const ownerId = document.Project.ownerId;

    // Classify if not already done
    if (!classification) {
      const fileExtension = document.fileName.split('.').pop()?.toLowerCase() || '';
      classification = await classifyDocument(document.fileName, fileExtension);
    }

    // Download file from S3
    const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download file from S3: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Process based on classification
    let actualPages = 0;
    let actualCost = 0;
    
    const fileExtension = document.fileName.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'pdf') {
      const result = await processWithVision(documentId, buffer, classification.processorType);
      actualPages = result.pages;
      actualCost = result.cost;
    } else if (fileExtension === 'docx' || fileExtension === 'doc') {
      logger.info('DOCUMENT_PROCESSOR', `Processing DOCX document ${documentId} for RAG system`);
      const result = await processDocxFile(documentId, buffer);
      actualPages = result.pages;
      actualCost = 0; // No AI cost for DOCX text extraction
    } else {
      logger.info('DOCUMENT_PROCESSOR', `Document ${documentId} is not a supported format (${fileExtension}), marking as processed without analysis`);
      actualPages = 1; // Count as 1 page for tracking
      actualCost = 0;
    }

    const processingTime = Date.now() - startTime;

    // If document was queued (actualPages = 0), don't mark as processed yet
    // The queue processor will handle the final status update
    if (actualPages === 0) {
      logger.info('PROCESS', `Document ${documentId} queued for batch processing`);
      return; // Exit early - queue will handle the rest
    }

    // Get user for usage tracking
    const user = await prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        pagesProcessedThisMonth: true,
        totalProcessingCost: true,
        processingResetAt: true,
      },
    });

    // Calculate user update values
    const now = new Date();
    const resetDate = user?.processingResetAt || now;
    const shouldReset = user ? (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) : false;

    // Combine all database updates into a single transaction to prevent race conditions
    await prisma.$transaction(async (tx) => {
      // Update document with processing info and completion status in a single update
      await tx.document.update({
        where: { id: documentId },
        data: {
          processed: true,
          pagesProcessed: actualPages,
          processingCost: actualCost,
          processorType: classification.processorType,
          queueStatus: 'completed',
          lastProcessingError: null,
          processedAt: now,
        },
      });

      // Update user's monthly usage
      if (user) {
        await tx.user.update({
          where: { id: ownerId },
          data: {
            pagesProcessedThisMonth: shouldReset ? actualPages : (user.pagesProcessedThisMonth + actualPages),
            totalProcessingCost: (user.totalProcessingCost || 0) + actualCost,
            processingResetAt: shouldReset ? now : resetDate,
          },
        });
      }

      // Create processing cost record
      await tx.processingCost.create({
        data: {
          documentId: documentId,
          userId: ownerId,
          processorType: classification.processorType,
          pages: actualPages,
          cost: actualCost,
          processingTime: processingTime,
        },
      });
    });

    // Track onboarding progress - document processed (non-critical, outside transaction)
    try {
      if (document.projectId) {
        await markDocumentProcessed(ownerId, document.projectId);
      }
    } catch (error) {
      // Silently fail - don't block processing
      logger.error('PROCESS', 'Failed to track onboarding progress', error);
    }

    logger.info('DOCUMENT_PROCESSOR', `Document ${documentId} processed successfully`, { processorType: classification.processorType, pages: actualPages, cost: actualCost.toFixed(4) });

    // Run intelligence extraction BEFORE marking as processed
    // This ensures chunks are enriched before RAG retrieval uses them
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { Project: true },
    });

    if (doc?.Project?.slug) {
      const projectSlug = doc.Project.slug;

      // 1. Intelligence extraction (Phase A, B, C)
      try {
        logger.info('DOCUMENT_PROCESSOR', `Starting intelligence extraction for ${documentId}`);
        const { runIntelligenceExtraction } = await import('./intelligence-orchestrator');
        await runIntelligenceExtraction({
          documentId,
          projectSlug,
          phases: ['A', 'B', 'C'],
        });
        logger.info('DOCUMENT_PROCESSOR', 'Intelligence extraction completed');
      } catch (error) {
        logger.error('DOCUMENT_PROCESSOR', 'Intelligence extraction failed', error as Error, { documentId });
      }

      // 2. Room extraction (after intelligence is done)
      try {
        logger.info('DOCUMENT_PROCESSOR', `Starting room extraction for project ${projectSlug}`);
        const { extractRoomsFromDocuments, saveExtractedRooms } = await import('./room-extractor');
        const roomResult = await extractRoomsFromDocuments(projectSlug);
        if (roomResult.rooms.length > 0) {
          const saveResult = await saveExtractedRooms(projectSlug, roomResult.rooms);
          logger.info('DOCUMENT_PROCESSOR', 'Room extraction complete', { created: saveResult.created, updated: saveResult.updated });
        } else {
          logger.info('DOCUMENT_PROCESSOR', 'No rooms found in documents');
        }
      } catch (error) {
        logger.error('DOCUMENT_PROCESSOR', 'Room extraction failed', error as Error, { documentId });
      }

      // 3. Auto-sync all features from this document
      const docForSync = await prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true, projectId: true, fileName: true, category: true },
      });

      if (docForSync?.projectId) {
        try {
          logger.info('DOCUMENT_PROCESSOR', `Starting feature auto-sync for ${docForSync.fileName}`);
          const { processDocumentForSync } = await import('./document-auto-sync');
          const syncResult = await processDocumentForSync(documentId, docForSync.projectId!);
          logger.info('DOCUMENT_PROCESSOR', 'Auto-sync complete', { featuresProcessed: syncResult.featuresProcessed.length });
          if (syncResult.featuresProcessed.length > 0) {
            logger.info('DOCUMENT_PROCESSOR', `Features processed: ${syncResult.featuresProcessed.join(', ')}`);
          }
          if (syncResult.featuresSkipped.length > 0) {
            logger.info('DOCUMENT_PROCESSOR', `Skipped (higher confidence exists): ${syncResult.featuresSkipped.join(', ')}`);
          }
          if (syncResult.errors.length > 0) {
            logger.warn('DOCUMENT_PROCESSOR', `Sync errors: ${syncResult.errors.join(', ')}`);
          }
        } catch (error) {
          logger.error('DOCUMENT_PROCESSOR', 'Auto-sync failed', error as Error, { documentId });
        }

        // 4. Auto-extract schedule if this is a schedule document
        const fileName = docForSync.fileName?.toLowerCase() || '';
        const category = docForSync.category?.toLowerCase() || '';
        const isScheduleDoc =
          category === 'schedule' ||
          fileName.includes('schedule') ||
          fileName.includes('gantt') ||
          fileName.includes('timeline') ||
          fileName.includes('lookahead') ||
          fileName.includes('critical path') ||
          fileName.endsWith('.mpp');

        if (isScheduleDoc) {
          try {
            logger.info('DOCUMENT_PROCESSOR', 'Detected schedule document, starting automatic schedule extraction');
            const { extractScheduleWithAI } = await import('./schedule-extractor-ai');
            const project = await prisma.project.findUnique({
              where: { id: docForSync.projectId! },
              select: { ownerId: true }
            });
            if (project?.ownerId) {
              const scheduleResult = await extractScheduleWithAI(documentId, docForSync.projectId!, project.ownerId);
              logger.info('DOCUMENT_PROCESSOR', 'Schedule extraction complete', { totalTasks: scheduleResult.totalTasks });
              if (scheduleResult.criticalPathTasks > 0) {
                logger.info('DOCUMENT_PROCESSOR', 'Critical path tasks identified', { count: scheduleResult.criticalPathTasks });
              }
            }
          } catch (error) {
            logger.error('DOCUMENT_PROCESSOR', 'Schedule extraction failed', error as Error, { documentId });
          }
        }
      }
    }
  } catch (error: any) {
    logger.error('DOCUMENT_PROCESSOR', `Error processing document ${documentId}`, error);
    
    // Update document with error information
    await prisma.document.update({
      where: { id: documentId },
      data: {
        queueStatus: 'failed',
        processed: false,
        lastProcessingError: error?.message || String(error),
      },
    }).catch((updateError: any) => {
      logger.error('DOCUMENT_PROCESSOR', 'Failed to update document error status', updateError);
    });
    
    throw error;
  }
}

/**
 * Process a PDF document using vision analysis or queue for large documents
 * @returns Object with pages and cost information
 */
async function processWithVision(
  documentId: string, 
  buffer: Buffer, 
  processorType: ProcessorType
): Promise<{ pages: number; cost: number }> {
  const tempDir = tmpdir();
  const tempFilePath = join(tempDir, `${documentId}-${Date.now()}.pdf`);
  
  try {
    // Write buffer to temporary file
    await writeFile(tempFilePath, buffer);

    // Get PDF page count
    const pages = await getPdfPageCountFromFile(tempFilePath);

    logger.info('PROCESS', `Document has ${pages} pages`);

    // For large documents (>10 pages), use queue system
    if (pages > 10) {
      logger.info('PROCESS', `Large document detected, using queue system`, { pages, classification: processorType });
      
      // Import queue functions dynamically to avoid circular dependencies
      const { queueDocumentForProcessing } = await import('./document-processing-queue');

      await queueDocumentForProcessing(documentId, pages, 5, processorType); // 5 pages per batch with classification

      // Mark as queued (not completed yet!)
      await prisma.document.update({
        where: { id: documentId },
        data: {
          queueStatus: 'queued',
          pagesProcessed: 0,
          processorType, // Store processor type for reference
        },
      });

      // Don't process inline — the cron job (/api/admin/process-queue) picks up
      // queued documents every 5 minutes with a 300s timeout, which is far more
      // reliable than trying to process inside waitUntil() with a 60s function timeout.
      logger.info('PROCESS', `Document ${documentId} queued for cron processing`, { pages, batches: Math.ceil(pages / 5) });
      
      // Return 0 - actual values will be updated as queue processes
      return { pages: 0, cost: 0 };
    }

    // For small documents (<= 10 pages), process immediately with retry logic
    logger.info('PROCESS', `Small document, processing immediately`, { pages, classification: processorType });
    
    // Import batch processor to use new retry logic
    const { processDocumentBatch } = await import('./document-processor-batch');
    const result = await processDocumentBatch(documentId, 1, pages, processorType);
    
    if (!result.success) {
      throw new Error(result.error || 'Processing failed');
    }

    // Calculate actual cost
    const costPerPage = processorType === 'vision-ai' ? 0.01 : 
                        processorType === 'claude-haiku-ocr' ? 0.001 : 
                        0.003;
    const cost = result.pagesProcessed * costPerPage;

    return { pages: result.pagesProcessed, cost };
  } finally {
    // Clean up temporary file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      logger.info('PROCESS', `Cleaned up temporary file`, { path: tempFilePath });
    }
  }
}

/**
 * Get the number of pages in a PDF file
 */
async function getPdfPageCountFromFile(filePath: string): Promise<number> {
  try {
    // Use pure JS pdf-lib to get page count (no system binaries required)
    const { getPdfPageCount } = await import('./pdf-to-image');
    const buffer = fs.readFileSync(filePath);
    return await getPdfPageCount(buffer);
  } catch (error) {
    logger.error('PROCESS', 'Error getting PDF page count', error);
    // Fallback: estimate from file size (rough estimate: 100KB per page)
    const stats = fs.statSync(filePath);
    return Math.max(1, Math.ceil(stats.size / (100 * 1024)));
  }
}

/**
 * Process all unprocessed documents for a project
 * @param projectId The project ID
 * @returns Promise with counts of processed and failed documents
 */
export async function processUnprocessedDocuments(projectId: string): Promise<{
  processed: number;
  failed: number;
  queued: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    processed: 0,
    failed: 0,
    queued: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // Import processing limits
    const { 
      canProcessPages, 
      getUsageStats, 
      getProjectProcessingLimits,
      queueDocumentForProcessing,
      sendLimitNotification
    } = await import('./processing-limits');

    // Get processing limits for this project
    const limits = await getProjectProcessingLimits(projectId);
    const stats = await getUsageStats(projectId);

    // Check if we're near/at limit
    if (stats.nearLimit && !stats.atLimit) {
      await sendLimitNotification(projectId, 'near_limit');
    }

    // Get all unprocessed documents for this project
    const unprocessedDocs = await prisma.document.findMany({
      where: {
        projectId,
        processed: false,
        deletedAt: null, // Don't process soft-deleted documents
        queueStatus: { not: 'queued' }, // Don't requeue already queued docs
      },
      include: {
        Project: {
          select: {
            queueEnabled: true,
          }
        }
      }
    });

    logger.info('PROCESSING', `Found ${unprocessedDocs.length} unprocessed documents for project ${projectId}`);
    logger.info('PROCESSING', `Daily usage`, { daily: stats.dailyPages, limit: limits.dailyPageLimit, remaining: stats.dailyRemaining });

    // Process each document (or queue if limits reached)
    for (const doc of unprocessedDocs) {
      try {
        // Estimate page count (rough: 100KB per page)
        const pageEstimate = Math.max(1, Math.ceil((doc.fileSize || 0) / (100 * 1024)));

        // Check if we can process this document
        const canProcess = await canProcessPages(projectId, pageEstimate);

        if (!canProcess.allowed) {
          // Queue document if queueing is enabled
          if (doc.Project?.queueEnabled) {
            await queueDocumentForProcessing(doc.id);
            result.queued++;
            logger.info('PROCESSING', `Queued document`, { name: doc.name, pageEstimate, reason: canProcess.reason });
            
            // Send limit notification
            if (canProcess.reason === 'daily_limit_exceeded') {
              await sendLimitNotification(projectId, 'daily_limit');
            } else if (canProcess.reason === 'monthly_limit_exceeded') {
              await sendLimitNotification(projectId, 'monthly_limit');
            }
          } else {
            result.skipped++;
            logger.info('PROCESSING', `Skipped document (queueing disabled)`, { name: doc.name, reason: canProcess.reason });
          }
          continue;
        }

        // Process document
        await processDocument(doc.id);
        result.processed++;
        logger.info('PROCESSING', `Processed ${doc.name}`);
      } catch (error) {
        result.failed++;
        const errorMsg = `Failed to process ${doc.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error('PROCESSING', errorMsg);
        result.errors.push(errorMsg);
      }
    }

    logger.info('PROCESSING', `Complete for project ${projectId}`, { processed: result.processed, queued: result.queued, skipped: result.skipped, failed: result.failed });
  } catch (error) {
    const errorMsg = `Error processing documents for project ${projectId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error('PROCESSING', errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Extract title blocks from document chunks (post-processing step)
 * This can be run after initial document processing to extract title block metadata
 */
export async function extractTitleBlocksFromDocument(documentId: string): Promise<void> {
  try {
    logger.info('TITLE_BLOCK', `Extracting title blocks for document ${documentId}`);

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        DocumentChunk: {
          where: {
            pageNumber: 1 // Title blocks are usually on first page
          }
        }
      }
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    if (!document.cloud_storage_path) {
      throw new Error(`Document has no cloud storage path`);
    }

    // Get the PDF file
    const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Convert first page to image using pure JS (no system binaries required)
    const { base64: imageBase64 } = await convertSinglePage(buffer, 1, 1500);

    // Extract title block for each chunk (should be only one for page 1)
    for (const chunk of document.DocumentChunk) {
      const result = await extractTitleBlock(
        imageBase64,
        chunk.content || '',
        document.fileName
      );

      if (result.success && result.data) {
        await storeTitleBlockData(documentId, chunk.id, result.data);
        logger.info('TITLE_BLOCK', `Title block extracted`, { sheetNumber: result.data.sheetNumber });
      } else {
        logger.warn('TITLE_BLOCK', `Title block extraction failed`, { error: result.error });
      }
    }

    logger.info('TITLE_BLOCK', `Title block extraction complete for document ${documentId}`);
  } catch (error) {
    logger.error('TITLE_BLOCK', 'Title block extraction error', error);
    throw error;
  }
}

/**
 * Extract and validate scales from document
 * Phase A.3 - Scale Detection & Validation
 */
export async function extractScalesFromDocument(documentId: string): Promise<void> {
  try {
    logger.info('SCALE_EXTRACTION', `Starting scale extraction for document ${documentId}`);

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { DocumentChunk: true }
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Get file URL and download
    const fileUrl = await getFileUrl(document.cloud_storage_path!, document.isPublic);
    const tempPdfPath = join(tmpdir(), `doc_${documentId}_${Date.now()}.pdf`);

    // Download file
    const response = await fetch(fileUrl);
    const pdfBuffer = Buffer.from(await response.arrayBuffer());

    try {
      // Convert first page to image for vision-based scale detection using pure JS
      // (Scale extraction now handled by dedicated extract-scales API)

      // Scale extraction now handled by dedicated extract-scales API
      // const textScales: any[] = [];
      // for (const chunk of document.DocumentChunk) {
      //   const scales = extractScaleFromText(chunk.content);
      //   textScales.push(...scales);
      // }

      // Get title block data if available
      const titleBlockChunk = document.DocumentChunk.find((c: any) => c.titleBlockData);
      const titleBlockData = titleBlockChunk?.titleBlockData as any;

      // // Use vision for more accurate scale detection
      // let visionScales: any[] = [];
      // if (fs.existsSync(imageFile)) {
      //   visionScales = await detectScaleWithVision(imageFile, titleBlockData);
      //   fs.unlinkSync(imageFile);
      // }

      // Combine results (prioritize vision)
      const allScales: any[] = []; // Scale detection moved to dedicated endpoint
      
      // Determine primary scale
      const primaryScale = allScales.length > 0 ? allScales[0] : null;

      if (primaryScale) {
        // Update chunks with scale data
        await prisma.documentChunk.updateMany({
          where: { documentId },
          data: {
            scaleData: { scales: allScales },
            primaryScale: primaryScale.normalized,
            scaleRatio: primaryScale.ratio,
            scaleType: primaryScale.imperial ? 'architectural_imperial' : 'metric',
            hasMultipleScales: allScales.length > 1
          }
        });

        logger.info('SCALE_EXTRACTION', `Scale extraction complete`, { primaryScale: primaryScale.normalized, scaleCount: allScales.length });
      } else {
        logger.info('SCALE_EXTRACTION', 'No scales detected in document');
      }

    } finally {
      // Clean up temp PDF
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
    }

  } catch (error) {
    logger.error('SCALE_EXTRACTION', 'Scale extraction error', error);
    // Non-fatal error, don't throw
  }
}

/**
 * Classify drawing type for document
 * Phase A.4 - Drawing Type Classification
 */
// Old drawing classification function - replaced by classifyDrawingsFromDocument()
// export async function classifyDrawingType(documentId: string): Promise<void> {
//   ... (commented out - use classifyDrawingsFromDocument instead)
// }

/**
 * Extract legends from a document (Phase A.2)
 */
export async function extractLegendsFromDocument(documentId: string): Promise<void> {
  try {
    logger.info('LEGEND_EXTRACTION', `Starting legend extraction for document ${documentId}`);

    const { detectLegendRegion, extractLegendEntries } = await import('./legend-extractor');

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        DocumentChunk: { select: { sheetNumber: true, discipline: true } },
        Project: { select: { id: true, slug: true } }
      }
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    if (!document.cloud_storage_path) {
      throw new Error(`Document ${documentId} has no cloud storage path`);
    }

    // Download file from S3
    const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Convert PDF to images using pure JS (no system binaries required)
    const pageImages = await convertPdfToImages(buffer, { width: 1500 });

    let extractedCount = 0;
    
    // Get sheet numbers and disciplines from chunks
    const sheetInfo = new Map<number, { sheetNumber: string | null; discipline: string | null }>(
      document.DocumentChunk.map((c: any) => [c.pageNumber as number, { 
        sheetNumber: c.sheetNumber as string | null, 
        discipline: c.discipline as string | null
      }])
    );

    // Process each page
    for (const pageImage of pageImages) {
      const pageNumber = pageImage.pageNumber;
      const base64Image = pageImage.base64;

      const info = sheetInfo.get(pageNumber) || { sheetNumber: null, discipline: null };
      const sheetNumber = info.sheetNumber || `Page ${pageNumber}`;

      // Detect legend region
      const legendRegion = await detectLegendRegion(base64Image, sheetNumber);
      
      if (legendRegion.found) {
        // Extract legend entries
        const extractionResult = await extractLegendEntries(
          base64Image, 
          sheetNumber, 
          info.discipline as any
        );
        
        if (extractionResult.success && extractionResult.legend && extractionResult.legend.legendEntries.length > 0 && document.Project) {
          // Store in database
          await prisma.sheetLegend.create({
            data: {
              projectId: document.Project.id,
              documentId: document.id,
              sheetNumber: sheetNumber,
              discipline: info.discipline || undefined,
              legendEntries: extractionResult.legend.legendEntries as any,
              boundingBox: legendRegion.boundingBox as any,
              confidence: legendRegion.confidence,
              extractedAt: new Date(),
            }
          });

          extractedCount++;
          logger.info('LEGEND_EXTRACTION', `Extracted legend entries`, { count: extractionResult.legend.legendEntries.length, pageNumber });
        }
      }
    }

    logger.info('LEGEND_EXTRACTION', `Legend extraction complete`, { legendsFound: extractedCount });

  } catch (error) {
    logger.error('LEGEND_EXTRACTION', 'Legend extraction error', error);
    // Non-fatal error, don't throw
  }
}

/**
 * Classify drawings in document (Phase A.4)
 * Automatically categorizes construction drawings by type
 */
export async function classifyDrawingsFromDocument(documentId: string): Promise<void> {
  try {
    logger.info('DRAWING_CLASSIFICATION', `Starting drawing classification for document ${documentId}`);

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        Project: true,
        DocumentChunk: {
          where: {
            sheetNumber: { not: null as any },
            titleBlockData: { not: null as any }
          },
          select: {
            id: true,
            sheetNumber: true,
            titleBlockData: true
          },
          distinct: ['sheetNumber']
        }
      }
    });

    if (!document || !document.Project) {
      throw new Error(`Document ${documentId} not found or has no project`);
    }

    if (document.DocumentChunk.length === 0) {
      logger.warn('DRAWING_CLASSIFICATION', 'No sheets with title blocks found. Run title block extraction first.');
      return;
    }

    logger.info('DRAWING_CLASSIFICATION', `Found ${document.DocumentChunk.length} sheets to classify`);

    let classifiedCount = 0;

    for (const chunk of document.DocumentChunk) {
      const titleBlockData = chunk.titleBlockData as any;
      const sheetNumber = chunk.sheetNumber || 'Unknown';
      const sheetTitle = titleBlockData?.sheetTitle || titleBlockData?.title || 'Untitled';

      // Classify using pattern matching (fast)
      const classification = classifyDrawingWithPatterns(sheetNumber, sheetTitle);

      // Store classification
      await storeDrawingClassification(
        document.Project.id,
        document.id,
        sheetNumber,
        classification
      );

      classifiedCount++;
      logger.info('DRAWING_CLASSIFICATION', `Classified sheet`, { sheetNumber, type: classification.type, confidence: Math.round(classification.confidence * 100) });
    }

    logger.info('DRAWING_CLASSIFICATION', `Drawing classification complete`, { sheetsClassified: classifiedCount });

  } catch (error) {
    logger.error('DRAWING_CLASSIFICATION', 'Drawing classification error', error);
    // Non-fatal error, don't throw
  }
}

/**
 * Process DOCX files by extracting text and creating chunks for RAG system
 * @param documentId The document ID
 * @param buffer The DOCX file buffer
 * @returns Processing result with page count
 */
async function processDocxFile(documentId: string, buffer: Buffer): Promise<{ pages: number; cost: number }> {
  try {
    logger.info('DOCX', `Extracting text from document ${documentId}`);
    
    // Extract text from DOCX using mammoth
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    if (!text || text.trim().length === 0) {
      logger.info('DOCX', `No text content found in document ${documentId}`);
      return { pages: 1, cost: 0 };
    }

    logger.info('DOCX', `Extracted text`, { characterCount: text.length });
    
    // Split text into chunks for RAG system (approximately 1000 chars per chunk)
    const CHUNK_SIZE = 1000;
    const chunks: string[] = [];
    
    // Split by paragraphs first to maintain context
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    logger.info('DOCX', `Created text chunks`, { chunkCount: chunks.length });
    
    // Store chunks in database for RAG retrieval
    const chunkPromises = chunks.map((chunkText, index) => {
      return prisma.documentChunk.create({
        data: {
          documentId,
          pageNumber: index + 1, // Use chunk index as page number
          chunkIndex: index,
          content: chunkText,
          metadata: {
            chunkIndex: index,
            totalChunks: chunks.length,
            textLength: chunkText.length,
            source: 'docx_extraction'
          }
        }
      });
    });
    
    await Promise.all(chunkPromises);

    logger.info('DOCX', `Successfully stored chunks for document ${documentId}`, { chunkCount: chunks.length });

    // Return number of chunks as "pages"
    return { pages: chunks.length, cost: 0 };

  } catch (error) {
    logger.error('DOCX', `Error processing document ${documentId}`, error);
    throw error;
  }
}
