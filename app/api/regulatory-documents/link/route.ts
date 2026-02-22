/**
 * API endpoint to link cached regulatory documents to a project
 * 
 * POST /api/regulatory-documents/link
 * Body: { projectId: string, standard: string, version: string }
 * 
 * Links a cached regulatory document to a project, or returns info if it needs processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { ensureRegulatoryDocumentForProject } from '@/lib/regulatory-documents';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('REGULATORY_DOCUMENTS_LINK');

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { projectId, standard, version } = body;

    if (!projectId || !standard || !version) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, standard, version' },
        { status: 400 }
      );
    }

    // Verify user has access to the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only project owner or admin can link regulatory documents
    if (project.ownerId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Ensure regulatory document is available for the project
    const result = await ensureRegulatoryDocumentForProject(
      projectId,
      standard,
      version
    );

    if (result.success && result.cached) {
      return NextResponse.json({
        success: true,
        cached: true,
        message: `Successfully linked ${standard} ${version} to project`,
        chunksAvailable: result.chunksAvailable,
      });
    } else if (result.needsProcessing) {
      return NextResponse.json({
        success: true,
        cached: false,
        needsProcessing: true,
        message: `${standard} ${version} needs to be processed first`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to link regulatory document',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error linking regulatory document', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
