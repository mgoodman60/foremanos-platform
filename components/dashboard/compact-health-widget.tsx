'use client';

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DashboardWidget } from './dashboard-widget';

interface CompactHealthWidgetProps {
  projectSlug: string;
}

interface HealthData {
  overallScore: number | null;
  scheduleScore: number | null;
  budgetScore: number | null;
  safetyScore: number | null;
  qualityScore: number | null;
  documentScore: number | null;
  intelligenceScore?: number;
  trend: 'improving' | 'stable' | 'declining';
  changeFromPrevious: number;
}

interface ScoreBarProps {
  label: string;
  score: number | null;
  setupHref: string;
  setupLabel: string;
}

function ScoreBar({ label, score, setupHref, setupLabel }: ScoreBarProps) {
  if (score === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-400 w-14 shrink-0">{label}</span>
        <a
          href={setupHref}
          className="flex-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded"
        >
          {setupLabel} &rarr;
        </a>
      </div>
    );
  }

  const color = score >= 80 ? 'bg-green-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 w-6 text-right tabular-nums">{score}</span>
    </div>
  );
}

export function CompactHealthWidget({ projectSlug }: CompactHealthWidgetProps) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | undefined>();

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`/api/projects/${projectSlug}/health`);
        if (res.ok) {
          const data = await res.json();
          setHealth(data.health);
          setLastFetched(new Date());
        } else {
          setError('Unable to load');
        }
      } catch {
        setError('Unable to load');
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, [projectSlug]);

  const hasScore = health?.overallScore !== null && health?.overallScore !== undefined;

  const scoreColor = !health || !hasScore
    ? 'text-gray-400'
    : health.overallScore! >= 80
      ? 'text-green-400'
      : health.overallScore! >= 50
        ? 'text-amber-400'
        : 'text-red-400';

  const TrendIcon = !health
    ? Minus
    : health.trend === 'improving'
      ? TrendingUp
      : health.trend === 'declining'
        ? TrendingDown
        : Minus;

  const trendColor = !health
    ? 'text-gray-400'
    : health.trend === 'improving'
      ? 'text-green-400'
      : health.trend === 'declining'
        ? 'text-red-400'
        : 'text-gray-400';

  return (
    <DashboardWidget
      title="Operational Health"
      icon={Activity}
      iconColor="bg-green-600"
      loading={loading}
      error={error || undefined}
      colSpan={1}
      lastFetched={lastFetched}
      primaryMetric={{
        value: hasScore ? health!.overallScore! : '--',
        label: 'Operational health score',
      }}
      href={`/project/${projectSlug}/reports`}
      customContent={
        health ? (
          <div>
            {hasScore ? (
              <>
                {/* Score + Trend */}
                <div className="flex items-end gap-3 mb-4">
                  <span className={`text-4xl font-bold tabular-nums ${scoreColor}`}>{health.overallScore}</span>
                  <div className={`flex items-center gap-1 pb-1 ${trendColor}`}>
                    <TrendIcon className="w-4 h-4" />
                    <span className="text-xs">
                      {health.changeFromPrevious >= 0 ? '+' : ''}
                      {health.changeFromPrevious.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Mini bars */}
                <div className="space-y-2">
                  <ScoreBar
                    label="Schedule"
                    score={health.scheduleScore}
                    setupHref={`/project/${projectSlug}/schedule`}
                    setupLabel="Add schedule"
                  />
                  <ScoreBar
                    label="Budget"
                    score={health.budgetScore}
                    setupHref={`/project/${projectSlug}/budget`}
                    setupLabel="Set budget"
                  />
                  <ScoreBar
                    label="Safety"
                    score={health.safetyScore}
                    setupHref={`/project/${projectSlug}/field-ops/daily-reports`}
                    setupLabel="Submit daily report"
                  />
                  <ScoreBar
                    label="Quality"
                    score={health.qualityScore}
                    setupHref={`/project/${projectSlug}/punch-list`}
                    setupLabel="Track punch items"
                  />
                </div>
              </>
            ) : (
              /* Get Started card when no overall score */
              <div className="text-center py-2">
                <p className="text-sm font-medium text-gray-300 mb-3">Set Up Your Project</p>
                <p className="text-xs text-gray-500 mb-4">Add data to see your operational health:</p>
                <div className="space-y-2">
                  <a
                    href={`/project/${projectSlug}/schedule`}
                    className="block text-[11px] text-blue-400 hover:text-blue-300 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded"
                  >
                    Add Schedule &rarr;
                  </a>
                  <a
                    href={`/project/${projectSlug}/budget`}
                    className="block text-[11px] text-blue-400 hover:text-blue-300 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded"
                  >
                    Set Budget &rarr;
                  </a>
                  <a
                    href={`/project/${projectSlug}/field-ops/daily-reports`}
                    className="block text-[11px] text-blue-400 hover:text-blue-300 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded"
                  >
                    Submit Daily Report &rarr;
                  </a>
                </div>
              </div>
            )}

            {/* Intelligence badge (separate from health) */}
            {health.intelligenceScore !== undefined && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">Document Intelligence</span>
                  <span className="text-[10px] text-blue-400 tabular-nums">{health.intelligenceScore}%</span>
                </div>
              </div>
            )}
          </div>
        ) : undefined
      }
      emptyState={{
        message: 'Upload documents and set up schedule to see health scores.',
        actionLabel: 'View Reports',
        actionHref: `/project/${projectSlug}/reports`,
      }}
    />
  );
}
