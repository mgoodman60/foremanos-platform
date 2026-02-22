import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PUNCH_LIST');

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const item = await prisma.punchListItem.findUnique({
      where: { id: params.id },
      include: {
        createdByUser: { select: { id: true, username: true } },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    logger.error('[Punch List API] Get error', error);
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      status,
      priority,
      location,
      floor,
      room,
      assignedTo,
      assignedToName,
      trade,
      category,
      photoIds,
      completionPhotoIds,
      dueDate,
      notes,
      completionNotes,
    } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (location !== undefined) updateData.location = location;
    if (floor !== undefined) updateData.floor = floor;
    if (room !== undefined) updateData.room = room;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (assignedToName !== undefined) updateData.assignedToName = assignedToName;
    if (trade !== undefined) updateData.trade = trade;
    if (category !== undefined) updateData.category = category;
    if (photoIds !== undefined) updateData.photoIds = photoIds;
    if (completionPhotoIds !== undefined) updateData.completionPhotoIds = completionPhotoIds;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (completionNotes !== undefined) updateData.completionNotes = completionNotes;

    // Handle status changes
    if (status === 'COMPLETED') {
      updateData.status = 'COMPLETED';
      updateData.completedAt = new Date();
      updateData.completedBy = session.user.id;
    } else if (status === 'VERIFIED') {
      updateData.status = 'VERIFIED';
      updateData.verifiedAt = new Date();
      updateData.verifiedBy = session.user.id;
    } else if (status) {
      updateData.status = status;
    }

    const item = await prisma.punchListItem.update({
      where: { id: params.id },
      data: updateData,
      include: {
        createdByUser: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    logger.error('[Punch List API] Update error', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.punchListItem.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Punch List API] Delete error', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}
