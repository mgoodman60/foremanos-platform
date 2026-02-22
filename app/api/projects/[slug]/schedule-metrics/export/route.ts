import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_METRICS_EXPORT');

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project with schedules
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        Schedule: {
          include: {
            ScheduleTask: {
              orderBy: { startDate: 'asc' }
            }
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const allTasks = (project as any).Schedule.flatMap((s: any) => s.ScheduleTask);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t: any) => t.status === 'completed').length;
    const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Create PDF-style report (simplified as text)
    const reportLines: string[] = [];
    reportLines.push('SCHEDULE PROGRESS REPORT');
    reportLines.push(`Project: ${project.name}`);
    reportLines.push(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`);
    reportLines.push('\n' + '='.repeat(60));
    reportLines.push('\nOVERALL METRICS');
    reportLines.push('='.repeat(60));
    reportLines.push(`Overall Progress: ${overallProgress}%`);
    reportLines.push(`Tasks Completed: ${completedTasks} of ${totalTasks}`);
    reportLines.push(`Completion Rate: ${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%`);
    
    // Task breakdown by status
    const tasksByStatus = {
      'not-started': allTasks.filter((t: any) => t.status === 'not-started').length,
      'in-progress': allTasks.filter((t: any) => t.status === 'in-progress').length,
      'completed': completedTasks,
      'delayed': allTasks.filter((t: any) => {
        const endDate = new Date(t.endDate);
        return endDate < new Date() && t.status !== 'completed';
      }).length
    };

    reportLines.push('\n' + '='.repeat(60));
    reportLines.push('TASK BREAKDOWN BY STATUS');
    reportLines.push('='.repeat(60));
    Object.entries(tasksByStatus).forEach(([status, count]) => {
      reportLines.push(`${status.toUpperCase()}: ${count}`);
    });

    // Upcoming tasks
    const now = new Date();
    const upcomingTasks = allTasks
      .filter((t: any) => new Date(t.startDate) > now)
      .slice(0, 10);

    reportLines.push('\n' + '='.repeat(60));
    reportLines.push('UPCOMING TASKS (Next 10)');
    reportLines.push('='.repeat(60));
    upcomingTasks.forEach((task: any) => {
      reportLines.push(
        `${format(new Date(task.startDate), 'MMM d, yyyy')} - ${task.name} [${(task as any).isCritical ? 'Critical' : 'Normal'}]`
      );
    });

    // Critical tasks
    const criticalTasks = allTasks.filter((t: any) => (t as any).isCritical && t.status !== 'completed');
    reportLines.push('\n' + '='.repeat(60));
    reportLines.push('CRITICAL TASKS REQUIRING ATTENTION');
    reportLines.push('='.repeat(60));
    if (criticalTasks.length === 0) {
      reportLines.push('No critical tasks requiring immediate attention.');
    } else {
      criticalTasks.forEach((task: any) => {
        reportLines.push(
          `${format(new Date(task.startDate), 'MMM d')} - ${format(new Date(task.endDate), 'MMM d')}: ${task.name} [${task.status}]`
        );
      });
    }

    reportLines.push('\n' + '='.repeat(60));
    reportLines.push('END OF REPORT');
    reportLines.push('='.repeat(60));

    const reportText = reportLines.join('\n');

    // Return as downloadable text file (PDF generation would require additional libraries)
    return new NextResponse(reportText, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="schedule-report-${slug}-${format(new Date(), 'yyyy-MM-dd')}.txt"`
      }
    });

  } catch (error) {
    logger.error('Error exporting schedule metrics', error);
    return NextResponse.json(
      { error: 'Failed to export schedule metrics' },
      { status: 500 }
    );
  }
}