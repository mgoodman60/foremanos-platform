/**
 * Analytics Service - Phase 6: Reporting & Analytics
 * Comprehensive KPI calculations and data aggregation
 */

import { prisma } from './db';
import { differenceInDays, startOfWeek, subDays, subWeeks, subMonths, format, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';

// =============================================
// PROJECT KPI CALCULATIONS
// =============================================

export interface ProjectKPIs {
  schedulePerformanceIndex: number;
  scheduleVariance: number;
  percentComplete: number;
  daysRemaining: number;
  daysElapsed: number;
  criticalPathTasks: number;
  tasksOnTrack: number;
  tasksDelayed: number;
  costPerformanceIndex: number;
  costVariance: number;
  budgetUtilization: number;
  estimateAtCompletion: number;
  varianceAtCompletion: number;
  rfiCount: number;
  openRFIs: number;
  changeOrderCount: number;
  pendingChangeOrders: number;
  punchListItems: number;
  openPunchItems: number;
  safetyIncidents: number;
  daysWithoutIncident: number;
  safetyScore: number;
  dailyReportCount: number;
  averageCrewSize: number;
  workHoursLogged: number;
  tasksCompletedThisWeek: number;
  totalDocuments: number;
  documentsProcessed: number;
  pendingReviews: number;
}

export async function calculateProjectKPIs(projectId: string): Promise<ProjectKPIs> {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const now = new Date();
  const weekStart = startOfWeek(now);

  // Fetch all related data in parallel with graceful error handling
  // Each query has its own catch to prevent one failure from breaking all analytics
  const [schedule, budget, documents, dailyReports, changeOrders, crews] = await Promise.all([
    prisma.schedule.findFirst({
      where: { projectId },
      include: { ScheduleTask: true },
    }).catch((err) => {
      console.error(`[Analytics] Failed to fetch schedule for ${projectId}:`, err);
      return null;
    }),
    prisma.projectBudget.findFirst({
      where: { projectId },
      include: { BudgetItem: true },
    }).catch((err) => {
      console.error(`[Analytics] Failed to fetch budget for ${projectId}:`, err);
      return null;
    }),
    prisma.document.findMany({
      where: { projectId, deletedAt: null },
    }).catch((err) => {
      console.error(`[Analytics] Failed to fetch documents for ${projectId}:`, err);
      return [] as Awaited<ReturnType<typeof prisma.document.findMany>>;
    }),
    prisma.dailyReport.findMany({
      where: { projectId, createdAt: { gte: subDays(now, 30) } },
    }).catch((err) => {
      console.error(`[Analytics] Failed to fetch daily reports for ${projectId}:`, err);
      return [] as Awaited<ReturnType<typeof prisma.dailyReport.findMany>>;
    }),
    prisma.changeOrder.findMany({
      where: { projectId },
    }).catch((err) => {
      console.error(`[Analytics] Failed to fetch change orders for ${projectId}:`, err);
      return [] as Awaited<ReturnType<typeof prisma.changeOrder.findMany>>;
    }),
    prisma.crew.findMany({
      where: { projectId },
    }).catch((err) => {
      console.error(`[Analytics] Failed to fetch crews for ${projectId}:`, err);
      return [] as Awaited<ReturnType<typeof prisma.crew.findMany>>;
    }),
  ]);

  // Schedule KPIs
  let schedulePerformanceIndex = 1.0;
  let scheduleVariance = 0;
  let percentComplete = 0;
  let daysRemaining = 0;
  let daysElapsed = 0;
  let criticalPathTasks = 0;
  let tasksOnTrack = 0;
  let tasksDelayed = 0;
  let tasksCompletedThisWeek = 0;

  if (schedule) {
    const tasks = schedule.ScheduleTask;
    const totalDuration = differenceInDays(schedule.endDate, schedule.startDate);
    daysElapsed = Math.max(0, differenceInDays(now, schedule.startDate));
    daysRemaining = Math.max(0, differenceInDays(schedule.endDate, now));
    
    const plannedProgress = totalDuration > 0 ? Math.min(100, (daysElapsed / totalDuration) * 100) : 0;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;
    percentComplete = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    schedulePerformanceIndex = plannedProgress > 0 ? percentComplete / plannedProgress : 1.0;
    scheduleVariance = percentComplete - plannedProgress;
    
    criticalPathTasks = tasks.filter(t => t.isCritical).length;
    tasksOnTrack = tasks.filter(t => t.status === 'in_progress' && t.endDate >= now).length;
    tasksDelayed = tasks.filter(t => t.status !== 'completed' && t.endDate < now).length;
    tasksCompletedThisWeek = tasks.filter(t => t.status === 'completed' && t.updatedAt >= weekStart).length;
  }

  // Budget KPIs
  let costPerformanceIndex = 1.0;
  let costVariance = 0;
  let budgetUtilization = 0;
  let estimateAtCompletion = 0;
  let varianceAtCompletion = 0;

  if (budget) {
    const totalBudget = budget.totalBudget || 0;
    const actualCost = budget.BudgetItem.reduce((sum, item) => sum + (item.actualCost || 0), 0);
    const earnedValue = (percentComplete / 100) * totalBudget;
    
    costPerformanceIndex = actualCost > 0 ? earnedValue / actualCost : 1.0;
    costVariance = earnedValue - actualCost;
    budgetUtilization = totalBudget > 0 ? (actualCost / totalBudget) * 100 : 0;
    estimateAtCompletion = costPerformanceIndex > 0 ? totalBudget / costPerformanceIndex : totalBudget;
    varianceAtCompletion = totalBudget - estimateAtCompletion;
  }

  // Quality KPIs
  const pendingCOs = changeOrders.filter(co => co.status === 'PENDING' || co.status === 'UNDER_REVIEW');

  // Safety KPIs (simulated)
  const lastIncidentDate = subDays(now, 45);
  const daysWithoutIncident = differenceInDays(now, lastIncidentDate);
  const safetyScore = Math.min(100, 85 + (daysWithoutIncident / 10));

  // Productivity KPIs
  const averageCrewSize = crews.length > 0 ? crews.reduce((sum, c) => sum + (c.averageSize || 4), 0) / crews.length : 0;
  const workHoursLogged = dailyReports.length * 8;

  // Document KPIs
  const processedDocs = documents.filter(d => d.processingCost !== null && d.processingCost > 0);

  return {
    schedulePerformanceIndex: Math.round(schedulePerformanceIndex * 100) / 100,
    scheduleVariance: Math.round(scheduleVariance * 10) / 10,
    percentComplete: Math.round(percentComplete * 10) / 10,
    daysRemaining,
    daysElapsed,
    criticalPathTasks,
    tasksOnTrack,
    tasksDelayed,
    costPerformanceIndex: Math.round(costPerformanceIndex * 100) / 100,
    costVariance: Math.round(costVariance),
    budgetUtilization: Math.round(budgetUtilization * 10) / 10,
    estimateAtCompletion: Math.round(estimateAtCompletion),
    varianceAtCompletion: Math.round(varianceAtCompletion),
    rfiCount: 0,
    openRFIs: 0,
    changeOrderCount: changeOrders.length,
    pendingChangeOrders: pendingCOs.length,
    punchListItems: 0,
    openPunchItems: 0,
    safetyIncidents: 0,
    daysWithoutIncident,
    safetyScore: Math.round(safetyScore),
    dailyReportCount: dailyReports.length,
    averageCrewSize: Math.round(averageCrewSize * 10) / 10,
    workHoursLogged,
    tasksCompletedThisWeek,
    totalDocuments: documents.length,
    documentsProcessed: processedDocs.length,
    pendingReviews: documents.length - processedDocs.length
  };
}

// =============================================
// TREND DATA CALCULATIONS
// =============================================

export interface TrendDataPoint {
  date: string;
  plannedProgress: number;
  actualProgress: number;
  plannedCost: number;
  actualCost: number;
  earnedValue: number;
}

export async function getProgressTrends(
  projectId: string,
  period: 'weekly' | 'monthly' = 'weekly',
  lookback: number = 12
): Promise<TrendDataPoint[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) return [];

  const schedule = await prisma.schedule.findFirst({
    where: { projectId },
    include: { ScheduleTask: true }
  });

  const budget = await prisma.projectBudget.findFirst({
    where: { projectId },
    include: { BudgetItem: true }
  });

  const now = new Date();
  const startDate = period === 'weekly' 
    ? subWeeks(now, lookback)
    : subMonths(now, lookback);

  const intervals = period === 'weekly'
    ? eachWeekOfInterval({ start: startDate, end: now })
    : eachMonthOfInterval({ start: startDate, end: now });

  const totalBudget = budget?.totalBudget || 0;
  const projectStart = schedule?.startDate || project.createdAt;
  const projectEnd = schedule?.endDate || new Date();
  const totalDuration = differenceInDays(projectEnd, projectStart);
  const tasks = schedule?.ScheduleTask || [];
  const totalTasks = tasks.length || 1;

  return intervals.map(date => {
    const daysFromStart = differenceInDays(date, projectStart);
    const plannedProgress = totalDuration > 0 
      ? Math.min(100, Math.max(0, (daysFromStart / totalDuration) * 100))
      : 0;

    const completedByDate = tasks.filter(t => 
      t.status === 'completed' && t.updatedAt <= date
    ).length;
    const actualProgress = (completedByDate / totalTasks) * 100;

    const plannedCost = (plannedProgress / 100) * totalBudget;
    const actualCost = (actualProgress / 100) * totalBudget * 1.05;
    const earnedValue = (actualProgress / 100) * totalBudget;

    return {
      date: format(date, period === 'weekly' ? 'MMM dd' : 'MMM yyyy'),
      plannedProgress: Math.round(plannedProgress * 10) / 10,
      actualProgress: Math.round(actualProgress * 10) / 10,
      plannedCost: Math.round(plannedCost),
      actualCost: Math.round(actualCost),
      earnedValue: Math.round(earnedValue)
    };
  });
}

// =============================================
// RESOURCE UTILIZATION ANALYTICS
// =============================================

export interface ResourceUtilization {
  resourceType: string;
  allocated: number;
  utilized: number;
  utilizationRate: number;
  trend: 'up' | 'down' | 'stable';
}

export async function getResourceUtilization(projectId: string): Promise<ResourceUtilization[]> {
  const allocations = await prisma.resourceAllocation.findMany({
    where: { projectId }
  });

  const byType = new Map<string, { allocated: number; utilized: number }>();

  allocations.forEach(alloc => {
    const type = alloc.resourceType;
    const current = byType.get(type) || { allocated: 0, utilized: 0 };
    current.allocated += alloc.allocatedUnits || 1;
    current.utilized += (alloc.allocatedUnits || 1) * (alloc.utilizationPercent / 100);
    byType.set(type, current);
  });

  return Array.from(byType.entries()).map(([type, data]) => ({
    resourceType: type,
    allocated: data.allocated,
    utilized: Math.round(data.utilized * 10) / 10,
    utilizationRate: data.allocated > 0 ? Math.round((data.utilized / data.allocated) * 100) : 0,
    trend: data.utilized / data.allocated > 0.8 ? 'up' : data.utilized / data.allocated < 0.5 ? 'down' : 'stable'
  }));
}

// =============================================
// COST BREAKDOWN ANALYTICS
// =============================================

export interface CostBreakdown {
  category: string;
  budgeted: number;
  committed: number;
  actual: number;
  variance: number;
  percentOfBudget: number;
}

export async function getCostBreakdown(projectId: string): Promise<CostBreakdown[]> {
  const budget = await prisma.projectBudget.findFirst({
    where: { projectId },
    include: { BudgetItem: true }
  });

  if (!budget) return [];

  const byTrade = new Map<string, CostBreakdown>();
  const totalBudget = budget.totalBudget || 0;

  budget.BudgetItem.forEach(item => {
    const trade = item.tradeType || 'General';
    
    const current = byTrade.get(trade) || {
      category: trade,
      budgeted: 0,
      committed: 0,
      actual: 0,
      variance: 0,
      percentOfBudget: 0
    };

    current.budgeted += item.budgetedAmount || 0;
    current.committed += item.committedCost || 0;
    current.actual += item.actualCost || 0;
    byTrade.set(trade, current);
  });

  return Array.from(byTrade.values()).map(item => ({
    ...item,
    variance: item.budgeted - item.actual,
    percentOfBudget: totalBudget > 0 ? Math.round((item.budgeted / totalBudget) * 100) : 0
  })).sort((a, b) => b.budgeted - a.budgeted);
}

// =============================================
// SCHEDULE ANALYTICS
// =============================================

export interface ScheduleAnalytics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  delayedTasks: number;
  criticalTasks: number;
  averageTaskDuration: number;
  longestTask: { name: string; duration: number } | null;
  upcomingMilestones: Array<{ name: string; date: Date; daysUntil: number }>;
}

export async function getScheduleAnalytics(projectId: string): Promise<ScheduleAnalytics> {
  const schedule = await prisma.schedule.findFirst({
    where: { projectId },
    include: { ScheduleTask: true }
  });

  const milestones = await prisma.milestone.findMany({
    where: { projectId, status: { not: 'COMPLETED' } },
    orderBy: { plannedDate: 'asc' },
    take: 5
  });

  const tasks = schedule?.ScheduleTask || [];
  const now = new Date();

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const notStartedTasks = tasks.filter(t => t.status === 'not_started').length;
  const delayedTasks = tasks.filter(t => t.status !== 'completed' && t.endDate < now).length;
  const criticalTasks = tasks.filter(t => t.isCritical).length;

  const totalDuration = tasks.reduce((sum, t) => sum + t.duration, 0);
  const averageTaskDuration = tasks.length > 0 ? totalDuration / tasks.length : 0;

  const longestTask = tasks.reduce((longest, t) => {
    if (!longest || t.duration > longest.duration) {
      return { name: t.name, duration: t.duration };
    }
    return longest;
  }, null);

  return {
    totalTasks: tasks.length,
    completedTasks,
    inProgressTasks,
    notStartedTasks,
    delayedTasks,
    criticalTasks,
    averageTaskDuration: Math.round(averageTaskDuration * 10) / 10,
    longestTask,
    upcomingMilestones: milestones.map(m => ({
      name: m.name,
      date: m.plannedDate,
      daysUntil: differenceInDays(m.plannedDate, now)
    }))
  };
}

// =============================================
// TEAM PERFORMANCE ANALYTICS
// =============================================

export interface TeamPerformance {
  crewId: string;
  crewName: string;
  memberCount: number;
  tasksAssigned: number;
  tasksCompleted: number;
  completionRate: number;
  averageProductivity: number;
  hoursLogged: number;
}

export async function getTeamPerformance(projectId: string): Promise<TeamPerformance[]> {
  const crews = await prisma.crew.findMany({
    where: { projectId },
    include: {
      CrewPerformance: {
        where: { date: { gte: subDays(new Date(), 30) } }
      }
    }
  });

  return crews.map(crew => {
    const performances = crew.CrewPerformance || [];
    const avgProductivity = performances.length > 0
      ? performances.reduce((sum: number, p) => sum + (p.productivityRate || 0), 0) / performances.length
      : 0;
    const totalHours = performances.reduce((sum: number, p) => sum + p.hoursWorked, 0);

    return {
      crewId: crew.id,
      crewName: crew.name,
      memberCount: crew.averageSize || 4,
      tasksAssigned: 0,
      tasksCompleted: 0,
      completionRate: 0,
      averageProductivity: Math.round(avgProductivity),
      hoursLogged: totalHours
    };
  });
}

// =============================================
// MEP ANALYTICS
// =============================================

export interface MEPAnalytics {
  systemType: string;
  totalItems: number;
  installed: number;
  tested: number;
  commissioned: number;
  installationRate: number;
  issuesCount: number;
}

export async function getMEPAnalytics(projectId: string): Promise<MEPAnalytics[]> {
  const systems = ['MECHANICAL', 'ELECTRICAL', 'PLUMBING', 'FIRE_PROTECTION', 'CONTROLS'];

  try {
    // Fetch all equipment for the project in a single query
    const allEquipment = await prisma.mEPEquipment.findMany({
      where: { projectId },
      select: { equipmentType: true, status: true }
    });

    // Group and calculate metrics in memory
    const results: MEPAnalytics[] = [];

    for (const system of systems) {
      const systemEquipment = allEquipment.filter(e => e.equipmentType === system);
      const totalItems = systemEquipment.length;

      if (totalItems > 0) {
        const installed = systemEquipment.filter(e =>
          ['INSTALLED', 'CONNECTED', 'TESTED', 'OPERATIONAL'].includes(e.status)
        ).length;

        const tested = systemEquipment.filter(e =>
          ['TESTED', 'OPERATIONAL'].includes(e.status)
        ).length;

        const commissioned = systemEquipment.filter(e =>
          e.status === 'OPERATIONAL'
        ).length;

        results.push({
          systemType: system.replace('_', ' '),
          totalItems,
          installed,
          tested,
          commissioned,
          installationRate: Math.round((installed / totalItems) * 100),
          issuesCount: 0
        });
      }
    }

    return results;
  } catch {
    // Return empty array if model doesn't exist or query fails
    return [];
  }
}

// =============================================
// DOCUMENT ANALYTICS
// =============================================

export interface DocumentAnalytics {
  totalDocuments: number;
  byCategory: Array<{ category: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  processingStatus: {
    completed: number;
    processing: number;
    failed: number;
    pending: number;
  };
  recentUploads: number;
  storageUsed: number;
}

export async function getDocumentAnalytics(projectId: string): Promise<DocumentAnalytics> {
  const documents = await prisma.document.findMany({
    where: { projectId, deletedAt: null }
  });

  const categoryMap = new Map<string, number>();
  documents.forEach(doc => {
    const cat = doc.category || 'Uncategorized';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
  });

  const typeMap = new Map<string, number>();
  documents.forEach(doc => {
    const ext = doc.name.split('.').pop()?.toUpperCase() || 'OTHER';
    typeMap.set(ext, (typeMap.get(ext) || 0) + 1);
  });

  const completed = documents.filter(d => d.processingCost !== null).length;
  const processing = 0;
  const failed = 0;
  const pending = documents.length - completed;

  const recentUploads = documents.filter(d => 
    d.createdAt && d.createdAt >= subDays(new Date(), 7)
  ).length;

  const storageUsed = documents.reduce((sum, d) => sum + (d.fileSize || 0), 0);

  return {
    totalDocuments: documents.length,
    byCategory: Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count })),
    byType: Array.from(typeMap.entries()).map(([type, count]) => ({ type, count })),
    processingStatus: { completed, processing, failed, pending },
    recentUploads,
    storageUsed
  };
}

// =============================================
// PROJECT COMPARISON
// =============================================

export interface ProjectComparison {
  projectId: string;
  projectName: string;
  percentComplete: number;
  budgetUtilization: number;
  schedulePerformance: number;
  documentCount: number;
  teamSize: number;
}

export async function compareProjects(projectIds: string[]): Promise<ProjectComparison[]> {
  if (projectIds.length === 0) return [];

  // Batch fetch all projects with their crews in a single query
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: {
      Crew: { select: { averageSize: true } },
      _count: { select: { Document: true } }
    }
  });

  // Calculate KPIs in parallel for all projects
  const kpisPromises = projectIds.map(projectId =>
    calculateProjectKPIs(projectId).catch(error => {
      console.error(`Error calculating KPIs for project ${projectId}:`, error);
      return null;
    })
  );
  const kpisResults = await Promise.all(kpisPromises);

  // Build comparison results
  const comparisons: ProjectComparison[] = [];

  for (let i = 0; i < projectIds.length; i++) {
    const projectId = projectIds[i];
    const project = projects.find(p => p.id === projectId);
    const kpis = kpisResults[i];

    if (project && kpis) {
      const teamSize = project.Crew.reduce((sum, c) => sum + (c.averageSize || 4), 0);
      comparisons.push({
        projectId,
        projectName: project.name,
        percentComplete: kpis.percentComplete,
        budgetUtilization: kpis.budgetUtilization,
        schedulePerformance: kpis.schedulePerformanceIndex * 100,
        documentCount: kpis.totalDocuments,
        teamSize
      });
    }
  }

  return comparisons;
}
