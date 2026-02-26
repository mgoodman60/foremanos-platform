import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  processDocumentForSync,
  syncAllProjectDocuments,
  getProjectSyncStatus,
} from '@/lib/document-auto-sync';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SYNC');

// GET /api/projects/[slug]/sync - Get sync status for all features
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const status = await getProjectSyncStatus(project.id);

    return NextResponse.json({
      success: true,
      projectId: project.id,
      projectName: project.name,
      ...status,
    });
  } catch (error) {
    logger.error('[Sync API] Error', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[slug]/sync - Trigger sync for project
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { documentId, feature: _feature } = body;

    let result;

    if (documentId) {
      // Sync specific document
      result = await processDocumentForSync(documentId, project.id);
      return NextResponse.json({
        success: true,
        type: 'document',
        result,
      });
    } else {
      // Sync all documents
      result = await syncAllProjectDocuments(project.id);
      return NextResponse.json({
        success: true,
        type: 'project',
        documentsProcessed: result.processed,
        results: result.results,
      });
    }
  } catch (error: unknown) {
    logger.error('[Sync API] Error', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errMsg || 'Failed to sync' },
      { status: 500 }
    );
  }
}
