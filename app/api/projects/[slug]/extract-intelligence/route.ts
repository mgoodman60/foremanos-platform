import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runIntelligenceExtraction } from '@/lib/intelligence-orchestrator';
import { safeErrorMessage } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_EXTRACT_INTELLIGENCE');

/**
 * POST /api/projects/[slug]/extract-intelligence
 * 
 * Manually trigger intelligence extraction (Phase A, B, C) for documents
 * Useful for re-processing or processing documents that were added before
 * the automatic extraction system was implemented.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can trigger extraction
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { slug } = params;
    const body = await req.json();
    const { documentId, phases, skipExisting } = body;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        Document: documentId ? {
          where: { id: documentId },
        } : {
          where: { processed: true }, // Only extract from processed documents
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.Document.length === 0) {
      return NextResponse.json(
        { error: 'No documents found to process' },
        { status: 404 }
      );
    }

    // Trigger extraction for all documents
    const results: any[] = [];
    const requestedPhases = phases || ['A', 'B', 'C'];

    logger.info('Manual intelligence extraction triggered', {
      user: session.user?.email,
      project: project.name,
      documents: project.Document.length,
      phases: requestedPhases.join(', '),
    });

    for (const document of project.Document) {
      try {
        const result = await runIntelligenceExtraction({
          documentId: document.id,
          projectSlug: slug,
          phases: requestedPhases,
          skipExisting: skipExisting !== false, // Default to true
        });

        results.push({
          documentName: document.name,
          ...result,
        });
      } catch (error: unknown) {
        logger.error('Failed to extract intelligence', error, { document: document.name });
        results.push({
          documentId: document.id,
          documentName: document.name,
          success: false,
          error: safeErrorMessage(error),
        });
      }
    }

    // Calculate summary
    const summary = {
      totalDocuments: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      phasesRun: requestedPhases,
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
    });
  } catch (error: unknown) {
    logger.error('Intelligence extraction API error', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to trigger intelligence extraction') },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[slug]/extract-intelligence
 * 
 * Get extraction status and statistics
 */
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project with extraction statistics
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        Document: {
          select: {
            id: true,
            name: true,
            processed: true,
            _count: {
              select: {
                DocumentChunk: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get chunk statistics
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          projectId: project.id,
        },
      },
      select: {
        sheetNumber: true,
        scaleData: true,
        dimensions: true,
        annotations: true,
        crossReferences: true,
        titleBlockData: true,
        metadata: true,
      },
    });

    // Calculate extraction statistics
    const stats = {
      totalChunks: chunks.length,
      phaseA: {
        titleBlocks: chunks.filter((c: any) => c.titleBlockData).length,
        scales: chunks.filter((c: any) => c.scaleData).length,
        sheets: new Set(chunks.filter((c: any) => c.sheetNumber).map((c: any) => c.sheetNumber)).size,
      },
      phaseB: {
        dimensions: chunks.filter((c: any) => c.dimensions).length,
        annotations: chunks.filter((c: any) => c.annotations).length,
        crossReferences: chunks.filter((c: any) => c.crossReferences).length,
      },
      phaseC: {
        spatialReferences: chunks.filter((c: any) => {
          const meta = c.metadata as any;
          return meta?.spatialReference != null;
        }).length,
        mepElements: chunks.filter((c: any) => {
          const meta = c.metadata as any;
          return meta?.mepElements != null && meta.mepElements.length > 0;
        }).length,
      },
    };

    return NextResponse.json({
      Project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
      },
      documents: project.Document,
      extractionStats: stats,
    });
  } catch (error: unknown) {
    logger.error('Get extraction stats error', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to get extraction statistics') },
      { status: 500 }
    );
  }
}
