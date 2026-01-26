import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  extractTitleBlock,
  storeTitleBlockData,
  TitleBlockData
} from '@/lib/title-block-extractor';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

        // Download document from S3 if needed
        const documentPath = await downloadDocument(document.cloud_storage_path);

        // Process first page only (title blocks are usually on first page)
        const chunks = document.DocumentChunk.filter((c: any) => {
          const isPageOne = c.pageNumber === 1;
          const needsProcessing = forceReprocess || !c.titleBlockData;
          return isPageOne && needsProcessing;
        });

        for (const chunk of chunks) {
          try {
            // Convert first page to image
            const imageBase64 = await pdfPageToBase64(documentPath, 1);

            // Extract title block
            const extractionResult = await extractTitleBlock(
              imageBase64,
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

        // Clean up temporary file
        await fs.unlink(documentPath).catch(() => {});
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function downloadDocument(cloudStoragePath: string): Promise<string> {
  // For now, assume documents are already accessible
  // In production, you'd download from S3 here
  const tempPath = path.join('/tmp', `doc-${Date.now()}.pdf`);
  
  // This is a placeholder - in production, download from S3
  // For now, assume document is in public folder
  const publicPath = path.join(process.cwd(), 'public', cloudStoragePath);
  
  try {
    await fs.copyFile(publicPath, tempPath);
    return tempPath;
  } catch (error) {
    throw new Error(`Failed to download document: ${cloudStoragePath}`);
  }
}

async function pdfPageToBase64(pdfPath: string, pageNumber: number): Promise<string> {
  const tempImagePath = path.join('/tmp', `page-${Date.now()}.jpg`);

  try {
    // Convert PDF page to image using pdftoppm
    const command = `pdftoppm -jpeg -f ${pageNumber} -l ${pageNumber} -scale-to 1500 "${pdfPath}" "${tempImagePath.replace('.jpg', '')}"`;
    await execAsync(command);

    // The output file will have -1.jpg appended
    const actualImagePath = tempImagePath.replace('.jpg', '-1.jpg');

    // Read and convert to base64
    const imageBuffer = await fs.readFile(actualImagePath);
    const base64 = imageBuffer.toString('base64');

    // Clean up
    await fs.unlink(actualImagePath).catch(() => {});

    return base64;
  } catch (error) {
    console.error('PDF to image conversion error:', error);
    throw error;
  }
}
