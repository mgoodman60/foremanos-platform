import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_RFIS');

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rfi = await prisma.rFI.findUnique({
      where: { id: params.id },
      include: {
        createdByUser: { select: { id: true, username: true } },
        comments: {
          include: {
            user: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!rfi) {
      return NextResponse.json({ error: 'RFI not found' }, { status: 404 });
    }

    return NextResponse.json({ rfi });
  } catch (error) {
    logger.error('[RFI API] Get error', error);
    return NextResponse.json(
      { error: 'Failed to fetch RFI' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      question,
      status,
      priority,
      assignedTo,
      assignedToName,
      assignedToEmail,
      specSection,
      drawingRef,
      documentIds,
      response,
      costImpact,
      scheduleImpact,
      impactNotes,
      ballInCourt,
      dueDate,
    } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (question !== undefined) updateData.question = question;
    if (priority !== undefined) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (assignedToName !== undefined) updateData.assignedToName = assignedToName;
    if (assignedToEmail !== undefined) updateData.assignedToEmail = assignedToEmail;
    if (specSection !== undefined) updateData.specSection = specSection;
    if (drawingRef !== undefined) updateData.drawingRef = drawingRef;
    if (documentIds !== undefined) updateData.documentIds = documentIds;
    if (costImpact !== undefined) updateData.costImpact = costImpact;
    if (scheduleImpact !== undefined) updateData.scheduleImpact = scheduleImpact;
    if (impactNotes !== undefined) updateData.impactNotes = impactNotes;
    if (ballInCourt !== undefined) updateData.ballInCourt = ballInCourt;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    // Handle response
    if (response !== undefined) {
      updateData.response = response;
      updateData.respondedBy = session.user.id;
      updateData.respondedAt = new Date();
      updateData.status = 'RESPONDED';
    }

    // Handle status changes
    if (status === 'CLOSED') {
      updateData.status = 'CLOSED';
      updateData.closedAt = new Date();
      updateData.closedBy = session.user.id;
    } else if (status && !response) {
      updateData.status = status;
    }

    const rfi = await prisma.rFI.update({
      where: { id: params.id },
      data: updateData,
      include: {
        createdByUser: { select: { id: true, username: true } },
        comments: {
          include: {
            user: { select: { id: true, username: true } },
          },
        },
      },
    });

    return NextResponse.json({ rfi });
  } catch (error) {
    logger.error('[RFI API] Update error', error);
    return NextResponse.json(
      { error: 'Failed to update RFI' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.rFI.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[RFI API] Delete error', error);
    return NextResponse.json(
      { error: 'Failed to delete RFI' },
      { status: 500 }
    );
  }
}
