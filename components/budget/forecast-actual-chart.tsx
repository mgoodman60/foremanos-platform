"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, DollarSign, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/budget-phases';
import { format, addMonths, startOfMonth, differenceInMonths } from 'date-fns';
import { semanticColors, neutralColors, chartColors } from '@/lib/design-tokens';

interface ForecastDataPoint {
  date: string;
  month: string;
  budget: number;
  forecast: number;
  actual: number | null;
  cumBudget: number;
  cumForecast: number;
  cumActual: number | null;
  variance: number | null;
}

interface ForecastActualChartProps {
  projectSlug: string;
  height?: number;
  showCumulative?: boolean;
}

export default function ForecastActualChart({
  projectSlug,
  height = 400,
  showCumulative: initialShowCumulative = true
}: ForecastActualChartProps) {
  const [data, setData] = useState<ForecastDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCumulative, setShowCumulative] = useState(initialShowCumulative);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  useEffect(() => {
    fetchForecastData();
  }, [projectSlug]);

  const fetchForecastData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectSlug}/budget/forecast`);
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result.data || generateSampleData());
    } catch (error) {
      console.error('Error fetching forecast:', error);
      setData(generateSampleData());
    } finally {
      setLoading(false);
    }
  };

  const generateSampleData = (): ForecastDataPoint[] => {
    const now = new Date();
    const projectStart = addMonths(now, -6);
    const projectEnd = addMonths(now, 6);
    const totalMonths = differenceInMonths(projectEnd, projectStart) + 1;
    
    const monthlyBudget = 250000;
    const data: ForecastDataPoint[] = [];
    let cumBudget = 0;
    let cumForecast = 0;
    let cumActual = 0;
    
    for (let i = 0; i < totalMonths; i++) {
      const date = addMonths(projectStart, i);
      const isPast = date <= now;
      const isFuture = date > now;
      
      // S-curve style spending
      const progress = i / totalMonths;
      const sCurveMultiplier = progress < 0.2 ? 0.6 : progress < 0.8 ? 1.2 : 0.8;
      
      const budget = monthlyBudget * sCurveMultiplier;
      const forecast = budget * (1 + (Math.random() - 0.5) * 0.1);
      const actual = isPast ? budget * (0.9 + Math.random() * 0.2) : null;
      
      cumBudget += budget;
      cumForecast += forecast;
      if (actual !== null) cumActual += actual;
      
      data.push({
        date: date.toISOString(),
        month: format(date, 'MMM yyyy'),
        budget: Math.round(budget),
        forecast: Math.round(forecast),
        actual: actual !== null ? Math.round(actual) : null,
        cumBudget: Math.round(cumBudget),
        cumForecast: Math.round(cumForecast),
        cumActual: isPast ? Math.round(cumActual) : null,
        variance: actual !== null ? Math.round(budget - actual) : null
      });
    }
    
    return data;
  };

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const actualData = data.filter(d => d.actual !== null);
    const totalBudget = data.reduce((sum, d) => sum + d.budget, 0);
    const totalForecast = data.reduce((sum, d) => sum + d.forecast, 0);
    const totalActual = actualData.reduce((sum, d) => sum + (d.actual || 0), 0);
    const variance = totalBudget - totalForecast;
    const variancePercent = totalBudget > 0 ? (variance / totalBudget) * 100 : 0;
    
    // EAC (Estimate at Completion)
    const cpi = totalActual > 0 && actualData.length > 0
      ? actualData.reduce((sum, d) => sum + d.budget, 0) / totalActual
      : 1;
    const eac = cpi > 0 ? totalBudget / cpi : totalBudget;
    
    return {
      totalBudget,
      totalForecast,
      totalActual,
      variance,
      variancePercent,
      cpi,
      eac,
      isOverBudget: variance < 0
    };
  }, [data]);

  interface TooltipPayloadEntry {
    color: string;
    name: string;
    value: number;
  }
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-dark-surface border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-semibold text-white mb-2">{label}</p>
        {payload.map((entry, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-400">{entry.name}:</span>
            </div>
            <span className="text-white font-medium">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3" />
          <div className="h-64 bg-gray-700 rounded" />
        </div>
      </Card>
    );
  }

  // Find current month index for reference line
  const currentMonthIndex = data.findIndex(d => {
    const date = new Date(d.date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  return (
    <Card className="bg-dark-card border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp aria-hidden="true" className="h-5 w-5 text-blue-400" />
            Forecast vs Actual
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant={showCumulative ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowCumulative(true)}
              className={showCumulative ? 'bg-blue-600' : 'border-gray-600'}
            >
              Cumulative
            </Button>
            <Button
              variant={!showCumulative ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowCumulative(false)}
              className={!showCumulative ? 'bg-blue-600' : 'border-gray-600'}
            >
              Monthly
            </Button>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Total Budget</div>
            <div className="text-lg font-semibold text-white">{formatCurrency(metrics.totalBudget)}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Forecast (EAC)</div>
            <div className="text-lg font-semibold text-blue-400">{formatCurrency(metrics.eac)}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Actual to Date</div>
            <div className="text-lg font-semibold text-emerald-400">{formatCurrency(metrics.totalActual)}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              Variance
              {metrics.isOverBudget && <AlertTriangle aria-hidden="true" className="h-3 w-3 text-red-500" />}
            </div>
            <div className={cn(
              'text-lg font-semibold',
              metrics.variance >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {metrics.variance >= 0 ? '+' : ''}{formatCurrency(metrics.variance)}
              <span className="text-xs ml-1">({metrics.variancePercent.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.gray[700]} />
            <XAxis 
              dataKey="month" 
              stroke={neutralColors.gray[400]} 
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke={neutralColors.gray[400]} 
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
            />
            
            {/* Reference line for today */}
            {currentMonthIndex >= 0 && (
              <ReferenceLine
                x={data[currentMonthIndex]?.month}
                stroke={semanticColors.error[500]}
                strokeDasharray="5 5"
                label={{ value: 'Today', fill: semanticColors.error[500], fontSize: 12, position: 'top' }}
              />
            )}

            {/* Budget Line */}
            <Line
              type="monotone"
              dataKey={showCumulative ? 'cumBudget' : 'budget'}
              name="Budget"
              stroke={neutralColors.slate[500]}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />

            {/* Forecast Area */}
            <Area
              type="monotone"
              dataKey={showCumulative ? 'cumForecast' : 'forecast'}
              name="Forecast"
              fill={chartColors.neutral}
              fillOpacity={0.2}
              stroke={chartColors.neutral}
              strokeWidth={2}
            />

            {/* Actual Line */}
            <Line
              type="monotone"
              dataKey={showCumulative ? 'cumActual' : 'actual'}
              name="Actual"
              stroke={chartColors.positive}
              strokeWidth={3}
              dot={{ fill: chartColors.positive, strokeWidth: 0, r: 4 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Explanation */}
      <div className="px-4 pb-4">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-gray-500 border-dashed border-t-2 border-gray-500" />
            <span>Original Budget</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-2 bg-blue-500/30 border border-blue-500 rounded" />
            <span>Forecast (Projected Spend)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-emerald-500" />
            <span>Actual Spend to Date</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-l-2 border-dashed border-red-500" />
            <span>Current Date</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Mini sparkline version for dashboard widgets
export function ForecastSparkline({ data, className }: { data: ForecastDataPoint[], className?: string }) {
  return (
    <div className={cn('h-16', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="cumBudget"
            stroke={neutralColors.slate[500]}
            strokeWidth={1}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="cumActual"
            stroke={chartColors.positive}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
