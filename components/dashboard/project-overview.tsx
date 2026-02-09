'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Calendar,
  DollarSign,
  FileText,
  ClipboardList,
  FileCheck,
  Ruler,
  DoorOpen,
  Camera,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { DashboardWidget } from './dashboard-widget';
import { useRouter } from 'next/navigation';

interface ProjectOverviewProps {
  projectSlug: string;
  projectId: string;
}

// ---- Data types ----

interface HealthData {
  overallScore: number;
  scheduleScore: number;
  budgetScore: number;
  safetyScore: number;
  qualityScore: number;
  trend: 'improving' | 'stable' | 'declining';
  changeFromPrevious: number;
}

interface ScheduleData {
  overallProgress: number;
  tasksCompleted: number;
  totalTasks: number;
  daysAheadBehind: number;
  criticalPathStatus: string;
  upcomingMilestones: { name: string; daysUntil: number }[];
  noDataSource?: boolean;
}

interface BudgetData {
  totalBudget: number;
  actualCost: number;
  costPerformanceIndex: number;
  percentSpent: number;
  hasBudget: boolean;
}

interface SubmittalData {
  total: number;
  pendingReview: number;
  approved: number;
  rejected: number;
}

interface FieldOpsData {
  latestReportDate: string | null;
  totalReports: number;
  pendingReports: number;
}

interface DocumentData {
  documentCount: number;
  processingCount: number;
}

interface TakeoffData {
  totalTakeoffs: number;
  totalLineItems: number;
}

interface RoomData {
  roomCount: number;
}

interface PhotoData {
  photoCount: number;
}

// ---- Format helpers ----

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getHealthTrend(trend: string): 'up' | 'down' | 'stable' {
  if (trend === 'improving') return 'up';
  if (trend === 'declining') return 'down';
  return 'stable';
}

export function ProjectOverview({ projectSlug, projectId }: ProjectOverviewProps) {
  const router = useRouter();

  // State for each widget's data
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);

  const [documents, setDocuments] = useState<DocumentData>({ documentCount: 0, processingCount: 0 });
  const [docsLoading, setDocsLoading] = useState(true);

  const [fieldOps, setFieldOps] = useState<FieldOpsData | null>(null);
  const [fieldOpsLoading, setFieldOpsLoading] = useState(true);

  const [submittals, setSubmittals] = useState<SubmittalData | null>(null);
  const [submittalsLoading, setSubmittalsLoading] = useState(true);

  const [takeoffs, setTakeoffs] = useState<TakeoffData>({ totalTakeoffs: 0, totalLineItems: 0 });
  const [takeoffsLoading, setTakeoffsLoading] = useState(true);

  const [rooms, setRooms] = useState<RoomData>({ roomCount: 0 });
  const [roomsLoading, setRoomsLoading] = useState(true);

  const [photos, setPhotos] = useState<PhotoData>({ photoCount: 0 });
  const [photosLoading, setPhotosLoading] = useState(true);

  // ---- Data fetchers ----

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data.health);
      } else {
        setHealthError('Unable to load');
      }
    } catch {
      setHealthError('Unable to load');
    } finally {
      setHealthLoading(false);
    }
  }, [projectSlug]);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/schedule-metrics`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSchedule(data);
      }
    } catch {
      setScheduleError('Unable to load');
    } finally {
      setScheduleLoading(false);
    }
  }, [projectSlug]);

  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/evm`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.budget && data.current) {
          setBudget({
            totalBudget: data.budget.total || 0,
            actualCost: data.current.actualCost || 0,
            costPerformanceIndex: data.current.costPerformanceIndex || 1,
            percentSpent: data.current.percentSpent || 0,
            hasBudget: true,
          });
        } else {
          setBudget({ totalBudget: 0, actualCost: 0, costPerformanceIndex: 1, percentSpent: 0, hasBudget: false });
        }
      } else {
        setBudget({ totalBudget: 0, actualCost: 0, costPerformanceIndex: 1, percentSpent: 0, hasBudget: false });
      }
    } catch {
      setBudget({ totalBudget: 0, actualCost: 0, costPerformanceIndex: 1, percentSpent: 0, hasBudget: false });
    } finally {
      setBudgetLoading(false);
    }
  }, [projectSlug]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/processing-status?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments({
          documentCount: data.totalDocuments || data.documents?.length || 0,
          processingCount: data.processingCount || data.documents?.filter((d: { status: string }) => d.status === 'processing').length || 0,
        });
      }
    } catch {
      // silently fail
    } finally {
      setDocsLoading(false);
    }
  }, [projectId]);

  const fetchFieldOps = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/daily-reports?limit=1`);
      if (res.ok) {
        const data = await res.json();
        const reports = data.reports || data.dailyReports || [];
        setFieldOps({
          latestReportDate: reports.length > 0
            ? reports[0].reportDate || reports[0].createdAt
            : null,
          totalReports: data.total || reports.length || 0,
          pendingReports: data.pending || 0,
        });
      }
    } catch {
      // silently fail
    } finally {
      setFieldOpsLoading(false);
    }
  }, [projectSlug]);

  const fetchSubmittals = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/stats`);
      if (res.ok) {
        const data = await res.json();
        setSubmittals({
          total: data.total || 0,
          pendingReview: data.pendingReview || 0,
          approved: data.byStatus?.approved || 0,
          rejected: data.byStatus?.rejected || 0,
        });
      }
    } catch {
      // silently fail
    } finally {
      setSubmittalsLoading(false);
    }
  }, [projectSlug]);

  const fetchTakeoffs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/takeoffs?summary=true`);
      if (res.ok) {
        const data = await res.json();
        setTakeoffs({
          totalTakeoffs: data.total || data.takeoffs?.length || 0,
          totalLineItems: data.totalLineItems || 0,
        });
      }
    } catch {
      // silently fail
    } finally {
      setTakeoffsLoading(false);
    }
  }, [projectSlug]);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/rooms?summary=true`);
      if (res.ok) {
        const data = await res.json();
        setRooms({ roomCount: data.total || data.rooms?.length || 0 });
      }
    } catch {
      // silently fail
    } finally {
      setRoomsLoading(false);
    }
  }, [projectSlug]);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/photos?summary=true`);
      if (res.ok) {
        const data = await res.json();
        setPhotos({ photoCount: data.total || data.photos?.length || 0 });
      }
    } catch {
      // silently fail
    } finally {
      setPhotosLoading(false);
    }
  }, [projectSlug]);

  // Fetch all data on mount
  useEffect(() => {
    fetchHealth();
    fetchSchedule();
    fetchBudget();
    fetchDocuments();
    fetchFieldOps();
    fetchSubmittals();
    fetchTakeoffs();
    fetchRooms();
    fetchPhotos();
  }, [fetchHealth, fetchSchedule, fetchBudget, fetchDocuments, fetchFieldOps, fetchSubmittals, fetchTakeoffs, fetchRooms, fetchPhotos]);

  // ---- Health score color ----
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  // ---- Build widget data ----

  const scheduleHasData = schedule && !schedule.noDataSource && schedule.totalTasks > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6" role="region" aria-label="Project dashboard widgets">
      {/* 1. Project Health */}
      <DashboardWidget
        title="Project Health"
        icon={Activity}
        iconColor="bg-green-600"
        loading={healthLoading}
        error={healthError || undefined}
        primaryMetric={{
          value: health ? health.overallScore : '--',
          label: 'Overall health score',
          trend: health ? getHealthTrend(health.trend) : undefined,
          trendValue: health ? `${health.changeFromPrevious >= 0 ? '+' : ''}${health.changeFromPrevious.toFixed(1)}` : undefined,
        }}
        secondaryMetrics={health ? [
          { label: 'Schedule', value: health.scheduleScore, color: getScoreColor(health.scheduleScore) },
          { label: 'Budget', value: health.budgetScore, color: getScoreColor(health.budgetScore) },
          { label: 'Safety', value: health.safetyScore, color: getScoreColor(health.safetyScore) },
          { label: 'Quality', value: health.qualityScore, color: getScoreColor(health.qualityScore) },
        ] : undefined}
        href={`/project/${projectSlug}/reports`}
        emptyState={{
          message: 'Upload documents and set up schedule to see health scores.',
          actionLabel: 'View Reports',
          actionHref: `/project/${projectSlug}/reports`,
        }}
      />

      {/* 2. Schedule Status */}
      <DashboardWidget
        title="Schedule Status"
        icon={Calendar}
        iconColor="bg-orange-500"
        loading={scheduleLoading}
        error={scheduleError || undefined}
        primaryMetric={{
          value: scheduleHasData ? `${schedule!.overallProgress}%` : '--',
          label: scheduleHasData
            ? `${schedule!.tasksCompleted}/${schedule!.totalTasks} tasks complete`
            : 'No schedule data',
          trend: scheduleHasData
            ? schedule!.daysAheadBehind >= 0 ? 'up' : 'down'
            : undefined,
          trendValue: scheduleHasData
            ? `${Math.abs(schedule!.daysAheadBehind)}d ${schedule!.daysAheadBehind >= 0 ? 'ahead' : 'behind'}`
            : undefined,
        }}
        secondaryMetrics={scheduleHasData && schedule!.upcomingMilestones.length > 0 ? [
          {
            label: 'Next milestone',
            value: schedule!.upcomingMilestones[0].name,
            icon: Calendar,
            color: 'text-orange-400',
          },
          {
            label: 'Critical path',
            value: schedule!.criticalPathStatus === 'healthy' ? 'On Track' : schedule!.criticalPathStatus === 'warning' ? 'At Risk' : 'Critical',
            icon: schedule!.criticalPathStatus === 'healthy' ? CheckCircle : AlertTriangle,
            color: schedule!.criticalPathStatus === 'healthy' ? 'text-green-400' : schedule!.criticalPathStatus === 'warning' ? 'text-amber-400' : 'text-red-400',
          },
        ] : undefined}
        href={`/project/${projectSlug}/schedule-budget`}
        emptyState={{
          message: 'Upload a schedule document to track progress.',
          actionLabel: 'Go to Schedules',
          actionHref: `/project/${projectSlug}/schedule-budget`,
        }}
      />

      {/* 3. Budget Overview */}
      <DashboardWidget
        title="Budget Overview"
        icon={DollarSign}
        iconColor="bg-emerald-600"
        loading={budgetLoading}
        primaryMetric={{
          value: budget?.hasBudget ? formatCurrency(budget.totalBudget) : '--',
          label: budget?.hasBudget
            ? `${budget.percentSpent.toFixed(0)}% spent`
            : 'No budget configured',
          trend: budget?.hasBudget
            ? budget.costPerformanceIndex >= 1 ? 'up' : 'down'
            : undefined,
          trendValue: budget?.hasBudget ? `CPI ${budget.costPerformanceIndex.toFixed(2)}` : undefined,
        }}
        secondaryMetrics={budget?.hasBudget ? [
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

      {/* 4. Documents */}
      <DashboardWidget
        title="Documents"
        icon={FileText}
        iconColor="bg-blue-600"
        loading={docsLoading}
        primaryMetric={{
          value: documents.documentCount,
          label: documents.processingCount > 0
            ? `${documents.processingCount} processing`
            : 'Total documents',
        }}
        secondaryMetrics={documents.processingCount > 0 ? [
          { label: 'Processing', value: documents.processingCount, icon: Clock, color: 'text-amber-400' },
        ] : undefined}
        href={`/project/${projectSlug}/documents`}
        emptyState={{
          message: 'Upload your first construction document.',
          actionLabel: 'Upload Document',
          actionHref: `/project/${projectSlug}/documents`,
        }}
      />

      {/* 5. Field Operations */}
      <DashboardWidget
        title="Field Operations"
        icon={ClipboardList}
        iconColor="bg-orange-600"
        loading={fieldOpsLoading}
        primaryMetric={{
          value: fieldOps?.totalReports || 0,
          label: fieldOps?.latestReportDate
            ? `Latest: ${new Date(fieldOps.latestReportDate).toLocaleDateString()}`
            : 'No daily reports yet',
        }}
        secondaryMetrics={fieldOps && fieldOps.pendingReports > 0 ? [
          { label: 'Pending review', value: fieldOps.pendingReports, icon: Clock, color: 'text-amber-400' },
        ] : undefined}
        href={`/project/${projectSlug}/field-ops/daily-reports`}
        emptyState={{
          message: 'Submit your first daily report.',
          actionLabel: 'Create Report',
          actionHref: `/project/${projectSlug}/field-ops/daily-reports`,
        }}
      />

      {/* 6. Submittals */}
      <DashboardWidget
        title="Submittals"
        icon={FileCheck}
        iconColor="bg-blue-500"
        loading={submittalsLoading}
        primaryMetric={{
          value: submittals?.total || 0,
          label: 'Total submittals',
        }}
        secondaryMetrics={submittals ? [
          { label: 'Approved', value: submittals.approved, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Pending', value: submittals.pendingReview, icon: Clock, color: 'text-amber-400' },
          { label: 'Rejected', value: submittals.rejected, icon: XCircle, color: 'text-red-400' },
        ] : undefined}
        href={`/project/${projectSlug}/mep/submittals`}
        emptyState={{
          message: 'No submittals tracked yet.',
          actionLabel: 'View Submittals',
          actionHref: `/project/${projectSlug}/mep/submittals`,
        }}
      />

      {/* 7. Material Takeoffs */}
      <DashboardWidget
        title="Material Takeoffs"
        icon={Ruler}
        iconColor="bg-yellow-600"
        loading={takeoffsLoading}
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

      {/* 8. Rooms & Spaces */}
      <DashboardWidget
        title="Rooms & Spaces"
        icon={DoorOpen}
        iconColor="bg-green-500"
        loading={roomsLoading}
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

      {/* 9. Photos & Progress */}
      <DashboardWidget
        title="Photos & Progress"
        icon={Camera}
        iconColor="bg-purple-600"
        loading={photosLoading}
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
    </div>
  );
}
