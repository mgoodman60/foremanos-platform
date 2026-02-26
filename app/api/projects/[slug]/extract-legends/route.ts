import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  extractLegendEntries,
  storeLegend,
  mergeLegendWithSymbolLibrary
} from '@/lib/legend-extractor';
import { getFileUrl } from '@/lib/s3';
import { rasterizeSinglePage } from '@/lib/pdf-to-image-raster';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('LEGEND_EXTRACTION');

/**
 * POST /api/projects/[slug]/extract-legends
 * 
 * Extracts legend sections from all documents in a project
 */
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await req.json();
    const { documentId, forceReprocess } = body;

    // Get project with documents that have title blocks
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        Document: {
          where: documentId ? { id: documentId } : undefined,
          include: {
            DocumentChunk: {
              where: {
                pageNumber: 1,
                sheetNumber: { not: null } // Only process sheets with title blocks
              },
              take: 1
            },
            SheetLegend: true
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each document
    for (const document of project.Document) {
      // Skip non-PDF documents
      if (!document.name.toLowerCase().endsWith('.pdf')) {
        continue;
      }

      // Skip if already has legend (unless force reprocess)
      if (!forceReprocess && document.SheetLegend.length > 0) {
        skippedCount++;
        continue;
      }

      // Skip if no cloud storage path
      if (!document.cloud_storage_path) {
        log.info(`Skipping document - no cloud storage path`, { documentName: document.name });
        continue;
      }

      // Get sheet number and discipline from first chunk
      const chunk = document.DocumentChunk[0];
      if (!chunk || !chunk.sheetNumber) {
        log.info(`Skipping document - no sheet number`, { documentName: document.name });
        continue;
      }

      log.info(`Processing legends`, { documentName: document.name, sheetNumber: chunk.sheetNumber });

      try {
        // Get the PDF file
        const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Extract first page as PDF for vision API processing
        // Using PDF native mode for best quality with vision APIs (Claude, GPT-4V)
        const rasterResult = await rasterizeSinglePage(buffer, 1, {
          dpi: 150,
          maxWidth: 1500,
          mode: 'pdf' // Use native PDF - better quality than rasterized images
        });
        const pageBase64 = rasterResult.base64;

        // Extract legend (supports both PDF and image input)
        const extractionResult = await extractLegendEntries(
          pageBase64,
          chunk.sheetNumber,
          chunk.discipline as any
        );

        if (extractionResult.success && extractionResult.legend) {
          // Store in database
          await storeLegend(
            project.id,
            document.id,
            extractionResult.legend
          );

          results.push({
            documentId: document.id,
            documentName: document.name,
            sheetNumber: chunk.sheetNumber,
            success: true,
            entriesFound: extractionResult.legend.legendEntries.length,
            confidence: extractionResult.confidence,
            method: extractionResult.method
          });

          successCount++;
        } else {
          results.push({
            documentId: document.id,
            documentName: document.name,
            sheetNumber: chunk.sheetNumber,
            success: false,
            error: extractionResult.error || 'No legend found'
          });

          errorCount++;
        }
      } catch (docError) {
        log.error(`Error processing document`, docError as Error, { documentId: document.id });
        results.push({
          documentId: document.id,
          documentName: document.name,
          success: false,
          error: docError instanceof Error ? docError.message : 'Unknown error'
        });
        errorCount++;
      }
    }

    // Merge with symbol library
    if (successCount > 0) {
      try {
        await mergeLegendWithSymbolLibrary(slug);
      } catch (mergeError) {
        log.error('Error merging with symbol library', mergeError as Error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${successCount + errorCount + skippedCount} documents`,
      successCount,
      errorCount,
      skippedCount,
      results
    });
  } catch (error) {
    log.error('Legend extraction error', error as Error);
    return NextResponse.json(
      { error: 'Failed to extract legends' },
      { status: 500 }
    );
  }
}
