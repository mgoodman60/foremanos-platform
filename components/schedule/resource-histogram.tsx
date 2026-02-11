"use client";

import { useState, useMemo } from 'react';
import { format, addDays, differenceInDays, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart3,
  Users,
  Truck,
  HardHat,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { semanticColors, neutralColors, chartColors, secondaryColors } from '@/lib/design-tokens';

// Types for resource data
export interface LaborEntry {
  date: Date | string;
  tradeName: string;
  workerCount: number;
  regularHours: number;
  overtimeHours: number;
  totalCost: number;
}

export interface EquipmentEntry {
  date: Date | string;
  equipmentName: string;
  equipmentType: string;
  hoursUsed: number;
  dailyRate: number;
  totalCost: number;
}

export interface TaskResource {
  taskId: string;
  taskName: string;
  startDate: Date | string;
  endDate: Date | string;
  tradeName: string;
  plannedWorkers: number;
  budgetedCost: number;
}

export interface ResourceHistogramProps {
  laborEntries: LaborEntry[];
  equipmentEntries: EquipmentEntry[];
  taskResources: TaskResource[];
  startDate: Date;
  endDate: Date;
  viewMode?: 'day' | 'week';
}

interface WeeklyResourceData {
  weekStart: Date;
  weekEnd: Date;
  trades: Record<string, {
    plannedWorkers: number;
    actualWorkers: number;
    plannedHours: number;
    actualHours: number;
    overtimeHours: number;
    plannedCost: number;
    actualCost: number;
  }>;
  totalPlannedWorkers: number;
  totalActualWorkers: number;
  totalPlannedCost: number;
  totalActualCost: number;
  equipment: Record<string, {
    hoursUsed: number;
    cost: number;
  }>;
}

// Trade colors for consistent visualization
const TRADE_COLORS: Record<string, string> = {
  'Electrical': semanticColors.info[500],
  'Plumbing': semanticColors.success[500],
  'HVAC': chartColors.palette[4],
  'Framing': semanticColors.warning[500],
  'Concrete': neutralColors.gray[500],
  'Drywall': chartColors.palette[5],
  'Painting': chartColors.palette[6],
  'Roofing': semanticColors.error[500],
  'Masonry': neutralColors.gray[800],
  'Flooring': semanticColors.success[400],
  'General Labor': neutralColors.slate[600],
  'Superintendent': secondaryColors.blue[400],
  'default': neutralColors.slate[400]
};

function getTradeColor(tradeName: string): string {
  // Normalize trade name for matching
  const normalizedTrade = tradeName.toLowerCase();
  for (const [key, color] of Object.entries(TRADE_COLORS)) {
    if (normalizedTrade.includes(key.toLowerCase())) {
      return color;
    }
  }
  return TRADE_COLORS.default;
}

export function ResourceHistogram({
  laborEntries,
  equipmentEntries,
  taskResources,
  startDate,
  endDate,
  viewMode = 'week'
}: ResourceHistogramProps) {
  const [showPlanned, setShowPlanned] = useState(true);
  const [showActual, setShowActual] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [showEquipment, setShowEquipment] = useState(false);

  // Get unique trades from data
  const uniqueTrades = useMemo(() => {
    const trades = new Set<string>();
    laborEntries.forEach(entry => trades.add(entry.tradeName));
    taskResources.forEach(resource => trades.add(resource.tradeName));
    return Array.from(trades).sort();
  }, [laborEntries, taskResources]);

  // Process data into weekly buckets
  const weeklyData = useMemo((): WeeklyResourceData[] => {
    const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
    
    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const weekData: WeeklyResourceData = {
        weekStart,
        weekEnd,
        trades: {},
        totalPlannedWorkers: 0,
        totalActualWorkers: 0,
        totalPlannedCost: 0,
        totalActualCost: 0,
        equipment: {}
      };

      // Process planned resources from tasks
      taskResources.forEach(task => {
        const taskStart = new Date(task.startDate);
        const taskEnd = new Date(task.endDate);
        
        // Check if task overlaps with this week
        if (taskStart <= weekEnd && taskEnd >= weekStart) {
          const tradeName = task.tradeName || 'General Labor';
          if (!weekData.trades[tradeName]) {
            weekData.trades[tradeName] = {
              plannedWorkers: 0,
              actualWorkers: 0,
              plannedHours: 0,
              actualHours: 0,
              overtimeHours: 0,
              plannedCost: 0,
              actualCost: 0
            };
          }
          
          // Calculate overlap days
          const overlapStart = taskStart > weekStart ? taskStart : weekStart;
          const overlapEnd = taskEnd < weekEnd ? taskEnd : weekEnd;
          const overlapDays = Math.max(1, differenceInDays(overlapEnd, overlapStart) + 1);
          const taskDays = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
          const ratio = overlapDays / taskDays;
          
          weekData.trades[tradeName].plannedWorkers += Math.ceil(task.plannedWorkers * ratio);
          weekData.trades[tradeName].plannedHours += task.plannedWorkers * 8 * overlapDays;
          weekData.trades[tradeName].plannedCost += task.budgetedCost * ratio;
        }
      });

      // Process actual labor entries
      laborEntries.forEach(entry => {
        const entryDate = new Date(entry.date);
        if (entryDate >= weekStart && entryDate <= weekEnd) {
          const tradeName = entry.tradeName || 'General Labor';
          if (!weekData.trades[tradeName]) {
            weekData.trades[tradeName] = {
              plannedWorkers: 0,
              actualWorkers: 0,
              plannedHours: 0,
              actualHours: 0,
              overtimeHours: 0,
              plannedCost: 0,
              actualCost: 0
            };
          }
          
          weekData.trades[tradeName].actualWorkers += entry.workerCount;
          weekData.trades[tradeName].actualHours += entry.regularHours + entry.overtimeHours;
          weekData.trades[tradeName].overtimeHours += entry.overtimeHours;
          weekData.trades[tradeName].actualCost += entry.totalCost;
        }
      });

      // Process equipment entries
      equipmentEntries.forEach(entry => {
        const entryDate = new Date(entry.date);
        if (entryDate >= weekStart && entryDate <= weekEnd) {
          const equipType = entry.equipmentType || entry.equipmentName;
          if (!weekData.equipment[equipType]) {
            weekData.equipment[equipType] = { hoursUsed: 0, cost: 0 };
          }
          weekData.equipment[equipType].hoursUsed += entry.hoursUsed;
          weekData.equipment[equipType].cost += entry.totalCost;
        }
      });

      // Calculate totals
      Object.values(weekData.trades).forEach(trade => {
        weekData.totalPlannedWorkers += trade.plannedWorkers;
        weekData.totalActualWorkers += trade.actualWorkers;
        weekData.totalPlannedCost += trade.plannedCost;
        weekData.totalActualCost += trade.actualCost;
      });

      return weekData;
    });
  }, [laborEntries, taskResources, equipmentEntries, startDate, endDate]);

  // Calculate max values for scaling
  const maxWorkers = useMemo(() => {
    return Math.max(
      ...weeklyData.map(w => Math.max(w.totalPlannedWorkers, w.totalActualWorkers)),
      1
    );
  }, [weeklyData]);

  // Filter data by selected trade
  const filteredData = useMemo(() => {
    if (selectedTrade === 'all') return weeklyData;
    return weeklyData.map(week => ({
      ...week,
      totalPlannedWorkers: week.trades[selectedTrade]?.plannedWorkers || 0,
      totalActualWorkers: week.trades[selectedTrade]?.actualWorkers || 0,
      totalPlannedCost: week.trades[selectedTrade]?.plannedCost || 0,
      totalActualCost: week.trades[selectedTrade]?.actualCost || 0
    }));
  }, [weeklyData, selectedTrade]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalPlanned = weeklyData.reduce((sum, w) => sum + w.totalPlannedWorkers, 0);
    const totalActual = weeklyData.reduce((sum, w) => sum + w.totalActualWorkers, 0);
    const totalPlannedCost = weeklyData.reduce((sum, w) => sum + w.totalPlannedCost, 0);
    const totalActualCost = weeklyData.reduce((sum, w) => sum + w.totalActualCost, 0);
    const totalOvertime = laborEntries.reduce((sum, e) => sum + e.overtimeHours, 0);
    
    return {
      totalPlanned,
      totalActual,
      variance: totalActual - totalPlanned,
      variancePercent: totalPlanned > 0 ? ((totalActual - totalPlanned) / totalPlanned) * 100 : 0,
      totalPlannedCost,
      totalActualCost,
      costVariance: totalActualCost - totalPlannedCost,
      totalOvertime,
      peakWeek: weeklyData.reduce((max, w) => 
        Math.max(w.totalPlannedWorkers, w.totalActualWorkers) > Math.max(max.totalPlannedWorkers, max.totalActualWorkers) ? w : max
      , weeklyData[0])
    };
  }, [weeklyData, laborEntries]);

  return (
    <TooltipProvider>
      <Card className="bg-dark-surface border-gray-700 p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-gray-200">Resource Histogram</h3>
              <Badge variant="outline" className="border-blue-500/50 text-blue-400 text-[10px]">
                {uniqueTrades.length} Trades
              </Badge>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-3">
              <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                <SelectTrigger className="w-[150px] h-8 bg-dark-card border-gray-600 text-sm">
                  <SelectValue placeholder="All Trades" />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-600">
                  <SelectItem value="all">All Trades</SelectItem>
                  {uniqueTrades.map(trade => (
                    <SelectItem key={trade} value={trade}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: getTradeColor(trade) }}
                        />
                        {trade}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Switch
                  id="show-planned"
                  checked={showPlanned}
                  onCheckedChange={setShowPlanned}
                  className="data-[state=checked]:bg-blue-500"
                />
                <Label htmlFor="show-planned" className="text-xs text-gray-400">Planned</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  id="show-actual"
                  checked={showActual}
                  onCheckedChange={setShowActual}
                  className="data-[state=checked]:bg-green-500"
                />
                <Label htmlFor="show-actual" className="text-xs text-gray-400">Actual</Label>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-dark-card rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <Users className="h-3 w-3" aria-hidden="true" />
                Peak Staffing
              </div>
              <div className="text-lg font-semibold text-gray-200">
                {Math.max(...filteredData.map(w => Math.max(w.totalPlannedWorkers, w.totalActualWorkers)))}
              </div>
              <div className="text-[10px] text-gray-400">
                workers/week
              </div>
            </div>
            
            <div className="bg-dark-card rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                {summaryStats.variance >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-amber-400" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-green-400" aria-hidden="true" />
                )}
                Variance
              </div>
              <div className={cn(
                "text-lg font-semibold",
                summaryStats.variance > 0 ? "text-amber-400" : "text-green-400"
              )}>
                {summaryStats.variance > 0 ? '+' : ''}{summaryStats.variance.toFixed(0)}
              </div>
              <div className="text-[10px] text-gray-400">
                {summaryStats.variancePercent > 0 ? '+' : ''}{summaryStats.variancePercent.toFixed(1)}% from plan
              </div>
            </div>
            
            <div className="bg-dark-card rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <AlertTriangle className="h-3 w-3 text-orange-400" aria-hidden="true" />
                Overtime
              </div>
              <div className="text-lg font-semibold text-orange-400">
                {summaryStats.totalOvertime.toFixed(0)}h
              </div>
              <div className="text-[10px] text-gray-400">
                total OT hours
              </div>
            </div>
            
            <div className="bg-dark-card rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <HardHat className="h-3 w-3" aria-hidden="true" />
                Labor Cost
              </div>
              <div className={cn(
                "text-lg font-semibold",
                summaryStats.costVariance > 0 ? "text-red-400" : "text-green-400"
              )}>
                ${(summaryStats.totalActualCost / 1000).toFixed(0)}k
              </div>
              <div className="text-[10px] text-gray-400">
                {summaryStats.costVariance > 0 ? '+' : ''}
                ${(summaryStats.costVariance / 1000).toFixed(1)}k vs plan
              </div>
            </div>
          </div>

          {/* Histogram Chart */}
          <div className="relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-[10px] text-gray-400">
              <span>{maxWorkers}</span>
              <span>{Math.round(maxWorkers / 2)}</span>
              <span>0</span>
            </div>
            
            {/* Chart area */}
            <div className="ml-10 overflow-x-auto">
              <div className="flex items-end gap-1 h-40 min-w-[600px]">
                {filteredData.map((week, idx) => {
                  const plannedHeight = (week.totalPlannedWorkers / maxWorkers) * 100;
                  const actualHeight = (week.totalActualWorkers / maxWorkers) * 100;
                  const isCurrentWeek = new Date() >= week.weekStart && new Date() <= week.weekEnd;
                  
                  return (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <div 
                          className={cn(
                            "flex-1 min-w-[40px] max-w-[60px] flex gap-0.5 items-end h-full border-b border-gray-700 cursor-pointer hover:bg-dark-card/50 transition-colors",
                            isCurrentWeek && "bg-blue-500/10 border-b-blue-500"
                          )}
                        >
                          {showPlanned && (
                            <div 
                              className="flex-1 bg-blue-500/40 border border-blue-500/60 rounded-t transition-all"
                              style={{ height: `${plannedHeight}%` }}
                            />
                          )}
                          {showActual && (
                            <div 
                              className="flex-1 bg-green-500/60 border border-green-500/80 rounded-t transition-all"
                              style={{ height: `${actualHeight}%` }}
                            />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-dark-surface border-gray-700 p-3">
                        <div className="space-y-2">
                          <div className="font-medium text-gray-200">
                            {format(week.weekStart, 'MMM d')} - {format(week.weekEnd, 'MMM d')}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <span className="text-blue-400">Planned:</span>
                            <span className="text-gray-300">{week.totalPlannedWorkers} workers</span>
                            <span className="text-green-400">Actual:</span>
                            <span className="text-gray-300">{week.totalActualWorkers} workers</span>
                            <span className="text-gray-400">Cost:</span>
                            <span className="text-gray-300">${week.totalActualCost.toLocaleString()}</span>
                          </div>
                          {Object.keys(week.trades).length > 0 && (
                            <div className="pt-2 border-t border-gray-700">
                              <div className="text-[10px] text-gray-400 mb-1">By Trade:</div>
                              {Object.entries(week.trades)
                                .filter(([_, data]) => data.actualWorkers > 0 || data.plannedWorkers > 0)
                                .slice(0, 5)
                                .map(([trade, data]) => (
                                  <div key={trade} className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-1">
                                      <div 
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: getTradeColor(trade) }}
                                      />
                                      <span className="text-gray-400">{trade}</span>
                                    </div>
                                    <span className="text-gray-300">
                                      {data.plannedWorkers}/{data.actualWorkers}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              
              {/* X-axis labels */}
              <div className="flex gap-1 mt-1">
                {filteredData.map((week, idx) => (
                  <div 
                    key={idx} 
                    className="flex-1 min-w-[40px] max-w-[60px] text-center text-[10px] text-gray-400"
                  >
                    {format(week.weekStart, 'M/d')}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trade Legend */}
          {selectedTrade === 'all' && uniqueTrades.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
              <span className="text-[10px] text-gray-400">Trades:</span>
              {uniqueTrades.slice(0, 8).map(trade => (
                <div key={trade} className="flex items-center gap-1">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getTradeColor(trade) }}
                  />
                  <span className="text-[10px] text-gray-400">{trade}</span>
                </div>
              ))}
              {uniqueTrades.length > 8 && (
                <span className="text-[10px] text-gray-400">+{uniqueTrades.length - 8} more</span>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-xs">
            {showPlanned && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500/40 border border-blue-500/60 rounded" />
                <span className="text-gray-400">Planned</span>
              </div>
            )}
            {showActual && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500/60 border border-green-500/80 rounded" />
                <span className="text-gray-400">Actual</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
}
