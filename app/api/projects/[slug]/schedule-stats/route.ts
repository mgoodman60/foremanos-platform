import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project with schedules and tasks
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        Schedule: {
          where: { isActive: true },
          include: {
            ScheduleTask: true
          }
        },
        Milestone: true
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Flatten all tasks from active schedules
    const allTasks = project.Schedule.flatMap(s => s.ScheduleTask);
    const totalTasks = allTasks.length;

    // Calculate stats
    const delayedTasks = allTasks.filter(t => t.status === 'delayed').length;
    
    const dueThisWeek = allTasks.filter(t => {
      const endDate = new Date(t.endDate);
      return isWithinInterval(endDate, { start: weekStart, end: weekEnd }) && 
             t.status !== 'completed';
    }).length;

    const completedThisWeek = allTasks.filter(t => {
      if (t.status !== 'completed') return false;
      const endDate = new Date(t.endDate);
      return isWithinInterval(endDate, { start: weekStart, end: weekEnd });
    }).length;

    const criticalPathItems = allTasks.filter(t => t.isCritical && t.status !== 'completed').length;

    // Milestones this month
    const milestonesThisMonth = project.Milestone.filter(m => {
      const date = new Date(m.plannedDate);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    }).length;

    // Calculate on-track percentage
    const tasksWithProgress = allTasks.filter(t => t.status !== 'not_started');
    const onTrackTasks = tasksWithProgress.filter(t => {
      if (t.status === 'completed') return true;
      if (t.status === 'delayed') return false;
      // In progress tasks - check if they're behind schedule
      const progress = t.percentComplete || 0;
      const daysPassed = Math.max(0, (now.getTime() - new Date(t.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const totalDays = Math.max(1, t.duration || 1);
      const expectedProgress = Math.min(100, (daysPassed / totalDays) * 100);
      return progress >= expectedProgress * 0.8; // Within 80% of expected
    });

    const onTrackPercentage = totalTasks > 0 
      ? Math.round((onTrackTasks.length / totalTasks) * 100) 
      : 100;

    return NextResponse.json({
      delayedTasks,
      dueThisWeek,
      milestonesThisMonth,
      completedThisWeek,
      criticalPathItems,
      onTrackPercentage,
      totalTasks
    });

  } catch (error) {
    console.error('Error fetching schedule stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule stats' },
      { status: 500 }
    );
  }
}
