'use client';

import { useState, useEffect, useCallback } from 'react';

interface DashboardGreetingProps {
  projectSlug: string;
  projectId: string;
  userName?: string;
}

interface GreetingData {
  overallScore: number | null;
  overdueCount: number;
  pendingSubmittals: number;
  unprocessedDocs: number;
}

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardGreeting({ projectSlug, projectId, userName }: DashboardGreetingProps) {
  const [data, setData] = useState<GreetingData>({
    overallScore: null,
    overdueCount: 0,
    pendingSubmittals: 0,
    unprocessedDocs: 0,
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchData = useCallback(async () => {
    setError(false);
    try {
      const results = await Promise.allSettled([
        fetch(`/api/projects/${projectSlug}/health`).then((r) => r.ok ? r.json() : null),
        fetch(`/api/projects/${projectSlug}/schedule-metrics`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null),
        fetch(`/api/projects/${projectSlug}/mep/submittals/stats`).then((r) => r.ok ? r.json() : null),
      ]);

      const healthResult = results[0].status === 'fulfilled' ? results[0].value : null;
      const scheduleResult = results[1].status === 'fulfilled' ? results[1].value : null;
      const submittalResult = results[2].status === 'fulfilled' ? results[2].value : null;

      const overdue = scheduleResult?.overdueTasks ?? 0;
      const pending = submittalResult?.pendingReview ?? 0;

      setData({
        overallScore: healthResult?.health?.overallScore ?? null,
        overdueCount: overdue,
        pendingSubmittals: pending,
        unprocessedDocs: 0,
      });
      setLoaded(true);
    } catch {
      setError(true);
      setLoaded(true);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData, projectId]);

  const greeting = getTimeOfDayGreeting();
  const attentionItems = data.overdueCount + data.pendingSubmittals + data.unprocessedDocs;

  const completionText = data.overallScore !== null
    ? `Your project is ${data.overallScore}% complete.`
    : '';

  const attentionText = attentionItems > 0
    ? `${attentionItems} item${attentionItems !== 1 ? 's' : ''} need${attentionItems === 1 ? 's' : ''} attention today.`
    : 'Everything looks good today.';

  if (!loaded) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-7 bg-gray-700 rounded w-2/5" />
        <div className="h-5 bg-gray-700/60 rounded w-3/5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-gray-400 text-sm">Failed to load project data.</p>
        {retryCount < 3 && (
          <button
            onClick={() => { setRetryCount(c => c + 1); setLoaded(false); fetchData(); }}
            className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="transition-all duration-500 opacity-100 translate-y-0"
    >
      <h1 className="text-xl text-slate-50 font-medium">
        {greeting}{userName ? `, ${userName}` : ''}.{' '}
        <span className="text-gray-400">
          {completionText} {attentionText}
        </span>
      </h1>
    </div>
  );
}
