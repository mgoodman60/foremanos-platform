import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_METRICS');

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        Schedule: {
          where: { isActive: true }, // Only include active schedules
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

    // Check if there's a valid schedule data source
    const scheduleDataSource = await prisma.projectDataSource.findFirst({
      where: {
        projectId: project.id,
        featureType: 'schedule',
      },
      include: {
        Document: { select: { deletedAt: true } }
      }
    });

    // If no data source OR document was deleted, return empty metrics
    const hasValidSource = scheduleDataSource && !scheduleDataSource.Document?.deletedAt;
    
    // Get all tasks from active schedules only
    const allTasks = (project as any).Schedule.flatMap((s: any) => s.ScheduleTask);
    
    // If no valid source and we have orphaned data, deactivate schedules
    if (!hasValidSource && allTasks.length > 0) {
      logger.info('[Schedule Metrics] No valid data source for project, deactivating orphaned schedules', { slug });
      await prisma.schedule.updateMany({
        where: { projectId: project.id },
        data: { isActive: false }
      });
      
      // Return empty metrics
      return NextResponse.json({
        overallProgress: 0,
        tasksCompleted: 0,
        totalTasks: 0,
        daysAheadBehind: 0,
        upcomingMilestones: [],
        criticalPathStatus: 'healthy',
        recentUpdates: [],
        weatherDelays: 0,
        averageCrewSize: 0,
        keyDates: [],
        noDataSource: true,
        message: 'No schedule document uploaded. Upload a schedule to see metrics.'
      });
    }
    
    // If no tasks at all, return empty metrics
    if (allTasks.length === 0) {
      return NextResponse.json({
        overallProgress: 0,
        tasksCompleted: 0,
        totalTasks: 0,
        daysAheadBehind: 0,
        upcomingMilestones: [],
        criticalPathStatus: 'healthy',
        recentUpdates: [],
        weatherDelays: 0,
        averageCrewSize: 0,
        keyDates: [],
        noDataSource: !hasValidSource,
        message: hasValidSource ? 'No schedule tasks found.' : 'No schedule document uploaded.'
      });
    }
    
    // Calculate metrics
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t: any) => t.status === 'completed').length;
    const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate schedule variance based on planned vs actual progress
    const now = new Date();
    
    // Calculate how much work SHOULD be done by today based on baseline schedule
    let plannedProgress = 0;
    let actualProgress = 0;
    
    for (const task of allTasks) {
      const startDate = new Date(task.startDate);
      const endDate = new Date(task.endDate);
      const taskDuration = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate planned percent complete for this task as of today
      let taskPlannedPercent = 0;
      if (now >= endDate) {
        taskPlannedPercent = 100; // Should be done
      } else if (now >= startDate) {
        // Should be partially done based on elapsed time
        const elapsedDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        taskPlannedPercent = Math.min(100, (elapsedDays / taskDuration) * 100);
      }
      
      // Get actual percent complete
      const actualPercent = task.status === 'completed' ? 100 : (task.percentComplete || 0);
      
      plannedProgress += taskPlannedPercent;
      actualProgress += actualPercent;
    }
    
    // Calculate variance in percentage points
    const plannedOverallPercent = totalTasks > 0 ? plannedProgress / totalTasks : 0;
    const actualOverallPercent = totalTasks > 0 ? actualProgress / totalTasks : 0;
    const variancePercent = actualOverallPercent - plannedOverallPercent;
    
    // Convert to days (assuming average task is ~5 days, total project duration in days)
    const projectDurationDays = allTasks.length > 0 ? (() => {
      const startDates = allTasks.map((t: any) => new Date(t.startDate).getTime());
      const endDates = allTasks.map((t: any) => new Date(t.endDate).getTime());
      const projectStart = Math.min(...startDates);
      const projectEnd = Math.max(...endDates);
      return Math.max(1, (projectEnd - projectStart) / (1000 * 60 * 60 * 24));
    })() : 100;
    
    const daysAheadBehind = Math.round((variancePercent / 100) * projectDurationDays);

    // Critical path analysis
    const delayedTasks = allTasks.filter((t: any) => {
      const endDate = new Date(t.endDate);
      return endDate < now && t.status !== 'completed';
    });
    const criticalDelayedTasks = delayedTasks.filter((t: any) => (t as any).isCritical);
    
    let criticalPathStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalDelayedTasks.length > 0) {
      criticalPathStatus = 'critical';
    } else if (delayedTasks.length > 2) {
      criticalPathStatus = 'warning';
    }

    // Upcoming milestones (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const upcomingMilestones = allTasks
      .filter((t: any) => {
        const startDate = new Date(t.startDate);
        return startDate >= now && startDate <= thirtyDaysFromNow && (t as any).isCritical;
      })
      .slice(0, 5)
      .map((t: any) => {
        const startDate = new Date(t.startDate);
        const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const endDate = new Date(t.endDate);
        const isDelayed = endDate < now && t.status !== 'completed';
        
        return {
          name: t.name,
          date: startDate.toISOString().split('T')[0],
          daysUntil,
          status: isDelayed ? 'delayed' : daysUntil <= 7 ? 'at-risk' : 'on-track'
        };
      });

    // Extract recent updates from daily reports
    const recentConversations = await prisma.conversation.findMany({
      where: {
        projectId: project.id,
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        ChatMessage: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    // Extract weather delay and crew size data
    let weatherDelayCount = 0;
    let totalCrewSize = 0;
    let crewSizeSamples = 0;

    for (const conv of recentConversations) {
      for (const msg of conv.ChatMessage) {
        const content = (msg as any).message || '';
        
        // Check for weather delays
        if (content.toLowerCase().includes('weather delay: yes')) {
          weatherDelayCount++;
        }
        
        // Extract crew size using regex
        const crewMatch = content.match(/crew size:\s*(\d+)/i);
        if (crewMatch) {
          totalCrewSize += parseInt(crewMatch[1]);
          crewSizeSamples++;
        }
      }
    }

    const averageCrewSize = crewSizeSamples > 0 ? Math.round(totalCrewSize / crewSizeSamples) : 0;

    // Calculate key dates from schedule data - show all major milestones
    const keyDates: { label: string; date: string; daysUntil: number; isPast: boolean; type: 'start' | 'end' | 'milestone' }[] = [];
    
    if (allTasks.length > 0) {
      // Find earliest start date (Project Start)
      const sortedByStart = [...allTasks].sort((a: any, b: any) => 
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );
      const projectStart = sortedByStart[0];
      
      // Find latest end date (Project End / Substantial Completion)
      const sortedByEnd = [...allTasks].sort((a: any, b: any) => 
        new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
      );
      const projectEnd = sortedByEnd[0];
      
      // Get ALL critical milestones sorted by date
      const criticalMilestones = allTasks
        .filter((t: any) => (t as any).isCritical)
        .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      // Add Project Start
      if (projectStart) {
        const startDate = new Date(projectStart.startDate);
        const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isComplete = projectStart.status === 'completed' || startDate < now;
        keyDates.push({
          label: 'Project Start',
          date: startDate.toISOString().split('T')[0],
          daysUntil,
          isPast: isComplete,
          type: 'start'
        });
      }
      
      // Add ALL critical milestones (spread across the timeline)
      // Use a Set to avoid duplicates based on name similarity
      const addedNames = new Set<string>();
      
      for (const milestone of criticalMilestones) {
        // Skip if we already have a very similar named milestone
        const normalizedName = milestone.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (addedNames.has(normalizedName)) continue;
        
        // Skip if this is the project start or end task (we add those separately)
        if (milestone === projectStart && milestone.name.toLowerCase().includes('start')) continue;
        if (milestone === projectEnd && milestone.name.toLowerCase().includes('completion')) continue;
        
        const milestoneDate = new Date(milestone.startDate);
        const daysUntil = Math.ceil((milestoneDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isComplete = milestone.status === 'completed';
        
        keyDates.push({
          label: milestone.name.length > 25 ? milestone.name.substring(0, 22) + '...' : milestone.name,
          date: milestoneDate.toISOString().split('T')[0],
          daysUntil,
          isPast: isComplete,
          type: 'milestone'
        });
        
        addedNames.add(normalizedName);
        
        // Cap at 10 milestones to avoid overcrowding
        if (keyDates.length >= 10) break;
      }
      
      // Add Project End / Substantial Completion (always last)
      if (projectEnd) {
        const endDate = new Date(projectEnd.endDate);
        const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isComplete = projectEnd.status === 'completed';
        keyDates.push({
          label: 'Substantial Complet...',
          date: endDate.toISOString().split('T')[0],
          daysUntil,
          isPast: isComplete,
          type: 'end'
        });
      }
      
      // Sort all key dates by date
      keyDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // Get recent schedule updates from the ScheduleUpdate model
    const recentScheduleUpdates = await prisma.scheduleUpdate.findMany({
      where: {
        projectId: project.id,
        status: {
          in: ['approved', 'auto_applied']
        },
        appliedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      orderBy: {
        appliedAt: 'desc'
      },
      take: 5,
      select: {
        appliedAt: true,
        taskId: true,
        newStatus: true,
        newPercentComplete: true,
        previousPercentComplete: true,
        impactType: true,
        status: true,
      }
    });

    // Get task names for recent updates - batch fetch all tasks in a single query
    const scheduleIds = (project as any).Schedule.map((s: any) => s.id);
    const taskIds = recentScheduleUpdates.map(u => u.taskId).filter(Boolean);

    // Batch fetch all tasks that match the taskIds
    const tasksForUpdates = taskIds.length > 0 && scheduleIds.length > 0
      ? await prisma.scheduleTask.findMany({
          where: {
            taskId: { in: taskIds },
            scheduleId: { in: scheduleIds }
          },
          select: { taskId: true, name: true }
        })
      : [];

    // Create a lookup map for O(1) access
    const taskNameMap = new Map(tasksForUpdates.map(t => [t.taskId, t.name]));

    const recentUpdates: { date: string; taskName: string; status: string }[] = [];

    for (const update of recentScheduleUpdates) {
      const taskName = taskNameMap.get(update.taskId);

      if (taskName && update.appliedAt) {
        const percentChange = update.newPercentComplete! - (update.previousPercentComplete || 0);
        const statusText = update.status === 'auto_applied'
          ? `Auto-updated: ${percentChange > 0 ? '+' : ''}${percentChange}% progress`
          : `Updated to ${update.newPercentComplete}%`;

        recentUpdates.push({
          date: new Date(update.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          taskName: taskName,
          status: statusText
        });
      }
    }

    return NextResponse.json({
      overallProgress,
      tasksCompleted: completedTasks,
      totalTasks,
      daysAheadBehind,
      upcomingMilestones,
      criticalPathStatus,
      recentUpdates,
      weatherDelays: weatherDelayCount,
      averageCrewSize,
      keyDates
    });

  } catch (error) {
    logger.error('Error fetching schedule metrics', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule metrics' },
      { status: 500 }
    );
  }
}