/**
 * API endpoint to initialize all regulatory documents for a project
 * 
 * POST /api/regulatory-documents/initialize
 * Body: { projectId: string }
 * 
 * Links all available cached regulatory documents to a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { initializeRegulatoryDocumentsForProject } from '@/lib/regulatory-documents';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required field: projectId' },
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

    // Only project owner or admin can initialize regulatory documents
    if (project.ownerId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Initialize regulatory documents for the project
    const result = await initializeRegulatoryDocumentsForProject(projectId);

    return NextResponse.json({
      success: true,
      documentsLinked: result.documentsLinked,
      documentsNeedingProcessing: result.documentsNeedingProcessing,
      details: result.details,
      message:
        result.documentsLinked > 0
          ? `Successfully linked ${result.documentsLinked} regulatory documents to project`
          : 'No cached regulatory documents available',
    });
  } catch (error) {
    console.error('Error initializing regulatory documents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
