'use client';

import { useState, useEffect } from 'react';
import { Calendar, Flag, CloudSun, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { DashboardWidget } from './dashboard-widget';
import { KeyDatesTimeline } from './key-dates-timeline';
import { ScheduleCalendarWidget } from './schedule-calendar-widget';
import { primaryColors } from '@/lib/design-tokens';

interface ExpandedScheduleWidgetProps {
  projectSlug: string;
  initialScheduleData?: ScheduleData | null;
  initialDailyReportData?: DailyReportData | null;
}

export interface ScheduleData {
  overallProgress: number;
  tasksCompleted: number;
  totalTasks: number;
  daysAheadBehind: number;
  criticalPathStatus: string;
  activeTodayCount?: number;
  upcomingMilestones: { name: string; daysUntil: number }[];
  keyDates?: { name: string; date: string; type: 'start' | 'end' | 'milestone'; category?: string }[];
  noDataSource?: boolean;
}

export interface DailyReportData {
  weather?: { condition?: string; temperature?: number };
  crewCount?: number;
}

function TodayChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2">
      <Icon className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
      <span className="text-xs text-gray-300">{label}</span>
    </div>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data, 1);
  const width = 120;
  const height = 30;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="block">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={primaryColors.orange[500]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExpandedScheduleWidget({ projectSlug, initialScheduleData, initialDailyReportData }: ExpandedScheduleWidgetProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'upcoming'>('overview');
  const [schedule, setSchedule] = useState<ScheduleData | null>(initialScheduleData ?? null);
  const [dailyReport, setDailyReport] = useState<DailyReportData | null>(initialDailyReportData ?? null);
  const [loading, setLoading] = useState(initialScheduleData === undefined);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | undefined>(initialScheduleData !== undefined ? new Date() : undefined);

  useEffect(() => {
    if (initialScheduleData !== undefined) return; // Skip fetch when server-provided
    const fetchData = async () => {
      const results = await Promise.allSettled([
        fetch(`/api/projects/${projectSlug}/schedule-metrics`, { cache: 'no-store' }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`/api/projects/${projectSlug}/daily-reports?limit=1`).then((r) =>
          r.ok ? r.json() : null
        ),
      ]);

      const scheduleResult = results[0].status === 'fulfilled' ? results[0].value : null;
      const drResult = results[1].status === 'fulfilled' ? results[1].value : null;

      if (scheduleResult) {
        setSchedule(scheduleResult);
        setLastFetched(new Date());
      } else {
        setError('Unable to load schedule');
      }

      if (drResult) {
        const reports = drResult.reports || drResult.dailyReports || [];
        if (reports.length > 0) {
          const latest = reports[0];
          setDailyReport({
            weather: latest.weather || undefined,
            crewCount: latest.crewCount || latest.labor?.length || 0,
          });
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [projectSlug, initialScheduleData]);

  const hasData = schedule && !schedule.noDataSource && schedule.totalTasks > 0;

  const nextMilestone = schedule?.upcomingMilestones?.[0];
  const weatherLabel = dailyReport?.weather
    ? `${dailyReport.weather.condition || 'N/A'} ${dailyReport.weather.temperature ?? '--'}°F`
    : 'No data';

  const daysLabel = hasData
    ? `${Math.abs(schedule!.daysAheadBehind)}d ${schedule!.daysAheadBehind >= 0 ? 'ahead' : 'behind'}`
    : '';

  const criticalBadge = hasData
    ? schedule!.criticalPathStatus === 'healthy'
      ? { label: 'On Track', color: 'text-green-400', Icon: CheckCircle }
      : schedule!.criticalPathStatus === 'warning'
        ? { label: 'At Risk', color: 'text-amber-400', Icon: AlertTriangle }
        : { label: 'Critical', color: 'text-red-400', Icon: AlertTriangle }
    : null;

  // Placeholder velocity data (7 data points for sparkline)
  const velocityData = hasData
    ? Array.from({ length: 7 }, (_, i) =>
        Math.max(0, (schedule!.overallProgress || 0) - (7 - i) * 2 + Math.random() * 3)
      )
    : [];

  const keyDates = schedule?.keyDates || [];

  return (
    <DashboardWidget
      title="Schedule Status"
      icon={Calendar}
      iconColor="bg-orange-500"
      loading={loading}
      error={error || undefined}
      colSpan={2}
      lastFetched={lastFetched}
      primaryMetric={{
        value: hasData ? `${schedule!.overallProgress}%` : '--',
        label: hasData
          ? `${schedule!.tasksCompleted}/${schedule!.totalTasks} tasks complete`
          : 'No schedule data',
      }}
      href={`/project/${projectSlug}/schedule-budget`}
      customContent={
        hasData ? (
          <div className="space-y-4">
            {/* Tab buttons */}
            <div className="flex gap-1" role="tablist" aria-label="Schedule view tabs">
              <button
                role="tab"
                aria-selected={activeTab === 'overview'}
                aria-controls="schedule-tab-overview"
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none ${
                  activeTab === 'overview'
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                Overview
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'upcoming'}
                aria-controls="schedule-tab-upcoming"
                onClick={() => setActiveTab('upcoming')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none ${
                  activeTab === 'upcoming'
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                Upcoming
              </button>
            </div>

            {activeTab === 'overview' ? (
              <>
                {/* "What's Happening Today?" chips */}
                <div className="flex flex-wrap gap-2">
                  <TodayChip
                    icon={Calendar}
                    label={`${schedule!.activeTodayCount ?? schedule!.totalTasks - schedule!.tasksCompleted} tasks active`}
                  />
                  {nextMilestone && (
                    <TodayChip icon={Flag} label={`${nextMilestone.name} in ${nextMilestone.daysUntil}d`} />
                  )}
                  <TodayChip icon={CloudSun} label={weatherLabel} />
                  <TodayChip icon={Users} label={`${dailyReport?.crewCount ?? 0} on site`} />
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-50 tabular-nums">{schedule!.overallProgress}%</span>
                    <span className={`text-xs tabular-nums ${schedule!.daysAheadBehind >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {daysLabel}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all duration-700"
                      style={{ width: `${schedule!.overallProgress}%` }}
                    />
                  </div>
                  {criticalBadge && (
                    <div className={`flex items-center gap-1 mt-1 ${criticalBadge.color}`}>
                      <criticalBadge.Icon className="w-3 h-3" aria-hidden="true" />
                      <span className="text-xs">{criticalBadge.label}</span>
                    </div>
                  )}
                </div>

                {/* Key Dates Timeline */}
                {keyDates.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Key Dates</p>
                    <KeyDatesTimeline keyDates={keyDates} />
                  </div>
                )}

                {/* Sparkline */}
                {velocityData.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">7d velocity</span>
                    <MiniSparkline data={velocityData} />
                  </div>
                )}
              </>
            ) : (
              <div id="schedule-tab-upcoming" role="tabpanel" aria-labelledby="tab-upcoming">
                <ScheduleCalendarWidget projectSlug={projectSlug} />
              </div>
            )}
          </div>
        ) : undefined
      }
      emptyState={{
        message: 'Upload a schedule document to track progress.',
        actionLabel: 'Go to Schedules',
        actionHref: `/project/${projectSlug}/schedule-budget`,
      }}
    />
  );
}
