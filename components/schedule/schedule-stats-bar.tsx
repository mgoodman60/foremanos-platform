'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CalendarClock,
  Flag,
  CheckCircle2,
  Target,
  TrendingUp,
  Zap
} from 'lucide-react';

interface ScheduleStats {
  delayedTasks: number;
  dueThisWeek: number;
  milestonesThisMonth: number;
  completedThisWeek: number;
  onTrackPercentage: number;
  criticalPathItems: number;
  totalTasks: number;
}

interface ScheduleStatsBarProps {
  projectSlug: string;
  onFilterClick?: (filter: string) => void;
}

export function ScheduleStatsBar({ projectSlug, onFilterClick }: ScheduleStatsBarProps) {
  const [stats, setStats] = useState<ScheduleStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [projectSlug]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/schedule-stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching schedule stats:', error);
      // Set default stats on error
      setStats({
        delayedTasks: 0,
        dueThisWeek: 0,
        milestonesThisMonth: 0,
        completedThisWeek: 0,
        onTrackPercentage: 0,
        criticalPathItems: 0,
        totalTasks: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="bg-dark-card border-gray-700 p-4 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-2" />
            <div className="h-8 bg-gray-700 rounded w-1/3" />
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      id: 'delayed',
      label: 'Delayed Tasks',
      value: stats?.delayedTasks || 0,
      icon: AlertTriangle,
      color: 'red',
      bgColor: 'bg-dark-card',
      borderColor: 'border-red-500/60',
      textColor: 'text-red-400',
      iconColor: 'text-red-500',
      iconBgColor: 'bg-red-500/20',
      pulse: (stats?.delayedTasks || 0) > 0
    },
    {
      id: 'dueThisWeek',
      label: 'Due This Week',
      value: stats?.dueThisWeek || 0,
      icon: CalendarClock,
      color: 'amber',
      bgColor: 'bg-dark-card',
      borderColor: 'border-amber-500/60',
      textColor: 'text-amber-400',
      iconColor: 'text-amber-500',
      iconBgColor: 'bg-amber-500/20',
      pulse: false
    },
    {
      id: 'milestones',
      label: 'Milestones',
      value: stats?.milestonesThisMonth || 0,
      icon: Flag,
      color: 'purple',
      bgColor: 'bg-dark-card',
      borderColor: 'border-purple-500/60',
      textColor: 'text-purple-400',
      iconColor: 'text-purple-500',
      iconBgColor: 'bg-purple-500/20',
      pulse: false
    },
    {
      id: 'completed',
      label: 'Completed',
      value: stats?.completedThisWeek || 0,
      icon: CheckCircle2,
      color: 'green',
      bgColor: 'bg-dark-card',
      borderColor: 'border-green-500/60',
      textColor: 'text-green-400',
      iconColor: 'text-green-500',
      iconBgColor: 'bg-green-500/20',
      pulse: false
    },
    {
      id: 'critical',
      label: 'Critical Path',
      value: stats?.criticalPathItems || 0,
      icon: Zap,
      color: 'orange',
      bgColor: 'bg-dark-card',
      borderColor: 'border-orange-500/60',
      textColor: 'text-orange-400',
      iconColor: 'text-orange-500',
      iconBgColor: 'bg-orange-500/20',
      pulse: false
    },
    {
      id: 'onTrack',
      label: 'On Track',
      value: `${stats?.onTrackPercentage || 0}%`,
      icon: Target,
      color: 'blue',
      bgColor: 'bg-dark-card',
      borderColor: 'border-emerald-500/60',
      textColor: 'text-emerald-400',
      iconColor: 'text-emerald-500',
      iconBgColor: 'bg-emerald-500/20',
      pulse: false,
      isPercentage: true
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statCards.map((stat) => (
        <Card
          key={stat.id}
          className={cn(
            'border-2 p-4 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg',
            stat.bgColor,
            stat.borderColor,
            'hover:border-opacity-80'
          )}
          onClick={() => onFilterClick?.(stat.id)}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-300 mb-1">{stat.label}</p>
              <p className={cn('text-2xl font-bold', stat.textColor)}>
                {stat.value}
              </p>
            </div>
            <div className={cn('p-2 rounded-lg relative', stat.iconBgColor)}>
              <stat.icon className={cn('h-5 w-5', stat.iconColor)} />
              {stat.pulse && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
              )}
            </div>
          </div>
          {stat.isPercentage && stats && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', 
                    stats.onTrackPercentage >= 80 ? 'bg-emerald-500' :
                    stats.onTrackPercentage >= 60 ? 'bg-blue-500' :
                    stats.onTrackPercentage >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${stats.onTrackPercentage}%` }}
                />
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
