'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  TrendingUp, TrendingDown, DollarSign, RefreshCw,
  AlertTriangle, CheckCircle, Target, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { chartColors, semanticColors } from '@/lib/design-tokens';

interface CashFlowData {
  period: string;
  plannedInflow: number;
  actualInflow: number;
  forecastInflow: number;
  plannedOutflow: number;
  actualOutflow: number;
  forecastOutflow: number;
  plannedNet: number;
  actualNet: number;
  forecastNet: number;
  cumulativePlanned: number;
  cumulativeActual: number | null;
  cumulativeForecast: number;
}

interface CostForecast {
  bac: number;
  ev: number;
  ac: number;
  cpi: number;
  spi: number;
  eac: number;
  etc: number;
  vac: number;
  percentComplete: number;
  costHealthStatus: string;
  scheduleHealthStatus: string;
  recommendations: string[];
}

export default function CashFlowChart() {
  const params = useParams();
  const slug = params?.slug as string;

  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [costForecast, setCostForecast] = useState<CostForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY');
  const [generating, setGenerating] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/cash-flow?periodType=${periodType}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCashFlowData(data.cashFlow?.forecasts || []);
      setCostForecast(data.costForecast);
    } catch (err) {
      toast.error('Failed to load cash flow data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [slug, periodType]);

  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${slug}/cash-flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodType, periodsAhead: 12 })
      });
      if (!res.ok) throw new Error('Failed to generate');
      toast.success('Cash flow forecast regenerated');
      fetchData();
    } catch (err) {
      toast.error('Failed to regenerate forecast');
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'ON_BUDGET':
      case 'ON_SCHEDULE':
        return 'text-green-400';
      case 'AT_RISK':
        return 'text-yellow-400';
      case 'OVER_BUDGET':
      case 'BEHIND_SCHEDULE':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getIndexColor = (value: number) => {
    if (value >= 1) return 'text-green-400';
    if (value >= 0.9) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <Card className="p-6 bg-dark-card border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3" />
          <div className="h-64 bg-gray-700 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cost Forecast Summary */}
      {costForecast && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Budget (BAC)</div>
            <div className="text-xl font-bold text-white">
              {formatCurrency(costForecast.bac)}
            </div>
          </Card>

          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Actual Cost (AC)</div>
            <div className="text-xl font-bold text-blue-400">
              {formatCurrency(costForecast.ac)}
            </div>
            <div className="text-xs text-gray-500">
              {costForecast.percentComplete.toFixed(1)}% complete
            </div>
          </Card>

          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Est. at Completion (EAC)</div>
            <div className="text-xl font-bold text-purple-400">
              {formatCurrency(costForecast.eac)}
            </div>
            <div className={`text-xs ${costForecast.vac >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {costForecast.vac >= 0 ? 'Under budget by ' : 'Over budget by '}
              {formatCurrency(Math.abs(costForecast.vac))}
            </div>
          </Card>

          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">To Complete (ETC)</div>
            <div className="text-xl font-bold text-yellow-400">
              {formatCurrency(costForecast.etc)}
            </div>
          </Card>

          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Cost Performance (CPI)</div>
            <div className={`text-xl font-bold ${getIndexColor(costForecast.cpi)}`}>
              {costForecast.cpi.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {costForecast.cpi >= 1 ? (
                <><ArrowUpRight className="h-3 w-3 text-green-400" /> Efficient</>
              ) : (
                <><ArrowDownRight className="h-3 w-3 text-red-400" /> Over spending</>
              )}
            </div>
          </Card>

          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Schedule Performance (SPI)</div>
            <div className={`text-xl font-bold ${getIndexColor(costForecast.spi)}`}>
              {costForecast.spi.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {costForecast.spi >= 1 ? (
                <><ArrowUpRight className="h-3 w-3 text-green-400" /> Ahead</>
              ) : (
                <><ArrowDownRight className="h-3 w-3 text-red-400" /> Behind</>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Health Status Badges */}
      {costForecast && (
        <div className="flex items-center gap-4">
          <Badge className={`${costForecast.costHealthStatus === 'ON_BUDGET' ? 'bg-green-600' : costForecast.costHealthStatus === 'AT_RISK' ? 'bg-yellow-600' : 'bg-red-600'}`}>
            {costForecast.costHealthStatus === 'ON_BUDGET' && <CheckCircle className="h-3 w-3 mr-1" />}
            {costForecast.costHealthStatus !== 'ON_BUDGET' && <AlertTriangle className="h-3 w-3 mr-1" />}
            {costForecast.costHealthStatus.replace('_', ' ')}
          </Badge>
          <Badge className={`${costForecast.scheduleHealthStatus === 'ON_SCHEDULE' ? 'bg-green-600' : costForecast.scheduleHealthStatus === 'AT_RISK' ? 'bg-yellow-600' : 'bg-red-600'}`}>
            {costForecast.scheduleHealthStatus === 'ON_SCHEDULE' && <CheckCircle className="h-3 w-3 mr-1" />}
            {costForecast.scheduleHealthStatus !== 'ON_SCHEDULE' && <AlertTriangle className="h-3 w-3 mr-1" />}
            {costForecast.scheduleHealthStatus.replace('_', ' ')}
          </Badge>
        </div>
      )}

      {/* Recommendations */}
      {costForecast && costForecast.recommendations.length > 0 && (
        <Card className="p-4 bg-yellow-900/20 border-yellow-700">
          <h4 className="font-medium text-yellow-400 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {costForecast.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <Target className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Chart Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Cash Flow Projection</h3>
        <div className="flex items-center gap-4">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
            <SelectTrigger className="w-32 bg-dark-card border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRegenerate} disabled={generating} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Cash Flow Chart */}
      <Card className="p-4 bg-dark-card border-gray-700">
        {cashFlowData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No cash flow data available</p>
              <Button onClick={handleRegenerate} className="mt-4" disabled={generating}>
                Generate Forecast
              </Button>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="period" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tickFormatter={formatCurrency}
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2328', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                formatter={(value) => typeof value === "number" ? formatCurrency(value) : ""}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="forecastInflow"
                name="Forecast Inflow"
                stroke={chartColors.positive}
                fill={`${chartColors.positive}33`}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="forecastOutflow"
                name="Forecast Outflow"
                stroke={chartColors.negative}
                fill={`${chartColors.negative}33`}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="actualInflow"
                name="Actual Inflow"
                stroke={semanticColors.success[400]}
                strokeWidth={3}
                dot={{ fill: semanticColors.success[400], strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="actualOutflow"
                name="Actual Outflow"
                stroke={semanticColors.error[400]}
                strokeWidth={3}
                dot={{ fill: semanticColors.error[400], strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Cumulative Cash Flow */}
      {cashFlowData.length > 0 && (
        <Card className="p-4 bg-dark-card border-gray-700">
          <h4 className="font-medium text-white mb-4">Cumulative Cash Position</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="period" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tickFormatter={formatCurrency}
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2328', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                formatter={(value) => typeof value === "number" ? formatCurrency(value) : ""}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="cumulativePlanned"
                name="Planned"
                stroke={chartColors.neutral}
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="cumulativeActual"
                name="Actual"
                stroke={chartColors.palette[1]}
                strokeWidth={3}
                dot={{ fill: chartColors.palette[1], strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="cumulativeForecast"
                name="Forecast"
                stroke={chartColors.palette[4]}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
