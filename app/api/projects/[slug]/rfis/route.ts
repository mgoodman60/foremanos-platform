import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_RFIS');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assignedTo = searchParams.get('assignedTo');

    const where: any = { projectId: project.id };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;

    const rfis = await prisma.rFI.findMany({
      where,
      include: {
        createdByUser: { select: { id: true, username: true } },
        comments: {
          include: {
            user: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ rfis });
  } catch (error) {
    logger.error('[RFI API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch RFIs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      question,
      priority,
      assignedTo,
      assignedToName,
      assignedToEmail,
      specSection,
      drawingRef,
      documentIds,
      dueDate,
      ballInCourt,
    } = body;

    // Get next RFI number
    const lastRFI = await prisma.rFI.findFirst({
      where: { projectId: project.id },
      orderBy: { rfiNumber: 'desc' },
    });
    const rfiNumber = (lastRFI?.rfiNumber || 0) + 1;

    const rfi = await prisma.rFI.create({
      data: {
        projectId: project.id,
        rfiNumber,
        title,
        question,
        priority: priority || 'NORMAL',
        assignedTo,
        assignedToName,
        assignedToEmail,
        specSection,
        drawingRef,
        documentIds: documentIds || [],
        dueDate: dueDate ? new Date(dueDate) : null,
        ballInCourt,
        createdBy: session.user.id,
      },
      include: {
        createdByUser: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json({ rfi });
  } catch (error) {
    logger.error('[RFI API] Create error', error);
    return NextResponse.json(
      { error: 'Failed to create RFI' },
      { status: 500 }
    );
  }
}
