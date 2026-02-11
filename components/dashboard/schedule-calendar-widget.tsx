'use client';

import { useState, useEffect } from 'react';
import { Calendar, Flag, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface ScheduleTask {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: 'on-track' | 'at-risk' | 'overdue' | 'completed';
  isMilestone?: boolean;
}

interface DayGroup {
  date: string;
  dayName: string;
  isToday: boolean;
  tasks: ScheduleTask[];
  milestones: ScheduleTask[];
}

interface ScheduleCalendarWidgetProps {
  projectSlug: string;
}

function getStatusClasses(status: ScheduleTask['status']): string {
  switch (status) {
    case 'on-track':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'at-risk':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'overdue':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'completed':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

function getStatusDot(status: ScheduleTask['status']): string {
  switch (status) {
    case 'on-track':
      return 'bg-green-400';
    case 'at-risk':
      return 'bg-amber-400';
    case 'overdue':
      return 'bg-red-400';
    case 'completed':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}

function determineTaskStatus(
  task: { startDate: string; endDate: string; progress: number },
  now: Date
): ScheduleTask['status'] {
  if (task.progress >= 100) return 'completed';

  const endDate = new Date(task.endDate);
  const startDate = new Date(task.startDate);

  if (endDate < now && task.progress < 100) return 'overdue';

  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();
  const expectedProgress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

  if (task.progress < expectedProgress - 10) return 'at-risk';
  return 'on-track';
}

function formatDayHeader(date: Date, isToday: boolean): string {
  if (isToday) {
    return `Today, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildDayGroups(
  tasks: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    progress: number;
    isMilestone?: boolean;
  }>
): DayGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const groups: DayGroup[] = [];

  for (let i = 0; i < 8; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const isToday = i === 0;

    groups.push({
      date: dateStr,
      dayName: formatDayHeader(date, isToday),
      isToday,
      tasks: [],
      milestones: [],
    });
  }

  for (const task of tasks) {
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);
    const status = determineTaskStatus(task, now);

    const scheduledTask: ScheduleTask = {
      id: task.id,
      name: task.name,
      startDate: task.startDate,
      endDate: task.endDate,
      progress: task.progress,
      status,
      isMilestone: task.isMilestone,
    };

    // Overdue tasks from past days appear under Today
    if (status === 'overdue') {
      if (task.isMilestone) {
        groups[0].milestones.push(scheduledTask);
      } else {
        groups[0].tasks.push(scheduledTask);
      }
      continue;
    }

    for (const group of groups) {
      const groupDate = new Date(group.date);
      const groupEnd = new Date(groupDate);
      groupEnd.setDate(groupEnd.getDate() + 1);

      const overlaps = taskStart < groupEnd && taskEnd >= groupDate;
      if (overlaps) {
        if (task.isMilestone) {
          group.milestones.push(scheduledTask);
        } else {
          group.tasks.push(scheduledTask);
        }
      }
    }
  }

  return groups;
}

export function ScheduleCalendarWidget({ projectSlug }: ScheduleCalendarWidgetProps) {
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await fetch(`/api/projects/${projectSlug}/health`, { cache: 'no-store' });
        if (!res.ok) {
          setError('Unable to load schedule');
          setLoading(false);
          return;
        }

        const data = await res.json();
        const activities = data.scheduleActivities || data.schedule?.tasks || [];

        const rawTasks = activities.map((a: Record<string, unknown>, idx: number) => ({
          id: (a.id as string) || `task-${idx}`,
          name: (a.name as string) || (a.taskName as string) || 'Unnamed Task',
          startDate: (a.startDate as string) || (a.start as string) || new Date().toISOString(),
          endDate: (a.endDate as string) || (a.end as string) || new Date().toISOString(),
          progress: typeof a.progress === 'number' ? a.progress : (typeof a.percentComplete === 'number' ? a.percentComplete : 0),
          isMilestone: Boolean(a.isMilestone || a.milestone),
        }));

        setDayGroups(buildDayGroups(rawTasks));
      } catch {
        setError('Unable to load schedule');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [projectSlug]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-24 bg-gray-700 rounded" />
            <div className="h-8 w-full bg-gray-700/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400">
        <AlertTriangle className="w-4 h-4" />
        <span>{error}</span>
      </div>
    );
  }

  const hasAnyTasks = dayGroups.some((g) => g.tasks.length > 0 || g.milestones.length > 0);

  if (!hasAnyTasks) {
    return (
      <div className="text-center py-6">
        <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No upcoming tasks scheduled</p>
        <Link
          href={`/project/${projectSlug}/schedule-budget`}
          className="text-xs text-orange-400 hover:text-orange-300 mt-1 inline-block focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded"
        >
          View Schedule
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1" role="list" aria-label="Upcoming schedule">
      {dayGroups.map((group) => {
        const isEmpty = group.tasks.length === 0 && group.milestones.length === 0;

        return (
          <div key={group.date} role="listitem">
            {/* Day header */}
            <div
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${
                group.isToday
                  ? 'bg-orange-500/10 border border-orange-500/20'
                  : ''
              }`}
            >
              <span
                className={`text-xs font-semibold ${
                  group.isToday ? 'text-orange-400' : 'text-gray-400'
                }`}
              >
                {group.dayName}
              </span>
              {!isEmpty && (
                <span className="text-[10px] text-gray-400 tabular-nums">
                  {group.tasks.length + group.milestones.length} item{group.tasks.length + group.milestones.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Tasks */}
            {isEmpty ? (
              <p className="text-[10px] text-gray-600 px-2 py-1">No tasks scheduled</p>
            ) : (
              <div className="space-y-1 px-2 py-1">
                {/* Milestones first */}
                {group.milestones.map((m) => (
                  <Link
                    key={m.id}
                    href={`/project/${projectSlug}/schedule-budget`}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none ${getStatusClasses(m.status)}`}
                  >
                    <Flag className="w-3 h-3 shrink-0" />
                    <span className="truncate font-medium">{m.name}</span>
                    {m.status === 'overdue' && (
                      <AlertTriangle className="w-3 h-3 shrink-0 text-red-400" />
                    )}
                  </Link>
                ))}

                {/* Regular tasks */}
                {group.tasks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/project/${projectSlug}/schedule-budget`}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none ${getStatusClasses(t.status)}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDot(t.status)}`} />
                    <span className="truncate">{t.name}</span>
                    {t.status === 'overdue' && (
                      <AlertTriangle className="w-3 h-3 shrink-0 text-red-400" />
                    )}
                    {t.progress > 0 && t.progress < 100 && (
                      <span className="ml-auto text-[10px] tabular-nums opacity-70 shrink-0">
                        {t.progress}%
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
