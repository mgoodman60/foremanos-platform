"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar,
  AlertTriangle, CheckCircle2, BarChart3, Activity,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

interface Budget {
  total: number;
  contingency: number;
  actualCost: number;
  committedCost: number;
}

interface EVMData {
  current: EVMMetrics;
  history: any[];
  budget: Budget;
}

export default function EVMDashboard() {
  const params = useParams();
  const slug = params?.slug as string;

  const [data, setData] = useState<EVMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (slug) {
      fetchEVMData();
    }
  }, [slug, days]);

  const fetchEVMData = async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/evm?days=${days}`);
      if (response.ok) {
        const evmData = await response.json();
        setData(evmData);
      } else if (response.status === 404) {
        // Budget not configured
        setData(null);
      } else {
        toast.error('Failed to load EVM data');
      }
    } catch (error) {
      console.error('Error fetching EVM data:', error);
      toast.error('Failed to load EVM data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPerformanceColor = (value: number, isVariance: boolean = false) => {
    if (isVariance) {
      if (value > 0) return 'text-green-400';
      if (value < 0) return 'text-red-400';
      return 'text-gray-400';
    }
    
    // For indices (CPI, SPI)
    if (value >= 1.0) return 'text-green-400';
    if (value >= 0.9) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getPerformanceStatus = (cpi: number, spi: number) => {
    const avgIndex = (cpi + spi) / 2;
    if (avgIndex >= 1.0) return { label: 'On Track', color: 'bg-green-500', icon: CheckCircle2 };
    if (avgIndex >= 0.9) return { label: 'At Risk', color: 'bg-yellow-500', icon: AlertTriangle };
    return { label: 'Off Track', color: 'bg-red-500', icon: AlertTriangle };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading EVM metrics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="py-12 text-center">
          <BarChart3 aria-hidden="true" className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-400 mb-2">Project budget not configured</p>
          <p className="text-sm text-gray-400">
            Configure your project budget to track Earned Value Management metrics
          </p>
        </CardContent>
      </Card>
    );
  }

  const { current, budget } = data;
  const status = getPerformanceStatus(current.costPerformanceIndex, current.schedulePerformanceIndex);
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-50">Earned Value Management</h2>
          <p className="text-gray-400 mt-1">Track project cost and schedule performance</p>
        </div>
        <Badge className={`${status.color} text-white flex items-center gap-2 px-3 py-1`}>
          <StatusIcon className="w-4 h-4" />
          {status.label}
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Planned Value */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <Calendar aria-hidden="true" className="w-4 h-4 mr-2" />
              Planned Value (PV)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">
              {formatCurrency(current.plannedValue)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Budgeted cost of work scheduled
            </p>
          </CardContent>
        </Card>

        {/* Earned Value */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <CheckCircle2 aria-hidden="true" className="w-4 h-4 mr-2" />
              Earned Value (EV)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">
              {formatCurrency(current.earnedValue)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Budgeted cost of work performed
            </p>
          </CardContent>
        </Card>

        {/* Actual Cost */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <DollarSign aria-hidden="true" className="w-4 h-4 mr-2" />
              Actual Cost (AC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">
              {formatCurrency(current.actualCost)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Actual cost of work performed
            </p>
          </CardContent>
        </Card>

        {/* Budget at Completion */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <BarChart3 aria-hidden="true" className="w-4 h-4 mr-2" />
              Budget at Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">
              {formatCurrency(budget.total)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Total project budget
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Indices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cost Performance Index */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader>
            <CardTitle className="text-slate-50">Cost Performance Index (CPI)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className={`text-3xl font-bold ${getPerformanceColor(current.costPerformanceIndex)}`}>
                {current.costPerformanceIndex.toFixed(2)}
              </div>
              <div className="flex items-center gap-2">
                {current.costPerformanceIndex >= 1.0 ? (
                  <ArrowUpRight aria-hidden="true" className="w-5 h-5 text-green-400" />
                ) : (
                  <ArrowDownRight aria-hidden="true" className="w-5 h-5 text-red-400" />
                )}
                <Badge variant={current.costPerformanceIndex >= 1.0 ? "default" : "destructive"}>
                  {current.costPerformanceIndex >= 1.0 ? 'Under Budget' : 'Over Budget'}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cost Variance:</span>
                <span className={`font-semibold ${getPerformanceColor(current.costVariance, true)}`}>
                  {formatCurrency(current.costVariance)}
                </span>
              </div>
              <Progress
                value={Math.min(current.costPerformanceIndex * 100, 100)}
                className="h-2"
              />
            </div>
            <p className="text-xs text-gray-400">
              {current.costPerformanceIndex >= 1.0
                ? `For every $1 spent, you're getting $${current.costPerformanceIndex.toFixed(2)} worth of work`
                : `You're spending $${(1 / current.costPerformanceIndex).toFixed(2)} for every $1 worth of work`
              }
            </p>
          </CardContent>
        </Card>

        {/* Schedule Performance Index */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader>
            <CardTitle className="text-slate-50">Schedule Performance Index (SPI)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className={`text-3xl font-bold ${getPerformanceColor(current.schedulePerformanceIndex)}`}>
                {current.schedulePerformanceIndex.toFixed(2)}
              </div>
              <div className="flex items-center gap-2">
                {current.schedulePerformanceIndex >= 1.0 ? (
                  <ArrowUpRight aria-hidden="true" className="w-5 h-5 text-green-400" />
                ) : (
                  <ArrowDownRight aria-hidden="true" className="w-5 h-5 text-red-400" />
                )}
                <Badge variant={current.schedulePerformanceIndex >= 1.0 ? "default" : "destructive"}>
                  {current.schedulePerformanceIndex >= 1.0 ? 'Ahead of Schedule' : 'Behind Schedule'}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Schedule Variance:</span>
                <span className={`font-semibold ${getPerformanceColor(current.scheduleVariance, true)}`}>
                  {formatCurrency(current.scheduleVariance)}
                </span>
              </div>
              <Progress
                value={Math.min(current.schedulePerformanceIndex * 100, 100)}
                className="h-2"
              />
            </div>
            <p className="text-xs text-gray-400">
              {current.schedulePerformanceIndex >= 1.0
                ? `You're completing work ${((current.schedulePerformanceIndex - 1) * 100).toFixed(0)}% faster than planned`
                : `You're ${((1 - current.schedulePerformanceIndex) * 100).toFixed(0)}% behind schedule`
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Estimate at Completion */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <Activity aria-hidden="true" className="w-4 h-4 mr-2" />
              Estimate at Completion (EAC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">
              {formatCurrency(current.estimateAtCompletion)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Projected total cost at completion
            </p>
          </CardContent>
        </Card>

        {/* Estimate to Complete */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <TrendingUp aria-hidden="true" className="w-4 h-4 mr-2" />
              Estimate to Complete (ETC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">
              {formatCurrency(current.estimateToComplete)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Estimated cost to finish remaining work
            </p>
          </CardContent>
        </Card>

        {/* Variance at Completion */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <AlertTriangle aria-hidden="true" className="w-4 h-4 mr-2" />
              Variance at Completion (VAC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(current.varianceAtCompletion, true)}`}>
              {formatCurrency(current.varianceAtCompletion)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {current.varianceAtCompletion >= 0
                ? 'Expected to finish under budget'
                : 'Expected to finish over budget'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card className="bg-dark-card border-gray-700">
        <CardHeader>
          <CardTitle className="text-slate-50">Project Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Work Completed</span>
              <span className="text-slate-50 font-semibold">{current.percentComplete.toFixed(1)}%</span>
            </div>
            <Progress value={current.percentComplete} className="h-3" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Budget Spent</span>
              <span className="text-slate-50 font-semibold">{current.percentSpent.toFixed(1)}%</span>
            </div>
            <Progress value={current.percentSpent} className="h-3" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
            <div>
              <p className="text-xs text-gray-400">Actual Cost to Date</p>
              <p className="text-lg font-semibold text-slate-50">{formatCurrency(current.actualCost)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Remaining Budget</p>
              <p className="text-lg font-semibold text-slate-50">
                {formatCurrency(budget.total - current.actualCost)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
