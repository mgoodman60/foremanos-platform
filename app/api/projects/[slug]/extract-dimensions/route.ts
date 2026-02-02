import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getFileUrl } from '@/lib/s3';
import { extractDimensionsWithVision, validateDimensionChains } from '@/lib/dimension-intelligence';
import { rasterizeSinglePage } from '@/lib/pdf-to-image-raster';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
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

    console.log(`[DIMENSION EXTRACTION] Starting extraction for ${documents.length} documents...`);

    let totalDimensions = 0;
    let processedSheets = 0;
    let errors: string[] = [];

    for (const document of documents) {
      try {
        // Check if already extracted (unless force reprocess)
        if (!forceReprocess) {
          const existing = await prisma.dimensionAnnotation.findFirst({
            where: {
              projectId: project.id,
              documentId: document.id
            }
          });

          if (existing) {
            console.log(`[DIMENSION EXTRACTION] Skipping ${document.name} - already processed`);
            const dims = existing.dimensions as any;
            if (Array.isArray(dims)) {
              totalDimensions += dims.length;
              processedSheets++;
            }
            continue;
          }
        }

        console.log(`[DIMENSION EXTRACTION] Processing ${document.name}...`);

        // Skip if no cloud storage path
        if (!document.cloud_storage_path) {
          console.log(`[DIMENSION EXTRACTION] Skipping ${document.name} - no cloud storage path`);
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

        // Get scale data if available
        const scaleChunk = await prisma.documentChunk.findFirst({
          where: {
            documentId: document.id,
            scaleData: { not: undefined }
          }
        });

        const scaleData = scaleChunk?.scaleData as any;

        // Extract first page as PDF for vision API processing
        // Using PDF native mode for best quality with vision APIs (Claude, GPT-4V)
        const rasterResult = await rasterizeSinglePage(buffer, 1, {
          dpi: 150,
          maxWidth: 2048,
          maxHeight: 2048,
          mode: 'pdf' // Use native PDF - better quality than rasterized images
        });

        const pageBase64 = rasterResult.base64;

        // Extract dimensions using vision (supports both PDF and image input)
        console.log(`[DIMENSION EXTRACTION] Analyzing ${sheetNumber} with GPT-5.2 Vision...`);
        const dimensions = await extractDimensionsWithVision(
          pageBase64,
          sheetNumber,
          scaleData
        );

        console.log(`[DIMENSION EXTRACTION] Extracted ${dimensions.length} dimensions from ${sheetNumber}`);

        // Validate dimension chains
        const dimensionsWithIds = dimensions.map((d, idx) => ({
          ...d,
          id: `${document.id}-dim-${idx}`,
          originalText: d.label,
          type: d.type,
          context: d.location,
          critical: false,
          position: d.boundingBox ? {
            x: d.boundingBox.x,
            y: d.boundingBox.y
          } : undefined,
          chainId: d.chainReference,
          validationErrors: []
        }));

        // Build dimension chains for validation
        const chainMap = new Map<string, any[]>();
        dimensionsWithIds.forEach(dim => {
          if (dim.chainId) {
            if (!chainMap.has(dim.chainId)) {
              chainMap.set(dim.chainId, []);
            }
            chainMap.get(dim.chainId)!.push(dim);
          }
        });

        const chains: any[] = [];
        chainMap.forEach((dims, chainId) => {
          const total = dims.reduce((sum, d) => sum + d.value, 0);
          chains.push({
            chainId,
            dimensions: dims,
            totalLength: total,
            valid: true,
            errorMessage: null
          });
        });

        // Calculate average confidence
        const avgConfidence = dimensions.length > 0
          ? dimensions.reduce((sum, d) => sum + d.confidence, 0) / dimensions.length
          : 0.85;

        // Store in database
        await prisma.dimensionAnnotation.upsert({
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
            dimensions: dimensionsWithIds,
            validationErrors: [],
            confidence: avgConfidence
          },
          update: {
            dimensions: dimensionsWithIds,
            validationErrors: [],
            confidence: avgConfidence,
            extractedAt: new Date()
          }
        });

        totalDimensions += dimensions.length;
        processedSheets++;

      } catch (error: any) {
        console.error(`[DIMENSION EXTRACTION] Error processing ${document.name}:`, error);
        errors.push(`${document.name}: ${error.message}`);
      }
    }

    console.log(`[DIMENSION EXTRACTION] Complete. Extracted ${totalDimensions} dimensions from ${processedSheets} sheets.`);

    return NextResponse.json({
      success: true,
      message: `Successfully extracted dimensions from ${processedSheets} sheets`,
      processed: processedSheets,
      totalDimensions,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error extracting dimensions:', error);
    return NextResponse.json({ 
      error: 'Failed to extract dimensions',
      details: error.message 
    }, { status: 500 });
  }
}
