'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Download,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Activity,
  CloudRain,
  Users,
  RefreshCw,
  Bell,
  FileText,
  Loader2,
  Flag,
  PlayCircle,
  Target,
  CalendarCheck,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Minus
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Inline Health Score types and fetching
interface HealthScoreResult {
  overallScore: number | null;
  scheduleScore: number | null;
  budgetScore: number | null;
  safetyScore: number | null;
  qualityScore: number | null;
  documentScore: number | null;
  intelligenceScore?: number;
  trend: 'improving' | 'stable' | 'declining';
  changeFromPrevious: number;
  metrics: Record<string, number>;
  alerts: Array<{
    type: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
    actionRequired?: string;
  }>;
}

interface UnparsedScheduleDoc {
  id: string;
  name: string;
  processed: boolean;
}

interface KeyDate {
  label: string;
  date: string;
  daysUntil: number;
  isPast: boolean;
  type: 'start' | 'end' | 'milestone';
}

interface BudgetMetrics {
  totalBudget: number;
  actualCost: number;
  earnedValue: number;
  plannedValue: number;
  costVariance: number;
  costPerformanceIndex: number;
  schedulePerformanceIndex: number;
  percentSpent: number;
  percentComplete: number;
  estimateAtCompletion: number;
  estimateToComplete: number;
  varianceAtCompletion: number;
  hasBudget: boolean;
}

interface ScheduleMetrics {
  overallProgress: number;
  tasksCompleted: number;
  totalTasks: number;
  daysAheadBehind: number;
  upcomingMilestones: {
    name: string;
    date: string;
    daysUntil: number;
    status: 'on-track' | 'at-risk' | 'delayed';
  }[];
  criticalPathStatus: 'healthy' | 'warning' | 'critical';
  recentUpdates: {
    date: string;
    taskName: string;
    status: string;
  }[];
  weatherDelays: number;
  averageCrewSize: number;
  keyDates?: KeyDate[];
  noDataSource?: boolean;
  message?: string;
}

interface ScheduleProgressRibbonProps {
  projectSlug: string;
  compact?: boolean;
  pendingUpdatesCount?: number;
}

export default function ScheduleProgressRibbon({ projectSlug, compact = false, pendingUpdatesCount = 0 }: ScheduleProgressRibbonProps) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<ScheduleMetrics | null>(null);
  const [budgetMetrics, setBudgetMetrics] = useState<BudgetMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unparsedScheduleDocs, setUnparsedScheduleDocs] = useState<UnparsedScheduleDoc[]>([]);
  const [parsing, setParsing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [health, setHealth] = useState<HealthScoreResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Fetch project health
  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/health`);
      if (!response.ok) throw new Error('Failed to fetch health');
      const data = await response.json();
      setHealth(data.health);
    } catch (error) {
      console.error('[Health Widget] Error:', error);
    } finally {
      setHealthLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchScheduleMetrics();
    fetchUnparsedScheduleDocs();
    fetchBudgetMetrics();
    fetchHealth();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchScheduleMetrics(true); // Silent refresh
      fetchBudgetMetrics(true);
    }, 30000);

    // Refresh health every 5 minutes
    const healthInterval = setInterval(fetchHealth, 5 * 60 * 1000);

    // Listen for schedule update events
    const handleScheduleUpdate = () => {
      fetchScheduleMetrics(true);
    };

    window.addEventListener('scheduleUpdated', handleScheduleUpdate);

    return () => {
      clearInterval(interval);
      clearInterval(healthInterval);
      window.removeEventListener('scheduleUpdated', handleScheduleUpdate);
    };
  }, [projectSlug, fetchHealth]);

  const fetchBudgetMetrics = async (silent = false) => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/evm`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        // No budget configured
        setBudgetMetrics({ hasBudget: false } as BudgetMetrics);
        return;
      }
      
      const data = await response.json();
      if (data.budget && data.current) {
        setBudgetMetrics({
          totalBudget: data.budget.total || 0,
          actualCost: data.current.actualCost || 0,
          earnedValue: data.current.earnedValue || 0,
          plannedValue: data.current.plannedValue || 0,
          costVariance: data.current.costVariance || 0,
          costPerformanceIndex: data.current.costPerformanceIndex || 1,
          schedulePerformanceIndex: data.current.schedulePerformanceIndex || 1,
          percentSpent: data.current.percentSpent || 0,
          percentComplete: data.current.percentComplete || 0,
          estimateAtCompletion: data.current.estimateAtCompletion || data.budget.total || 0,
          estimateToComplete: data.current.estimateToComplete || 0,
          varianceAtCompletion: data.current.varianceAtCompletion || 0,
          hasBudget: true
        });
      } else {
        setBudgetMetrics({ hasBudget: false } as BudgetMetrics);
      }
    } catch (error) {
      console.error('Error fetching budget metrics:', error);
      if (!silent) {
        setBudgetMetrics({ hasBudget: false } as BudgetMetrics);
      }
    }
  };

  const fetchUnparsedScheduleDocs = async () => {
    try {
      // Fetch schedule category documents that are processed but haven't been parsed into tasks
      const response = await fetch(`/api/projects/${projectSlug}/documents?category=schedule`);
      if (!response.ok) return;
      
      const data = await response.json();
      // Filter to only processed documents (we can parse them)
      const processedScheduleDocs = (data.documents || []).filter((doc: any) => 
        doc.processed && doc.category === 'schedule'
      );
      setUnparsedScheduleDocs(processedScheduleDocs);
    } catch (error) {
      console.error('Error fetching schedule documents:', error);
    }
  };

  const handleParseSchedule = async (documentId: string) => {
    try {
      setParsing(true);
      toast.loading('Parsing schedule document...');
      
      const response = await fetch(`/api/documents/${documentId}/parse-schedule`, {
        method: 'POST',
      });
      
      toast.dismiss();
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to parse schedule');
      }
      
      toast.success('Schedule parsed successfully! Tasks extracted.');
      
      // Refresh metrics after parsing
      await fetchScheduleMetrics();
      await fetchUnparsedScheduleDocs();
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('scheduleUpdated'));
    } catch (error: any) {
      toast.error(error.message || 'Failed to parse schedule');
    } finally {
      setParsing(false);
    }
  };

  const fetchScheduleMetrics = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      const response = await fetch(`/api/projects/${projectSlug}/schedule-metrics`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        // If 404 or no schedules, don't show error
        if (response.status === 404 || response.status === 500) {
          setMetrics(null);
          return;
        }
        throw new Error('Failed to fetch metrics');
      }
      
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching schedule metrics:', error);
      if (!silent) {
        toast.error('Failed to load schedule metrics');
      }
      setMetrics(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    toast.promise(
      fetchScheduleMetrics(),
      {
        loading: 'Refreshing schedule data...',
        success: 'Schedule data updated',
        error: 'Failed to refresh'
      }
    );
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/schedule-metrics/export`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule-report-${projectSlug}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Schedule report exported successfully');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export schedule report');
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-dark-card border-2 border-dark-hover/50 animate-pulse">
        <div className="h-24 bg-dark-surface rounded"></div>
      </Card>
    );
  }

  if (!metrics || metrics.totalTasks === 0 || metrics.noDataSource) {
    // Check if there are processed schedule documents that can be parsed
    const hasUnparsedDocs = unparsedScheduleDocs.length > 0;
    const noSourceMessage = metrics?.message || 'Upload a schedule document and parse it to see progress tracking.';
    
    return (
      <Card className="p-6 bg-dark-card border-2 border-dark-hover/50">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-600/50 flex items-center justify-center">
                <Activity className="h-6 w-6 text-gray-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-300">No Schedule Data Available</h3>
                <p className="text-sm text-gray-400">
                  {hasUnparsedDocs
                    ? 'Schedule document found! Click "Parse Schedule" to extract tasks and milestones.'
                    : noSourceMessage}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/project/${projectSlug}/schedules`)}
              className="border-dark-hover text-gray-300 hover:bg-dark-surface"
            >
              Go to Schedules
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          {/* Show Parse Schedule button if there are unparsed schedule documents */}
          {hasUnparsedDocs && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
              <span className="text-sm text-gray-400 self-center mr-2">Available schedule documents:</span>
              {unparsedScheduleDocs.map((doc) => (
                <Button
                  key={doc.id}
                  size="sm"
                  onClick={() => handleParseSchedule(doc.id)}
                  disabled={parsing}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {parsing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Parse "{doc.name}"
                    </>
                  )}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'on-track':
        return 'text-green-400 bg-green-900/40 border border-green-600';
      case 'warning':
      case 'at-risk':
        return 'text-yellow-400 bg-yellow-900/40 border border-yellow-600';
      case 'critical':
      case 'delayed':
        return 'text-red-400 bg-red-900/40 border border-red-600';
      default:
        return 'text-gray-300 bg-gray-800 border border-dark-hover';
    }
  };

  const _getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const getCPIColor = (cpi: number) => {
    if (cpi >= 1.0) return 'text-green-500';
    if (cpi >= 0.9) return 'text-yellow-500';
    return 'text-red-500';
  };

  const _getCPIStatus = (cpi: number) => {
    if (cpi >= 1.0) return 'Under Budget';
    if (cpi >= 0.9) return 'Near Budget';
    return 'Over Budget';
  };

  // Health score helpers
  const getHealthScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHealthScoreBg = (score: number | null) => {
    if (score === null) return 'bg-gray-500/20 border-gray-500/50';
    if (score >= 80) return 'bg-green-500/20 border-green-500/50';
    if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/50';
    if (score >= 40) return 'bg-orange-500/20 border-orange-500/50';
    return 'bg-red-500/20 border-red-500/50';
  };

  const HealthTrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'improving') return <TrendingUp className="w-3 h-3 text-green-400" />;
    if (trend === 'declining') return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  // Render inline health widget
  const renderHealthWidget = () => {
    if (healthLoading) {
      return (
        <div className="bg-dark-surface rounded-lg p-3 border border-dark-hover/50 flex items-center justify-center min-w-[120px]">
          <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
        </div>
      );
    }

    if (!health) {
      return (
        <div className="bg-dark-surface rounded-lg p-3 border border-dark-hover/50 min-w-[120px]">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400">Health</span>
          </div>
          <p className="text-xs text-gray-400">Unable to calculate</p>
        </div>
      );
    }

    return (
      <div className={`rounded-lg p-3 border-2 min-w-[120px] ${getHealthScoreBg(health.overallScore)}`}>
        <div className="flex items-center gap-2 mb-1">
          <Activity className={`w-4 h-4 ${getHealthScoreColor(health.overallScore)}`} />
          <span className="text-xs font-medium text-gray-300">Health Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${getHealthScoreColor(health.overallScore)}`}>
            {health.overallScore ?? '--'}
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <HealthTrendIcon trend={health.trend} />
              <span className={`text-[10px] ${
                health.changeFromPrevious > 0 ? 'text-green-400' : 
                health.changeFromPrevious < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {health.changeFromPrevious >= 0 ? '+' : ''}{health.changeFromPrevious.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (compact) {
    return (
      <Card className="p-4 bg-dark-card border-2 border-orange-500/30 hover:shadow-md transition-shadow shadow-orange-900/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-slate-50">Schedule Progress</span>
            </div>
            <Badge variant="outline" className={getStatusColor(metrics.criticalPathStatus)}>
              {metrics.criticalPathStatus === 'healthy' ? 'On Track' : 
               metrics.criticalPathStatus === 'warning' ? 'At Risk' : 'Delayed'}
            </Badge>
            {pendingUpdatesCount > 0 && (
              <button
                onClick={() => router.push(`/project/${projectSlug}/schedule-updates`)}
                className="flex items-center gap-1.5 px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                title={`${pendingUpdatesCount} pending schedule update${pendingUpdatesCount !== 1 ? 's' : ''}`}
              >
                <Bell className="h-3 w-3" />
                <span>{pendingUpdatesCount}</span>
              </button>
            )}
            {/* Budget indicator in compact mode */}
            {budgetMetrics?.hasBudget && (
              <button
                onClick={() => router.push(`/project/${projectSlug}/evm`)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  budgetMetrics.costPerformanceIndex >= 1 
                    ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60' 
                    : budgetMetrics.costPerformanceIndex >= 0.9 
                      ? 'bg-yellow-900/40 text-yellow-400 hover:bg-yellow-900/60'
                      : 'bg-red-900/40 text-red-400 hover:bg-red-900/60'
                }`}
                title="Click to view cost dashboard"
              >
                <DollarSign className="h-3 w-3" />
                <span>CPI: {budgetMetrics.costPerformanceIndex.toFixed(2)}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-500">{metrics.overallProgress}%</div>
              <div className="text-xs text-gray-400">{metrics.tasksCompleted}/{metrics.totalTasks} tasks</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="text-gray-400 hover:text-orange-500 hover:bg-dark-surface"
              title="Refresh schedule data"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/project/${projectSlug}/schedules`)}
              className="border-dark-hover text-gray-300 hover:bg-dark-surface"
            >
              View Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-card border-2 border-orange-500/30 shadow-lg shadow-orange-900/10 overflow-hidden">
      {/* Collapsible Header - Always visible */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-dark-hover transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shadow-md shadow-orange-500/30 flex-shrink-0">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-50">Schedule Progress</h3>
            <p className="text-sm text-gray-300">Real-time project schedule tracking</p>
          </div>
          {pendingUpdatesCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/project/${projectSlug}/schedule-updates`); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-md transition-colors cursor-pointer"
              title={`${pendingUpdatesCount} pending schedule update${pendingUpdatesCount !== 1 ? 's' : ''}`}
            >
              <Bell className="h-4 w-4" />
              <span>{pendingUpdatesCount}</span>
            </button>
          )}
          
          {/* Collapsed summary info */}
          {isCollapsed && (
            <div className="hidden sm:flex items-center gap-3 ml-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-surface rounded-lg">
                <span className="text-2xl font-bold text-orange-500">{metrics.overallProgress}%</span>
                <span className="text-xs text-gray-400">{metrics.tasksCompleted}/{metrics.totalTasks}</span>
              </div>
              <Badge className={`${getStatusColor(metrics.criticalPathStatus)} text-xs px-2 py-0.5`}>
                {metrics.criticalPathStatus === 'healthy' ? 'On Track' : 
                 metrics.criticalPathStatus === 'warning' ? 'At Risk' : 'Critical'}
              </Badge>
              {/* Health score inline when collapsed */}
              {health && (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${getHealthScoreBg(health.overallScore)}`}>
                  <Activity className={`w-3.5 h-3.5 ${getHealthScoreColor(health.overallScore)}`} />
                  <span className={`text-sm font-bold ${getHealthScoreColor(health.overallScore)}`}>
                    {health.overallScore ?? '--'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="text-gray-400 hover:text-orange-500 hover:bg-dark-surface h-8 w-8 p-0"
            title="Refresh schedule data"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="hidden sm:flex items-center gap-1.5 border-dark-hover text-gray-300 hover:bg-dark-surface h-8 px-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Export</span>
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/project/${projectSlug}/schedules`)}
              className="bg-orange-500 hover:bg-orange-600 flex items-center gap-1 h-8 px-2.5 text-xs"
            >
              <span className="hidden sm:inline">Full</span> Schedule
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          {/* Collapse Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-orange-500 hover:bg-dark-surface h-8 w-8 p-0"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          </div>
        </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-3">
        {/* Main Metrics Grid - Responsive Layout */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-9 gap-2 sm:gap-3">
          {/* Health Score Widget */}
          {renderHealthWidget()}
          
          {/* Overall Progress */}
          <div className="bg-dark-surface rounded-lg p-3 shadow-sm border border-dark-hover/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-300">Overall Progress</span>
              <CheckCircle2 className="h-4 w-4 text-orange-500" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-slate-50">{metrics.overallProgress}%</div>
              <div className="text-[10px] text-gray-400">
                {metrics.tasksCompleted} of {metrics.totalTasks} tasks completed
              </div>
            </div>
          </div>

          {/* Schedule Variance */}
          <div className="bg-dark-surface rounded-lg p-3 shadow-sm border border-dark-hover/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-300">Schedule Variance</span>
              {metrics.daysAheadBehind >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="space-y-1">
              <div className={`text-2xl font-bold ${
                metrics.daysAheadBehind >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {metrics.daysAheadBehind >= 0 ? '+' : ''}{metrics.daysAheadBehind}
              </div>
              <div className="text-[10px] text-gray-400">
                {Math.abs(metrics.daysAheadBehind)} days {metrics.daysAheadBehind >= 0 ? 'ahead' : 'behind'}
              </div>
            </div>
          </div>

          {/* Critical Path Status */}
          <div className="bg-dark-surface rounded-lg p-3 shadow-sm border border-dark-hover/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-300">Critical Path</span>
              <AlertTriangle className={`h-4 w-4 ${
                metrics.criticalPathStatus === 'healthy' ? 'text-green-500' :
                metrics.criticalPathStatus === 'warning' ? 'text-yellow-500' : 'text-red-500'
              }`} />
            </div>
            <div className="space-y-1">
              <Badge className={`${getStatusColor(metrics.criticalPathStatus)} text-xs px-2 py-0.5`}>
                {metrics.criticalPathStatus === 'healthy' ? 'Healthy' :
                 metrics.criticalPathStatus === 'warning' ? 'At Risk' : 'Critical'}
              </Badge>
              <div className="text-[10px] text-gray-400">
                {metrics.criticalPathStatus === 'healthy' 
                  ? 'No delays on critical path'
                  : 'Requires attention'}
              </div>
            </div>
          </div>

          {/* Next Milestone */}
          <div className="bg-dark-surface rounded-lg p-3 shadow-sm border border-dark-hover/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-300">Next Milestone</span>
              <Calendar className="h-4 w-4 text-orange-500" />
            </div>
            {metrics.upcomingMilestones.length > 0 ? (
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-50 truncate">
                  {metrics.upcomingMilestones[0].name}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-[10px] text-gray-400">
                    {metrics.upcomingMilestones[0].daysUntil} days
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-gray-400">No upcoming milestones</div>
            )}
          </div>
          
          {/* Budget / Cost Tracking - Clickable to EVM */}
          <div 
            onClick={() => router.push(`/project/${projectSlug}/evm`)}
            className="bg-dark-surface rounded-lg p-3 shadow-sm border border-dark-hover/50 cursor-pointer hover:border-orange-500 hover:bg-dark-hover transition-all group"
            title="Click to view detailed cost dashboard"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-300 group-hover:text-orange-500 transition-colors">Budget Status</span>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-green-500" />
                <ChevronRight className="h-3 w-3 text-gray-400 group-hover:text-orange-500 transition-colors" />
              </div>
            </div>
            {budgetMetrics?.hasBudget ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className={`text-lg font-bold ${getCPIColor(budgetMetrics.costPerformanceIndex)}`}>
                    {budgetMetrics.costPerformanceIndex.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-400">CPI</span>
                  {budgetMetrics.costPerformanceIndex >= 1 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                </div>
                <div className="text-[10px] text-gray-400">
                  {formatCurrency(budgetMetrics.actualCost)} / {formatCurrency(budgetMetrics.totalBudget)}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-sm font-semibold text-gray-400">Not Set</div>
                <div className="text-[10px] text-gray-400">Click to configure</div>
              </div>
            )}
          </div>

          {/* EAC - Estimate at Completion */}
          {budgetMetrics?.hasBudget && (
            <div 
              onClick={() => router.push(`/project/${projectSlug}/evm`)}
              className="bg-dark-surface rounded-lg p-3 shadow-sm border border-dark-hover/50 cursor-pointer hover:border-orange-500 hover:bg-dark-hover transition-all group"
              title="Estimate at Completion - Click for details"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-300 group-hover:text-orange-500 transition-colors">Cost Forecast</span>
                <Calculator className="h-4 w-4 text-blue-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className={`text-lg font-bold ${
                    budgetMetrics.varianceAtCompletion >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {formatCurrency(budgetMetrics.estimateAtCompletion)}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 flex items-center gap-1">
                  <span>EAC</span>
                  <span className="text-gray-600">•</span>
                  <span className={budgetMetrics.varianceAtCompletion >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {budgetMetrics.varianceAtCompletion >= 0 ? '+' : ''}{formatCurrency(budgetMetrics.varianceAtCompletion)} VAC
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Weather Delays */}
          <div className="bg-dark-surface rounded-lg p-3 shadow-sm border border-dark-hover/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-300">Weather Delays</span>
              <CloudRain className="h-4 w-4 text-orange-500" />
            </div>
            <div className="space-y-1">
              <div className={`text-2xl font-bold ${
                metrics.weatherDelays > 0 ? 'text-orange-500' : 'text-green-500'
              }`}>
                {metrics.weatherDelays || 0}
              </div>
              <div className="text-[10px] text-gray-400">
                {metrics.weatherDelays > 0 ? 'weather delay days' : 'No weather delays'}
              </div>
            </div>
          </div>

          {/* Average Crew Size */}
          <div className="bg-dark-surface rounded-lg p-3 shadow-sm border border-dark-hover/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-300">Avg Crew Size</span>
              <Users className="h-4 w-4 text-orange-500" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-slate-50">
                {metrics.averageCrewSize || 0}
              </div>
              <div className="text-[10px] text-gray-400">
                {metrics.averageCrewSize > 0 ? 'workers per day' : 'No data recorded'}
              </div>
            </div>
          </div>
        </div>

        {/* Key Dates Timeline Ribbon */}
        {metrics.keyDates && metrics.keyDates.length > 0 && (
          <div className="bg-dark-surface rounded-lg p-4 shadow-sm border border-gray-700">
            <h4 className="text-sm font-semibold text-slate-50 mb-3 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-orange-500" />
              Key Dates
            </h4>
            {/* Scrollable timeline */}
            <div className="overflow-x-auto pb-2 -mx-1">
              <div className="flex items-stretch gap-2 min-w-max px-1">
                {metrics.keyDates.map((keyDate, index) => {
                  const getDateIcon = () => {
                    switch (keyDate.type) {
                      case 'start':
                        return <PlayCircle className="h-4 w-4 text-green-500" />;
                      case 'end':
                        return <Target className="h-4 w-4 text-blue-500" />;
                      case 'milestone':
                        return <Flag className="h-4 w-4 text-orange-500" />;
                      default:
                        return <Calendar className="h-4 w-4 text-gray-400" />;
                    }
                  };
                  
                  const getDateStyle = () => {
                    if (keyDate.isPast) {
                      return 'border-green-600/50 bg-green-900/20';
                    }
                    if (keyDate.daysUntil <= 7) {
                      return 'border-yellow-600/50 bg-yellow-900/20';
                    }
                    if (keyDate.daysUntil <= 30) {
                      return 'border-orange-600/50 bg-orange-900/20';
                    }
                    return 'border-dark-hover bg-dark-card';
                  };

                  const formatDate = (dateStr: string) => {
                    const date = new Date(dateStr);
                    return date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric'
                    });
                  };

                  return (
                    <div key={index} className="flex items-center">
                      {/* Milestone Card */}
                      <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getDateStyle()} transition-all hover:scale-[1.02] min-w-[140px]`}
                      >
                        <div className="flex-shrink-0">
                          {getDateIcon()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-slate-50 truncate" title={keyDate.label}>
                            {keyDate.label}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs mt-0.5">
                            <span className="text-gray-300">{formatDate(keyDate.date)}</span>
                            <span className="text-gray-600">•</span>
                            {keyDate.isPast ? (
                              <span className="text-green-400 font-medium flex items-center gap-0.5">
                                <CheckCircle2 className="h-3 w-3" />
                                Complete
                              </span>
                            ) : (
                              <span className={`font-medium ${
                                keyDate.daysUntil <= 7 ? 'text-yellow-400' :
                                keyDate.daysUntil <= 30 ? 'text-orange-400' :
                                'text-gray-400'
                              }`}>
                                {keyDate.daysUntil} days
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Connector line between milestones */}
                      {index < metrics.keyDates!.length - 1 && (
                        <div className="w-4 h-0.5 bg-gray-600 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Scroll hint if many dates */}
            {metrics.keyDates.length > 5 && (
              <div className="text-xs text-gray-400 mt-1 text-right">
                ← Scroll for more →
              </div>
            )}
          </div>
        )}

        {/* Recent Updates from Daily Reports */}
        {metrics.recentUpdates && metrics.recentUpdates.length > 0 && (
          <div className="bg-dark-surface rounded-lg p-4 shadow-sm border border-gray-700">
            <h4 className="text-sm font-semibold text-slate-50 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              Recent Schedule Updates from Daily Reports
            </h4>
            <div className="space-y-2">
              {metrics.recentUpdates.slice(0, 3).map((update, index) => (
                <div key={index} className="flex items-center justify-between text-sm border-l-2 border-orange-500 pl-3 py-1">
                  <div className="flex-1">
                    <span className="font-medium text-slate-50">{update.taskName}</span>
                    <span className="text-gray-400 mx-2">•</span>
                    <span className="text-gray-300">{update.status}</span>
                  </div>
                  <span className="text-xs text-gray-400">{update.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      )}
    </Card>
  );
}