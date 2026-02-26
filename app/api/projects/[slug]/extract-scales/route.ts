/**
 * Extract Scales API
 * POST /api/projects/[slug]/extract-scales
 * 
 * Extracts scale information from all documents in a project
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  detectScalesWithVision,
  storeSheetScaleData,
  type SheetScaleData,
} from '@/lib/scale-detector';
import { rasterizePdfToImages } from '@/lib/pdf-to-image-raster';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_EXTRACT_SCALES');

export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session || session.user.role === 'guest') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { forceReprocess = false } = await req.json();

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        Document: {
          where: {
            fileType: 'application/pdf',
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let processed = 0;
    let extracted = 0;
    let totalScales = 0;

    // Process each document
    for (const document of project.Document) {
      logger.info('Processing document', { document: document.name });
      
      // Check if already processed
      if (!forceReprocess) {
        const existingScale = await prisma.documentChunk.findFirst({
          where: {
            documentId: document.id,
          },
        });

        if (existingScale) {
          logger.info('⏭️  Already has scale data, skipping');
          continue;
        }
      }

      processed++;

      try {
        // Download PDF from S3
        const { getFileUrl } = await import('@/lib/s3');
        const pdfUrl = await getFileUrl(document.cloud_storage_path || '', document.isPublic || false);

        const pdfResponse = await fetch(pdfUrl);
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

        // Extract PDF pages for vision API processing
        // Using PDF native mode for best quality with vision APIs (Claude, GPT-4V)
        const rasterizedPages = await rasterizePdfToImages(pdfBuffer, {
          dpi: 150,
          maxWidth: 2048,
          maxHeight: 2048,
          mode: 'pdf' // Use native PDF - better quality than rasterized images
        });

        // Process each page
        for (const page of rasterizedPages) {
          const pageNumber = page.pageNumber;

          logger.info('Processing page', { page: pageNumber, totalPages: rasterizedPages.length });

          // Use page number as sheet identifier
          const sheetNumber = `Page ${pageNumber}`;

          // Try Vision API first
          const visionResult = await detectScalesWithVision(page.base64, sheetNumber);

          if (visionResult.success && visionResult.scales.length > 0) {
            // Store scale data
            const scaleData: SheetScaleData = {
              sheetNumber,
              primaryScale: visionResult.scales[0],
              secondaryScales: visionResult.scales.slice(1),
              hasMultipleScales: visionResult.scales.length > 1,
              scaleCount: visionResult.scales.length,
              extractedFrom: visionResult.extractedFrom,
              confidence: visionResult.confidence,
            };

            await storeSheetScaleData(project.id, document.id, sheetNumber, scaleData);

            extracted++;
            totalScales += visionResult.scales.length;
            logger.info('Extracted scales from page', { count: visionResult.scales.length, page: pageNumber });
          } else {
            logger.info('No scales found on page', { page: pageNumber });
          }
        }

      } catch (error) {
        logger.error('Error processing document', error, { document: document.name });
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      extracted,
      totalScales,
    });

  } catch (error) {
    logger.error('Extract scales error', error);
    return NextResponse.json(
      { error: 'Failed to extract scales' },
      { status: 500 }
    );
  }
}
