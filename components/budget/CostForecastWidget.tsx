'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Target, AlertTriangle, 
  RefreshCw, Calculator, Calendar, DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from 'recharts';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { neutralColors, backgroundColors, borderColors, chartColors, semanticColors } from '@/lib/design-tokens';

interface ForecastData {
  // Core metrics
  totalBudget: number;
  actualCost: number;
  percentComplete: number;
  
  // Calculated forecasts
  estimateAtCompletion: number;    // EAC = Actual / % Complete
  estimateToComplete: number;      // ETC = EAC - Actual
  varianceAtCompletion: number;    // VAC = Budget - EAC
  
  // Performance indices
  costPerformanceIndex: number;    // CPI = EV / AC
  schedulePerformanceIndex: number; // SPI = EV / PV
  toCompletePerformanceIndex: number; // TCPI = (Budget - EV) / (Budget - AC)
  
  // Trend data
  projectionTrend: Array<{
    date: string;
    actual: number;
    planned: number;
    projected: number;
  }>;
  
  // Risk assessment
  forecastConfidence: 'high' | 'medium' | 'low';
  riskFactors: string[];
  
  // Schedule forecast
  originalEndDate?: string;
  projectedEndDate?: string;
  daysVariance: number;
}

interface CostForecastWidgetProps {
  projectSlug: string;
  refreshInterval?: number;
  showChart?: boolean;
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
  return `${value.toFixed(2)}`;
};

export default function CostForecastWidget({ 
  projectSlug, 
  refreshInterval = 60000,
  showChart = true 
}: CostForecastWidgetProps) {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchForecast = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/budget/forecast`);
      if (!response.ok) throw new Error('Failed to fetch forecast');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('[CostForecast] Error:', error);
      if (!data) {
        toast.error('Failed to load cost forecast');
      }
    } finally {
      setLoading(false);
    }
  }, [projectSlug, data]);

  useEffect(() => {
    fetchForecast();
    const timer = setInterval(fetchForecast, refreshInterval);
    return () => clearInterval(timer);
  }, [fetchForecast, refreshInterval]);

  const getCPIColor = (cpi: number) => {
    if (cpi >= 1.0) return 'text-green-400';
    if (cpi >= 0.9) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCPIBg = (cpi: number) => {
    if (cpi >= 1.0) return 'bg-green-500/20 border-green-500/30';
    if (cpi >= 0.9) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high': return <Badge className="bg-green-500/20 text-green-400">High Confidence</Badge>;
      case 'medium': return <Badge className="bg-yellow-500/20 text-yellow-400">Medium Confidence</Badge>;
      case 'low': return <Badge className="bg-red-500/20 text-red-400">Low Confidence</Badge>;
      default: return null;
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

  const overBudget = data.varianceAtCompletion < 0;
  const projectAtRisk = data.costPerformanceIndex < 0.9 || data.schedulePerformanceIndex < 0.9;

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-400" />
            Cost Forecast
          </CardTitle>
          <div className="flex items-center gap-2">
            {getConfidenceBadge(data.forecastConfidence)}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchForecast}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Forecast Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* EAC - Estimate at Completion */}
          <div className={`rounded-lg p-3 border ${overBudget ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
            <div className="flex items-center gap-1 mb-1">
              <Target className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-400">Estimate at Completion</p>
            </div>
            <p className={`text-xl font-bold ${overBudget ? 'text-red-400' : 'text-green-400'}`}>
              {formatCurrency(data.estimateAtCompletion)}
            </p>
            <p className="text-xs text-gray-400">Budget: {formatCurrency(data.totalBudget)}</p>
          </div>

          {/* VAC - Variance at Completion */}
          <div className={`rounded-lg p-3 border ${getCPIBg(data.varianceAtCompletion >= 0 ? 1 : 0.5)}`}>
            <div className="flex items-center gap-1 mb-1">
              {data.varianceAtCompletion >= 0 
                ? <TrendingDown className="w-4 h-4 text-green-400" />
                : <TrendingUp className="w-4 h-4 text-red-400" />
              }
              <p className="text-xs text-gray-400">Variance at Completion</p>
            </div>
            <p className={`text-xl font-bold ${data.varianceAtCompletion >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.varianceAtCompletion >= 0 ? '+' : ''}{formatCurrency(data.varianceAtCompletion)}
            </p>
            <p className="text-xs text-gray-400">
              {data.varianceAtCompletion >= 0 ? 'Under budget' : 'Over budget'}
            </p>
          </div>

          {/* ETC - Estimate to Complete */}
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-400">Estimate to Complete</p>
            </div>
            <p className="text-xl font-bold text-white">
              {formatCurrency(data.estimateToComplete)}
            </p>
            <p className="text-xs text-gray-400">
              {((data.estimateToComplete / data.totalBudget) * 100).toFixed(1)}% of budget remaining
            </p>
          </div>
        </div>

        {/* Performance Indices */}
        <div className="grid grid-cols-3 gap-3">
          {/* CPI */}
          <div className={`rounded-lg p-3 border ${getCPIBg(data.costPerformanceIndex)}`}>
            <p className="text-xs text-gray-400 mb-1">CPI</p>
            <p className={`text-2xl font-bold ${getCPIColor(data.costPerformanceIndex)}`}>
              {formatPercent(data.costPerformanceIndex)}
            </p>
            <p className="text-xs text-gray-400">
              {data.costPerformanceIndex >= 1 ? 'Cost efficient' : 'Cost overrun'}
            </p>
          </div>

          {/* SPI */}
          <div className={`rounded-lg p-3 border ${getCPIBg(data.schedulePerformanceIndex)}`}>
            <p className="text-xs text-gray-400 mb-1">SPI</p>
            <p className={`text-2xl font-bold ${getCPIColor(data.schedulePerformanceIndex)}`}>
              {formatPercent(data.schedulePerformanceIndex)}
            </p>
            <p className="text-xs text-gray-400">
              {data.schedulePerformanceIndex >= 1 ? 'Ahead of schedule' : 'Behind schedule'}
            </p>
          </div>

          {/* TCPI */}
          <div className={`rounded-lg p-3 border ${getCPIBg(data.toCompletePerformanceIndex <= 1 ? 1 : 0.8)}`}>
            <p className="text-xs text-gray-400 mb-1">TCPI</p>
            <p className={`text-2xl font-bold ${data.toCompletePerformanceIndex <= 1 ? 'text-green-400' : 'text-yellow-400'}`}>
              {formatPercent(data.toCompletePerformanceIndex)}
            </p>
            <p className="text-xs text-gray-400">
              {data.toCompletePerformanceIndex <= 1 ? 'Achievable' : 'Challenging'}
            </p>
          </div>
        </div>

        {/* Projection Chart */}
        {showChart && data.projectionTrend.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.projectionTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.gray[700]} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: neutralColors.gray[400], fontSize: 10 }}
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getMonth()+1}/${d.getDate()}`;
                  }}
                />
                <YAxis 
                  tick={{ fill: neutralColors.gray[400], fontSize: 10 }}
                  tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: backgroundColors.dark.card, border: `1px solid ${borderColors.dark.subtle}` }}
                  labelStyle={{ color: neutralColors.gray[400] }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <ReferenceLine y={data.totalBudget} stroke={semanticColors.error[500]} strokeDasharray="5 5" label="Budget" />
                <Area 
                  type="monotone" 
                  dataKey="planned" 
                  fill="rgba(59, 130, 246, 0.1)" 
                  stroke={chartColors.neutral}
                  strokeDasharray="3 3"
                  name="Planned"
                />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke={chartColors.positive}
                  strokeWidth={2}
                  dot={false}
                  name="Actual"
                />
                <Line 
                  type="monotone" 
                  dataKey="projected" 
                  stroke={chartColors.warning}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Projected"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Schedule Forecast */}
        {data.originalEndDate && (
          <div className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Schedule Forecast</span>
            </div>
            <div className="text-right">
              <p className="text-sm text-white">
                {data.projectedEndDate 
                  ? format(new Date(data.projectedEndDate), 'MMM d, yyyy')
                  : 'TBD'
                }
              </p>
              {data.daysVariance !== 0 && (
                <p className={`text-xs ${data.daysVariance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {data.daysVariance > 0 ? '+' : ''}{data.daysVariance} days
                </p>
              )}
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {data.riskFactors.length > 0 && projectAtRisk && (
          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">Risk Factors</span>
            </div>
            <ul className="space-y-1">
              {data.riskFactors.map((risk, idx) => (
                <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                  <span className="text-yellow-400">•</span>
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
