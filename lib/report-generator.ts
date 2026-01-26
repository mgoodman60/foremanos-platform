/**
 * Report Generator Service - Phase 6: Reporting & Analytics
 * Automated and custom report generation
 */

import { prisma } from './db';
import { 
  calculateProjectKPIs, 
  getProgressTrends, 
  getCostBreakdown, 
  getScheduleAnalytics,
  getTeamPerformance,
  getMEPAnalytics,
  getDocumentAnalytics,
  getResourceUtilization
} from './analytics-service';
import { format, subDays, subWeeks, subMonths } from 'date-fns';

// =============================================
// REPORT TYPES & CONFIGURATIONS
// =============================================

export type ReportType = 
  | 'EXECUTIVE_SUMMARY'
  | 'PROGRESS_REPORT'
  | 'COST_REPORT'
  | 'SCHEDULE_REPORT'
  | 'SAFETY_REPORT'
  | 'MEP_REPORT'
  | 'RESOURCE_REPORT'
  | 'CUSTOM';

export type ReportFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ON_DEMAND';

export interface ReportConfig {
  type: ReportType;
  projectId: string;
  title?: string;
  sections: string[];
  dateRange?: { start: Date; end: Date };
  includeCharts?: boolean;
  recipients?: string[];
  format?: 'JSON' | 'PDF' | 'CSV';
}

export interface GeneratedReport {
  id: string;
  type: ReportType;
  title: string;
  generatedAt: Date;
  projectId: string;
  projectName: string;
  dateRange: { start: string; end: string };
  sections: ReportSection[];
  summary: string;
  recommendations: string[];
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'kpi' | 'table' | 'chart' | 'text' | 'list';
  data: any;
}

// =============================================
// EXECUTIVE SUMMARY REPORT
// =============================================

export async function generateExecutiveSummary(projectId: string): Promise<GeneratedReport> {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) throw new Error('Project not found');

  const kpis = await calculateProjectKPIs(projectId);
  const trends = await getProgressTrends(projectId, 'weekly', 4);
  const costBreakdown = await getCostBreakdown(projectId);
  const scheduleAnalytics = await getScheduleAnalytics(projectId);

  const sections: ReportSection[] = [
    {
      id: 'overview',
      title: 'Project Overview',
      type: 'kpi',
      data: {
        percentComplete: kpis.percentComplete,
        daysRemaining: kpis.daysRemaining,
        budgetUtilization: kpis.budgetUtilization,
        schedulePerformance: kpis.schedulePerformanceIndex
      }
    },
    {
      id: 'schedule-status',
      title: 'Schedule Status',
      type: 'kpi',
      data: {
        spi: kpis.schedulePerformanceIndex,
        scheduleVariance: `${kpis.scheduleVariance}%`,
        tasksOnTrack: kpis.tasksOnTrack,
        tasksDelayed: kpis.tasksDelayed,
        criticalPath: kpis.criticalPathTasks
      }
    },
    {
      id: 'budget-status',
      title: 'Budget Status',
      type: 'kpi',
      data: {
        cpi: kpis.costPerformanceIndex,
        costVariance: formatCurrency(kpis.costVariance),
        eac: formatCurrency(kpis.estimateAtCompletion),
        vac: formatCurrency(kpis.varianceAtCompletion)
      }
    },
    {
      id: 'progress-trend',
      title: 'Progress Trend (Last 4 Weeks)',
      type: 'chart',
      data: trends
    },
    {
      id: 'cost-breakdown',
      title: 'Cost Breakdown by Division',
      type: 'table',
      data: costBreakdown.slice(0, 10)
    },
    {
      id: 'upcoming-milestones',
      title: 'Upcoming Milestones',
      type: 'list',
      data: scheduleAnalytics.upcomingMilestones
    }
  ];

  // Generate recommendations
  const recommendations = generateRecommendations(kpis);

  // Generate summary text
  const summary = generateSummaryText(project.name, kpis);

  return {
    id: `exec-${Date.now()}`,
    type: 'EXECUTIVE_SUMMARY',
    title: `Executive Summary - ${project.name}`,
    generatedAt: new Date(),
    projectId,
    projectName: project.name,
    dateRange: {
      start: format(subWeeks(new Date(), 4), 'MMM dd, yyyy'),
      end: format(new Date(), 'MMM dd, yyyy')
    },
    sections,
    summary,
    recommendations
  };
}

// =============================================
// PROGRESS REPORT
// =============================================

export async function generateProgressReport(
  projectId: string,
  period: 'weekly' | 'monthly' = 'weekly'
): Promise<GeneratedReport> {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) throw new Error('Project not found');

  const kpis = await calculateProjectKPIs(projectId);
  const scheduleAnalytics = await getScheduleAnalytics(projectId);
  const teamPerformance = await getTeamPerformance(projectId);
  const trends = await getProgressTrends(projectId, period, period === 'weekly' ? 4 : 3);

  // Get daily reports for the period
  const periodStart = period === 'weekly' ? subWeeks(new Date(), 1) : subMonths(new Date(), 1);
  const dailyReports = await prisma.dailyReport.findMany({
    where: {
      projectId,
      createdAt: { gte: periodStart }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const sections: ReportSection[] = [
    {
      id: 'progress-summary',
      title: 'Progress Summary',
      type: 'kpi',
      data: {
        overallProgress: `${kpis.percentComplete}%`,
        tasksCompleted: scheduleAnalytics.completedTasks,
        tasksInProgress: scheduleAnalytics.inProgressTasks,
        tasksDelayed: scheduleAnalytics.delayedTasks
      }
    },
    {
      id: 'schedule-performance',
      title: 'Schedule Performance',
      type: 'kpi',
      data: {
        spi: kpis.schedulePerformanceIndex,
        variance: `${kpis.scheduleVariance}%`,
        daysRemaining: kpis.daysRemaining,
        completedThisWeek: kpis.tasksCompletedThisWeek
      }
    },
    {
      id: 'progress-chart',
      title: 'Progress Over Time',
      type: 'chart',
      data: trends
    },
    {
      id: 'task-breakdown',
      title: 'Task Status Breakdown',
      type: 'chart',
      data: {
        labels: ['Completed', 'In Progress', 'Not Started', 'Delayed'],
        values: [
          scheduleAnalytics.completedTasks,
          scheduleAnalytics.inProgressTasks,
          scheduleAnalytics.notStartedTasks,
          scheduleAnalytics.delayedTasks
        ]
      }
    },
    {
      id: 'team-performance',
      title: 'Team Performance',
      type: 'table',
      data: teamPerformance
    },
    {
      id: 'daily-reports',
      title: 'Recent Daily Reports',
      type: 'list',
      data: dailyReports.map(r => ({
        date: format(r.createdAt, 'MMM dd'),
        weather: r.weatherCondition || 'N/A',
        status: r.status
      }))
    }
  ];

  const recommendations: string[] = [];
  if (kpis.schedulePerformanceIndex < 0.9) {
    recommendations.push('Schedule is behind target. Consider adding resources to critical path tasks.');
  }
  if (scheduleAnalytics.delayedTasks > 3) {
    recommendations.push(`${scheduleAnalytics.delayedTasks} tasks are delayed. Review and update task assignments.`);
  }
  if (kpis.tasksCompletedThisWeek === 0) {
    recommendations.push('No tasks completed this week. Investigate potential blockers.');
  }

  return {
    id: `progress-${Date.now()}`,
    type: 'PROGRESS_REPORT',
    title: `${period === 'weekly' ? 'Weekly' : 'Monthly'} Progress Report - ${project.name}`,
    generatedAt: new Date(),
    projectId,
    projectName: project.name,
    dateRange: {
      start: format(periodStart, 'MMM dd, yyyy'),
      end: format(new Date(), 'MMM dd, yyyy')
    },
    sections,
    summary: `Project is ${kpis.percentComplete}% complete with SPI of ${kpis.schedulePerformanceIndex}. ${kpis.tasksCompletedThisWeek} tasks completed this week.`,
    recommendations
  };
}

// =============================================
// COST REPORT
// =============================================

export async function generateCostReport(projectId: string): Promise<GeneratedReport> {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) throw new Error('Project not found');

  const kpis = await calculateProjectKPIs(projectId);
  const costBreakdown = await getCostBreakdown(projectId);
  const trends = await getProgressTrends(projectId, 'monthly', 6);

  // Get change orders
  const changeOrders = await prisma.changeOrder.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' }
  });

  const approvedCOs = changeOrders.filter(co => co.status === 'APPROVED');
  const totalCOValue = approvedCOs.reduce((sum, co) => sum + (co.approvedAmount || co.proposedAmount || 0), 0);

  // Get payment applications
  const payApps = await prisma.paymentApplication.findMany({
    where: { projectId },
    orderBy: { periodEnd: 'desc' }
  });

  const sections: ReportSection[] = [
    {
      id: 'budget-overview',
      title: 'Budget Overview',
      type: 'kpi',
      data: {
        totalBudget: formatCurrency(kpis.estimateAtCompletion + kpis.varianceAtCompletion),
        actualCost: formatCurrency(kpis.estimateAtCompletion - kpis.varianceAtCompletion),
        budgetUtilization: `${kpis.budgetUtilization}%`,
        costVariance: formatCurrency(kpis.costVariance)
      }
    },
    {
      id: 'evm-metrics',
      title: 'Earned Value Metrics',
      type: 'kpi',
      data: {
        cpi: kpis.costPerformanceIndex,
        eac: formatCurrency(kpis.estimateAtCompletion),
        vac: formatCurrency(kpis.varianceAtCompletion),
        status: kpis.costPerformanceIndex >= 1 ? 'Under Budget' : 'Over Budget'
      }
    },
    {
      id: 'cost-trend',
      title: 'Cost Trend',
      type: 'chart',
      data: trends.map(t => ({
        period: t.date,
        planned: t.plannedCost,
        actual: t.actualCost,
        earned: t.earnedValue
      }))
    },
    {
      id: 'cost-by-division',
      title: 'Cost by Division',
      type: 'table',
      data: costBreakdown
    },
    {
      id: 'change-orders',
      title: 'Change Orders Summary',
      type: 'kpi',
      data: {
        totalCOs: changeOrders.length,
        approved: approvedCOs.length,
        pending: kpis.pendingChangeOrders,
        totalValue: formatCurrency(totalCOValue)
      }
    },
    {
      id: 'payment-apps',
      title: 'Recent Payment Applications',
      type: 'table',
      data: payApps.slice(0, 5).map(pa => ({
        number: pa.applicationNumber,
        period: `${format(pa.periodStart, 'MMM dd')} - ${format(pa.periodEnd, 'MMM dd')}`,
        amount: formatCurrency(pa.netDue),
        status: pa.status
      }))
    }
  ];

  const recommendations: string[] = [];
  if (kpis.costPerformanceIndex < 0.95) {
    recommendations.push('Project is trending over budget. Review spending in top cost categories.');
  }
  if (kpis.pendingChangeOrders > 3) {
    recommendations.push(`${kpis.pendingChangeOrders} change orders pending approval. Expedite review process.`);
  }

  return {
    id: `cost-${Date.now()}`,
    type: 'COST_REPORT',
    title: `Cost Report - ${project.name}`,
    generatedAt: new Date(),
    projectId,
    projectName: project.name,
    dateRange: {
      start: format(project.createdAt, 'MMM dd, yyyy'),
      end: format(new Date(), 'MMM dd, yyyy')
    },
    sections,
    summary: `Budget utilization at ${kpis.budgetUtilization}% with CPI of ${kpis.costPerformanceIndex}. ${changeOrders.length} change orders totaling ${formatCurrency(totalCOValue)}.`,
    recommendations
  };
}

// =============================================
// MEP REPORT
// =============================================

export async function generateMEPReport(projectId: string): Promise<GeneratedReport> {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) throw new Error('Project not found');

  const mepAnalytics = await getMEPAnalytics(projectId);

  // Get equipment with deficiencies
  const deficientEquipment = await prisma.mEPEquipment.findMany({
    where: { projectId, status: 'DEFICIENT' },
    orderBy: { updatedAt: 'desc' },
    take: 10
  });

  // Get pending submittals
  const pendingSubmittals = await prisma.mEPSubmittal.findMany({
    where: { projectId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    orderBy: { submittedDate: 'desc' },
    take: 10
  });

  const sections: ReportSection[] = [
    {
      id: 'mep-overview',
      title: 'MEP Systems Overview',
      type: 'table',
      data: mepAnalytics.map((sys: { systemType: string; totalItems: number; installed: number; tested: number; commissioned: number; installationRate: number }) => ({
        system: sys.systemType,
        total: sys.totalItems,
        installed: sys.installed,
        tested: sys.tested,
        commissioned: sys.commissioned,
        progress: `${sys.installationRate}%`
      }))
    },
    {
      id: 'installation-progress',
      title: 'Installation Progress by System',
      type: 'chart',
      data: mepAnalytics.map((sys: { systemType: string; installationRate: number }) => ({
        system: sys.systemType,
        rate: sys.installationRate
      }))
    },
    {
      id: 'deficient-equipment',
      title: 'Equipment Requiring Attention',
      type: 'list',
      data: deficientEquipment.map((eq: { equipmentType: string; name: string; notes: string | null; status: string }) => ({
        system: eq.equipmentType,
        description: eq.name,
        notes: eq.notes || 'No notes',
        status: eq.status
      }))
    },
    {
      id: 'pending-submittals',
      title: 'Pending Submittals',
      type: 'table',
      data: pendingSubmittals.map((s) => ({
        type: s.submittalType,
        submittalNo: s.submittalNumber,
        date: s.submittedDate ? format(s.submittedDate, 'MMM dd, yyyy') : 'N/A',
        status: s.status
      }))
    }
  ];

  const deficientCount = deficientEquipment.length;
  const recommendations: string[] = [];
  if (deficientCount > 0) {
    recommendations.push(`${deficientCount} MEP equipment items marked as deficient. Review and address promptly.`);
  }

  const lowProgress = mepAnalytics.filter(s => s.installationRate < 50);
  if (lowProgress.length > 0) {
    recommendations.push(`${lowProgress.map(s => s.systemType).join(', ')} systems are below 50% installation. Review resource allocation.`);
  }

  return {
    id: `mep-${Date.now()}`,
    type: 'MEP_REPORT',
    title: `MEP Status Report - ${project.name}`,
    generatedAt: new Date(),
    projectId,
    projectName: project.name,
    dateRange: {
      start: format(project.createdAt, 'MMM dd, yyyy'),
      end: format(new Date(), 'MMM dd, yyyy')
    },
    sections,
    summary: `MEP installation across ${mepAnalytics.length} systems. ${deficientCount} equipment items requiring attention.`,
    recommendations
  };
}

// =============================================
// RESOURCE REPORT
// =============================================

export async function generateResourceReport(projectId: string): Promise<GeneratedReport> {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) throw new Error('Project not found');

  const resourceUtilization = await getResourceUtilization(projectId);
  const teamPerformance = await getTeamPerformance(projectId);
  const kpis = await calculateProjectKPIs(projectId);

  const sections: ReportSection[] = [
    {
      id: 'resource-summary',
      title: 'Resource Summary',
      type: 'kpi',
      data: {
        totalCrews: teamPerformance.length,
        totalWorkers: teamPerformance.reduce((sum, t) => sum + t.memberCount, 0),
        avgCrewSize: kpis.averageCrewSize,
        hoursLogged: kpis.workHoursLogged
      }
    },
    {
      id: 'utilization',
      title: 'Resource Utilization',
      type: 'table',
      data: resourceUtilization
    },
    {
      id: 'team-performance',
      title: 'Team Performance',
      type: 'table',
      data: teamPerformance
    },
    {
      id: 'utilization-chart',
      title: 'Utilization by Resource Type',
      type: 'chart',
      data: resourceUtilization.map(r => ({
        type: r.resourceType,
        rate: r.utilizationRate
      }))
    }
  ];

  const underutilized = resourceUtilization.filter(r => r.utilizationRate < 60);
  const overutilized = resourceUtilization.filter(r => r.utilizationRate > 100);

  const recommendations: string[] = [];
  if (underutilized.length > 0) {
    recommendations.push(`${underutilized.map(r => r.resourceType).join(', ')} resources are underutilized. Consider reallocation.`);
  }
  if (overutilized.length > 0) {
    recommendations.push(`${overutilized.map(r => r.resourceType).join(', ')} resources are overallocated. Risk of burnout or delays.`);
  }

  return {
    id: `resource-${Date.now()}`,
    type: 'RESOURCE_REPORT',
    title: `Resource Report - ${project.name}`,
    generatedAt: new Date(),
    projectId,
    projectName: project.name,
    dateRange: {
      start: format(subMonths(new Date(), 1), 'MMM dd, yyyy'),
      end: format(new Date(), 'MMM dd, yyyy')
    },
    sections,
    summary: `${teamPerformance.length} crews with ${teamPerformance.reduce((s, t) => s + t.memberCount, 0)} workers. ${kpis.workHoursLogged} hours logged.`,
    recommendations
  };
}

// =============================================
// CUSTOM REPORT BUILDER
// =============================================

export async function generateCustomReport(config: ReportConfig): Promise<GeneratedReport> {
  const project = await prisma.project.findUnique({
    where: { id: config.projectId }
  });

  if (!project) throw new Error('Project not found');

  const sections: ReportSection[] = [];
  const kpis = await calculateProjectKPIs(config.projectId);

  for (const sectionName of config.sections) {
    switch (sectionName) {
      case 'kpis':
        sections.push({
          id: 'kpis',
          title: 'Key Performance Indicators',
          type: 'kpi',
          data: kpis
        });
        break;
      case 'schedule':
        const scheduleData = await getScheduleAnalytics(config.projectId);
        sections.push({
          id: 'schedule',
          title: 'Schedule Analytics',
          type: 'table',
          data: scheduleData
        });
        break;
      case 'budget':
        const costData = await getCostBreakdown(config.projectId);
        sections.push({
          id: 'budget',
          title: 'Budget Breakdown',
          type: 'table',
          data: costData
        });
        break;
      case 'resources':
        const resourceData = await getResourceUtilization(config.projectId);
        sections.push({
          id: 'resources',
          title: 'Resource Utilization',
          type: 'table',
          data: resourceData
        });
        break;
      case 'mep':
        const mepData = await getMEPAnalytics(config.projectId);
        sections.push({
          id: 'mep',
          title: 'MEP Status',
          type: 'table',
          data: mepData
        });
        break;
      case 'documents':
        const docData = await getDocumentAnalytics(config.projectId);
        sections.push({
          id: 'documents',
          title: 'Document Analytics',
          type: 'kpi',
          data: docData
        });
        break;
      case 'trends':
        const trendData = await getProgressTrends(config.projectId, 'weekly', 8);
        sections.push({
          id: 'trends',
          title: 'Progress Trends',
          type: 'chart',
          data: trendData
        });
        break;
      case 'team':
        const teamData = await getTeamPerformance(config.projectId);
        sections.push({
          id: 'team',
          title: 'Team Performance',
          type: 'table',
          data: teamData
        });
        break;
    }
  }

  return {
    id: `custom-${Date.now()}`,
    type: 'CUSTOM',
    title: config.title || `Custom Report - ${project.name}`,
    generatedAt: new Date(),
    projectId: config.projectId,
    projectName: project.name,
    dateRange: {
      start: config.dateRange ? format(config.dateRange.start, 'MMM dd, yyyy') : format(project.createdAt, 'MMM dd, yyyy'),
      end: config.dateRange ? format(config.dateRange.end, 'MMM dd, yyyy') : format(new Date(), 'MMM dd, yyyy')
    },
    sections,
    summary: `Custom report with ${sections.length} sections.`,
    recommendations: generateRecommendations(kpis)
  };
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function generateRecommendations(kpis: any): string[] {
  const recommendations: string[] = [];

  if (kpis.schedulePerformanceIndex < 0.9) {
    recommendations.push('Schedule performance is below target. Review critical path and consider acceleration measures.');
  }
  if (kpis.costPerformanceIndex < 0.95) {
    recommendations.push('Cost performance indicates potential overrun. Review spending and identify cost-saving opportunities.');
  }
  if (kpis.tasksDelayed > 5) {
    recommendations.push(`${kpis.tasksDelayed} tasks are delayed. Prioritize clearing blockers and reallocating resources.`);
  }
  if (kpis.pendingChangeOrders > 3) {
    recommendations.push('Multiple change orders pending. Expedite approvals to prevent budget uncertainty.');
  }
  if (kpis.safetyScore < 80) {
    recommendations.push('Safety score below target. Schedule safety meeting and review protocols.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Project metrics are within acceptable ranges. Continue monitoring.');
  }

  return recommendations;
}

function generateSummaryText(projectName: string, kpis: any): string {
  const status = kpis.schedulePerformanceIndex >= 1 && kpis.costPerformanceIndex >= 1
    ? 'on track'
    : kpis.schedulePerformanceIndex >= 1
      ? 'on schedule but over budget'
      : kpis.costPerformanceIndex >= 1
        ? 'under budget but behind schedule'
        : 'requiring attention on both schedule and budget';

  return `${projectName} is ${kpis.percentComplete}% complete and ${status}. ` +
    `Schedule Performance Index: ${kpis.schedulePerformanceIndex}, ` +
    `Cost Performance Index: ${kpis.costPerformanceIndex}. ` +
    `${kpis.daysRemaining} days remaining until completion.`;
}

// =============================================
// REPORT EXPORT FUNCTIONS
// =============================================

export function reportToCSV(report: GeneratedReport): string {
  const lines: string[] = [];
  lines.push(`Report: ${report.title}`);
  lines.push(`Generated: ${format(report.generatedAt, 'yyyy-MM-dd HH:mm:ss')}`);
  lines.push(`Project: ${report.projectName}`);
  lines.push(`Period: ${report.dateRange.start} - ${report.dateRange.end}`);
  lines.push('');
  lines.push(`Summary: ${report.summary}`);
  lines.push('');

  report.sections.forEach(section => {
    lines.push(`=== ${section.title} ===`);
    if (section.type === 'table' && Array.isArray(section.data)) {
      if (section.data.length > 0) {
        const headers = Object.keys(section.data[0]);
        lines.push(headers.join(','));
        section.data.forEach((row: any) => {
          lines.push(headers.map(h => String(row[h] ?? '')).join(','));
        });
      }
    } else if (section.type === 'kpi') {
      Object.entries(section.data).forEach(([key, value]) => {
        lines.push(`${key},${value}`);
      });
    }
    lines.push('');
  });

  if (report.recommendations.length > 0) {
    lines.push('=== Recommendations ===');
    report.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
  }

  return lines.join('\n');
}

export function reportToJSON(report: GeneratedReport): string {
  return JSON.stringify(report, null, 2);
}
