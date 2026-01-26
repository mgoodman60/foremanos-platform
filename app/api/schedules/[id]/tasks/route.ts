import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/schedules/[id]/tasks - Get all tasks for a schedule
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const isCritical = searchParams.get('isCritical');
    const location = searchParams.get('location');

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
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = schedule.Project.ownerId === user.id;
    const isMember = schedule.Project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build where clause
    const where: any = { scheduleId: id };
    if (status) where.status = status;
    if (isCritical) where.isCritical = isCritical === 'true';
    if (location) where.location = location;

    // Get tasks with subcontractor info
    const tasks = await prisma.scheduleTask.findMany({
      where,
      include: {
        Subcontractor: {
          select: {
            id: true,
            companyName: true,
            tradeType: true
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/schedules/[id]/tasks - Create or update task
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
    const body = await request.json();
    const {
      taskId: existingTaskId,
      percentComplete,
      status,
      actualCost,
      notes,
      location,
      assignedTo,
      subcontractorId
    } = body;

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
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = schedule.Project.ownerId === user.id;
    const isMember = schedule.Project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Find task by taskId
    const task = await prisma.scheduleTask.findFirst({
      where: {
        scheduleId: id,
        taskId: existingTaskId
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Update task
    const updated = await prisma.scheduleTask.update({
      where: { id: task.id },
      data: {
        ...(percentComplete !== undefined && { percentComplete }),
        ...(status && { status }),
        ...(actualCost !== undefined && { actualCost }),
        ...(notes !== undefined && { notes }),
        ...(location !== undefined && { location }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(subcontractorId !== undefined && { 
          subcontractorId: subcontractorId === '' ? null : subcontractorId 
        })
      },
      include: {
        Subcontractor: {
          select: {
            id: true,
            companyName: true,
            tradeType: true
          }
        }
      }
    });

    console.log(`[SCHEDULE] Updated task ${existingTaskId}: ${percentComplete}% complete, status: ${status}, subcontractor: ${subcontractorId || 'none'}`);

    return NextResponse.json({ task: updated });
  } catch (error: any) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task', details: error.message },
      { status: 500 }
    );
  }
}
