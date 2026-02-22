import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE');

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[slug]/schedule
 * Set the master schedule for a project
 */
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions (only owner or admin can set master schedule)
    const isOwner = project.ownerId === user.id;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only project owner or admin can set master schedule' },
        { status: 403 }
      );
    }

    // Verify the document exists and belongs to this project
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        projectId: project.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found in this project' },
        { status: 404 }
      );
    }

    // Update project with master schedule reference
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        masterScheduleDocId: documentId,
        scheduleConfirmedAt: new Date(),
        scheduleConfirmedBy: user.id,
      },
    });

    logger.info('Set master schedule for project', { slug: project.slug, document: document.name });

    return NextResponse.json({
      success: true,
      project: updatedProject,
      Document: {
        id: document.id,
        name: document.name,
        fileName: document.fileName,
      },
    });
  } catch (error: unknown) {
    logger.error('', error);
    return NextResponse.json(
      { error: 'Failed to set master schedule' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[slug]/schedule
 * Get the master schedule information for a project
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        Document: {
          select: {
            id: true,
            name: true,
            fileName: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find the master schedule document if set
    let masterScheduleDoc = null;
    if (project.masterScheduleDocId) {
      masterScheduleDoc = project.Document.find(
        (doc: any) => doc.id === project.masterScheduleDocId
      );
    }

    return NextResponse.json({
      masterScheduleDocId: project.masterScheduleDocId,
      scheduleConfirmedAt: project.scheduleConfirmedAt,
      document: masterScheduleDoc,
      hasSchedule: !!project.masterScheduleDocId,
    });
  } catch (error: unknown) {
    logger.error('', error);
    return NextResponse.json(
      { error: 'Failed to get master schedule info' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[slug]/schedule
 * Remove the master schedule reference from a project
 */
export async function DELETE(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions (only owner or admin can remove master schedule)
    const isOwner = project.ownerId === user.id;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only project owner or admin can remove master schedule' },
        { status: 403 }
      );
    }

    // Update project to remove master schedule reference
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        masterScheduleDocId: null,
        scheduleConfirmedAt: null,
        scheduleConfirmedBy: null,
      },
    });

    logger.info('Removed master schedule from project', { slug: project.slug });

    return NextResponse.json({
      success: true,
      project: updatedProject,
    });
  } catch (error: unknown) {
    logger.error('', error);
    return NextResponse.json(
      { error: 'Failed to remove master schedule' },
      { status: 500 }
    );
  }
}
