/**
 * MEP Maintenance Schedule API
 * GET: List all maintenance schedules
 * POST: Create new maintenance schedule
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const systemId = searchParams.get('systemId');
    const equipmentId = searchParams.get('equipmentId');
    const frequency = searchParams.get('frequency');
    const isActive = searchParams.get('isActive');
    const overdue = searchParams.get('overdue');

    const now = new Date();
    const schedules = await prisma.mEPMaintenanceSchedule.findMany({
      where: {
        projectId: project.id,
        ...(systemId && { systemId }),
        ...(equipmentId && { equipmentId }),
        ...(frequency && { frequency: frequency as any }),
        ...(isActive !== null && { isActive: isActive === 'true' }),
        ...(overdue === 'true' && { nextDueDate: { lt: now } }),
      },
      include: {
        system: {
          select: { systemNumber: true, name: true, systemType: true }
        },
        equipment: {
          select: { equipmentTag: true, name: true, equipmentType: true }
        },
        _count: {
          select: { logs: true }
        }
      },
      orderBy: [{ nextDueDate: 'asc' }, { scheduleNumber: 'asc' }]
    });

    // Calculate summary stats
    const stats = {
      total: schedules.length,
      active: schedules.filter(s => s.isActive).length,
      overdue: schedules.filter(s => s.isActive && s.nextDueDate < now).length,
      dueThisWeek: schedules.filter(s => {
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return s.isActive && s.nextDueDate >= now && s.nextDueDate <= weekFromNow;
      }).length,
      dueThisMonth: schedules.filter(s => {
        const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return s.isActive && s.nextDueDate >= now && s.nextDueDate <= monthFromNow;
      }).length,
    };

    return NextResponse.json({ schedules, stats });
  } catch (error) {
    console.error('[MEP Maintenance GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance schedules' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      systemId,
      equipmentId,
      name,
      frequency,
      intervalDays,
      taskDescription,
      checklist,
      estimatedDuration,
      assignedTo,
      assignedContractor,
      startDate,
    } = body;

    // Generate schedule number
    const count = await prisma.mEPMaintenanceSchedule.count({
      where: { projectId: project.id }
    });
    const scheduleNumber = `PM-${String(count + 1).padStart(3, '0')}`;

    // Calculate next due date based on frequency
    const start = new Date(startDate || new Date());
    const nextDueDate = new Date(start);
    
    switch (frequency) {
      case 'DAILY': nextDueDate.setDate(nextDueDate.getDate() + 1); break;
      case 'WEEKLY': nextDueDate.setDate(nextDueDate.getDate() + 7); break;
      case 'BIWEEKLY': nextDueDate.setDate(nextDueDate.getDate() + 14); break;
      case 'MONTHLY': nextDueDate.setMonth(nextDueDate.getMonth() + 1); break;
      case 'QUARTERLY': nextDueDate.setMonth(nextDueDate.getMonth() + 3); break;
      case 'SEMI_ANNUAL': nextDueDate.setMonth(nextDueDate.getMonth() + 6); break;
      case 'ANNUAL': nextDueDate.setFullYear(nextDueDate.getFullYear() + 1); break;
      case 'CUSTOM': 
        if (intervalDays) nextDueDate.setDate(nextDueDate.getDate() + intervalDays);
        break;
    }

    const schedule = await prisma.mEPMaintenanceSchedule.create({
      data: {
        project: { connect: { id: project.id } },
        createdByUser: { connect: { id: session.user.id } },
        ...(systemId && { system: { connect: { id: systemId } } }),
        ...(equipmentId && { equipment: { connect: { id: equipmentId } } }),
        scheduleNumber,
        name,
        frequency,
        intervalDays: intervalDays || null,
        taskDescription: taskDescription || null,
        checklist: checklist || null,
        estimatedDuration: estimatedDuration || null,
        assignedTo: assignedTo || null,
        assignedContractor: assignedContractor || null,
        startDate: start,
        nextDueDate,
        isActive: true,
      },
      include: {
        system: { select: { systemNumber: true, name: true } },
        equipment: { select: { equipmentTag: true, name: true } },
      }
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error('[MEP Maintenance POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create maintenance schedule' },
      { status: 500 }
    );
  }
}
