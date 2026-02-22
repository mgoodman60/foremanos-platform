// Delay Impact Analysis API
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULES_DELAYS');

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch schedule tasks with baseline and actual dates
    const tasks = await prisma.scheduleTask.findMany({
      where: {
        Schedule: {
          projectId: project.id,
          isActive: true
        }
      },
      select: {
        id: true,
        taskId: true,
        name: true,
        startDate: true,
        endDate: true,
        baselineStartDate: true,
        baselineEndDate: true,
        actualStartDate: true,
        actualEndDate: true,
        status: true,
        isCritical: true,
        percentComplete: true,
        totalFloat: true
      }
    });

    // Fetch daily reports for context
    const dailyReports = await prisma.dailyReport.findMany({
      where: {
        projectId: project.id,
        OR: [
          { weatherNotes: { not: null } },
          { delaysEncountered: { not: null } }
        ]
      },
      select: {
        id: true,
        reportDate: true,
        weatherCondition: true,
        weatherNotes: true,
        delaysEncountered: true,
        delayHours: true,
        delayReason: true
      },
      orderBy: { reportDate: 'desc' },
      take: 90
    });

    // Fetch weather impacts from dedicated table
    const weatherImpacts = await prisma.weatherImpact.findMany({
      where: {
        projectId: project.id
      },
      select: {
        id: true,
        reportDate: true,
        affectedTrades: true,
        delayHours: true,
        notes: true,
        workStopped: true,
        conditions: true
      },
      orderBy: { reportDate: 'desc' },
      take: 90
    });

    // Analyze delays from tasks
    const taskDelays = tasks
      .filter(task => {
        if (!task.baselineEndDate || !task.endDate) return false;
        const baseline = new Date(task.baselineEndDate);
        const current = new Date(task.endDate);
        return current > baseline;
      })
      .map(task => {
        const baseline = new Date(task.baselineEndDate!);
        const current = new Date(task.endDate);
        const delayDays = Math.ceil((current.getTime() - baseline.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: `task-delay-${task.id}`,
          type: 'other' as const,
          description: `${task.name} delayed from baseline schedule`,
          startDate: task.baselineEndDate!.toISOString(),
          endDate: task.endDate.toISOString(),
          daysImpact: delayDays,
          affectedTasks: [task.id],
          isCriticalPath: task.isCritical,
          status: task.status === 'completed' ? 'resolved' as const : 'active' as const,
          createdAt: new Date().toISOString()
        };
      });

    // Analyze weather delays from WeatherImpact table
    const weatherDelays = weatherImpacts
      .filter(impact => impact.workStopped || (impact.delayHours && impact.delayHours > 0))
      .map(impact => ({
        id: `weather-delay-${impact.id}`,
        type: 'weather' as const,
        description: impact.notes || impact.conditions || 'Weather delay',
        startDate: impact.reportDate.toISOString(),
        endDate: impact.reportDate.toISOString(),
        daysImpact: (impact.delayHours || 4) / 8,
        affectedTasks: (impact.affectedTrades as string[] | null) || [],
        isCriticalPath: false,
        status: 'resolved' as const,
        createdAt: impact.reportDate.toISOString()
      }));

    // Also add delays from daily reports with delay info
    const reportDelays = dailyReports
      .filter(report => report.delayHours && report.delayHours > 0)
      .map(report => ({
        id: `report-delay-${report.id}`,
        type: report.delayReason?.toLowerCase().includes('weather') ? 'weather' as const : 'other' as const,
        description: report.delaysEncountered || report.delayReason || 'Reported delay',
        startDate: report.reportDate.toISOString(),
        endDate: report.reportDate.toISOString(),
        daysImpact: (report.delayHours || 0) / 8,
        affectedTasks: [] as string[],
        isCriticalPath: false,
        status: 'resolved' as const,
        createdAt: report.reportDate.toISOString()
      }));

    // Combine and sort all delays
    const allDelays = [...taskDelays, ...weatherDelays, ...reportDelays]
      .sort((a, b) => b.daysImpact - a.daysImpact);

    // Calculate summary metrics
    const metrics = {
      totalDelayDays: allDelays.reduce((sum, d) => sum + d.daysImpact, 0),
      criticalDelays: allDelays.filter(d => d.isCriticalPath).length,
      activeDelays: allDelays.filter(d => d.status === 'active').length,
      weatherDelays: allDelays.filter(d => d.type === 'weather').length,
      delaysByType: allDelays.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + d.daysImpact;
        return acc;
      }, {} as Record<string, number>)
    };

    return NextResponse.json({
      delays: allDelays,
      metrics,
      tasksAnalyzed: tasks.length,
      reportsAnalyzed: dailyReports.length + weatherImpacts.length
    });
  } catch (error) {
    logger.error('[Delays API] Error', error);
    return NextResponse.json(
      { error: 'Failed to analyze delays' },
      { status: 500 }
    );
  }
}
