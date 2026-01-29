import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  extractTitleBlock,
  storeTitleBlockData,
  TitleBlockData
} from '@/lib/title-block-extractor';
import { getFileUrl } from '@/lib/s3';
import { rasterizeSinglePage } from '@/lib/pdf-to-image-raster';

/**
 * POST /api/projects/[slug]/extract-title-blocks
 * 
 * Extracts title block information from all documents in a project
 * or from a specific document if documentId is provided
 */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await req.json();
    const { documentId, forceReprocess } = body;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        Document: {
          where: documentId ? { id: documentId } : undefined,
          include: {
            DocumentChunk: true
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

    // Process each document
    for (const document of project.Document) {
      // Skip non-PDF documents
      if (!document.name.toLowerCase().endsWith('.pdf')) {
        continue;
      }

      console.log(`Processing ${document.name}...`);

      try {
        // Skip if no cloud storage path
        if (!document.cloud_storage_path) {
          console.log(`Skipping ${document.name} - no cloud storage path`);
          continue;
        }

        // Download document from S3
        const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to download document: ${response.statusText}`);
        }
        const pdfBuffer = Buffer.from(await response.arrayBuffer());

        // Process first page only (title blocks are usually on first page)
        const chunks = document.DocumentChunk.filter((c: any) => {
          const isPageOne = c.pageNumber === 1;
          const needsProcessing = forceReprocess || !c.titleBlockData;
          return isPageOne && needsProcessing;
        });

        for (const chunk of chunks) {
          try {
            // Convert first page to image using serverless-compatible rasterization
            const rasterResult = await rasterizeSinglePage(pdfBuffer, 1, {
              dpi: 150,
              maxWidth: 1500,
              maxHeight: 1500,
              format: 'jpeg',
              quality: 90
            });

            // Extract title block
            const extractionResult = await extractTitleBlock(
              rasterResult.base64,
              chunk.content || '',
              document.name
            );

            if (extractionResult.success && extractionResult.data) {
              // Store in database
              await storeTitleBlockData(
                document.id,
                chunk.id,
                extractionResult.data
              );

              results.push({
                documentId: document.id,
                documentName: document.name,
                chunkId: chunk.id,
                success: true,
                sheetNumber: extractionResult.data.sheetNumber,
                confidence: extractionResult.confidence,
                method: extractionResult.extractionMethod
              });

              successCount++;
            } else {
              results.push({
                documentId: document.id,
                documentName: document.name,
                chunkId: chunk.id,
                success: false,
                error: extractionResult.error
              });

              errorCount++;
            }
          } catch (chunkError) {
            console.error(`Error processing chunk ${chunk.id}:`, chunkError);
            errorCount++;
          }
        }
      } catch (docError) {
        console.error(`Error processing document ${document.id}:`, docError);
        results.push({
          documentId: document.id,
          documentName: document.name,
          success: false,
          error: docError instanceof Error ? docError.message : 'Unknown error'
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${successCount + errorCount} documents`,
      successCount,
      errorCount,
      results
    });
  } catch (error) {
    console.error('Title block extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract title blocks' },
      { status: 500 }
    );
  }
}

