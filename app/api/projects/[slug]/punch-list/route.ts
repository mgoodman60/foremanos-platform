import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PUNCH_LIST');

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
    const category = searchParams.get('category');
    const assignedTo = searchParams.get('assignedTo');

    const where: any = { projectId: project.id };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (assignedTo) where.assignedTo = assignedTo;

    const items = await prisma.punchListItem.findMany({
      where,
      include: {
        createdByUser: { select: { id: true, username: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    // Get summary stats
    const stats = await prisma.punchListItem.groupBy({
      by: ['status'],
      where: { projectId: project.id },
      _count: true,
    });

    return NextResponse.json({ items, stats });
  } catch (error) {
    logger.error('[Punch List API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch punch list' },
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
      description,
      priority,
      location,
      floor,
      room,
      assignedTo,
      assignedToName,
      trade,
      category,
      photoIds,
      dueDate,
      notes,
    } = body;

    // Get next item number
    const lastItem = await prisma.punchListItem.findFirst({
      where: { projectId: project.id },
      orderBy: { itemNumber: 'desc' },
    });
    const itemNumber = (lastItem?.itemNumber || 0) + 1;

    const item = await prisma.punchListItem.create({
      data: {
        projectId: project.id,
        itemNumber,
        title,
        description,
        priority: priority || 'NORMAL',
        location,
        floor,
        room,
        assignedTo,
        assignedToName,
        trade,
        category: category || 'GENERAL',
        photoIds: photoIds || [],
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
        createdBy: session.user.id,
      },
      include: {
        createdByUser: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    logger.error('[Punch List API] Create error', error);
    return NextResponse.json(
      { error: 'Failed to create punch list item' },
      { status: 500 }
    );
  }
}
