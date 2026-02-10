/**
 * Project Health Score Service
 * Calculates real-time project health based on multiple factors
 */

import { prisma } from './db';
import { logger } from './logger';
import {
  getProjectIntelligenceMetrics,
  calculateIntelligenceScore,
} from './intelligence-score-calculator';

export interface HealthScoreMetrics {
  // Schedule metrics
  scheduleVariance: number;        // Days ahead/behind
  tasksOnTrack: number;            // Percentage
  upcomingMilestones: number;      // Count due in 7 days
  overdueTasks: number;            // Count
  
  // Budget metrics
  budgetVariance: number;          // Percentage over/under
  changeOrderCount: number;        // Total pending
  invoicesPending: number;         // Count
  
  // Safety metrics
  incidentsFree: number;           // Days without incident
  safetyIssuesOpen: number;        // Count
  
  // Quality metrics
  openRFIs: number;                // Count
  overdueRFIs: number;             // Count
  openPunchItems: number;          // Count
  resolvedPunchRate: number;       // Percentage
  
  // Documentation metrics
  documentsProcessed: number;      // Count
  dailyReportsSubmitted: number;   // Last 7 days
  photosUploaded: number;          // Last 7 days
}

export interface HealthScoreResult {
  overallScore: number | null;
  scheduleScore: number | null;
  budgetScore: number | null;
  safetyScore: number | null;
  qualityScore: number | null;
  documentScore: number | null;
  intelligenceScore?: number;
  trend: 'improving' | 'stable' | 'declining';
  changeFromPrevious: number;
  metrics: HealthScoreMetrics;
  alerts: HealthAlert[];
}

export interface HealthAlert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  actionRequired?: string;
}

/**
 * Calculate the overall project health score
 */
export async function calculateProjectHealth(projectId: string): Promise<HealthScoreResult> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Fetch all required data in parallel
  const [
    project,
    budget,
    changeOrders,
    invoices,
    rfis,
    punchItems,
    dailyReports,
    documents,
    scheduleUpdates,
    previousSnapshot,
  ] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.projectBudget.findUnique({ where: { projectId } }),
    prisma.changeOrder.findMany({ where: { projectId } }),
    prisma.invoice.findMany({ where: { projectId } }),
    prisma.rFI.findMany({ where: { projectId } }),
    prisma.punchListItem.findMany({ where: { projectId } }),
    prisma.dailyReport.findMany({
      where: { projectId, reportDate: { gte: sevenDaysAgo } },
    }),
    prisma.document.findMany({
      where: { projectId, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.scheduleUpdate.findMany({
      where: { projectId, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.projectHealthSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  const alerts: HealthAlert[] = [];
  
  // === SCHEDULE SCORE (0-100, null if no schedule data) ===
  let scheduleScore: number | null = null;
  const scheduleActivities = project.scheduleActivities as any[] || [];
  let tasksOnTrack = 0;
  let overdueTasks = 0;
  let upcomingMilestones = 0;
  let scheduleVariance = 0;

  if (scheduleActivities.length > 0) {
    scheduleScore = 100;
    for (const task of scheduleActivities) {
      const endDate = task.endDate ? new Date(task.endDate) : null;
      const progress = task.progress || 0;

      if (endDate) {
        if (endDate < now && progress < 100) {
          overdueTasks++;
          scheduleScore -= 5;
        } else if (progress >= (getExpectedProgress(task.startDate, task.endDate) - 10)) {
          tasksOnTrack++;
        }

        // Check for upcoming milestones (7 days)
        const daysUntilDue = (endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
        if (daysUntilDue >= 0 && daysUntilDue <= 7) {
          upcomingMilestones++;
        }
      }
    }

    tasksOnTrack = Math.round((tasksOnTrack / scheduleActivities.length) * 100);
    scheduleScore = Math.max(0, Math.min(100, scheduleScore));
  }

  if (overdueTasks > 0) {
    alerts.push({
      type: overdueTasks > 5 ? 'critical' : 'warning',
      category: 'Schedule',
      message: `${overdueTasks} task(s) are overdue`,
      actionRequired: 'Review and update task timelines',
    });
  }
  
  // === BUDGET SCORE (0-100, null if no budget data) ===
  let budgetScore: number | null = null;
  let budgetVariance = 0;
  let invoicesPending = 0;
  let changeOrderCount = 0;

  if (budget && (budget.totalBudget || 0) > 0) {
    budgetScore = 100;
    const totalBudget = budget.totalBudget || 1;
    const actualCost = budget.actualCost || 0;
    budgetVariance = ((actualCost - totalBudget) / totalBudget) * 100;

    if (budgetVariance > 0) {
      budgetScore -= Math.min(50, budgetVariance * 2);
    }

    // Penalize for pending change orders
    changeOrderCount = changeOrders.filter(co => co.status === 'PENDING' || co.status === 'UNDER_REVIEW').length;
    budgetScore -= changeOrderCount * 2;

    // Check pending invoices
    invoicesPending = invoices.filter(inv => inv.status === 'PENDING').length;
    budgetScore = Math.max(0, Math.min(100, budgetScore));
  }

  if (budgetVariance > 10) {
    alerts.push({
      type: 'critical',
      category: 'Budget',
      message: `Project is ${budgetVariance.toFixed(1)}% over budget`,
      actionRequired: 'Review cost overruns and implement controls',
    });
  }
  
  // === SAFETY SCORE (0-100, null if no daily reports) ===
  let safetyScore: number | null = null;
  let incidentsFree = 0;
  let safetyIssuesOpen = 0;

  // Check safety-related punch items
  safetyIssuesOpen = punchItems.filter(p =>
    p.category === 'SAFETY' && (p.status === 'OPEN' || p.status === 'IN_PROGRESS')
  ).length;

  if (dailyReports.length > 0) {
    safetyScore = 100;

    // Count days since last incident from daily reports
    const reportsWithIncidents = dailyReports.filter(r => r.safetyIncidents > 0);
    if (reportsWithIncidents.length === 0) {
      // All clear for the period
      incidentsFree = 7;
    } else {
      const lastIncident = reportsWithIncidents.sort((a, b) =>
        new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime()
      )[0];
      incidentsFree = Math.floor((now.getTime() - new Date(lastIncident.reportDate).getTime()) / (24 * 60 * 60 * 1000));
      safetyScore -= (7 - Math.min(7, incidentsFree)) * 5;
    }

    safetyScore -= safetyIssuesOpen * 10;
    safetyScore = Math.max(0, Math.min(100, safetyScore));
  }

  if (safetyIssuesOpen > 0) {
    alerts.push({
      type: 'critical',
      category: 'Safety',
      message: `${safetyIssuesOpen} open safety issue(s) require attention`,
      actionRequired: 'Address safety concerns immediately',
    });
  }
  
  // === QUALITY SCORE (0-100, null if no punch items or RFIs) ===
  let qualityScore: number | null = null;
  const openRFIs = rfis.filter(r => r.status === 'OPEN' || r.status === 'PENDING_RESPONSE').length;
  const overdueRFIs = rfis.filter(r =>
    r.dueDate && new Date(r.dueDate) < now && r.status !== 'CLOSED'
  ).length;
  const openPunchItems = punchItems.filter(p =>
    p.status === 'OPEN' || p.status === 'IN_PROGRESS'
  ).length;
  const totalPunchItems = punchItems.length;
  const resolvedPunchRate = totalPunchItems > 0
    ? (punchItems.filter(p => p.status === 'VERIFIED').length / totalPunchItems) * 100
    : 0;

  if (punchItems.length > 0 || rfis.length > 0) {
    qualityScore = 100;
    qualityScore -= openRFIs * 2;
    qualityScore -= overdueRFIs * 5;
    qualityScore -= openPunchItems;
    qualityScore = Math.max(0, Math.min(100, qualityScore));
  }

  if (overdueRFIs > 0) {
    alerts.push({
      type: 'warning',
      category: 'Quality',
      message: `${overdueRFIs} RFI(s) are past due`,
      actionRequired: 'Follow up on outstanding RFIs',
    });
  }

  if (openPunchItems > 20) {
    alerts.push({
      type: 'warning',
      category: 'Quality',
      message: `${openPunchItems} punch list items remain open`,
      actionRequired: 'Accelerate punch list completion',
    });
  }
  
  // === DOCUMENTATION SCORE (0-100, null if no reports/photos) ===
  let documentScore: number | null = null;
  const documentsProcessed = documents.length;
  const dailyReportsSubmitted = dailyReports.filter(r => r.status === 'SUBMITTED' || r.status === 'APPROVED').length;
  const photosUploaded = documents.filter(d =>
    d.fileType && ['jpg', 'jpeg', 'png', 'gif'].includes(d.fileType.toLowerCase())
  ).length;

  if (dailyReportsSubmitted > 0 || photosUploaded > 0) {
    documentScore = 100;

    // Expect at least 5 daily reports in 7 days (weekdays)
    if (dailyReportsSubmitted < 3) {
      documentScore -= (3 - dailyReportsSubmitted) * 10;
      alerts.push({
        type: 'info',
        category: 'Documentation',
        message: 'Daily reports are behind schedule',
        actionRequired: 'Submit missing daily reports',
      });
    }

    documentScore = Math.max(0, Math.min(100, documentScore));
  }

  // Intelligence score is reported separately, not blended into health
  let intelligenceScoreValue: number | undefined;
  try {
    const intMetrics = await getProjectIntelligenceMetrics(projectId);
    const intScore = calculateIntelligenceScore(intMetrics);
    intelligenceScoreValue = intScore.overall;
  } catch (err) {
    logger.warn('PROJECT_HEALTH', 'Intelligence scoring failed', {
      projectId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  
  // === CALCULATE OVERALL SCORE ===
  // Weighted average from non-null categories only; null if < 2 have data
  const categoryScores = [
    { score: scheduleScore, weight: 0.25 },
    { score: budgetScore, weight: 0.25 },
    { score: safetyScore, weight: 0.20 },
    { score: qualityScore, weight: 0.20 },
    { score: documentScore, weight: 0.10 },
  ].filter(s => s.score !== null) as { score: number; weight: number }[];

  let overallScore: number | null = null;
  if (categoryScores.length >= 2) {
    const totalWeight = categoryScores.reduce((sum, s) => sum + s.weight, 0);
    overallScore = Math.round(
      categoryScores.reduce((sum, s) => sum + (s.score * s.weight), 0) / totalWeight
    );
  }
  
  // === DETERMINE TREND ===
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  let changeFromPrevious = 0;
  
  if (previousSnapshot && overallScore !== null) {
    changeFromPrevious = overallScore - previousSnapshot.overallScore;
    if (changeFromPrevious > 3) trend = 'improving';
    else if (changeFromPrevious < -3) trend = 'declining';
  }
  
  const metrics: HealthScoreMetrics = {
    scheduleVariance,
    tasksOnTrack,
    upcomingMilestones,
    overdueTasks,
    budgetVariance,
    changeOrderCount,
    invoicesPending,
    incidentsFree,
    safetyIssuesOpen,
    openRFIs,
    overdueRFIs,
    openPunchItems,
    resolvedPunchRate,
    documentsProcessed,
    dailyReportsSubmitted,
    photosUploaded,
  };
  
  return {
    overallScore,
    scheduleScore: scheduleScore !== null ? Math.round(scheduleScore) : null,
    budgetScore: budgetScore !== null ? Math.round(budgetScore) : null,
    safetyScore: safetyScore !== null ? Math.round(safetyScore) : null,
    qualityScore: qualityScore !== null ? Math.round(qualityScore) : null,
    documentScore: documentScore !== null ? Math.round(documentScore) : null,
    intelligenceScore: intelligenceScoreValue,
    trend,
    changeFromPrevious,
    metrics,
    alerts,
  };
}

/**
 * Helper to calculate expected progress based on timeline
 */
function getExpectedProgress(startDate: string | Date | null, endDate: string | Date | null): number {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  
  if (now <= start) return 0;
  if (now >= end) return 100;
  
  return ((now - start) / (end - start)) * 100;
}

/**
 * Save a health snapshot for trend tracking
 */
export async function saveHealthSnapshot(projectId: string): Promise<void> {
  const health = await calculateProjectHealth(projectId);
  
  await prisma.projectHealthSnapshot.create({
    data: {
      projectId,
      overallScore: health.overallScore ?? 0,
      scheduleScore: health.scheduleScore ?? 0,
      budgetScore: health.budgetScore ?? 0,
      safetyScore: health.safetyScore ?? 0,
      qualityScore: health.qualityScore ?? 0,
      documentScore: health.documentScore ?? 0,
      metrics: health.metrics as any,
      trend: health.trend,
      changeFromPrevious: health.changeFromPrevious,
    },
  });
}

/**
 * Get health history for trend visualization
 */
export async function getHealthHistory(
  projectId: string,
  days: number = 30
): Promise<{ date: Date; score: number; trend: string | null }[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const snapshots = await prisma.projectHealthSnapshot.findMany({
    where: {
      projectId,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      overallScore: true,
      trend: true,
    },
  });
  
  return snapshots.map(s => ({
    date: s.createdAt,
    score: s.overallScore,
    trend: s.trend,
  }));
}

/**
 * Get health score color based on value
 */
export function getHealthColor(score: number | null): string {
  if (score === null) return '#6B7280'; // Gray for no data
  if (score >= 80) return '#22C55E'; // Green
  if (score >= 60) return '#EAB308'; // Yellow
  if (score >= 40) return '#F97316'; // Orange
  return '#EF4444'; // Red
}

/**
 * Get health score label
 */
export function getHealthLabel(score: number | null): string {
  if (score === null) return 'No Data';
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Attention';
  return 'Critical';
}
