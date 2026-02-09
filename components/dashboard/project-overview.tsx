'use client';

import { useState, useEffect, useCallback } from 'react';
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
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  LayoutGrid,
  Grid3X3,
} from 'lucide-react';
import { DashboardWidget } from './dashboard-widget';
import { DashboardGreeting } from './dashboard-greeting';
import { QuickActionsBar } from './quick-actions-bar';
import { CompactHealthWidget } from './compact-health-widget';
import { ExpandedScheduleWidget } from './expanded-schedule-widget';
import { useRouter } from 'next/navigation';
import { useProject } from '@/components/layout/project-context';
import { useDocumentUpload } from '@/hooks/use-document-upload';

interface ProjectOverviewProps {
  projectSlug: string;
  projectId: string;
}

// ---- Data types ----

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

function BudgetSparkline({ percentSpent }: { percentSpent: number }) {
  // Simple representative sparkline based on a budget spend curve
  const points = [5, 12, 18, 28, 35, 50, 65].map((v) =>
    Math.min(100, v * (percentSpent / 50 || 1))
  );

  const width = 120;
  const height = 30;
  const max = Math.max(...points, 1);
  const step = width / (points.length - 1);

  const pathPoints = points.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="block mt-1 mb-2">
      <polyline
        points={pathPoints.join(' ')}
        fill="none"
        stroke="#f97316"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProjectOverview({ projectSlug, projectId }: ProjectOverviewProps) {
  const router = useRouter();
  const { session } = useProject();
  const { triggerUpload, fileInputRef, handleFileUpload, showCategoryModal } = useDocumentUpload();

  // Density toggle
  const [density, setDensity] = useState<'compact' | 'expanded'>(() => {
    if (typeof window === 'undefined') return 'expanded';
    return (localStorage.getItem('dashboard_density') as 'compact' | 'expanded') || 'expanded';
  });

  const toggleDensity = useCallback(() => {
    setDensity((prev) => {
      const next = prev === 'compact' ? 'expanded' : 'compact';
      localStorage.setItem('dashboard_density', next);
      return next;
    });
  }, []);

  const isCompact = density === 'compact';

  // State for remaining widgets
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetFetched, setBudgetFetched] = useState<Date | undefined>();

  const [documents, setDocuments] = useState<DocumentData>({ documentCount: 0, processingCount: 0 });
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsFetched, setDocsFetched] = useState<Date | undefined>();

  const [fieldOps, setFieldOps] = useState<FieldOpsData | null>(null);
  const [fieldOpsLoading, setFieldOpsLoading] = useState(true);
  const [fieldOpsFetched, setFieldOpsFetched] = useState<Date | undefined>();

  const [submittals, setSubmittals] = useState<SubmittalData | null>(null);
  const [submittalsLoading, setSubmittalsLoading] = useState(true);
  const [submittalsFetched, setSubmittalsFetched] = useState<Date | undefined>();

  const [takeoffs, setTakeoffs] = useState<TakeoffData>({ totalTakeoffs: 0, totalLineItems: 0 });
  const [takeoffsLoading, setTakeoffsLoading] = useState(true);
  const [takeoffsFetched, setTakeoffsFetched] = useState<Date | undefined>();

  const [rooms, setRooms] = useState<RoomData>({ roomCount: 0 });
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsFetched, setRoomsFetched] = useState<Date | undefined>();

  const [photos, setPhotos] = useState<PhotoData>({ photoCount: 0 });
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosFetched, setPhotosFetched] = useState<Date | undefined>();

  // ---- Data fetchers ----

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
      setBudgetFetched(new Date());
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
        setDocsFetched(new Date());
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
        setFieldOpsFetched(new Date());
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
        setSubmittalsFetched(new Date());
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
        setTakeoffsFetched(new Date());
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
        setRoomsFetched(new Date());
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
        setPhotosFetched(new Date());
      }
    } catch {
      // silently fail
    } finally {
      setPhotosLoading(false);
    }
  }, [projectSlug]);

  // Fetch all data on mount
  useEffect(() => {
    fetchBudget();
    fetchDocuments();
    fetchFieldOps();
    fetchSubmittals();
    fetchTakeoffs();
    fetchRooms();
    fetchPhotos();
  }, [fetchBudget, fetchDocuments, fetchFieldOps, fetchSubmittals, fetchTakeoffs, fetchRooms, fetchPhotos]);

  const userName = session?.user?.username || undefined;

  return (
    <div className="p-6 space-y-6" role="region" aria-label="Project dashboard widgets">
      {/* Row 0: Greeting */}
      <DashboardGreeting
        projectSlug={projectSlug}
        projectId={projectId}
        userName={userName}
      />

      {/* Row 0b: Quick Actions */}
      <QuickActionsBar projectSlug={projectSlug} onUpload={triggerUpload} />

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Density toggle */}
      <div className="flex justify-end">
        <button
          onClick={toggleDensity}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
          title={density === 'compact' ? 'Switch to expanded view' : 'Switch to compact view'}
        >
          {density === 'compact' ? (
            <Grid3X3 className="w-4 h-4" />
          ) : (
            <LayoutGrid className="w-4 h-4" />
          )}
          {density === 'compact' ? 'Expanded' : 'Compact'}
        </button>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Row 1: Health (1-col) + Schedule (2-col) */}
        <CompactHealthWidget projectSlug={projectSlug} />
        <ExpandedScheduleWidget projectSlug={projectSlug} />

        {/* Row 2: Budget + Documents + Field Ops */}
        <DashboardWidget
          title="Budget Overview"
          icon={DollarSign}
          iconColor="bg-emerald-600"
          loading={budgetLoading}
          compact={isCompact}
          lastFetched={budgetFetched}
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
          customContent={
            !isCompact && budget?.hasBudget ? (
              <div>
                {/* Primary metric */}
                <div className="mb-1">
                  <span className="text-3xl font-bold text-slate-50" aria-live="polite">
                    {formatCurrency(budget.totalBudget)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400">{budget.percentSpent.toFixed(0)}% spent</span>
                  <span className={`flex items-center gap-1 text-xs ${budget.costPerformanceIndex >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                    {budget.costPerformanceIndex >= 1 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    CPI {budget.costPerformanceIndex.toFixed(2)}
                  </span>
                </div>
                {/* Sparkline */}
                <BudgetSparkline percentSpent={budget.percentSpent} />
                {/* Secondary metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className={`w-3.5 h-3.5 ${budget.costPerformanceIndex >= 1 ? 'text-green-400' : 'text-red-400'}`} />
                    <div>
                      <p className={`text-sm font-semibold ${budget.costPerformanceIndex >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(budget.actualCost)}
                      </p>
                      <p className="text-xs text-gray-500">Actual cost</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {budget.costPerformanceIndex >= 1
                      ? <TrendingUp className={`w-3.5 h-3.5 text-green-400`} />
                      : <TrendingDown className={`w-3.5 h-3.5 ${budget.costPerformanceIndex >= 0.9 ? 'text-amber-400' : 'text-red-400'}`} />
                    }
                    <div>
                      <p className={`text-sm font-semibold ${budget.costPerformanceIndex >= 1 ? 'text-green-400' : budget.costPerformanceIndex >= 0.9 ? 'text-amber-400' : 'text-red-400'}`}>
                        {budget.costPerformanceIndex.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">CPI</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : undefined
          }
          href={`/project/${projectSlug}/budget`}
          emptyState={{
            message: 'Set up a budget to track costs.',
            actionLabel: 'Configure Budget',
            actionHref: `/project/${projectSlug}/budget`,
          }}
        />

        <DashboardWidget
          title="Documents"
          icon={FileText}
          iconColor="bg-blue-600"
          loading={docsLoading}
          compact={isCompact}
          lastFetched={docsFetched}
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

        <DashboardWidget
          title="Field Operations"
          icon={ClipboardList}
          iconColor="bg-orange-600"
          loading={fieldOpsLoading}
          compact={isCompact}
          lastFetched={fieldOpsFetched}
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

        {/* Row 3: Submittals + Takeoffs + Rooms */}
        <DashboardWidget
          title="Submittals"
          icon={FileCheck}
          iconColor="bg-blue-500"
          loading={submittalsLoading}
          compact={isCompact}
          lastFetched={submittalsFetched}
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

        <DashboardWidget
          title="Material Takeoffs"
          icon={Ruler}
          iconColor="bg-yellow-600"
          loading={takeoffsLoading}
          compact={isCompact}
          lastFetched={takeoffsFetched}
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
          loading={roomsLoading}
          compact={isCompact}
          lastFetched={roomsFetched}
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

        {/* Row 4: Photos */}
        <DashboardWidget
          title="Photos & Progress"
          icon={Camera}
          iconColor="bg-purple-600"
          loading={photosLoading}
          compact={isCompact}
          lastFetched={photosFetched}
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
    </div>
  );
}
