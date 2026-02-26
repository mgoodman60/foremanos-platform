import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_UPDATES');

// PATCH /api/projects/[slug]/schedule-updates/[id] - Approve or reject a schedule update
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;
    const body = await request.json();
    const { action, reason } = body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve or reject' },
        { status: 400 }
      );
    }

    // Fetch project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only owners and admins can approve/reject
    const isOwner = project.ownerId === session.user.id;
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only project owners and admins can approve or reject updates' },
        { status: 403 }
      );
    }

    // Fetch the schedule update
    const scheduleUpdate = await prisma.scheduleUpdate.findUnique({
      where: { id },
      include: {
        Schedule: true,
      },
    });

    if (!scheduleUpdate) {
      return NextResponse.json({ error: 'Schedule update not found' }, { status: 404 });
    }

    if (scheduleUpdate.projectId !== project.id) {
      return NextResponse.json({ error: 'Schedule update does not belong to this project' }, { status: 403 });
    }

    if (scheduleUpdate.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot ${action} an update that is already ${scheduleUpdate.status}` },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Apply the schedule update
      const updateData: any = {};

      if (scheduleUpdate.newStatus) {
        updateData.status = scheduleUpdate.newStatus;
      }

      if (scheduleUpdate.newPercentComplete !== null && scheduleUpdate.newPercentComplete !== undefined) {
        updateData.percentComplete = scheduleUpdate.newPercentComplete;
      }

      // Update the schedule
      await prisma.schedule.update({
        where: { id: scheduleUpdate.scheduleId },
        data: updateData,
      });

      // Mark update as applied
      await prisma.scheduleUpdate.update({
        where: { id },
        data: {
          status: 'applied',
          appliedAt: new Date(),
          appliedBy: session.user.id,
        },
      });

      return NextResponse.json({
        message: 'Schedule update approved and applied successfully',
        update: { ...scheduleUpdate, status: 'applied' },
      });
    } else {
      // Reject the update
      await prisma.scheduleUpdate.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: session.user.id,
          rejectionReason: reason || 'No reason provided',
        },
      });

      return NextResponse.json({
        message: 'Schedule update rejected successfully',
        update: { ...scheduleUpdate, status: 'rejected' },
      });
    }
  } catch (error: unknown) {
    logger.error('Error updating schedule update', error);
    return NextResponse.json(
      { error: 'Failed to update schedule update' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[slug]/schedule-updates/[id] - Delete a schedule update
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;

    // Fetch project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only owners and admins can delete
    const isOwner = project.ownerId === session.user.id;
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only project owners and admins can delete updates' },
        { status: 403 }
      );
    }

    // Delete the schedule update
    await prisma.scheduleUpdate.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Schedule update deleted successfully' });
  } catch (error: unknown) {
    logger.error('Error deleting schedule update', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule update' },
      { status: 500 }
    );
  }
}
