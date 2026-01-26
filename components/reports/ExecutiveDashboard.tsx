'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, 
  DollarSign, Calendar, Users, FileText, Activity, Briefcase,
  ArrowUp, ArrowDown, Minus, RefreshCw
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'good' | 'warning' | 'critical';
  icon: React.ReactNode;
}

function KPICard({ title, value, subtitle, trend, trendValue, status, icon }: KPICardProps) {
  const statusColors = {
    good: 'border-green-500/30 bg-green-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    critical: 'border-red-500/30 bg-red-500/5'
  };

  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    stable: 'text-gray-400'
  };

  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;

  return (
    <div className={`p-4 rounded-lg border ${status ? statusColors[status] : 'border-gray-700 bg-gray-800/50'}`}>
      <div className="flex items-start justify-between">
        <div className="text-gray-400">{icon}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trendColors[trend]}`}>
            <TrendIcon className="w-3 h-3" />
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-gray-400">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

interface ExecutiveDashboardProps {
  projectId: string;
  projectSlug: string;
}

export default function ExecutiveDashboard({ projectId, projectSlug }: ExecutiveDashboardProps) {
  const [kpis, setKpis] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [kpiRes, trendsRes, costRes] = await Promise.all([
        fetch(`/api/projects/${projectSlug}/analytics/kpis`),
        fetch(`/api/projects/${projectSlug}/analytics/trends?period=weekly&lookback=8`),
        fetch(`/api/projects/${projectSlug}/analytics/cost-breakdown`)
      ]);

      if (kpiRes.ok) {
        const kpiData = await kpiRes.json();
        setKpis(kpiData);
      }
      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setTrends(trendsData);
      }
      if (costRes.ok) {
        const costData = await costRes.json();
        setCostBreakdown(costData.slice(0, 6));
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectSlug]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const getSPIStatus = (spi: number) => spi >= 0.95 ? 'good' : spi >= 0.85 ? 'warning' : 'critical';
  const getCPIStatus = (cpi: number) => cpi >= 0.95 ? 'good' : cpi >= 0.85 ? 'warning' : 'critical';

  const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Executive Dashboard</h2>
          <p className="text-gray-400">Real-time project performance overview</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Project Progress"
          value={`${kpis?.percentComplete || 0}%`}
          subtitle={`${kpis?.daysRemaining || 0} days remaining`}
          icon={<Activity className="w-5 h-5" />}
          status={kpis?.percentComplete >= 80 ? 'good' : kpis?.percentComplete >= 50 ? 'warning' : 'critical'}
        />
        <KPICard
          title="Schedule Performance (SPI)"
          value={kpis?.schedulePerformanceIndex || 0}
          subtitle={`Variance: ${kpis?.scheduleVariance || 0}%`}
          trend={kpis?.schedulePerformanceIndex >= 1 ? 'up' : 'down'}
          icon={<Calendar className="w-5 h-5" />}
          status={getSPIStatus(kpis?.schedulePerformanceIndex || 0)}
        />
        <KPICard
          title="Cost Performance (CPI)"
          value={kpis?.costPerformanceIndex || 0}
          subtitle={`Budget: ${kpis?.budgetUtilization || 0}% used`}
          trend={kpis?.costPerformanceIndex >= 1 ? 'up' : 'down'}
          icon={<DollarSign className="w-5 h-5" />}
          status={getCPIStatus(kpis?.costPerformanceIndex || 0)}
        />
        <KPICard
          title="Safety Score"
          value={kpis?.safetyScore || 0}
          subtitle={`${kpis?.daysWithoutIncident || 0} days without incident`}
          icon={<CheckCircle className="w-5 h-5" />}
          status={kpis?.safetyScore >= 90 ? 'good' : kpis?.safetyScore >= 75 ? 'warning' : 'critical'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Trend Chart */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Progress vs Plan</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Area type="monotone" dataKey="plannedProgress" name="Planned" stroke="#6B7280" fill="#374151" fillOpacity={0.3} />
              <Area type="monotone" dataKey="actualProgress" name="Actual" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Breakdown Chart */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Cost by Division</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={250}>
              <PieChart>
                <Pie
                  data={costBreakdown}
                  dataKey="budgeted"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {costBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(value) => value !== undefined ? [`$${Number(value).toLocaleString()}`, 'Budget'] : ['', '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/2 space-y-2">
              {costBreakdown.map((item, index) => (
                <div key={item.category} className="flex items-center gap-2 text-sm">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                  />
                  <span className="text-gray-400 truncate">{item.category}</span>
                  <span className="text-white ml-auto">{item.percentOfBudget}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard
          title="Tasks On Track"
          value={kpis?.tasksOnTrack || 0}
          icon={<CheckCircle className="w-4 h-4" />}
        />
        <KPICard
          title="Tasks Delayed"
          value={kpis?.tasksDelayed || 0}
          icon={<AlertTriangle className="w-4 h-4" />}
          status={kpis?.tasksDelayed > 3 ? 'warning' : undefined}
        />
        <KPICard
          title="Critical Path Tasks"
          value={kpis?.criticalPathTasks || 0}
          icon={<Clock className="w-4 h-4" />}
        />
        <KPICard
          title="Change Orders"
          value={kpis?.changeOrderCount || 0}
          subtitle={`${kpis?.pendingChangeOrders || 0} pending`}
          icon={<FileText className="w-4 h-4" />}
        />
        <KPICard
          title="Daily Reports"
          value={kpis?.dailyReportCount || 0}
          subtitle="Last 30 days"
          icon={<Briefcase className="w-4 h-4" />}
        />
        <KPICard
          title="Documents"
          value={kpis?.totalDocuments || 0}
          subtitle={`${kpis?.documentsProcessed || 0} processed`}
          icon={<FileText className="w-4 h-4" />}
        />
      </div>

      {/* EVM Metrics */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Earned Value Metrics</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trends.slice(-6)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value) => value !== undefined ? [`$${Number(value).toLocaleString()}`, ''] : ['', '']}
            />
            <Bar dataKey="plannedCost" name="Planned Value (PV)" fill="#6B7280" />
            <Bar dataKey="actualCost" name="Actual Cost (AC)" fill="#EF4444" />
            <Bar dataKey="earnedValue" name="Earned Value (EV)" fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-8 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-500" />
            <span className="text-gray-400">Planned Value</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-gray-400">Actual Cost</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-gray-400">Earned Value</span>
          </div>
        </div>
      </div>
    </div>
  );
}
