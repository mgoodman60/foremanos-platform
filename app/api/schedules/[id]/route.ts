import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getScheduleProgress } from '@/lib/schedule-parser';
import { safeErrorMessage } from '@/lib/api-error';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { createLogger } from '@/lib/logger';
const logger = createLogger('SCHEDULES');

// GET /api/schedules/[id] - Get single schedule with tasks
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get schedule
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        Project: {
          include: {
            User_Project_ownerIdToUser: true,
            ProjectMember: { include: { User: true } }
          }
        },
        ScheduleTask: {
          orderBy: { startDate: 'asc' }
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

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Verify access
    const userId = session.user.id;
    const userRole = session.user.role;

    const isOwner = schedule.Project.ownerId === userId;
    const isMember = schedule.Project.ProjectMember.some((m: any) => m.userId === userId);

    if (!isOwner && !isMember && userRole !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get progress
    const progress = await getScheduleProgress(id);

    return NextResponse.json({
      schedule,
      progress
    });
  } catch (error: any) {
    logger.error('Error fetching schedule', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}

// PUT /api/schedules/[id] - Update schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(`api:${session.user.email}`, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = params;
    const body = await request.json();
    const { name, description, startDate, endDate, isActive } = body;

    // Get schedule
    const schedule = await prisma.schedule.findUnique({
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

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Verify access
    const userId = session.user.id;
    const userRole = session.user.role;

    const isOwner = schedule.Project.ownerId === userId;
    const isMember = schedule.Project.ProjectMember.some((m: any) => m.userId === userId);

    if (!isOwner && !isMember && userRole !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // If marking this schedule as active, deactivate others
    if (isActive === true) {
      await prisma.schedule.updateMany({
        where: {
          projectId: schedule.projectId,
          id: { not: id }
        },
        data: { isActive: false }
      });
    }

    // Update schedule
    const updated = await prisma.schedule.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        _count: {
          select: { ScheduleTask: true }
        }
      }
    });

    return NextResponse.json({ schedule: updated });
  } catch (error: any) {
    logger.error('Error updating schedule', error);
    return NextResponse.json(
      { error: 'Failed to update schedule', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/schedules/[id] - Delete schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deleteRateLimitResult = await checkRateLimit(`api:${session.user.email}`, RATE_LIMITS.API);
    if (!deleteRateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = params;

    // Get schedule
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        Project: {
          include: {
            User_Project_ownerIdToUser: true
          }
        }
      }
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Verify access (owner or admin only)
    const userId = session.user.id;
    const userRole = session.user.role;

    const isOwner = schedule.Project.ownerId === userId;

    if (!isOwner && userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only project owners and admins can delete schedules' },
        { status: 403 }
      );
    }

    // Delete schedule (cascade deletes tasks)
    await prisma.schedule.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Schedule deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting schedule', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
