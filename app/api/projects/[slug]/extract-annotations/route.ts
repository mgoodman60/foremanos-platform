import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';
import { extractAnnotationsWithVision } from '@/lib/annotation-processor';
import { rasterizeSinglePage } from '@/lib/pdf-to-image-raster';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_EXTRACT_ANNOTATIONS');

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { forceReprocess = false } = body;

    const project = await prisma.project.findUnique({ 
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get PLANS documents separately
    const documents = await prisma.document.findMany({
      where: {
        projectId: project.id,
        category: 'plans_drawings'
      }
    });

    logger.info('[ANNOTATION EXTRACTION] Starting extraction', { documentCount: documents.length });

    let totalAnnotations = 0;
    let processedSheets = 0;
    let criticalCount = 0;
    const errors: string[] = [];

    for (const document of documents) {
      try {
        // Check if already extracted (unless force reprocess)
        if (!forceReprocess) {
          const existing = await prisma.enhancedAnnotation.findFirst({
            where: {
              projectId: project.id,
              documentId: document.id
            }
          });

          if (existing) {
            logger.info('[ANNOTATION EXTRACTION] Skipping document - already processed', { document: document.name });
            const anns = existing.annotations as any;
            if (Array.isArray(anns)) {
              totalAnnotations += anns.length;
              criticalCount += anns.filter((a: any) => a.priority === 'critical').length;
              processedSheets++;
            }
            continue;
          }
        }

        logger.info('[ANNOTATION EXTRACTION] Processing document', { document: document.name });

        // Skip if no cloud storage path
        if (!document.cloud_storage_path) {
          logger.info('[ANNOTATION EXTRACTION] Skipping document - no cloud storage path', { document: document.name });
          continue;
        }

        // Download file from S3
        const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Get sheet number from document metadata
        const sheetNumber = ((document as any).metadata)?.sheetNumber || document.name.replace(/\.pdf$/i, '');

        // Extract first page as PDF for vision API processing
        // Using PDF native mode for best quality with vision APIs (Claude, GPT-4V)
        const rasterResult = await rasterizeSinglePage(buffer, 1, {
          dpi: 150,
          maxWidth: 2048,
          maxHeight: 2048,
          mode: 'pdf' // Use native PDF - better quality than rasterized images
        });

        const pageBase64 = rasterResult.base64;

        // Extract annotations using vision (supports both PDF and image input)
        logger.info('[ANNOTATION EXTRACTION] Analyzing sheet with GPT-5.2 Vision', { sheet: sheetNumber });
        const annotations = await extractAnnotationsWithVision(
          pageBase64,
          sheetNumber
        );

        logger.info('[ANNOTATION EXTRACTION] Extracted annotations', { count: annotations.length, sheet: sheetNumber });

        // Transform to match component expectations
        const formattedAnnotations = annotations.map((ann, idx) => ({
          id: ann.id || `${document.id}-ann-${idx}`,
          type: ann.type,
          text: ann.text,
          priority: ann.priority as 'critical' | 'important' | 'informational',
          keywords: ann.tags,
          requirements: ann.type === 'requirement' ? [ann.text] : [],
          position: ann.boundingBox ? {
            x: ann.boundingBox.x,
            y: ann.boundingBox.y
          } : { x: 0, y: 0 },
          confidence: ann.confidence,
          context: ann.location,
          leaderLines: false
        }));

        // Calculate average confidence
        const avgConfidence = annotations.length > 0
          ? annotations.reduce((sum, a) => sum + a.confidence, 0) / annotations.length
          : 0.85;

        // Count critical annotations
        const critical = annotations.filter(a => a.priority === 'critical').length;

        // Store in database
        await prisma.enhancedAnnotation.upsert({
          where: {
            projectId_documentId_sheetNumber: {
              projectId: project.id,
              documentId: document.id,
              sheetNumber
            }
          },
          create: {
            projectId: project.id,
            documentId: document.id,
            sheetNumber,
            annotations: formattedAnnotations,
            confidence: avgConfidence
          },
          update: {
            annotations: formattedAnnotations,
            confidence: avgConfidence,
            extractedAt: new Date()
          }
        });

        totalAnnotations += annotations.length;
        criticalCount += critical;
        processedSheets++;

      } catch (error: unknown) {
        logger.error('[ANNOTATION EXTRACTION] Error processing document', error, { document: document.name });
        const errMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${document.name}: ${errMsg}`);
      }
    }

    logger.info('[ANNOTATION EXTRACTION] Complete', { totalAnnotations, criticalCount, processedSheets });

    return NextResponse.json({
      success: true,
      message: `Successfully extracted annotations from ${processedSheets} sheets`,
      processed: processedSheets,
      totalAnnotations,
      criticalCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: unknown) {
    logger.error('Error extracting annotations', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      error: 'Failed to extract annotations',
      details: errMsg
    }, { status: 500 });
  }
}
