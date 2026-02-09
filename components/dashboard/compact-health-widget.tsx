'use client';

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DashboardWidget } from './dashboard-widget';

interface CompactHealthWidgetProps {
  projectSlug: string;
}

interface HealthData {
  overallScore: number;
  scheduleScore: number;
  budgetScore: number;
  safetyScore: number;
  qualityScore: number;
  trend: 'improving' | 'stable' | 'declining';
  changeFromPrevious: number;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-green-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 w-6 text-right">{score}</span>
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

  const scoreColor = !health
    ? 'text-gray-400'
    : health.overallScore >= 80
      ? 'text-green-400'
      : health.overallScore >= 50
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
      title="Project Health"
      icon={Activity}
      iconColor="bg-green-600"
      loading={loading}
      error={error || undefined}
      colSpan={1}
      lastFetched={lastFetched}
      primaryMetric={{
        value: health?.overallScore ?? '--',
        label: 'Overall health score',
      }}
      href={`/project/${projectSlug}/reports`}
      customContent={
        health ? (
          <div>
            {/* Score + Trend */}
            <div className="flex items-end gap-3 mb-4">
              <span className={`text-4xl font-bold ${scoreColor}`}>{health.overallScore}</span>
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
              <ScoreBar label="Schedule" score={health.scheduleScore} />
              <ScoreBar label="Budget" score={health.budgetScore} />
              <ScoreBar label="Safety" score={health.safetyScore} />
              <ScoreBar label="Quality" score={health.qualityScore} />
            </div>
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
