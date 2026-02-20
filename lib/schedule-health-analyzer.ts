import { prisma } from '@/lib/db';
import { differenceInDays, isAfter, isBefore, addDays } from 'date-fns';
import { logger } from '@/lib/logger';

// Industry benchmarks for construction projects
const INDUSTRY_BENCHMARKS = {
  onTimeCompletion: 75, // % of tasks completed on time
  floatUtilization: 30, // % average float usage
  criticalPathDelay: 5, // Max acceptable delay days on critical path
  resourceUtilization: 80, // Target resource utilization %
  weeklyProgress: 10, // Expected % progress per week
  scheduleCompression: 15, // Max acceptable schedule compression %
};

export interface HealthIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  title: string;
  description: string;
  affectedTasks: string[];
  suggestedFix?: string;
  autoFixable: boolean;
  impact: string;
}

export interface HealthMetric {
  name: string;
  value: number;
  target: number;
  status: 'good' | 'warning' | 'critical';
  trend?: 'improving' | 'stable' | 'declining';
}

export interface ScheduleHealthReport {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'Healthy' | 'At Risk' | 'Critical';
  metrics: HealthMetric[];
  issues: HealthIssue[];
  recommendations: string[];
  benchmarkComparison: {
    metric: string;
    yourValue: number;
    industryAvg: number;
    percentile: number;
  }[];
  generatedAt: string;
}

function calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getStatus(score: number): 'Healthy' | 'At Risk' | 'Critical' {
  if (score >= 75) return 'Healthy';
  if (score >= 50) return 'At Risk';
  return 'Critical';
}

function getMetricStatus(value: number, target: number, inverse = false): 'good' | 'warning' | 'critical' {
  const ratio = inverse ? target / Math.max(value, 0.1) : value / Math.max(target, 0.1);
  if (ratio >= 0.9) return 'good';
  if (ratio >= 0.7) return 'warning';
  return 'critical';
}

export async function analyzeScheduleHealth(projectSlug: string): Promise<ScheduleHealthReport> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Schedule: {
        include: {
          ScheduleTask: {
            orderBy: { startDate: 'asc' },
          },
        },
      },
      Milestone: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const tasks = project.Schedule.flatMap(s => s.ScheduleTask);
  const milestones = project.Milestone || [];
  const now = new Date();

  const issues: HealthIssue[] = [];
  const metrics: HealthMetric[] = [];

  // 1. Calculate on-time performance
  const _completedTasks = tasks.filter(t => t.status === 'completed');
  const delayedTasks = tasks.filter(t => t.status === 'delayed');
  const overdueTasks = tasks.filter(t => {
    const endDate = new Date(t.endDate);
    return t.status !== 'completed' && isBefore(endDate, now);
  });

  const onTimeRate = tasks.length > 0 
    ? ((tasks.length - delayedTasks.length - overdueTasks.length) / tasks.length) * 100 
    : 100;

  metrics.push({
    name: 'On-Time Performance',
    value: Math.round(onTimeRate),
    target: INDUSTRY_BENCHMARKS.onTimeCompletion,
    status: getMetricStatus(onTimeRate, INDUSTRY_BENCHMARKS.onTimeCompletion),
  });

  // 2. Critical path analysis
  const criticalTasks = tasks.filter(t => t.isCritical);
  const criticalDelayed = criticalTasks.filter(t => t.status === 'delayed');
  const criticalOverdue = criticalTasks.filter(t => {
    const endDate = new Date(t.endDate);
    return t.status !== 'completed' && isBefore(endDate, now);
  });

  const criticalPathHealth = criticalTasks.length > 0
    ? ((criticalTasks.length - criticalDelayed.length - criticalOverdue.length) / criticalTasks.length) * 100
    : 100;

  metrics.push({
    name: 'Critical Path Health',
    value: Math.round(criticalPathHealth),
    target: 95,
    status: getMetricStatus(criticalPathHealth, 95),
  });

  // 3. Float utilization
  const tasksWithFloat = tasks.filter(t => t.totalFloat && t.totalFloat > 0);
  const floatUsed = tasksWithFloat.filter(t => {
    const baselineEnd = t.baselineEndDate ? new Date(t.baselineEndDate) : null;
    const currentEnd = new Date(t.endDate);
    if (!baselineEnd) return false;
    return isAfter(currentEnd, baselineEnd);
  });

  const floatUtilization = tasksWithFloat.length > 0
    ? (floatUsed.length / tasksWithFloat.length) * 100
    : 0;

  metrics.push({
    name: 'Float Utilization',
    value: Math.round(floatUtilization),
    target: INDUSTRY_BENCHMARKS.floatUtilization,
    status: floatUtilization <= INDUSTRY_BENCHMARKS.floatUtilization ? 'good' : 
            floatUtilization <= 50 ? 'warning' : 'critical',
  });

  // 4. Progress tracking
  const totalProgress = tasks.length > 0
    ? tasks.reduce((sum, t) => sum + (t.percentComplete || 0), 0) / tasks.length
    : 0;

  metrics.push({
    name: 'Overall Progress',
    value: Math.round(totalProgress),
    target: 100,
    status: totalProgress >= 50 ? 'good' : totalProgress >= 25 ? 'warning' : 'critical',
  });

  // 5. Milestone adherence
  const _upcomingMilestones = milestones.filter(m => {
    const targetDate = new Date(m.plannedDate);
    return isAfter(targetDate, now) && isBefore(targetDate, addDays(now, 30));
  });

  const overdueMilestones = milestones.filter(m => {
    const targetDate = new Date(m.plannedDate);
    return m.status !== 'COMPLETED' && isBefore(targetDate, now);
  });

  const milestoneHealth = milestones.length > 0
    ? ((milestones.length - overdueMilestones.length) / milestones.length) * 100
    : 100;

  metrics.push({
    name: 'Milestone Adherence',
    value: Math.round(milestoneHealth),
    target: 100,
    status: getMetricStatus(milestoneHealth, 100),
  });

  // Generate issues

  // Critical: Overdue tasks on critical path
  if (criticalOverdue.length > 0) {
    issues.push({
      id: 'critical-path-overdue',
      severity: 'critical',
      type: 'schedule_slip',
      title: `${criticalOverdue.length} Critical Path Task(s) Overdue`,
      description: `Tasks on the critical path are past their due date, directly impacting project completion.`,
      affectedTasks: criticalOverdue.map(t => t.name),
      suggestedFix: 'Consider crash scheduling or fast-tracking these activities. Add resources or work overtime.',
      autoFixable: false,
      impact: 'Project completion date at risk',
    });
  }

  // Critical: Overdue milestones
  if (overdueMilestones.length > 0) {
    issues.push({
      id: 'overdue-milestones',
      severity: 'critical',
      type: 'milestone_miss',
      title: `${overdueMilestones.length} Milestone(s) Overdue`,
      description: `Key project milestones have not been met, potentially triggering contractual penalties.`,
      affectedTasks: overdueMilestones.map(m => m.name),
      suggestedFix: 'Review milestone dependencies and reallocate resources to achieve completion.',
      autoFixable: false,
      impact: 'Contractual obligations may be affected',
    });
  }

  // Warning: Tasks with zero float
  const zeroFloatTasks = tasks.filter(t => t.totalFloat === 0 && t.status !== 'completed');
  if (zeroFloatTasks.length > 5) {
    issues.push({
      id: 'zero-float-concentration',
      severity: 'warning',
      type: 'float_depletion',
      title: `${zeroFloatTasks.length} Tasks with Zero Float`,
      description: `Many tasks have no schedule buffer. Any delay will impact the project end date.`,
      affectedTasks: zeroFloatTasks.slice(0, 5).map(t => t.name),
      suggestedFix: 'Review task sequences for parallel execution opportunities.',
      autoFixable: false,
      impact: 'Schedule has no flexibility for delays',
    });
  }

  // Warning: Resource conflicts (tasks with same assignee overlapping)
  const tasksByAssignee = tasks.reduce((acc, task) => {
    if (task.assignedTo) {
      if (!acc[task.assignedTo]) acc[task.assignedTo] = [];
      acc[task.assignedTo].push(task);
    }
    return acc;
  }, {} as Record<string, typeof tasks>);

  Object.entries(tasksByAssignee).forEach(([assignee, assignedTasks]: [string, typeof tasks]) => {
    const overlaps: string[] = [];
    for (let i = 0; i < assignedTasks.length; i++) {
      for (let j = i + 1; j < assignedTasks.length; j++) {
        const task1 = assignedTasks[i];
        const task2 = assignedTasks[j];
        const start1 = new Date(task1.startDate);
        const end1 = new Date(task1.endDate);
        const start2 = new Date(task2.startDate);
        const end2 = new Date(task2.endDate);

        // Check for overlap
        if (start1 <= end2 && start2 <= end1) {
          overlaps.push(`${task1.name} ↔ ${task2.name}`);
        }
      }
    }

    if (overlaps.length > 0) {
      issues.push({
        id: `resource-conflict-${assignee}`,
        severity: 'warning',
        type: 'resource_conflict',
        title: 'Resource Over-Allocation Detected',
        description: `Multiple concurrent tasks assigned to the same resource.`,
        affectedTasks: overlaps.slice(0, 3),
        suggestedFix: 'Stagger task start dates or assign additional resources.',
        autoFixable: true,
        impact: 'Tasks may not be completed as scheduled',
      });
    }
  });

  // Warning: Upcoming tight deadlines
  const tightDeadlines = tasks.filter(t => {
    const endDate = new Date(t.endDate);
    const daysRemaining = differenceInDays(endDate, now);
    const remainingProgress = 100 - (t.percentComplete || 0);
    return daysRemaining > 0 && daysRemaining < 7 && remainingProgress > 30;
  });

  if (tightDeadlines.length > 0) {
    issues.push({
      id: 'tight-deadlines',
      severity: 'warning',
      type: 'deadline_risk',
      title: `${tightDeadlines.length} Task(s) at Risk of Missing Deadline`,
      description: `Tasks due within 7 days with significant work remaining.`,
      affectedTasks: tightDeadlines.map(t => t.name),
      suggestedFix: 'Prioritize these tasks and consider adding resources.',
      autoFixable: false,
      impact: 'Near-term schedule slip likely',
    });
  }

  // Info: Stale tasks (in progress for too long)
  const staleTasks = tasks.filter(t => {
    if (t.status !== 'in_progress') return false;
    const startDate = t.actualStartDate ? new Date(t.actualStartDate) : new Date(t.startDate);
    const daysSinceStart = differenceInDays(now, startDate);
    const plannedDuration = differenceInDays(new Date(t.endDate), new Date(t.startDate));
    return daysSinceStart > plannedDuration * 1.5 && (t.percentComplete || 0) < 90;
  });

  if (staleTasks.length > 0) {
    issues.push({
      id: 'stale-tasks',
      severity: 'info',
      type: 'productivity',
      title: `${staleTasks.length} Task(s) Running Long`,
      description: `Tasks have been in progress significantly longer than planned.`,
      affectedTasks: staleTasks.map(t => t.name),
      suggestedFix: 'Review blockers and update progress or extend duration.',
      autoFixable: false,
      impact: 'May indicate productivity issues',
    });
  }

  // Info: Missing baseline
  const noBaseline = tasks.filter(t => !t.baselineStartDate && t.status !== 'completed');
  if (noBaseline.length > tasks.length * 0.3 && noBaseline.length > 5) {
    issues.push({
      id: 'missing-baseline',
      severity: 'info',
      type: 'data_quality',
      title: 'Schedule Baseline Not Set',
      description: `${noBaseline.length} tasks don't have baseline dates, limiting variance tracking.`,
      affectedTasks: noBaseline.slice(0, 3).map(t => t.name),
      suggestedFix: 'Save current schedule as baseline to enable variance tracking.',
      autoFixable: true,
      impact: 'Cannot measure schedule variance',
    });
  }

  // Calculate overall score
  const scoreComponents = [
    onTimeRate * 0.25,
    criticalPathHealth * 0.30,
    (100 - Math.min(floatUtilization, 100)) * 0.15,
    totalProgress * 0.15,
    milestoneHealth * 0.15,
  ];

  const overallScore = Math.round(scoreComponents.reduce((a, b) => a + b, 0));

  // Generate recommendations
  const recommendations: string[] = [];

  if (criticalPathHealth < 90) {
    recommendations.push('Focus resources on critical path activities to prevent schedule slip.');
  }
  if (floatUtilization > 40) {
    recommendations.push('Review schedule buffers - significant float has been consumed.');
  }
  if (delayedTasks.length > tasks.length * 0.1) {
    recommendations.push('Implement corrective actions for delayed activities.');
  }
  if (overdueMilestones.length > 0) {
    recommendations.push('Escalate overdue milestones to project leadership.');
  }
  if (noBaseline.length > 5) {
    recommendations.push('Establish schedule baseline to enable variance tracking.');
  }
  if (zeroFloatTasks.length > 3) {
    recommendations.push('Look for opportunities to add float through parallel execution.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Schedule is on track. Continue monitoring critical path activities.');
  }

  // Benchmark comparison
  const benchmarkComparison = [
    {
      metric: 'On-Time Completion',
      yourValue: Math.round(onTimeRate),
      industryAvg: INDUSTRY_BENCHMARKS.onTimeCompletion,
      percentile: Math.min(100, Math.round((onTimeRate / INDUSTRY_BENCHMARKS.onTimeCompletion) * 50)),
    },
    {
      metric: 'Critical Path Health',
      yourValue: Math.round(criticalPathHealth),
      industryAvg: 85,
      percentile: Math.min(100, Math.round((criticalPathHealth / 85) * 50)),
    },
    {
      metric: 'Float Utilization',
      yourValue: Math.round(floatUtilization),
      industryAvg: INDUSTRY_BENCHMARKS.floatUtilization,
      percentile: floatUtilization <= INDUSTRY_BENCHMARKS.floatUtilization ? 75 : 
                  Math.max(25, 75 - Math.round((floatUtilization - INDUSTRY_BENCHMARKS.floatUtilization))),
    },
  ];

  return {
    overallScore,
    grade: calculateGrade(overallScore),
    status: getStatus(overallScore),
    metrics,
    issues: issues.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    recommendations,
    benchmarkComparison,
    generatedAt: new Date().toISOString(),
  };
}

export async function applyAutoFix(
  projectSlug: string,
  issueId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        Schedule: {
          include: { ScheduleTask: true },
        },
      },
    });

    if (!project) {
      return { success: false, message: 'Project not found' };
    }

    const tasks = project.Schedule.flatMap(s => s.ScheduleTask);

    if (issueId === 'missing-baseline') {
      // Set baseline dates for all tasks without baseline
      const updates = tasks
        .filter(t => !t.baselineStartDate)
        .map(t =>
          prisma.scheduleTask.update({
            where: { id: t.id },
            data: {
              baselineStartDate: t.startDate,
              baselineEndDate: t.endDate,
            },
          })
        );

      await prisma.$transaction(updates);
      return { success: true, message: `Set baseline for ${updates.length} tasks` };
    }

    if (issueId.startsWith('resource-conflict-')) {
      // For resource conflicts, we could stagger start dates
      // This is a simplified implementation
      return { 
        success: false, 
        message: 'Resource conflict resolution requires manual review. Consider reassigning tasks or adjusting dates.' 
      };
    }

    return { success: false, message: 'Auto-fix not available for this issue' };
  } catch (error) {
    logger.error('SCHEDULE_HEALTH', 'Error applying auto-fix', error as Error);
    return { success: false, message: 'Failed to apply fix' };
  }
}
