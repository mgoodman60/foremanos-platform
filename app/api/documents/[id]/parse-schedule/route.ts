import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractScheduleWithAI, deleteScheduleForDocument } from '@/lib/schedule-extractor-ai';
import { safeErrorMessage } from '@/lib/api-error';

// POST /api/documents/[id]/parse-schedule - Parse schedule from document using AI
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { scheduleName } = body;

    // Get document
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        Project: {
          include: {
            User_Project_ownerIdToUser: true,
            ProjectMember: { include: { User: true } }
          }
        }
      }
    });

    if (!document || !document.Project) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify user access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = document.Project.ownerId === user.id;
    const isMember = document.Project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if document is processed
    if (!document.processed) {
      return NextResponse.json(
        { error: 'Document must be processed for OCR before schedule parsing. Please wait for document processing to complete.' },
        { status: 400 }
      );
    }

    console.log(`[PARSE_SCHEDULE] Starting AI-powered parse for document ${document.name}`);

    // Delete any existing schedules for this document
    await deleteScheduleForDocument(id);

    // Parse schedule using AI
    const result = await extractScheduleWithAI(
      id,
      document.Project.id,
      user.id,
      scheduleName
    );

    console.log(`[PARSE_SCHEDULE] Parse complete: ${result.totalTasks} tasks found`);

    // Get created schedule with tasks
    const schedule = await prisma.schedule.findUnique({
      where: { id: result.scheduleId },
      include: {
        ScheduleTask: {
          orderBy: { startDate: 'asc' },
          take: 10 // Return first 10 tasks in response
        },
        Document: {
          select: {
            id: true,
            name: true,
            fileName: true
          }
        },
        User: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Schedule parsed successfully',
      schedule,
      summary: {
        totalTasks: result.totalTasks,
        criticalPathTasks: result.criticalPathTasks,
        startDate: result.startDate,
        endDate: result.endDate
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('[PARSE_SCHEDULE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to parse schedule', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
