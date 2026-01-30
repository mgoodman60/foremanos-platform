"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  Clock,
  CloudRain,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  RefreshCw,
  Activity,
  Users,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { format, differenceInDays, addDays, parseISO, isAfter, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';

export interface DelayEvent {
  id: string;
  type: 'weather' | 'material' | 'labor' | 'inspection' | 'change_order' | 'other';
  description: string;
  startDate: string;
  endDate?: string;
  daysImpact: number;
  affectedTasks: string[];
  isCriticalPath: boolean;
  status: 'active' | 'resolved' | 'mitigated';
  createdAt: string;
}

export interface ScheduleTask {
  id: string;
  taskId: string;
  name: string;
  startDate: string;
  endDate: string;
  baselineStartDate?: string | null;
  baselineEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  status: string;
  isCritical: boolean;
  percentComplete?: number;
  totalFloat?: number;
}

interface DelayImpactAnalyzerProps {
  projectSlug: string;
  tasks?: ScheduleTask[];
  projectStartDate?: Date;
  projectEndDate?: Date;
  baselineEndDate?: Date;
}

const getDelayTypeIcon = (type: string) => {
  switch (type) {
    case 'weather': return <CloudRain className="h-4 w-4" />;
    case 'material': return <Package className="h-4 w-4" />;
    case 'labor': return <Users className="h-4 w-4" />;
    case 'inspection': return <CheckCircle2 className="h-4 w-4" />;
    case 'change_order': return <Target className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
};

const getDelayTypeColor = (type: string) => {
  switch (type) {
    case 'weather': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'material': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'labor': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'inspection': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'change_order': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

export function DelayImpactAnalyzer({
  projectSlug,
  tasks = [],
  projectStartDate,
  projectEndDate,
  baselineEndDate
}: DelayImpactAnalyzerProps) {
  const [delayEvents, setDelayEvents] = useState<DelayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDelayAnalysis();
  }, [projectSlug, tasks]);

  const loadDelayAnalysis = async () => {
    setLoading(true);
    try {
      // Fetch delay events from API
      const response = await fetch(`/api/projects/${projectSlug}/schedules/delays`);
      if (response.ok) {
        const data = await response.json();
        setDelayEvents(data.delays || []);
      } else {
        // Generate analysis from task data if no stored delays
        const analysisFromTasks = analyzeTaskDelays(tasks);
        setDelayEvents(analysisFromTasks);
      }
    } catch (err) {
      console.error('Failed to load delay analysis:', err);
      // Fallback to task analysis
      const analysisFromTasks = analyzeTaskDelays(tasks);
      setDelayEvents(analysisFromTasks);
    } finally {
      setLoading(false);
    }
  };

  // Analyze tasks for delays based on baseline vs actual dates
  const analyzeTaskDelays = (taskList: ScheduleTask[]): DelayEvent[] => {
    const delays: DelayEvent[] = [];
    
    taskList.forEach(task => {
      if (task.baselineEndDate && task.endDate) {
        const baselineEnd = new Date(task.baselineEndDate);
        const currentEnd = new Date(task.endDate);
        const delayDays = differenceInDays(currentEnd, baselineEnd);
        
        if (delayDays > 0) {
          delays.push({
            id: `delay-${task.id}`,
            type: 'other',
            description: `${task.name} delayed from baseline`,
            startDate: task.baselineEndDate,
            endDate: task.endDate,
            daysImpact: delayDays,
            affectedTasks: [task.id],
            isCriticalPath: task.isCritical,
            status: task.status === 'completed' ? 'resolved' : 'active',
            createdAt: new Date().toISOString()
          });
        }
      }
    });
    
    return delays.sort((a, b) => b.daysImpact - a.daysImpact);
  };

  // Calculate metrics from tasks
  const metrics = {
    totalTasks: tasks.length,
    delayedTasks: tasks.filter(t => t.status === 'delayed').length,
    criticalDelayed: tasks.filter(t => t.isCritical && t.status === 'delayed').length,
    onTrack: tasks.filter(t => t.status !== 'delayed' && t.status !== 'blocked').length,
    avgFloat: tasks.filter(t => t.totalFloat !== undefined && t.totalFloat !== null).length > 0
      ? Math.round(tasks.filter(t => t.totalFloat !== undefined).reduce((sum, t) => sum + (t.totalFloat || 0), 0) / tasks.filter(t => t.totalFloat !== undefined).length)
      : 0,
    projectedDelay: projectEndDate && baselineEndDate
      ? Math.max(0, differenceInDays(projectEndDate, baselineEndDate))
      : delayEvents.filter(d => d.isCriticalPath && d.status === 'active').reduce((sum, d) => sum + d.daysImpact, 0)
  };

  // Group delays by type
  const delaysByType = delayEvents.reduce((acc, delay) => {
    acc[delay.type] = (acc[delay.type] || 0) + delay.daysImpact;
    return acc;
  }, {} as Record<string, number>);

  const totalDelayDays = Object.values(delaysByType).reduce((sum, days) => sum + days, 0);

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700 p-6">
        <div className="flex items-center justify-center gap-3 py-8 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Analyzing schedule delays...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-card border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <TrendingDown className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-200">Delay Impact Analysis</h3>
            <p className="text-sm text-gray-400">Track and analyze schedule variances</p>
          </div>
        </div>
        
        <Button variant="outline" size="sm" onClick={loadDelayAnalysis} className="border-gray-600">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={cn(
          'rounded-lg p-4 border',
          metrics.projectedDelay > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className={cn('h-4 w-4', metrics.projectedDelay > 0 ? 'text-red-400' : 'text-green-400')} />
            <span className="text-xs text-gray-400">Projected Delay</span>
          </div>
          <p className={cn('text-2xl font-bold', metrics.projectedDelay > 0 ? 'text-red-400' : 'text-green-400')}>
            {metrics.projectedDelay > 0 ? `+${metrics.projectedDelay}` : '0'} days
          </p>
        </div>
        
        <div className="bg-dark-surface rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <span className="text-xs text-gray-400">Delayed Tasks</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">
            {metrics.delayedTasks}
            <span className="text-sm text-gray-500 font-normal"> / {metrics.totalTasks}</span>
          </p>
        </div>
        
        <div className="bg-dark-surface rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-red-400" />
            <span className="text-xs text-gray-400">Critical Delayed</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{metrics.criticalDelayed}</p>
        </div>
        
        <div className="bg-dark-surface rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400">Avg Float</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{metrics.avgFloat} days</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-dark-surface border border-gray-700">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="causes">Delay Causes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-4">
          {/* Delay Breakdown by Type */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-300">Delay Breakdown by Cause</h4>
            
            {Object.entries(delaysByType).length > 0 ? (
              Object.entries(delaysByType).map(([type, days]) => {
                const percentage = totalDelayDays > 0 ? (days / totalDelayDays) * 100 : 0;
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('capitalize', getDelayTypeColor(type))}>
                          {getDelayTypeIcon(type)}
                          <span className="ml-1">{type.replace('_', ' ')}</span>
                        </Badge>
                      </div>
                      <span className="text-gray-400">{days} days ({percentage.toFixed(0)}%)</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-gray-500">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>No significant delays detected</p>
              </div>
            )}
          </div>
          
          {/* Schedule Health Indicator */}
          <div className="mt-6 p-4 bg-dark-surface rounded-lg border border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Schedule Health</h4>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Tasks On Track</span>
                  <span>{metrics.totalTasks > 0 ? Math.round((metrics.onTrack / metrics.totalTasks) * 100) : 0}%</span>
                </div>
                <Progress 
                  value={metrics.totalTasks > 0 ? (metrics.onTrack / metrics.totalTasks) * 100 : 0} 
                  className="h-3"
                />
              </div>
              <Badge 
                variant="outline" 
                className={cn(
                  'px-3 py-1',
                  metrics.onTrack / metrics.totalTasks >= 0.8 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  metrics.onTrack / metrics.totalTasks >= 0.6 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                  'bg-red-500/20 text-red-400 border-red-500/30'
                )}
              >
                {metrics.onTrack / metrics.totalTasks >= 0.8 ? 'Healthy' :
                 metrics.onTrack / metrics.totalTasks >= 0.6 ? 'At Risk' : 'Critical'}
              </Badge>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="causes" className="mt-4">
          <div className="space-y-3">
            {delayEvents.length > 0 ? (
              delayEvents.slice(0, 10).map(delay => (
                <div 
                  key={delay.id}
                  className={cn(
                    'p-4 rounded-lg border',
                    delay.status === 'active' ? 'bg-orange-500/5 border-orange-500/20' :
                    delay.status === 'mitigated' ? 'bg-yellow-500/5 border-yellow-500/20' :
                    'bg-gray-500/5 border-gray-700'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg', getDelayTypeColor(delay.type))}>
                        {getDelayTypeIcon(delay.type)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-200">{delay.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>{format(parseISO(delay.startDate), 'MMM d, yyyy')}</span>
                          {delay.endDate && (
                            <>
                              <ChevronRight className="h-3 w-3" />
                              <span>{format(parseISO(delay.endDate), 'MMM d, yyyy')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant="outline"
                        className={cn(
                          delay.isCriticalPath ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                          'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        )}
                      >
                        {delay.daysImpact}d impact
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{delay.status}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                <p>No delay events recorded</p>
                <p className="text-xs mt-1">Delays will be tracked automatically from daily reports</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="history" className="mt-4">
          <div className="space-y-3">
            {delayEvents.filter(d => d.status === 'resolved').length > 0 ? (
              delayEvents.filter(d => d.status === 'resolved').map(delay => (
                <div 
                  key={delay.id}
                  className="p-4 rounded-lg border bg-green-500/5 border-green-500/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      <div>
                        <p className="font-medium text-gray-300">{delay.description}</p>
                        <p className="text-xs text-gray-500">
                          Resolved after {delay.daysImpact} day{delay.daysImpact > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                      Resolved
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p>No resolved delays yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
