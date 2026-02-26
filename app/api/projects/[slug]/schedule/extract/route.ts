import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { 
  extractScheduleFromDocument, 
  matchTasksToSubcontractors,
  importExtractedTasks 
} from '@/lib/schedule-document-extractor';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_EXTRACT');

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[slug]/schedule/extract
 * Extract schedule data from an uploaded document
 * 
 * Body:
 * - documentId: ID of the document to extract from
 * - importToSchedule: Optional schedule ID to import tasks into
 * - projectStartDate: Start date for imported tasks
 */
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { documentId, importToSchedule, projectStartDate } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify document belongs to project
    const document = await prisma.document.findFirst({
      where: { id: documentId, projectId: project.id }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found in project' }, { status: 404 });
    }

    // Extract schedule from document
    const extraction = await extractScheduleFromDocument(documentId);

    if (!extraction.success || extraction.extractedTasks.length === 0) {
      return NextResponse.json({
        success: false,
        source: extraction.source,
        warnings: extraction.warnings,
        message: 'Could not extract schedule tasks from this document'
      });
    }

    // Match tasks to subcontractors
    const matchedTasks = await matchTasksToSubcontractors(extraction.extractedTasks, project.id);

    // Import to schedule if requested
    let importResult: Awaited<ReturnType<typeof importExtractedTasks>> | null = null;
    if (importToSchedule) {
      const startDate = projectStartDate ? new Date(projectStartDate) : new Date();
      importResult = await importExtractedTasks(importToSchedule, matchedTasks, startDate);
    }

    return NextResponse.json({
      success: true,
      source: extraction.source,
      extractedTasks: matchedTasks.length,
      tasks: matchedTasks.slice(0, 50), // Return first 50 for preview
      projectInfo: extraction.projectInfo,
      warnings: extraction.warnings,
      importResult
    });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract schedule' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[slug]/schedule/extract
 * List documents that can be used for schedule extraction
 */
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get documents that may contain schedule information
    const documents = await prisma.document.findMany({
      where: {
        projectId: project.id,
        OR: [
          { name: { contains: 'schedule', mode: 'insensitive' } },
          { name: { contains: 'gantt', mode: 'insensitive' } },
          { name: { contains: 'timeline', mode: 'insensitive' } },
          { name: { contains: 'lookahead', mode: 'insensitive' } },
          { name: { endsWith: '.xlsx' } },
          { name: { endsWith: '.xls' } },
          { name: { endsWith: '.mpp' } }
        ]
      },
      select: {
        id: true,
        name: true,
        fileType: true,
        createdAt: true,
        fileSize: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      documents,
      count: documents.length
    });
  } catch (error) {
    logger.error('List error', error);
    return NextResponse.json(
      { error: 'Failed to list extractable documents' },
      { status: 500 }
    );
  }
}
