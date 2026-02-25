import {
  getDashboardBudget,
  getDashboardHealth,
  getDashboardScheduleMetrics,
  getDashboardDocuments,
  getDashboardFieldOps,
  getDashboardSubmittals,
  getDashboardTakeoffs,
  getDashboardRooms,
  getDashboardPhotos,
  getDashboardActivity,
} from '@/lib/data/get-dashboard-data';

import { CompactHealthWidget } from './compact-health-widget';
import { ExpandedScheduleWidget } from './expanded-schedule-widget';
import { RecentActivityFeed } from './recent-activity-feed';
import { DashboardWidget } from './dashboard-widget';
import {
  DollarSign,
  FileText,
  ClipboardList,
  FileCheck,
  Ruler,
  DoorOpen,
  Camera,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

// Format helpers (duplicated from project-overview since they're simple)
function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// ----- Health Widget Server -----
export async function HealthWidgetServer({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const health = await getDashboardHealth(projectId);

  // The health service returns the same shape as HealthData, pass directly
  return <CompactHealthWidget projectSlug={projectSlug} initialData={health} />;
}

// ----- Schedule Widget Server -----
export async function ScheduleWidgetServer({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const [scheduleData, fieldOps] = await Promise.all([
    getDashboardScheduleMetrics(projectId),
    getDashboardFieldOps(projectId),
  ]);

  // Build daily report data for the schedule widget's "today" chips
  const dailyReportData = fieldOps.latestReportDate ? {
    weather: undefined, // Would need separate query; widget handles null gracefully
    crewCount: 0,
  } : null;

  return (
    <ExpandedScheduleWidget
      projectSlug={projectSlug}
      initialScheduleData={scheduleData}
      initialDailyReportData={dailyReportData}
    />
  );
}

// ----- Budget Widget Server -----
export async function BudgetWidgetServer({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const budget = await getDashboardBudget(projectId);

  return (
    <DashboardWidget
      title="Budget Overview"
      icon={DollarSign}
      iconColor="bg-emerald-600"
      primaryMetric={{
        value: budget.hasBudget ? formatCurrency(budget.totalBudget) : '--',
        label: budget.hasBudget
          ? `${budget.percentSpent.toFixed(0)}% spent`
          : 'No budget configured',
        trend: budget.hasBudget
          ? budget.costPerformanceIndex >= 1 ? 'up' : 'down'
          : undefined,
        trendValue: budget.hasBudget ? `CPI ${budget.costPerformanceIndex.toFixed(2)}` : undefined,
      }}
      secondaryMetrics={budget.hasBudget ? [
        {
          label: 'Actual cost',
          value: formatCurrency(budget.actualCost),
          icon: DollarSign,
          color: budget.costPerformanceIndex >= 1 ? 'text-green-400' : 'text-red-400',
        },
        {
          label: 'CPI',
          value: budget.costPerformanceIndex.toFixed(2),
          icon: budget.costPerformanceIndex >= 1 ? TrendingUp : TrendingDown,
          color: budget.costPerformanceIndex >= 1 ? 'text-green-400' : budget.costPerformanceIndex >= 0.9 ? 'text-amber-400' : 'text-red-400',
        },
      ] : undefined}
      href={`/project/${projectSlug}/budget`}
      emptyState={{
        message: 'Set up a budget to track costs.',
        actionLabel: 'Configure Budget',
        actionHref: `/project/${projectSlug}/budget`,
      }}
    />
  );
}

// ----- Documents Widget Server -----
export async function DocumentsWidgetServer({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const docs = await getDashboardDocuments(projectId);

  return (
    <DashboardWidget
      title="Documents"
      icon={FileText}
      iconColor="bg-blue-600"
      primaryMetric={{
        value: docs.documentCount,
        label: docs.processingCount > 0
          ? `${docs.processingCount} processing`
          : 'Total documents',
      }}
      secondaryMetrics={docs.processingCount > 0 ? [
        { label: 'Processing', value: docs.processingCount, icon: Clock, color: 'text-amber-400' },
      ] : undefined}
      href={`/project/${projectSlug}/documents`}
      emptyState={{
        message: 'Upload your first construction document.',
        actionLabel: 'Upload Document',
        actionHref: `/project/${projectSlug}/documents`,
      }}
    />
  );
}

// ----- Field Ops Widget Server -----
export async function FieldOpsWidgetServer({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const fieldOps = await getDashboardFieldOps(projectId);

  return (
    <DashboardWidget
      title="Field Operations"
      icon={ClipboardList}
      iconColor="bg-orange-600"
      primaryMetric={{
        value: fieldOps.totalReports,
        label: fieldOps.latestReportDate
          ? `Latest: ${new Date(fieldOps.latestReportDate).toLocaleDateString()}`
          : 'No daily reports yet',
      }}
      secondaryMetrics={fieldOps.pendingReports > 0 ? [
        { label: 'Pending review', value: fieldOps.pendingReports, icon: Clock, color: 'text-amber-400' },
      ] : undefined}
      href={`/project/${projectSlug}/field-ops/daily-reports`}
      emptyState={{
        message: 'Submit your first daily report.',
        actionLabel: 'Create Report',
        actionHref: `/project/${projectSlug}/field-ops/daily-reports`,
      }}
    />
  );
}

// ----- Submittals Widget Server -----
export async function SubmittalsWidgetServer({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const submittals = await getDashboardSubmittals(projectId);

  return (
    <DashboardWidget
      title="Submittals"
      icon={FileCheck}
      iconColor="bg-blue-500"
      primaryMetric={{
        value: submittals.total,
        label: 'Total submittals',
      }}
      secondaryMetrics={[
        { label: 'Approved', value: submittals.approved, icon: CheckCircle, color: 'text-green-400' },
        { label: 'Pending', value: submittals.pendingReview, icon: Clock, color: 'text-amber-400' },
        { label: 'Rejected', value: submittals.rejected, icon: XCircle, color: 'text-red-400' },
      ]}
      href={`/project/${projectSlug}/mep/submittals`}
      emptyState={{
        message: 'No submittals tracked yet.',
        actionLabel: 'View Submittals',
        actionHref: `/project/${projectSlug}/mep/submittals`,
      }}
    />
  );
}

// ----- Stats Widget Server (Takeoffs + Rooms + Photos combined) -----
export async function StatsWidgetServer({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const [takeoffs, rooms, photos] = await Promise.all([
    getDashboardTakeoffs(projectId),
    getDashboardRooms(projectId),
    getDashboardPhotos(projectId),
  ]);

  return (
    <>
      <DashboardWidget
        title="Material Takeoffs"
        icon={Ruler}
        iconColor="bg-yellow-600"
        primaryMetric={{
          value: takeoffs.totalTakeoffs,
          label: takeoffs.totalLineItems > 0 ? `${takeoffs.totalLineItems} line items` : 'Total takeoffs',
        }}
        href={`/project/${projectSlug}/takeoffs`}
        emptyState={{
          message: 'Upload floor plans to auto-generate takeoffs.',
          actionLabel: 'View Takeoffs',
          actionHref: `/project/${projectSlug}/takeoffs`,
        }}
      />

      <DashboardWidget
        title="Rooms & Spaces"
        icon={DoorOpen}
        iconColor="bg-green-500"
        primaryMetric={{
          value: rooms.roomCount,
          label: 'Rooms extracted',
        }}
        href={`/project/${projectSlug}/rooms`}
        emptyState={{
          message: 'Upload floor plans to extract room data.',
          actionLabel: 'View Rooms',
          actionHref: `/project/${projectSlug}/rooms`,
        }}
      />

      <DashboardWidget
        title="Photos & Progress"
        icon={Camera}
        iconColor="bg-purple-600"
        primaryMetric={{
          value: photos.photoCount,
          label: 'Field photos',
        }}
        href={`/project/${projectSlug}/photos`}
        emptyState={{
          message: 'Capture site photos for progress tracking.',
          actionLabel: 'Upload Photos',
          actionHref: `/project/${projectSlug}/photos`,
        }}
      />
    </>
  );
}

// ----- Activity Feed Server -----
export async function ActivityFeedServer({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const activities = await getDashboardActivity(projectId, projectSlug);
  return <RecentActivityFeed projectSlug={projectSlug} initialActivities={activities} />;
}
