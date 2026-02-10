'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, TrendingUp, TrendingDown, Minus, 
  Calendar, DollarSign, Shield, CheckSquare, FileText,
  AlertTriangle, AlertCircle, Info, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

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

interface ProjectHealthWidgetProps {
  projectSlug: string;
  compact?: boolean;
}

export default function ProjectHealthWidget({ projectSlug, compact = false }: ProjectHealthWidgetProps) {
  const [health, setHealth] = useState<HealthScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/health`);
      if (!response.ok) throw new Error('Failed to fetch health');
      const data = await response.json();
      setHealth(data.health);
    } catch (error) {
      console.error('[Health Widget] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchHealth();
    // Refresh every 5 minutes
    const interval = setInterval(fetchHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHealth();
    toast.success('Health score refreshed');
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return 'bg-gray-500/20 border-gray-500/50 shadow-gray-500/20';
    if (score >= 80) return 'bg-green-500/20 border-green-500/50 shadow-green-500/20';
    if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/50 shadow-yellow-500/20';
    if (score >= 40) return 'bg-orange-500/20 border-orange-500/50 shadow-orange-500/20';
    return 'bg-red-500/20 border-red-500/50 shadow-red-500/20';
  };

  const getScoreLabel = (score: number | null) => {
    if (score === null) return 'No Data';
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Attention';
    return 'Critical';
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const AlertIcon = ({ type }: { type: string }) => {
    if (type === 'critical') return <AlertCircle className="w-4 h-4 text-red-400" />;
    if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    return <Info className="w-4 h-4 text-blue-400" />;
  };

  if (loading) {
    return (
      <div className="bg-dark-subtle border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="bg-dark-subtle border border-gray-700 rounded-xl p-6">
        <p className="text-gray-400 text-center">Unable to calculate health score</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`rounded-lg border-2 p-3 ${getScoreBg(health.overallScore)} w-[140px] flex-shrink-0 shadow-md`}>
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 flex-shrink-0 ${getScoreColor(health.overallScore)}`} />
          <div className="min-w-0">
            <p className="text-[10px] text-gray-300 leading-tight font-medium">Operational</p>
            <p className="text-[10px] text-gray-300 leading-tight font-medium">Health</p>
          </div>
          <div className="flex flex-col items-end ml-auto">
            <p className={`text-xl font-bold leading-none ${getScoreColor(health.overallScore)}`}>
              {health.overallScore ?? '--'}
            </p>
            {health.overallScore !== null && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <TrendIcon trend={health.trend} />
                <span className="text-[9px] text-gray-300">
                  {health.changeFromPrevious >= 0 ? '+' : ''}{health.changeFromPrevious.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Operational Health</h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-6">
        {/* Overall Score */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className={`text-5xl font-bold ${getScoreColor(health.overallScore)}`}>
                {health.overallScore ?? '--'}
              </span>
              <div className="flex flex-col">
                <span className={`text-sm font-medium ${getScoreColor(health.overallScore)}`}>
                  {getScoreLabel(health.overallScore)}
                </span>
                {health.overallScore !== null && (
                  <div className="flex items-center gap-1 mt-1">
                    <TrendIcon trend={health.trend} />
                    <span className="text-xs text-gray-400 capitalize">{health.trend}</span>
                    {health.changeFromPrevious !== 0 && (
                      <span className={`text-xs ${health.changeFromPrevious > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ({health.changeFromPrevious >= 0 ? '+' : ''}{health.changeFromPrevious.toFixed(1)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <ScoreCard
            icon={<Calendar className="w-4 h-4" />}
            label="Schedule"
            score={health.scheduleScore}
          />
          <ScoreCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Budget"
            score={health.budgetScore}
          />
          <ScoreCard
            icon={<Shield className="w-4 h-4" />}
            label="Safety"
            score={health.safetyScore}
          />
          <ScoreCard
            icon={<CheckSquare className="w-4 h-4" />}
            label="Quality"
            score={health.qualityScore}
          />
          <ScoreCard
            icon={<FileText className="w-4 h-4" />}
            label="Docs"
            score={health.documentScore}
          />
        </div>

        {/* Alerts */}
        {health.alerts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Alerts</h3>
            {health.alerts.slice(0, 3).map((alert, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 p-3 rounded-lg ${
                  alert.type === 'critical' ? 'bg-red-500/10 border border-red-500/20' :
                  alert.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' :
                  'bg-blue-500/10 border border-blue-500/20'
                }`}
              >
                <AlertIcon type={alert.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{alert.message}</p>
                  {alert.actionRequired && (
                    <p className="text-xs text-gray-400 mt-1">{alert.actionRequired}</p>
                  )}
                </div>
                <span className="text-xs text-gray-500">{alert.category}</span>
              </div>
            ))}
          </div>
        )}

        {/* Key Metrics */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Key Metrics</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Open RFIs</span>
              <p className="text-white font-medium">{health.metrics.openRFIs}</p>
            </div>
            <div>
              <span className="text-gray-400">Punch Items</span>
              <p className="text-white font-medium">{health.metrics.openPunchItems}</p>
            </div>
            <div>
              <span className="text-gray-400">Overdue Tasks</span>
              <p className="text-white font-medium">{health.metrics.overdueTasks}</p>
            </div>
            <div>
              <span className="text-gray-400">Incident-Free Days</span>
              <p className="text-white font-medium">{health.metrics.incidentsFree}</p>
            </div>
            <div>
              <span className="text-gray-400">Budget Variance</span>
              <p className={`font-medium ${health.metrics.budgetVariance > 5 ? 'text-red-400' : 'text-green-400'}`}>
                {health.metrics.budgetVariance >= 0 ? '+' : ''}{health.metrics.budgetVariance.toFixed(1)}%
              </p>
            </div>
            <div>
              <span className="text-gray-400">Tasks On Track</span>
              <p className="text-white font-medium">{health.metrics.tasksOnTrack}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ icon, label, score }: { icon: React.ReactNode; label: string; score: number | null }) {
  const getColor = (s: number | null) => {
    if (s === null) return 'text-gray-400 bg-gray-500/10';
    if (s >= 80) return 'text-green-400 bg-green-500/10';
    if (s >= 60) return 'text-yellow-400 bg-yellow-500/10';
    if (s >= 40) return 'text-orange-400 bg-orange-500/10';
    return 'text-red-400 bg-red-500/10';
  };

  return (
    <div className={`rounded-lg p-3 ${getColor(score)}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-gray-300">{label}</span>
      </div>
      <p className="text-lg font-semibold">{score ?? '--'}</p>
    </div>
  );
}
