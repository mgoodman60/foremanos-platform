import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractCalloutsFromText } from '@/lib/detail-callout-extractor';

/**
 * POST /api/projects/[slug]/cross-references/extract
 * Re-extract cross-references from all project documents
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all processed plan documents
    const documents = await prisma.document.findMany({
      where: {
        projectId: project.id,
        processed: true,
        deletedAt: null,
        OR: [
          { category: 'plans_drawings' },
          { fileType: 'pdf' },
          { fileType: { contains: 'pdf' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!documents.length) {
      return NextResponse.json({
        success: false,
        message: 'No processed plan documents found',
      });
    }

    // Delete existing cross-references for this project
    await prisma.detailCallout.deleteMany({
      where: { projectId: project.id },
    });

    // Track extraction results
    const results: {
      documentId: string;
      documentName: string;
      status: 'success' | 'failed' | 'skipped';
      calloutsExtracted?: number;
      error?: string;
    }[] = [];

    let totalCallouts = 0;

    // Process each document
    for (const doc of documents) {
      try {
        // Get document chunks
        const chunks = await prisma.documentChunk.findMany({
          where: { documentId: doc.id },
          select: { content: true, pageNumber: true },
          take: 50,
        });

        // Extract sheet number from document name
        const sheetMatch = doc.name.match(/([A-Z]?\d*-?\d+)/i);
        const sourceSheet = sheetMatch ? sheetMatch[1] : doc.name;

        // Combine all chunk content
        const docText = chunks.map(c => c.content).join('\n');

        if (!docText || docText.length < 50) {
          results.push({
            documentId: doc.id,
            documentName: doc.name,
            status: 'skipped',
            calloutsExtracted: 0,
            error: 'No text content extracted',
          });
          continue;
        }

        // Extract cross-references from text
        const callouts = extractCalloutsFromText(docText, sourceSheet);

        if (callouts && callouts.length > 0) {
          // Save callouts to database
          for (const callout of callouts) {
            await prisma.detailCallout.create({
              data: {
                projectId: project.id,
                documentId: doc.id,
                type: callout.type || 'reference',
                number: callout.number || '',
                sheetReference: callout.sheetReference || '',
                sourceSheet: sourceSheet,
                sourceLocation: '',
                description: callout.description || '',
                confidence: callout.confidence || 0.8,
              },
            });
            totalCallouts++;
          }

          results.push({
            documentId: doc.id,
            documentName: doc.name,
            status: 'success',
            calloutsExtracted: callouts.length,
          });
        } else {
          results.push({
            documentId: doc.id,
            documentName: doc.name,
            status: 'skipped',
            calloutsExtracted: 0,
            error: 'No cross-references found in text',
          });
        }
      } catch (error: any) {
        console.error(`[Cross-Ref Extract] Error processing ${doc.name}:`, error);
        results.push({
          documentId: doc.id,
          documentName: doc.name,
          status: 'failed',
          error: error.message || 'Extraction failed',
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    return NextResponse.json({
      success: true,
      message: `Extracted ${totalCallouts} cross-references from ${successCount} documents`,
      summary: {
        documentsProcessed: documents.length,
        documentsWithRefs: successCount,
        totalCallouts,
      },
      results,
    });
  } catch (error: any) {
    console.error('[Cross-Reference Extract Error]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract cross-references' },
      { status: 500 }
    );
  }
}
