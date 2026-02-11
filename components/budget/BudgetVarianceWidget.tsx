'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, 
  RefreshCw, DollarSign, ArrowUpRight, ArrowDownRight,
  Minus, ChevronDown, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface BudgetVarianceData {
  totalBudget: number;
  actualCost: number;
  committedCost: number;
  remainingBudget: number;
  variance: number;
  variancePercent: number;
  percentComplete: number;
  percentSpent: number;
  items: BudgetItemVariance[];
  byPhase: PhaseVariance[];
  lastUpdated: string;
  dataSource: 'pay_application' | 'daily_reports' | 'derived';
}

interface BudgetItemVariance {
  id: string;
  name: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'on_track' | 'warning' | 'over_budget' | 'under_budget';
}

interface PhaseVariance {
  phaseCode: number;
  phaseName: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  itemCount: number;
}

interface BudgetVarianceWidgetProps {
  projectSlug: string;
  refreshInterval?: number; // Auto-refresh interval in ms (default: 30s)
  compact?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

export default function BudgetVarianceWidget({ 
  projectSlug, 
  refreshInterval = 30000,
  compact = false 
}: BudgetVarianceWidgetProps) {
  const [data, setData] = useState<BudgetVarianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchVarianceData = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/budget/variance`);
      if (!response.ok) throw new Error('Failed to fetch variance data');
      const result = await response.json();
      setData(result);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('[BudgetVariance] Error:', error);
      if (!data) {
        toast.error('Failed to load budget variance data');
      }
    } finally {
      setLoading(false);
    }
  }, [projectSlug, data]);

  // Initial fetch
  useEffect(() => {
    fetchVarianceData();
  }, [fetchVarianceData]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      timerRef.current = setInterval(fetchVarianceData, refreshInterval);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, refreshInterval, fetchVarianceData]);

  const getVarianceColor = (variancePercent: number) => {
    if (variancePercent > 5) return 'text-green-400'; // Under budget
    if (variancePercent > 0) return 'text-green-300';
    if (variancePercent > -5) return 'text-yellow-400'; // Warning
    return 'text-red-400'; // Over budget
  };

  const getVarianceBgColor = (variancePercent: number) => {
    if (variancePercent > 5) return 'bg-green-500/20 border-green-500/30';
    if (variancePercent > 0) return 'bg-green-500/10 border-green-500/20';
    if (variancePercent > -5) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'under_budget': return <TrendingDown className="w-4 h-4 text-green-400" />;
      case 'on_track': return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'over_budget': return <TrendingUp className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const togglePhase = (phaseCode: number) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseCode)) {
        next.delete(phaseCode);
      } else {
        next.add(phaseCode);
      }
      return next;
    });
  };

  const getDataSourceLabel = (source: string) => {
    switch (source) {
      case 'pay_application': return 'Pay App';
      case 'daily_reports': return 'Daily Reports';
      case 'derived': return 'Derived';
      default: return source;
    }
  };

  if (loading && !data) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Compact mode - show summary only
  if (compact) {
    return (
      <Card className={`bg-gray-800/50 border-gray-700 ${getVarianceBgColor(data.variancePercent)}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Budget Variance</span>
            <Badge variant="outline" className="text-xs">
              {getDataSourceLabel(data.dataSource)}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${getVarianceColor(data.variancePercent)}`}>
              {formatCurrency(data.variance)}
            </span>
            <span className={`text-sm ${getVarianceColor(data.variancePercent)}`}>
              {formatPercent(data.variancePercent)}
            </span>
          </div>
          <Progress 
            value={Math.min(data.percentSpent, 100)} 
            className="mt-2 h-2"
          />
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>{data.percentSpent.toFixed(1)}% spent</span>
            <span>{data.percentComplete.toFixed(1)}% complete</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full mode
  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Budget Variance
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Source: {getDataSourceLabel(data.dataSource)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAutoRefresh(!autoRefresh);
                toast.info(autoRefresh ? 'Auto-refresh disabled' : 'Auto-refresh enabled');
              }}
              className={autoRefresh ? 'text-green-400' : 'text-gray-400'}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Total Budget</p>
            <p className="text-lg font-semibold text-white">
              {formatCurrency(data.totalBudget)}
            </p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Actual Cost</p>
            <p className="text-lg font-semibold text-white">
              {formatCurrency(data.actualCost)}
            </p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Committed</p>
            <p className="text-lg font-semibold text-yellow-400">
              {formatCurrency(data.committedCost)}
            </p>
          </div>
          <div className={`rounded-lg p-3 border ${getVarianceBgColor(data.variancePercent)}`}>
            <p className="text-xs text-gray-400 mb-1">Variance</p>
            <div className="flex items-center gap-1">
              {data.variance >= 0 
                ? <ArrowDownRight className="w-4 h-4 text-green-400" />
                : <ArrowUpRight className="w-4 h-4 text-red-400" />
              }
              <p className={`text-lg font-semibold ${getVarianceColor(data.variancePercent)}`}>
                {formatCurrency(Math.abs(data.variance))}
              </p>
            </div>
            <p className={`text-xs ${getVarianceColor(data.variancePercent)}`}>
              {data.variance >= 0 ? 'Under' : 'Over'} budget ({formatPercent(data.variancePercent)})
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Budget Utilization</span>
            <span className="text-white">{data.percentSpent.toFixed(1)}%</span>
          </div>
          <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(data.percentSpent, 100)}%` }}
            />
            {data.percentComplete > 0 && (
              <div 
                className="absolute top-0 w-0.5 h-full bg-green-400"
                style={{ left: `${Math.min(data.percentComplete, 100)}%` }}
                title={`${data.percentComplete.toFixed(1)}% complete`}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span>
            <span className="text-green-400">▐ {data.percentComplete.toFixed(1)}% complete</span>
            <span>100%</span>
          </div>
        </div>

        {/* Phase Breakdown */}
        {data.byPhase.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-300">By Phase</h4>
            <div className="space-y-1">
              {data.byPhase.map(phase => (
                <div key={phase.phaseCode} className="bg-gray-900/30 rounded border border-gray-700">
                  <button
                    onClick={() => togglePhase(phase.phaseCode)}
                    className="w-full flex items-center justify-between p-2 hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedPhases.has(phase.phaseCode) 
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />
                      }
                      <span className="text-sm text-white">{phase.phaseName}</span>
                      <Badge variant="outline" className="text-xs">
                        {phase.itemCount} items
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">
                        {formatCurrency(phase.actual)} / {formatCurrency(phase.budgeted)}
                      </span>
                      <span className={`text-sm font-medium ${getVarianceColor(phase.variancePercent)}`}>
                        {formatPercent(phase.variancePercent)}
                      </span>
                    </div>
                  </button>
                  {expandedPhases.has(phase.phaseCode) && (
                    <div className="px-4 pb-2">
                      <Progress 
                        value={phase.budgeted > 0 ? (phase.actual / phase.budgeted) * 100 : 0} 
                        className="h-1.5"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Variance Items */}
        {data.items.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-300">Top Variance Items</h4>
            <div className="space-y-1">
              {data.items.slice(0, 5).map(item => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-gray-900/30 rounded border border-gray-700"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.status)}
                    <span className="text-sm text-white truncate max-w-[200px]">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      {formatCurrency(item.actual)} / {formatCurrency(item.budgeted)}
                    </span>
                    <span className={`text-sm font-medium min-w-[60px] text-right ${getVarianceColor(item.variancePercent)}`}>
                      {formatPercent(item.variancePercent)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
