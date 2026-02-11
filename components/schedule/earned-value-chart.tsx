"use client";

import { useState, useMemo } from 'react';
import { format, differenceInDays, eachWeekOfInterval, startOfWeek, endOfWeek, isBefore, isAfter } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Clock,
  BarChart2,
  LineChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { chartColors } from '@/lib/design-tokens';

// Types for earned value data
export interface ScheduleTask {
  id: string;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  duration: number;
  percentComplete: number;
  budgetedCost: number;
  actualCost: number;
  baselineStartDate?: Date | string | null;
  baselineEndDate?: Date | string | null;
}

export interface CostEntry {
  date: Date | string;
  category: string;
  amount: number;
  description?: string;
}

export interface EarnedValueChartProps {
  tasks: ScheduleTask[];
  costEntries: CostEntry[];
  projectStartDate: Date;
  projectEndDate: Date;
  projectBudget: number;
}

interface WeeklyEVData {
  weekStart: Date;
  weekEnd: Date;
  // Cumulative values
  plannedValue: number; // PV (BCWS - Budgeted Cost of Work Scheduled)
  earnedValue: number;  // EV (BCWP - Budgeted Cost of Work Performed)
  actualCost: number;   // AC (ACWP - Actual Cost of Work Performed)
  // Periodic values
  weeklyPV: number;
  weeklyEV: number;
  weeklyAC: number;
}

export function EarnedValueChart({
  tasks,
  costEntries,
  projectStartDate,
  projectEndDate,
  projectBudget
}: EarnedValueChartProps) {
  const [showPV, setShowPV] = useState(true);
  const [showEV, setShowEV] = useState(true);
  const [showAC, setShowAC] = useState(true);
  const [showForecasts, setShowForecasts] = useState(true);

  // Calculate weekly earned value data
  const weeklyData = useMemo((): WeeklyEVData[] => {
    const weeks = eachWeekOfInterval({ start: projectStartDate, end: projectEndDate });
    const today = new Date();
    
    let cumulativePV = 0;
    let cumulativeEV = 0;
    let cumulativeAC = 0;
    
    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const isComplete = isBefore(weekEnd, today);
      const isCurrent = !isBefore(weekEnd, today) && !isAfter(weekStart, today);
      
      // Calculate Planned Value (PV) - budgeted cost of work scheduled by this week
      let weeklyPV = 0;
      tasks.forEach(task => {
        const taskStart = new Date(task.baselineStartDate || task.startDate);
        const taskEnd = new Date(task.baselineEndDate || task.endDate);
        const taskDuration = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
        const dailyBudget = task.budgetedCost / taskDuration;
        
        // Calculate how much of this task should be complete by this week
        if (taskStart <= weekEnd) {
          const effectiveEnd = taskEnd < weekEnd ? taskEnd : weekEnd;
          const effectiveStart = taskStart > startOfWeek(weekStart) ? taskStart : startOfWeek(weekStart);
          
          if (effectiveEnd >= effectiveStart) {
            const daysInWeek = Math.min(
              differenceInDays(effectiveEnd, effectiveStart) + 1,
              7
            );
            weeklyPV += dailyBudget * daysInWeek;
          }
        }
      });
      
      // Calculate Earned Value (EV) - budgeted cost of work actually performed
      let weeklyEV = 0;
      if (isComplete || isCurrent) {
        tasks.forEach(task => {
          const taskStart = new Date(task.startDate);
          const taskEnd = new Date(task.endDate);
          
          // Only count EV for tasks that have started
          if (taskStart <= weekEnd) {
            // For current/past weeks, use actual progress
            const earnedThisTask = task.budgetedCost * (task.percentComplete / 100);
            
            // Distribute EV across the task duration
            const taskDuration = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
            const weekProgress = task.percentComplete / 100;
            const effectiveEndForTask = new Date(Math.min(weekEnd.getTime(), taskEnd.getTime()));
            
            if (taskStart <= effectiveEndForTask) {
              const daysComplete = differenceInDays(effectiveEndForTask, taskStart) + 1;
              const ratioComplete = Math.min(1, daysComplete / taskDuration);
              weeklyEV += earnedThisTask * ratioComplete;
            }
          }
        });
      }
      
      // Calculate Actual Cost (AC) - actual cost of work performed
      let weeklyAC = 0;
      if (isComplete || isCurrent) {
        costEntries.forEach(entry => {
          const entryDate = new Date(entry.date);
          if (entryDate >= weekStart && entryDate <= weekEnd) {
            weeklyAC += entry.amount;
          }
        });
        
        // Also add actual costs from tasks
        tasks.forEach(task => {
          const taskStart = new Date(task.startDate);
          const taskEnd = new Date(task.endDate);
          const taskDuration = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
          
          if (taskStart <= weekEnd && task.actualCost > 0) {
            const effectiveEnd = taskEnd < weekEnd ? taskEnd : weekEnd;
            const effectiveStart = taskStart > weekStart ? taskStart : weekStart;
            
            if (effectiveEnd >= effectiveStart) {
              const daysInWeek = differenceInDays(effectiveEnd, effectiveStart) + 1;
              const dailyActual = task.actualCost / taskDuration;
              weeklyAC += dailyActual * daysInWeek;
            }
          }
        });
      }
      
      cumulativePV += weeklyPV;
      cumulativeEV += weeklyEV;
      cumulativeAC += weeklyAC;
      
      return {
        weekStart,
        weekEnd,
        plannedValue: cumulativePV,
        earnedValue: cumulativeEV,
        actualCost: cumulativeAC,
        weeklyPV,
        weeklyEV,
        weeklyAC
      };
    });
  }, [tasks, costEntries, projectStartDate, projectEndDate]);

  // Calculate performance indices and forecasts
  const metrics = useMemo(() => {
    const today = new Date();
    const currentWeekData = weeklyData.find(w => 
      w.weekStart <= today && w.weekEnd >= today
    ) || weeklyData[weeklyData.length - 1];
    
    if (!currentWeekData) {
      return {
        pv: 0, ev: 0, ac: 0,
        cv: 0, sv: 0,
        cpi: 1, spi: 1,
        eac: projectBudget,
        etc: projectBudget,
        vac: 0,
        tcpi: 1,
        percentComplete: 0,
        percentSpent: 0
      };
    }
    
    const pv = currentWeekData.plannedValue;
    const ev = currentWeekData.earnedValue;
    const ac = currentWeekData.actualCost;
    
    // Cost Variance: EV - AC (positive = under budget)
    const cv = ev - ac;
    // Schedule Variance: EV - PV (positive = ahead of schedule)
    const sv = ev - pv;
    
    // Cost Performance Index: EV / AC (>1 = under budget)
    const cpi = ac > 0 ? ev / ac : 1;
    // Schedule Performance Index: EV / PV (>1 = ahead of schedule)
    const spi = pv > 0 ? ev / pv : 1;
    
    // Estimate at Completion: BAC / CPI
    const eac = cpi > 0 ? projectBudget / cpi : projectBudget;
    // Estimate to Complete: EAC - AC
    const etc = eac - ac;
    // Variance at Completion: BAC - EAC
    const vac = projectBudget - eac;
    // To Complete Performance Index
    const tcpi = (projectBudget - ev) > 0 ? (projectBudget - ev) / (projectBudget - ac) : 1;
    
    const percentComplete = projectBudget > 0 ? (ev / projectBudget) * 100 : 0;
    const percentSpent = projectBudget > 0 ? (ac / projectBudget) * 100 : 0;
    
    return { pv, ev, ac, cv, sv, cpi, spi, eac, etc, vac, tcpi, percentComplete, percentSpent };
  }, [weeklyData, projectBudget]);

  // Calculate max value for chart scaling
  const maxValue = useMemo(() => {
    const allValues = weeklyData.flatMap(w => [
      w.plannedValue, w.earnedValue, w.actualCost
    ]);
    return Math.max(...allValues, projectBudget, 1);
  }, [weeklyData, projectBudget]);

  // Find current week index
  const currentWeekIndex = useMemo(() => {
    const today = new Date();
    return weeklyData.findIndex(w => w.weekStart <= today && w.weekEnd >= today);
  }, [weeklyData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <TooltipProvider>
      <Card className="bg-dark-surface border-gray-700 p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-purple-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-gray-200">Earned Value Analysis</h3>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px]",
                  metrics.spi >= 1 && metrics.cpi >= 1 
                    ? "border-green-500/50 text-green-400"
                    : metrics.spi < 0.9 || metrics.cpi < 0.9
                    ? "border-red-500/50 text-red-400"
                    : "border-amber-500/50 text-amber-400"
                )}
              >
                {metrics.spi >= 1 && metrics.cpi >= 1 ? 'On Track' :
                 metrics.spi < 0.9 || metrics.cpi < 0.9 ? 'At Risk' : 'Watch'}
              </Badge>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-pv"
                  checked={showPV}
                  onCheckedChange={setShowPV}
                  className="data-[state=checked]:bg-blue-500"
                />
                <Label htmlFor="show-pv" className="text-xs text-gray-400">PV</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-ev"
                  checked={showEV}
                  onCheckedChange={setShowEV}
                  className="data-[state=checked]:bg-green-500"
                />
                <Label htmlFor="show-ev" className="text-xs text-gray-400">EV</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-ac"
                  checked={showAC}
                  onCheckedChange={setShowAC}
                  className="data-[state=checked]:bg-amber-500"
                />
                <Label htmlFor="show-ac" className="text-xs text-gray-400">AC</Label>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-6 gap-2">
            {/* CPI */}
            <div className="bg-dark-card rounded-lg p-2">
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                <DollarSign className="h-3 w-3" aria-hidden="true" />
                CPI
              </div>
              <div className={cn(
                "text-lg font-bold",
                metrics.cpi >= 1 ? "text-green-400" : 
                metrics.cpi >= 0.9 ? "text-amber-400" : "text-red-400"
              )}>
                {metrics.cpi.toFixed(2)}
              </div>
              <div className="text-[9px] text-gray-400">
                {metrics.cpi >= 1 ? 'Under Budget' : 'Over Budget'}
              </div>
            </div>
            
            {/* SPI */}
            <div className="bg-dark-card rounded-lg p-2">
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                <Clock className="h-3 w-3" aria-hidden="true" />
                SPI
              </div>
              <div className={cn(
                "text-lg font-bold",
                metrics.spi >= 1 ? "text-green-400" : 
                metrics.spi >= 0.9 ? "text-amber-400" : "text-red-400"
              )}>
                {metrics.spi.toFixed(2)}
              </div>
              <div className="text-[9px] text-gray-400">
                {metrics.spi >= 1 ? 'Ahead' : 'Behind'}
              </div>
            </div>
            
            {/* Cost Variance */}
            <div className="bg-dark-card rounded-lg p-2">
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                {metrics.cv >= 0 ? (
                  <TrendingDown className="h-3 w-3 text-green-400" aria-hidden="true" />
                ) : (
                  <TrendingUp className="h-3 w-3 text-red-400" aria-hidden="true" />
                )}
                CV
              </div>
              <div className={cn(
                "text-lg font-bold",
                metrics.cv >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(Math.abs(metrics.cv))}
              </div>
              <div className="text-[9px] text-gray-400">
                {metrics.cv >= 0 ? 'Under' : 'Over'}
              </div>
            </div>
            
            {/* Schedule Variance */}
            <div className="bg-dark-card rounded-lg p-2">
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                <Activity className="h-3 w-3" aria-hidden="true" />
                SV
              </div>
              <div className={cn(
                "text-lg font-bold",
                metrics.sv >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(Math.abs(metrics.sv))}
              </div>
              <div className="text-[9px] text-gray-400">
                {metrics.sv >= 0 ? 'Ahead' : 'Behind'}
              </div>
            </div>
            
            {/* EAC */}
            <div className="bg-dark-card rounded-lg p-2">
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                <Target className="h-3 w-3" aria-hidden="true" />
                EAC
              </div>
              <div className={cn(
                "text-lg font-bold",
                metrics.eac <= projectBudget ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(metrics.eac)}
              </div>
              <div className="text-[9px] text-gray-400">
                Forecast Total
              </div>
            </div>
            
            {/* VAC */}
            <div className="bg-dark-card rounded-lg p-2">
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                {metrics.vac >= 0 ? (
                  <CheckCircle2 className="h-3 w-3 text-green-400" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-red-400" aria-hidden="true" />
                )}
                VAC
              </div>
              <div className={cn(
                "text-lg font-bold",
                metrics.vac >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {metrics.vac >= 0 ? '+' : ''}{formatCurrency(metrics.vac)}
              </div>
              <div className="text-[9px] text-gray-400">
                {metrics.vac >= 0 ? 'Under Est.' : 'Over Est.'}
              </div>
            </div>
          </div>

          {/* S-Curve Chart */}
          <div className="relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-[10px] text-gray-400 pr-1 text-right">
              <span>{formatCurrency(maxValue)}</span>
              <span>{formatCurrency(maxValue * 0.75)}</span>
              <span>{formatCurrency(maxValue * 0.5)}</span>
              <span>{formatCurrency(maxValue * 0.25)}</span>
              <span>$0</span>
            </div>
            
            {/* Chart area */}
            <div className="ml-14 overflow-x-auto">
              <div className="relative h-48 min-w-[600px]">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="border-t border-gray-700/50" />
                  ))}
                </div>
                
                {/* Budget line */}
                <div 
                  className="absolute left-0 right-0 border-t-2 border-dashed border-purple-500/50 pointer-events-none"
                  style={{ top: `${100 - (projectBudget / maxValue) * 100}%` }}
                >
                  <span className="absolute right-0 -top-4 text-[10px] text-purple-400 bg-dark-surface px-1">
                    BAC: {formatCurrency(projectBudget)}
                  </span>
                </div>
                
                {/* Current week indicator */}
                {currentWeekIndex >= 0 && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-500/50 pointer-events-none"
                    style={{ left: `${(currentWeekIndex / weeklyData.length) * 100}%` }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 bg-dark-surface px-1 whitespace-nowrap">
                      Today
                    </div>
                  </div>
                )}
                
                {/* SVG for curves */}
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                  {/* PV Line (Planned Value) */}
                  {showPV && (
                    <polyline
                      fill="none"
                      stroke={chartColors.neutral}
                      strokeWidth="2"
                      strokeDasharray="4,2"
                      points={weeklyData.map((w, i) => {
                        const x = (i / (weeklyData.length - 1)) * 100;
                        const y = 100 - (w.plannedValue / maxValue) * 100;
                        return `${x}%,${y}%`;
                      }).join(' ')}
                    />
                  )}

                  {/* EV Line (Earned Value) */}
                  {showEV && currentWeekIndex >= 0 && (
                    <polyline
                      fill="none"
                      stroke={chartColors.positive}
                      strokeWidth="2.5"
                      points={weeklyData.slice(0, currentWeekIndex + 1).map((w, i) => {
                        const x = (i / (weeklyData.length - 1)) * 100;
                        const y = 100 - (w.earnedValue / maxValue) * 100;
                        return `${x}%,${y}%`;
                      }).join(' ')}
                    />
                  )}

                  {/* AC Line (Actual Cost) */}
                  {showAC && currentWeekIndex >= 0 && (
                    <polyline
                      fill="none"
                      stroke={chartColors.warning}
                      strokeWidth="2"
                      points={weeklyData.slice(0, currentWeekIndex + 1).map((w, i) => {
                        const x = (i / (weeklyData.length - 1)) * 100;
                        const y = 100 - (w.actualCost / maxValue) * 100;
                        return `${x}%,${y}%`;
                      }).join(' ')}
                    />
                  )}

                  {/* EAC Forecast Line */}
                  {showForecasts && currentWeekIndex >= 0 && currentWeekIndex < weeklyData.length - 1 && (
                    <polyline
                      fill="none"
                      stroke={chartColors.negative}
                      strokeWidth="1.5"
                      strokeDasharray="6,3"
                      opacity="0.6"
                      points={[
                        `${(currentWeekIndex / (weeklyData.length - 1)) * 100}%,${100 - (weeklyData[currentWeekIndex].actualCost / maxValue) * 100}%`,
                        `100%,${100 - (metrics.eac / maxValue) * 100}%`
                      ].join(' ')}
                    />
                  )}
                </svg>
                
                {/* Data points with tooltips */}
                <div className="absolute inset-0">
                  {weeklyData.map((week, idx) => {
                    const x = (idx / (weeklyData.length - 1)) * 100;
                    const showPoint = idx <= currentWeekIndex || idx % 4 === 0;
                    
                    if (!showPoint) return null;
                    
                    return (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <div 
                            className="absolute w-4 h-full cursor-pointer hover:bg-white/5"
                            style={{ left: `calc(${x}% - 8px)` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-dark-surface border-gray-700 p-3">
                          <div className="space-y-2">
                            <div className="font-medium text-gray-200">
                              {format(week.weekStart, 'MMM d')} - {format(week.weekEnd, 'MMM d')}
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <span className="text-blue-400">PV:</span>
                              <span className="text-gray-300">{formatCurrency(week.plannedValue)}</span>
                              {idx <= currentWeekIndex && (
                                <>
                                  <span className="text-green-400">EV:</span>
                                  <span className="text-gray-300">{formatCurrency(week.earnedValue)}</span>
                                  <span className="text-amber-400">AC:</span>
                                  <span className="text-gray-300">{formatCurrency(week.actualCost)}</span>
                                </>
                              )}
                            </div>
                            {idx <= currentWeekIndex && (
                              <div className="pt-2 border-t border-gray-700 text-[10px]">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">CPI:</span>
                                  <span className={week.actualCost > 0 ? 
                                    (week.earnedValue / week.actualCost >= 1 ? 'text-green-400' : 'text-red-400') : 
                                    'text-gray-400'
                                  }>
                                    {week.actualCost > 0 ? (week.earnedValue / week.actualCost).toFixed(2) : 'N/A'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">SPI:</span>
                                  <span className={week.plannedValue > 0 ? 
                                    (week.earnedValue / week.plannedValue >= 1 ? 'text-green-400' : 'text-red-400') : 
                                    'text-gray-400'
                                  }>
                                    {week.plannedValue > 0 ? (week.earnedValue / week.plannedValue).toFixed(2) : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
              
              {/* X-axis labels */}
              <div className="flex mt-1">
                {weeklyData.filter((_, i) => i % Math.ceil(weeklyData.length / 8) === 0 || i === weeklyData.length - 1).map((week, idx) => (
                  <div 
                    key={idx}
                    className="text-[10px] text-gray-400"
                    style={{ flex: 1 }}
                  >
                    {format(week.weekStart, 'MMM d')}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-xs border-t border-gray-700 pt-3">
            {showPV && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-blue-500" style={{ borderStyle: 'dashed' }} />
                <span className="text-gray-400">Planned Value (PV)</span>
              </div>
            )}
            {showEV && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-green-500" />
                <span className="text-gray-400">Earned Value (EV)</span>
              </div>
            )}
            {showAC && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-amber-500" />
                <span className="text-gray-400">Actual Cost (AC)</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-purple-500 border-t-2 border-dashed" />
              <span className="text-gray-400">Budget (BAC)</span>
            </div>
          </div>

          {/* Progress bars */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Work Complete</span>
                <span className="text-green-400">{metrics.percentComplete.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${Math.min(100, metrics.percentComplete)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Budget Spent</span>
                <span className={metrics.percentSpent > metrics.percentComplete ? 'text-red-400' : 'text-amber-400'}>
                  {metrics.percentSpent.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all",
                    metrics.percentSpent > metrics.percentComplete ? 'bg-red-500' : 'bg-amber-500'
                  )}
                  style={{ width: `${Math.min(100, metrics.percentSpent)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
}
