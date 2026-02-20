/**
 * Complete Maintenance Task API
 * POST: Log completion of a maintenance task
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      notes,
      findings,
      deficienciesFound,
      actualDuration,
      photoIds,
      status = 'COMPLETED',
    } = body;

    // Get the schedule
    const schedule = await prisma.mEPMaintenanceSchedule.findUnique({
      where: { id: params.id },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Create the maintenance log
    const log = await prisma.mEPMaintenanceLog.create({
      data: {
        scheduleId: params.id,
        completedDate: new Date(),
        completedBy: session.user.id,
        completedByName: (session.user as any).username || session.user.email || 'Unknown',
        status,
        notes: notes || null,
        findings: findings || null,
        deficienciesFound: deficienciesFound || false,
        actualDuration: actualDuration || null,
        photoIds: photoIds || [],
      }
    });

    // Calculate next due date
    const now = new Date();
    const nextDueDate = new Date(now);
    
    switch (schedule.frequency) {
      case 'DAILY': nextDueDate.setDate(nextDueDate.getDate() + 1); break;
      case 'WEEKLY': nextDueDate.setDate(nextDueDate.getDate() + 7); break;
      case 'BIWEEKLY': nextDueDate.setDate(nextDueDate.getDate() + 14); break;
      case 'MONTHLY': nextDueDate.setMonth(nextDueDate.getMonth() + 1); break;
      case 'QUARTERLY': nextDueDate.setMonth(nextDueDate.getMonth() + 3); break;
      case 'SEMI_ANNUAL': nextDueDate.setMonth(nextDueDate.getMonth() + 6); break;
      case 'ANNUAL': nextDueDate.setFullYear(nextDueDate.getFullYear() + 1); break;
      case 'CUSTOM': 
        if (schedule.intervalDays) nextDueDate.setDate(nextDueDate.getDate() + schedule.intervalDays);
        break;
    }

    // Update the schedule with completion info and new due date
    await prisma.mEPMaintenanceSchedule.update({
      where: { id: params.id },
      data: {
        lastCompletedDate: now,
        nextDueDate,
      }
    });

    return NextResponse.json({ 
      log,
      nextDueDate,
      message: 'Maintenance completed successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('[MEP Maintenance Complete Error]:', error);
    return NextResponse.json(
      { error: 'Failed to complete maintenance task' },
      { status: 500 }
    );
  }
}
