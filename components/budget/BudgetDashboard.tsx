"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar,
  AlertTriangle, CheckCircle2, Loader2, RefreshCw,
  ArrowUpRight, ArrowDownRight, PieChart as PieChartIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, BarChart, Bar
} from 'recharts';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { chartColors, semanticColors, neutralColors, backgroundColors, borderColors } from '@/lib/design-tokens';

// Types
interface EVMMetrics {
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
  costVariance: number;
  scheduleVariance: number;
  costPerformanceIndex: number;
  schedulePerformanceIndex: number;
  estimateAtCompletion: number;
  estimateToComplete: number;
  varianceAtCompletion: number;
  percentComplete: number;
  percentSpent: number;
}

interface CostBreakdown {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentUsed: number;
}

interface DailyCost {
  date: string;
  labor: number;
  material: number;
  equipment: number;
  subcontractor: number;
  total: number;
  cumulative: number;
}

interface DashboardData {
  evm: EVMMetrics;
  costBreakdown: CostBreakdown[];
  dailyCosts: DailyCost[];
  budget: {
    total: number;
    contingency: number;
    actualCost: number;
    committedCost: number;
  };
}

// CPI/SPI Gauge Component
function PerformanceGauge({
  value,
  label,
  description
}: {
  value: number;
  label: string;
  description: string;
}) {
  const getColor = (val: number) => {
    if (val >= 1.0) return { main: semanticColors.success[500], bg: 'rgba(16, 185, 129, 0.1)' };
    if (val >= 0.9) return { main: semanticColors.warning[500], bg: 'rgba(245, 158, 11, 0.1)' };
    return { main: semanticColors.error[500], bg: 'rgba(239, 68, 68, 0.1)' };
  };

  const colors = getColor(value);
  const angle = Math.min(Math.max((value - 0.5) * 180, 0), 180); // Map 0.5-1.5 to 0-180 degrees
  const _percentage = Math.min(Math.max((value - 0.5) * 100, 0), 100);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        {/* Background arc */}
        <div 
          className="absolute w-32 h-32 rounded-full border-8 border-gray-700"
          style={{ top: 0 }}
        />
        {/* Value arc */}
        <div 
          className="absolute w-32 h-32 rounded-full border-8 origin-center"
          style={{ 
            top: 0,
            borderColor: colors.main,
            clipPath: 'polygon(0 50%, 100% 50%, 100% 0, 0 0)',
            transform: `rotate(${angle - 90}deg)`,
            transition: 'transform 0.5s ease-out'
          }}
        />
        {/* Center value */}
        <div className="absolute inset-0 flex items-end justify-center pb-0">
          <span className="text-2xl font-bold" style={{ color: colors.main }}>
            {value.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="text-center mt-2">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      {/* Status indicator */}
      <div className="mt-2">
        {value >= 1.0 ? (
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            <CheckCircle2 aria-hidden="true" className="h-3 w-3 mr-1" /> On Target
          </Badge>
        ) : value >= 0.9 ? (
          <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
            <AlertTriangle aria-hidden="true" className="h-3 w-3 mr-1" /> At Risk
          </Badge>
        ) : (
          <Badge className="bg-red-600/20 text-red-400 border-red-600/30">
            <TrendingDown aria-hidden="true" className="h-3 w-3 mr-1" /> Over Budget
          </Badge>
        )}
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  color
}: {
  title: string;
  value: string;
  subValue?: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
}) {
  return (
    <Card className="bg-dark-card border-gray-700">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subValue && (
              <p className="text-xs text-gray-400 mt-1">{subValue}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${color.replace('text', 'bg')}/20`}>
            <Icon aria-hidden="true" className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center text-xs">
            {trend === 'up' ? (
              <ArrowUpRight aria-hidden="true" className="h-3 w-3 text-green-400 mr-1" />
            ) : trend === 'down' ? (
              <ArrowDownRight aria-hidden="true" className="h-3 w-3 text-red-400 mr-1" />
            ) : null}
            <span className={trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}>
              {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}vs last period
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TRADE_COLORS = chartColors.palette;

export default function BudgetDashboard() {
  const params = useParams();
  const slug = params?.slug as string;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/budget/dashboard?days=${days}`);
      if (res.ok) {
        const dashboardData = await res.json();
        setData(dashboardData);
      } else {
        setData(null);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load budget dashboard');
    } finally {
      setLoading(false);
    }
  }, [slug, days]);

  useEffect(() => {
    if (slug) fetchDashboardData();
  }, [slug, days, fetchDashboardData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="p-8 text-center">
          <PieChartIcon aria-hidden="true" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Budget Data</h3>
          <p className="text-gray-400">Configure your project budget to see the dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  const { evm, costBreakdown, dailyCosts, budget } = data;

  // Prepare pie chart data
  const pieData = costBreakdown.filter(c => c.actual > 0).map((item, idx) => ({
    name: item.category,
    value: item.actual,
    color: TRADE_COLORS[idx % TRADE_COLORS.length]
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign aria-hidden="true" className="h-6 w-6 text-green-400" />
          Budget Performance Dashboard
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-dark-card border border-gray-600 rounded px-3 py-1 text-sm text-gray-300"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchDashboardData}
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Budget"
          value={formatCurrency(budget.total)}
          subValue="Contract + Contingency"
          icon={DollarSign}
          color="text-blue-400"
        />
        <KPICard
          title="Actual Cost"
          value={formatCurrency(evm.actualCost)}
          subValue={`${evm.percentSpent.toFixed(1)}% of budget`}
          icon={evm.actualCost > evm.plannedValue ? TrendingUp : TrendingDown}
          trend={evm.costVariance >= 0 ? 'up' : 'down'}
          color={evm.costVariance >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <KPICard
          title="Cost Variance"
          value={formatCurrency(Math.abs(evm.costVariance))}
          subValue={evm.costVariance >= 0 ? 'Under budget' : 'Over budget'}
          icon={evm.costVariance >= 0 ? CheckCircle2 : AlertTriangle}
          color={evm.costVariance >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <KPICard
          title="Est. at Completion"
          value={formatCurrency(evm.estimateAtCompletion)}
          subValue={evm.estimateAtCompletion <= budget.total ? 'Within budget' : 'Over budget'}
          icon={Calendar}
          color={evm.estimateAtCompletion <= budget.total ? 'text-green-400' : 'text-yellow-400'}
        />
      </div>

      {/* CPI/SPI Gauges */}
      <Card className="bg-dark-card border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Performance Indices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-8">
            <PerformanceGauge
              value={evm.costPerformanceIndex}
              label="CPI (Cost Performance)"
              description="EV / AC - Above 1.0 = under budget"
            />
            <PerformanceGauge
              value={evm.schedulePerformanceIndex}
              label="SPI (Schedule Performance)"
              description="EV / PV - Above 1.0 = ahead of schedule"
            />
          </div>
          
          {/* Performance Summary */}
          <div className="mt-6 p-4 bg-dark-surface rounded-lg">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Performance Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Planned Value:</span>
                <span className="ml-2 text-white">{formatCurrencyFull(evm.plannedValue)}</span>
              </div>
              <div>
                <span className="text-gray-400">Earned Value:</span>
                <span className="ml-2 text-green-400">{formatCurrencyFull(evm.earnedValue)}</span>
              </div>
              <div>
                <span className="text-gray-400">Actual Cost:</span>
                <span className={`ml-2 ${evm.actualCost <= evm.earnedValue ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrencyFull(evm.actualCost)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Cost Trend & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Cost Trend Chart */}
        <Card className="bg-dark-card border-gray-700 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <TrendingUp aria-hidden="true" className="h-5 w-5 text-blue-400" />
              Daily Cost Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyCosts}>
                <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.gray[700]} />
                <XAxis 
                  dataKey="date" 
                  stroke={neutralColors.gray[400]}
                  tick={{ fill: neutralColors.gray[400], fontSize: 11 }}
                  tickFormatter={(value) => format(new Date(value), 'M/d')}
                />
                <YAxis 
                  stroke={neutralColors.gray[400]}
                  tick={{ fill: neutralColors.gray[400], fontSize: 11 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: backgroundColors.dark.card, border: `1px solid ${borderColors.dark.subtle}`, borderRadius: '8px' }}
                  labelStyle={{ color: neutralColors.gray[400] }}
                  formatter={(value: number) => [formatCurrencyFull(value), '']}
                />
                <Legend />
                <Area type="monotone" dataKey="labor" stackId="1" stroke={chartColors.palette[1]} fill={chartColors.palette[1]} fillOpacity={0.6} name="Labor" />
                <Area type="monotone" dataKey="material" stackId="1" stroke={chartColors.palette[0]} fill={chartColors.palette[0]} fillOpacity={0.6} name="Materials" />
                <Area type="monotone" dataKey="equipment" stackId="1" stroke={chartColors.palette[2]} fill={chartColors.palette[2]} fillOpacity={0.6} name="Equipment" />
                <Area type="monotone" dataKey="subcontractor" stackId="1" stroke={chartColors.palette[4]} fill={chartColors.palette[4]} fillOpacity={0.6} name="Subcontractors" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost Breakdown Pie Chart */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <PieChartIcon aria-hidden="true" className="h-5 w-5 text-green-400" />
              Cost by Trade
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: backgroundColors.dark.card, border: `1px solid ${borderColors.dark.subtle}`, borderRadius: '8px' }}
                      formatter={(value: number) => formatCurrencyFull(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {pieData.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }} 
                        />
                        <span className="text-gray-300 truncate max-w-[120px]">{item.name}</span>
                      </div>
                      <span className="text-white">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                No cost data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Actual by Category */}
      <Card className="bg-dark-card border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Budget vs Actual by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costBreakdown.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.gray[700]} />
              <XAxis type="number" stroke={neutralColors.gray[400]} tickFormatter={formatCurrency} />
              <YAxis 
                type="category" 
                dataKey="category" 
                stroke={neutralColors.gray[400]} 
                tick={{ fill: neutralColors.gray[400], fontSize: 11 }}
                width={100}
              />
              <Tooltip
                contentStyle={{ backgroundColor: backgroundColors.dark.card, border: `1px solid ${borderColors.dark.subtle}`, borderRadius: '8px' }}
                formatter={(value: number) => formatCurrencyFull(value)}
              />
              <Legend />
              <Bar dataKey="budgeted" fill={chartColors.palette[1]} name="Budgeted" radius={[0, 4, 4, 0]} />
              <Bar dataKey="actual" fill={chartColors.palette[0]} name="Actual" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
