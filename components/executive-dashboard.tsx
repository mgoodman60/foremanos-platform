/**
 * Executive Dashboard - Unified Project Overview
 * Combines: Schedule, Budget, Submittals, Weather, Field Ops metrics
 * With PDF Export capability
 */

'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  FileCheck,
  AlertTriangle,
  Cloud,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Activity,
  Loader2,
  RefreshCw,
  ChevronRight,
  Building,
  HardHat,
  FileText,
  Wrench,
  Download,
  Printer,
  Bell,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface DashboardMetrics {
  schedule: {
    percentComplete: number;
    daysRemaining: number;
    tasksOnTrack: number;
    tasksDelayed: number;
    criticalTasks: number;
    endDate: string | null;
    totalTasks?: number;
  };
  budget: {
    totalBudget: number;
    spent: number;
    committed: number;
    variance: number;
    forecastAtCompletion: number;
    contingencyRemaining?: number;
  };
  submittals: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    shortages: number;
  };
  fieldOps: {
    openRFIs: number;
    openPunchItems: number;
    dailyReportsThisWeek: number;
    safetyIncidents: number;
  };
  weather: {
    current: string;
    temp: number;
    workImpact: string;
    daysAffectedThisWeek: number;
  };
  labor: {
    crewsOnSite: number;
    totalWorkers: number;
    hoursThisWeek: number;
  };
  changeOrders?: {
    total: number;
    pending: number;
    approvedValue: number;
  };
  documents?: {
    total: number;
    processed: number;
  };
  alerts?: {
    critical: number;
    warning: number;
    info: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'submittal' | 'rfi' | 'schedule' | 'budget' | 'document' | 'daily_report';
  action: string;
  description: string;
  timestamp: string;
  user?: string;
}

interface ExecutiveDashboardProps {
  projectSlug: string;
}

export default function ExecutiveDashboard({ projectSlug }: ExecutiveDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [projectName, setProjectName] = useState<string>('');

  useEffect(() => {
    fetchDashboardData();
  }, [projectSlug]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectSlug}/executive-dashboard`);
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const data = await res.json();
      setMetrics(data.metrics);
      setActivities(data.recentActivity || []);
      setProjectName(data.projectName || '');
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    const toastId = toast.loading('Generating executive report...');
    
    try {
      const res = await fetch(`/api/projects/${projectSlug}/executive-dashboard/export`);
      if (!res.ok) throw new Error('Failed to generate report');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectSlug}-executive-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully', { id: toastId });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to generate report', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 5) return 'text-red-400';
    if (variance > 0) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const getWeatherImpactColor = (impact: string) => {
    switch (impact?.toLowerCase()) {
      case 'severe': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-600 text-white';
      case 'moderate': return 'bg-yellow-600 text-black';
      default: return 'bg-emerald-600 text-white';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-gray-400">Loading dashboard...</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <AlertTriangle aria-hidden="true" className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <p className="text-gray-400">Unable to load dashboard data</p>
        <button
          onClick={() => fetchDashboardData()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 aria-hidden="true" className="w-7 h-7 text-blue-400" />
            Executive Dashboard
          </h2>
          {projectName && (
            <p className="text-lg text-gray-300 mt-1">{projectName}</p>
          )}
          {lastUpdated && (
            <p className="text-sm text-gray-400 mt-1">
              Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
            ) : (
              <Download aria-hidden="true" className="w-4 h-4" />
            )}
            Export PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <Printer aria-hidden="true" className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw aria-hidden="true" className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts Banner */}
      {metrics.alerts && (metrics.alerts.critical > 0 || metrics.alerts.warning > 0) && (
        <div className={`flex items-center gap-3 p-3 rounded-lg ${
          metrics.alerts.critical > 0 
            ? 'bg-red-900/30 border border-red-700/50' 
            : 'bg-yellow-900/30 border border-yellow-700/50'
        }`}>
          <Bell aria-hidden="true" className={`w-5 h-5 ${metrics.alerts.critical > 0 ? 'text-red-400' : 'text-yellow-400'}`} />
          <span className="text-white text-sm">
            {metrics.alerts.critical > 0 && (
              <span className="text-red-400 font-medium">{metrics.alerts.critical} critical alert{metrics.alerts.critical !== 1 ? 's' : ''}</span>
            )}
            {metrics.alerts.critical > 0 && metrics.alerts.warning > 0 && ' and '}
            {metrics.alerts.warning > 0 && (
              <span className="text-yellow-400 font-medium">{metrics.alerts.warning} warning{metrics.alerts.warning !== 1 ? 's' : ''}</span>
            )}
            {' require attention'}
          </span>
          <Link
            href={`/project/${projectSlug}/budget`}
            className="ml-auto text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
          >
            View Alerts <ChevronRight aria-hidden="true" className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Schedule Health */}
        <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Calendar aria-hidden="true" className="w-5 h-5 text-blue-400" />
            <span className="text-2xl font-bold text-white">
              {metrics.schedule.percentComplete}%
            </span>
          </div>
          <p className="text-sm text-gray-400">Schedule Progress</p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {metrics.schedule.tasksDelayed > 0 ? (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle aria-hidden="true" className="w-3 h-3" />
                {metrics.schedule.tasksDelayed} delayed
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle aria-hidden="true" className="w-3 h-3" />
                On track
              </span>
            )}
          </div>
        </div>

        {/* Budget Status */}
        <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border border-emerald-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign aria-hidden="true" className="w-5 h-5 text-emerald-400" />
            <span className={`text-2xl font-bold ${getVarianceColor(metrics.budget.variance)}`}>
              {metrics.budget.variance > 0 ? '+' : ''}{metrics.budget.variance.toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-gray-400">Budget Variance</p>
          <div className="mt-2 text-xs text-gray-400">
            {formatCurrency(metrics.budget.spent)} of {formatCurrency(metrics.budget.totalBudget)}
          </div>
        </div>

        {/* Submittals */}
        <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <FileCheck aria-hidden="true" className="w-5 h-5 text-purple-400" />
            <span className="text-2xl font-bold text-white">
              {metrics.submittals.pending}
            </span>
          </div>
          <p className="text-sm text-gray-400">Pending Submittals</p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-emerald-400">{metrics.submittals.approved} approved</span>
            {metrics.submittals.shortages > 0 && (
              <span className="text-red-400">• {metrics.submittals.shortages} shortages</span>
            )}
          </div>
        </div>

        {/* Weather */}
        <div className="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 border border-cyan-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Cloud aria-hidden="true" className="w-5 h-5 text-cyan-400" />
            <span className="text-2xl font-bold text-white">
              {metrics.weather.temp}°F
            </span>
          </div>
          <p className="text-sm text-gray-400">{metrics.weather.current}</p>
          <div className="mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${getWeatherImpactColor(metrics.weather.workImpact)}`}>
              {metrics.weather.workImpact} impact
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedule Details */}
        <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar aria-hidden="true" className="w-5 h-5 text-blue-400" />
              Schedule Status
            </h3>
            <Link
              href={`/project/${projectSlug}/schedules`}
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
            >
              View <ChevronRight aria-hidden="true" className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Days Remaining</span>
              <span className="text-white font-medium">{metrics.schedule.daysRemaining}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tasks On Track</span>
              <span className="text-emerald-400 font-medium">{metrics.schedule.tasksOnTrack}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tasks Delayed</span>
              <span className={`font-medium ${metrics.schedule.tasksDelayed > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {metrics.schedule.tasksDelayed}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Critical Path Tasks</span>
              <span className="text-orange-400 font-medium">{metrics.schedule.criticalTasks}</span>
            </div>
            {metrics.schedule.endDate && (
              <div className="pt-2 border-t border-slate-700">
                <span className="text-gray-400 text-sm">Target Completion:</span>
                <span className="text-white ml-2">
                  {format(new Date(metrics.schedule.endDate), 'MMM d, yyyy')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Budget Details */}
        <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign aria-hidden="true" className="w-5 h-5 text-emerald-400" />
              Budget Status
            </h3>
            <Link
              href={`/project/${projectSlug}/budget`}
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
            >
              View <ChevronRight aria-hidden="true" className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Budget</span>
              <span className="text-white font-medium">{formatCurrency(metrics.budget.totalBudget)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Spent to Date</span>
              <span className="text-emerald-400 font-medium">{formatCurrency(metrics.budget.spent)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Committed</span>
              <span className="text-yellow-400 font-medium">{formatCurrency(metrics.budget.committed)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Forecast at Completion</span>
              <span className={`font-medium ${metrics.budget.forecastAtCompletion > metrics.budget.totalBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatCurrency(metrics.budget.forecastAtCompletion)}
              </span>
            </div>
            {/* Budget Progress Bar */}
            <div className="pt-2">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min((metrics.budget.spent / metrics.budget.totalBudget) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{((metrics.budget.spent / metrics.budget.totalBudget) * 100).toFixed(0)}% spent</span>
                <span>{formatCurrency(metrics.budget.totalBudget - metrics.budget.spent)} remaining</span>
              </div>
            </div>
          </div>
        </div>

        {/* Field Operations */}
        <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <HardHat aria-hidden="true" className="w-5 h-5 text-orange-400" />
              Field Operations
            </h3>
            <Link
              href={`/project/${projectSlug}/field-ops`}
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
            >
              View <ChevronRight aria-hidden="true" className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Open RFIs</span>
              <span className={`font-medium ${metrics.fieldOps.openRFIs > 5 ? 'text-yellow-400' : 'text-white'}`}>
                {metrics.fieldOps.openRFIs}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Open Punch Items</span>
              <span className={`font-medium ${metrics.fieldOps.openPunchItems > 10 ? 'text-yellow-400' : 'text-white'}`}>
                {metrics.fieldOps.openPunchItems}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Daily Reports (Week)</span>
              <span className="text-white font-medium">{metrics.fieldOps.dailyReportsThisWeek}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Safety Incidents</span>
              <span className={`font-medium ${metrics.fieldOps.safetyIncidents > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {metrics.fieldOps.safetyIncidents}
              </span>
            </div>
            {/* Labor Summary */}
            <div className="pt-2 border-t border-slate-700">
              <div className="flex items-center gap-2 text-sm">
                <Users aria-hidden="true" className="w-4 h-4 text-blue-400" />
                <span className="text-gray-400">
                  {metrics.labor.crewsOnSite} crews / {metrics.labor.totalWorkers} workers
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <Clock aria-hidden="true" className="w-4 h-4 text-blue-400" />
                <span className="text-gray-400">
                  {metrics.labor.hoursThisWeek.toLocaleString()} hours this week
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity aria-hidden="true" className="w-5 h-5 text-blue-400" />
            Recent Activity
          </h3>
        </div>
        {activities.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <div className={`p-1.5 rounded-lg ${
                  activity.type === 'submittal' ? 'bg-purple-600/20 text-purple-400' :
                  activity.type === 'rfi' ? 'bg-orange-600/20 text-orange-400' :
                  activity.type === 'schedule' ? 'bg-blue-600/20 text-blue-400' :
                  activity.type === 'budget' ? 'bg-emerald-600/20 text-emerald-400' :
                  activity.type === 'daily_report' ? 'bg-cyan-600/20 text-cyan-400' :
                  'bg-slate-600/20 text-slate-400'
                }`}>
                  {activity.type === 'submittal' && <FileCheck aria-hidden="true" className="w-4 h-4" />}
                  {activity.type === 'rfi' && <FileText aria-hidden="true" className="w-4 h-4" />}
                  {activity.type === 'schedule' && <Calendar aria-hidden="true" className="w-4 h-4" />}
                  {activity.type === 'budget' && <DollarSign aria-hidden="true" className="w-4 h-4" />}
                  {activity.type === 'daily_report' && <Wrench aria-hidden="true" className="w-4 h-4" />}
                  {activity.type === 'document' && <FileText aria-hidden="true" className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{activity.action}</p>
                  <p className="text-gray-400 text-xs truncate">{activity.description}</p>
                </div>
                <span className="text-gray-400 text-xs whitespace-nowrap">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
