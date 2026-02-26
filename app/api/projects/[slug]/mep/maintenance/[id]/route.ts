/**
 * MEP Maintenance Schedule Detail API
 * GET: Get single schedule with logs
 * PATCH: Update schedule
 * DELETE: Delete schedule
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_MAINTENANCE');

export async function GET(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schedule = await prisma.mEPMaintenanceSchedule.findUnique({
      where: { id: params.id },
      include: {
        system: { select: { systemNumber: true, name: true, systemType: true } },
        equipment: { select: { equipmentTag: true, name: true, equipmentType: true } },
        logs: {
          orderBy: { completedDate: 'desc' },
          take: 20,
        },
      }
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    logger.error('[MEP Maintenance GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance schedule' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      frequency,
      intervalDays,
      taskDescription,
      checklist,
      estimatedDuration,
      assignedTo,
      assignedContractor,
      nextDueDate,
      isActive,
    } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (intervalDays !== undefined) updateData.intervalDays = intervalDays;
    if (taskDescription !== undefined) updateData.taskDescription = taskDescription;
    if (checklist !== undefined) updateData.checklist = checklist;
    if (estimatedDuration !== undefined) updateData.estimatedDuration = estimatedDuration;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (assignedContractor !== undefined) updateData.assignedContractor = assignedContractor;
    if (nextDueDate !== undefined) updateData.nextDueDate = new Date(nextDueDate);
    if (isActive !== undefined) updateData.isActive = isActive;

    const schedule = await prisma.mEPMaintenanceSchedule.update({
      where: { id: params.id },
      data: updateData,
      include: {
        system: { select: { systemNumber: true, name: true } },
        equipment: { select: { equipmentTag: true, name: true } },
      }
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    logger.error('[MEP Maintenance PATCH Error]', error);
    return NextResponse.json(
      { error: 'Failed to update maintenance schedule' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.mEPMaintenanceSchedule.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[MEP Maintenance DELETE Error]', error);
    return NextResponse.json(
      { error: 'Failed to delete maintenance schedule' },
      { status: 500 }
    );
  }
}
