/**
 * API Endpoint: Extract Detail Callouts from Documents
 * 
 * POST /api/projects/[slug]/extract-callouts
 * 
 * Extracts detail callouts, section cuts, elevation markers, and other
 * cross-references from construction drawings.
 * 
 * Phase B.1 - Document Intelligence Roadmap
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  extractCalloutsFromText,
  extractCalloutsWithVision,
  storeCallouts,
} from '@/lib/detail-callout-extractor';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const _execAsync = promisify(exec);

interface ExtractionRequest {
  documentIds?: string[];       // Specific documents to process
  useVision?: boolean;           // Use GPT-4o Vision (default: true)
  usePatterns?: boolean;         // Use pattern matching (default: true)
  force?: boolean;               // Re-extract even if already processed
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: ExtractionRequest = await request.json();
    const {
      documentIds,
      useVision = true,
      usePatterns = true,
      force = false,
    } = body;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        Document: {
          where: documentIds ? { id: { in: documentIds } } : {},
          include: { DocumentChunk: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Filter for PDF documents with chunks (already processed)
    const documents = project.Document.filter(
      (doc: any) => doc.fileType === 'pdf' && doc.DocumentChunk.length > 0
    );

    if (documents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No processable documents found',
        processed: 0,
        calloutsExtracted: 0,
      });
    }

    let totalCallouts = 0;
    let processedDocs = 0;
    const results: any[] = [];

    // Process each document
    for (const document of documents) {
      try {
        console.log(`Extracting callouts from: ${document.name}`);

        // Group chunks by sheet number
        const sheetMap = new Map<string, any[]>();
        for (const chunk of document.DocumentChunk) {
          const sheetNumber = chunk.sheetNumber || 'unknown';
          if (!sheetMap.has(sheetNumber)) {
            sheetMap.set(sheetNumber, []);
          }
          sheetMap.get(sheetNumber)!.push(chunk);
        }

        // Process each sheet
        for (const [sheetNumber, chunks] of sheetMap.entries()) {
          if (sheetNumber === 'unknown') continue;

          // Check if already processed (unless force=true)
          if (!force) {
            const existing = await prisma.detailCallout.count({
              where: {
                projectId: project.id,
                sourceSheet: sheetNumber,
              },
            });

            if (existing > 0) {
              console.log(`Sheet ${sheetNumber} already processed, skipping`);
              continue;
            }
          }

          let callouts: any[] = [];

          // Method 1: Pattern matching from text
          if (usePatterns) {
            const combinedText = chunks.map((c) => c.text).join('\n');
            const patternCallouts = extractCalloutsFromText(
              combinedText,
              sheetNumber
            );
            callouts = callouts.concat(patternCallouts);
            console.log(
              `  Pattern matching found ${patternCallouts.length} callouts`
            );
          }

          // Method 2: Vision analysis
          if (useVision) {
            // Convert first page of sheet to image
            const imagePath = await convertPdfPageToImage(
              document.cloud_storage_path!,
              chunks[0].pageNumber || 1
            );

            if (imagePath) {
              try {
                const imageBase64 = await fs.readFile(imagePath, 'base64');
                const visionCallouts = await extractCalloutsWithVision(
                  imageBase64,
                  sheetNumber
                );
                
                // Merge vision results (prefer higher confidence)
                for (const vCall of visionCallouts) {
                  const duplicate = callouts.find(
                    (c) =>
                      c.number === vCall.number &&
                      c.sheetReference === vCall.sheetReference
                  );

                  if (duplicate) {
                    // Update if vision has higher confidence
                    if (vCall.confidence > duplicate.confidence) {
                      Object.assign(duplicate, vCall);
                    }
                  } else {
                    callouts.push(vCall);
                  }
                }

                console.log(
                  `  Vision analysis found ${visionCallouts.length} callouts`
                );
              } finally {
                // Clean up temp file
                await fs.unlink(imagePath).catch(() => {});
              }
            }
          }

          // Store callouts in database
          if (callouts.length > 0) {
            await storeCallouts(
              project.id,
              document.id,
              sheetNumber,
              callouts
            );

            totalCallouts += callouts.length;
            results.push({
              sheet: sheetNumber,
              document: document.name,
              calloutsFound: callouts.length,
            });
          }
        }

        processedDocs++;
      } catch (error) {
        console.error(`Error processing document ${document.name}:`, error);
        results.push({
          document: document.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedDocuments: processedDocs,
      totalCallouts,
      results,
    });
  } catch (error) {
    console.error('Callout extraction error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract callouts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Convert PDF page to image for vision analysis
 */
async function convertPdfPageToImage(
  s3Key: string,
  pageNumber: number
): Promise<string | null> {
  try {
    const tempDir = os.tmpdir();
    const _outputPath = path.join(
      tempDir,
      `pdf-page-${Date.now()}-${pageNumber}.png`
    );

    // Download from S3 and convert
    // For now, return null if cloud_storage_path is not accessible
    // In production, you'd download from S3 first
    console.warn('PDF to image conversion not fully implemented for S3');
    return null;
  } catch (error) {
    console.error('PDF conversion error:', error);
    return null;
  }
}
