import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { markScheduleUpdatesReviewed } from '@/lib/onboarding-tracker';

export const dynamic = 'force-dynamic';

interface RejectRequest {
  rejectionReason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug, id } = params;
    const body: RejectRequest = await request.json().catch(() => ({}));

    // Get project and verify permissions
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check permissions (admin, owner, or editor)
    const isOwner = project.ownerId === session.user.id;
    const member = project.ProjectMember[0];
    const isEditor = member?.role === 'editor' || member?.role === 'owner';
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isEditor && !isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get the schedule update
    const scheduleUpdate = await prisma.scheduleUpdate.findUnique({
      where: { id },
    });

    if (!scheduleUpdate) {
      return NextResponse.json(
        { error: 'Schedule update not found' },
        { status: 404 }
      );
    }

    if (scheduleUpdate.projectId !== project.id) {
      return NextResponse.json(
        { error: 'Schedule update does not belong to this project' },
        { status: 403 }
      );
    }

    if (scheduleUpdate.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot reject update with status: ${scheduleUpdate.status}` },
        { status: 400 }
      );
    }

    // Update schedule update status
    const updated = await prisma.scheduleUpdate.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: session.user.id,
        rejectionReason: body.rejectionReason,
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'schedule_update_rejected',
      resource: 'ScheduleUpdate',
      resourceId: scheduleUpdate.scheduleId,
      details: {
        updateId: id,
        taskId: scheduleUpdate.taskId,
        rejectionReason: body.rejectionReason,
      },
    });

    // Track onboarding progress - schedule updates reviewed
    markScheduleUpdatesReviewed(session.user.id, project.id).catch((err) => {
      console.error('[ONBOARDING] Error marking schedule updates reviewed:', err);
    });

    return NextResponse.json({
      success: true,
      scheduleUpdate: updated,
    });
  } catch (error) {
    console.error('[REJECT_UPDATE] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
