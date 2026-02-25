import { cache } from 'react';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';
import { calculateProjectHealth } from '@/lib/project-health-service';

// =============================================
// Function 1: getDashboardBudget
// Replaces /api/projects/${slug}/evm
// =============================================

export const getDashboardBudget = cache(async (projectId: string) => {
  const budget = await withDatabaseRetry(
    () =>
      prisma.projectBudget.findFirst({
        where: { projectId },
        select: {
          totalBudget: true,
          actualCost: true,
          contingency: true,
          committedCost: true,
        },
      }),
    'Dashboard budget'
  );

  if (!budget || !budget.totalBudget) {
    return {
      totalBudget: 0,
      actualCost: 0,
      costPerformanceIndex: 1,
      percentSpent: 0,
      hasBudget: false,
    };
  }

  const totalBudget = budget.totalBudget;
  const actualCost = budget.actualCost || 0;
  const percentSpent = totalBudget > 0 ? (actualCost / totalBudget) * 100 : 0;
  // CPI = EV / AC (simplified: use % budget spent)
  const costPerformanceIndex =
    actualCost > 0
      ? (totalBudget * (percentSpent / 100)) / actualCost
      : 1;

  return {
    totalBudget,
    actualCost,
    costPerformanceIndex,
    percentSpent,
    hasBudget: true,
  };
});

// =============================================
// Function 2: getDashboardHealth
// Replaces /api/projects/${slug}/health
// =============================================

export const getDashboardHealth = cache(async (projectId: string) => {
  try {
    return await calculateProjectHealth(projectId);
  } catch {
    return null;
  }
});

// =============================================
// Function 3: getDashboardScheduleMetrics
// Replaces /api/projects/${slug}/schedule-metrics
// =============================================

export const getDashboardScheduleMetrics = cache(async (projectId: string) => {
  const [project, milestones] = await Promise.all([
    withDatabaseRetry(
      () =>
        prisma.project.findUnique({
          where: { id: projectId },
          include: {
            Schedule: {
              where: { isActive: true },
              include: { ScheduleTask: { orderBy: { startDate: 'asc' } } },
            },
          },
        }),
      'Dashboard schedule metrics'
    ),
    withDatabaseRetry(
      () =>
        prisma.milestone.findMany({
          where: {
            projectId,
            status: { not: 'COMPLETED' },
            plannedDate: { gt: new Date() },
          },
          orderBy: { plannedDate: 'asc' },
          take: 5,
          select: { name: true, plannedDate: true },
        }),
      'Dashboard milestones'
    ),
  ]);

  if (!project?.Schedule?.length) {
    return null;
  }

  const schedule = project.Schedule[0];
  const tasks = schedule.ScheduleTask || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (t) => t.status === 'completed' || t.percentComplete === 100
  ).length;
  const overallProgress =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate days ahead/behind based on planned vs actual
  const now = new Date();
  const plannedComplete = tasks.filter(
    (t) => t.endDate && new Date(t.endDate) <= now
  ).length;
  const daysAheadBehind = completedTasks - plannedComplete; // simplified

  // Critical path
  const criticalTasks = tasks.filter((t) => t.isCritical);
  const criticalBehind = criticalTasks.filter(
    (t) =>
      t.status !== 'completed' && t.endDate && new Date(t.endDate) < now
  ).length;
  const criticalPathStatus =
    criticalBehind === 0
      ? 'healthy'
      : criticalBehind <= 2
        ? 'warning'
        : 'critical';

  // Upcoming milestones (from dedicated Milestone model)
  const upcomingMilestones = milestones.map((m) => ({
    name: m.name,
    daysUntil: Math.ceil(
      (new Date(m.plannedDate).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
    ),
  }));

  // Key dates from critical tasks
  const keyDates = criticalTasks
    .filter((t) => t.endDate)
    .slice(0, 8)
    .map((t) => ({
      name: t.name,
      date: t.endDate.toISOString(),
      type: 'end' as const,
    }));

  return {
    overallProgress,
    tasksCompleted: completedTasks,
    totalTasks,
    daysAheadBehind,
    criticalPathStatus,
    upcomingMilestones,
    keyDates,
    noDataSource: false,
  };
});

// =============================================
// Function 4: getDashboardDocuments
// Replaces /api/documents/processing-status
// =============================================

export const getDashboardDocuments = cache(async (projectId: string) => {
  const [totalCount, processingCount] = await Promise.all([
    withDatabaseRetry(
      () =>
        prisma.document.count({ where: { projectId, deletedAt: null } }),
      'Dashboard doc count'
    ),
    withDatabaseRetry(
      () =>
        prisma.document.count({
          where: { projectId, deletedAt: null, processed: false },
        }),
      'Dashboard doc processing count'
    ),
  ]);

  return { documentCount: totalCount, processingCount };
});

// =============================================
// Function 5: getDashboardFieldOps
// Replaces /api/projects/${slug}/daily-reports?limit=1
// =============================================

export const getDashboardFieldOps = cache(async (projectId: string) => {
  const [latestReport, totalCount, pendingCount] = await Promise.all([
    withDatabaseRetry(
      () =>
        prisma.dailyReport.findFirst({
          where: { projectId, deletedAt: null },
          orderBy: { reportDate: 'desc' },
          select: { reportDate: true, createdAt: true },
        }),
      'Dashboard latest report'
    ),
    withDatabaseRetry(
      () =>
        prisma.dailyReport.count({
          where: { projectId, deletedAt: null },
        }),
      'Dashboard report count'
    ),
    withDatabaseRetry(
      () =>
        prisma.dailyReport.count({
          where: { projectId, deletedAt: null, status: 'SUBMITTED' },
        }),
      'Dashboard pending reports'
    ),
  ]);

  return {
    latestReportDate:
      latestReport?.reportDate?.toISOString() ||
      latestReport?.createdAt?.toISOString() ||
      null,
    totalReports: totalCount,
    pendingReports: pendingCount,
  };
});

// =============================================
// Function 6: getDashboardSubmittals
// Replaces /api/projects/${slug}/mep/submittals/stats
// =============================================

export const getDashboardSubmittals = cache(async (projectId: string) => {
  const submittals = await withDatabaseRetry(
    () =>
      prisma.mEPSubmittal.groupBy({
        by: ['status'],
        where: { projectId },
        _count: true,
      }),
    'Dashboard submittal stats'
  );

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const s of submittals) {
    byStatus[s.status.toLowerCase()] = s._count;
    total += s._count;
  }

  return {
    total,
    pendingReview: (byStatus['pending'] || 0) + (byStatus['submitted'] || 0),
    approved:
      (byStatus['approved'] || 0) + (byStatus['approved_as_noted'] || 0),
    rejected:
      (byStatus['rejected'] || 0) + (byStatus['revise_resubmit'] || 0),
  };
});

// =============================================
// Function 7: getDashboardTakeoffs
// Replaces /api/projects/${slug}/takeoffs?summary=true
// =============================================

export const getDashboardTakeoffs = cache(async (projectId: string) => {
  const [totalTakeoffs, totalLineItems] = await Promise.all([
    withDatabaseRetry(
      () =>
        prisma.materialTakeoff.count({
          where: { projectId, documentId: { not: null } },
        }),
      'Dashboard takeoff count'
    ),
    withDatabaseRetry(
      () =>
        prisma.takeoffLineItem.count({
          where: { MaterialTakeoff: { projectId, documentId: { not: null } } },
        }),
      'Dashboard line item count'
    ),
  ]);

  return { totalTakeoffs, totalLineItems };
});

// =============================================
// Function 8: getDashboardRooms
// Replaces /api/projects/${slug}/rooms?summary=true
// =============================================

export const getDashboardRooms = cache(async (projectId: string) => {
  const roomCount = await withDatabaseRetry(
    () =>
      prisma.room.count({
        where: { projectId, sourceDocumentId: { not: null } },
      }),
    'Dashboard room count'
  );

  return { roomCount };
});

// =============================================
// Function 9: getDashboardPhotos
// Replaces /api/projects/${slug}/photos?summary=true
// Note: No FieldPhoto model — counting RoomPhoto as project photo proxy
// =============================================

export const getDashboardPhotos = cache(async (projectId: string) => {
  const photoCount = await withDatabaseRetry(
    () => prisma.roomPhoto.count({ where: { projectId } }),
    'Dashboard photo count'
  );

  return { photoCount };
});

// =============================================
// Function 10: getDashboardActivity
// Replaces /api/projects/${slug}/activity?limit=10
// =============================================

export const getDashboardActivity = cache(
  async (projectId: string, projectSlug: string) => {
    const limit = 10;

    const [docs, reports, changeOrders] = await Promise.all([
      withDatabaseRetry(
        () =>
          prisma.document.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              name: true,
              category: true,
              createdAt: true,
              updatedBy: true,
            },
          }),
        'Dashboard activity docs'
      ),
      withDatabaseRetry(
        () =>
          prisma.dailyReport.findMany({
            where: { projectId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              reportNumber: true,
              reportDate: true,
              status: true,
              createdAt: true,
              createdByUser: { select: { username: true, email: true } },
            },
          }),
        'Dashboard activity reports'
      ),
      withDatabaseRetry(
        () =>
          prisma.changeOrder.findMany({
            where: { projectId },
            orderBy: { submittedDate: 'desc' },
            take: limit,
            select: {
              id: true,
              orderNumber: true,
              title: true,
              status: true,
              requestedBy: true,
              submittedDate: true,
            },
          }),
        'Dashboard activity change orders'
      ),
    ]);

    // Merge and sort
    type ActivityItem = {
      id: string;
      type: string;
      title: string;
      description: string;
      timestamp: string;
      actor: { name: string; email: string };
      href?: string;
    };

    const activities: ActivityItem[] = [
      ...docs.map((d) => ({
        id: `doc-${d.id}`,
        type: 'document_upload',
        title: d.name || 'Document uploaded',
        description: `${d.category || 'Document'} uploaded`,
        timestamp: d.createdAt.toISOString(),
        actor: { name: d.updatedBy || 'System', email: '' },
        href: `/project/${projectSlug}/documents/${d.id}`,
      })),
      ...reports.map((r) => ({
        id: `report-${r.id}`,
        type: 'daily_report',
        title: `Daily Report #${r.reportNumber || ''}`,
        description: `Report for ${r.reportDate ? new Date(r.reportDate).toLocaleDateString() : 'N/A'} - ${r.status}`,
        timestamp: r.createdAt.toISOString(),
        actor: {
          name: r.createdByUser?.username || 'Unknown',
          email: r.createdByUser?.email || '',
        },
        href: `/project/${projectSlug}/field-ops/daily-reports/${r.id}`,
      })),
      ...changeOrders.map((co) => ({
        id: `co-${co.id}`,
        type: 'change_order',
        title: `CO #${co.orderNumber}: ${co.title}`,
        description: `Status: ${co.status}`,
        timestamp:
          co.submittedDate?.toISOString() || new Date().toISOString(),
        actor: { name: co.requestedBy || 'Unknown', email: '' },
      })),
    ];

    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return activities.slice(0, limit);
  }
);
