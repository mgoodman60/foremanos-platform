import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MILESTONES');

// GET /api/projects/[slug]/milestones/[id]
export async function GET(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: params.id },
      include: {
        createdByUser: { select: { username: true } }
      }
    });

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Get linked tasks
    let linkedTasks: any[] = [];
    if (milestone.linkedTaskIds.length > 0) {
      linkedTasks = await prisma.scheduleTask.findMany({
        where: { taskId: { in: milestone.linkedTaskIds } },
        select: {
          id: true,
          taskId: true,
          name: true,
          percentComplete: true,
          status: true,
          endDate: true
        }
      });
    }

    return NextResponse.json({ ...milestone, linkedTasks });
  } catch (error) {
    logger.error('Get milestone error', error);
    return NextResponse.json({ error: 'Failed to fetch milestone' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/milestones/[id]
export async function PATCH(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      description,
      plannedDate,
      forecastDate,
      actualDate,
      status,
      category,
      isCritical,
      paymentLinked,
      paymentAmount,
      linkedTaskIds,
      predecessorIds,
      notes
    } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (plannedDate !== undefined) updateData.plannedDate = new Date(plannedDate);
    if (forecastDate !== undefined) updateData.forecastDate = new Date(forecastDate);
    if (actualDate !== undefined) {
      updateData.actualDate = new Date(actualDate);
      updateData.status = 'COMPLETED';
    }
    if (status !== undefined) updateData.status = status;
    if (category !== undefined) updateData.category = category;
    if (isCritical !== undefined) updateData.isCritical = isCritical;
    if (paymentLinked !== undefined) updateData.paymentLinked = paymentLinked;
    if (paymentAmount !== undefined) updateData.paymentAmount = paymentAmount;
    if (linkedTaskIds !== undefined) updateData.linkedTaskIds = linkedTaskIds;
    if (predecessorIds !== undefined) updateData.predecessorIds = predecessorIds;
    if (notes !== undefined) updateData.notes = notes;

    const milestone = await prisma.milestone.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json(milestone);
  } catch (error) {
    logger.error('Update milestone error', error);
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/milestones/[id]
export async function DELETE(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.milestone.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete milestone error', error);
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 });
  }
}
