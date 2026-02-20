'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Lightbulb,
  TrendingDown,
  Calendar,
  FileText,
  ClipboardList,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useProject } from '@/components/layout/project-context';

interface Insight {
  id: string;
  icon: typeof Lightbulb;
  iconColor: string;
  text: string;
  chatPrompt?: string;
}

interface AIInsightsCardProps {
  projectSlug: string;
  projectId: string;
}

export function AIInsightsCard({ projectSlug, projectId }: AIInsightsCardProps) {
  const { setAiDrawerOpen } = useProject();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const computeInsights = useCallback(async () => {
    const results: Insight[] = [];

    try {
      // Fetch health + budget + schedule + docs in parallel
      const [healthRes, budgetRes, scheduleRes, docsRes, reportsRes] = await Promise.allSettled([
        fetch(`/api/projects/${projectSlug}/health`),
        fetch(`/api/projects/${projectSlug}/evm`, { cache: 'no-store' }),
        fetch(`/api/projects/${projectSlug}/schedule-metrics`, { cache: 'no-store' }),
        fetch(`/api/documents/processing-status?projectId=${projectId}`),
        fetch(`/api/projects/${projectSlug}/daily-reports?limit=1`),
      ]);

      // Health insights
      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const data = await healthRes.value.json();
        const health = data.health;
        if (health && health.overallScore < 50) {
          results.push({
            id: 'health-low',
            icon: AlertTriangle,
            iconColor: 'text-red-400',
            text: `Project health score is ${health.overallScore}/100. Review your schedule and budget status.`,
            chatPrompt: 'What is causing my project health score to be low?',
          });
        }
        if (health?.trend === 'declining') {
          results.push({
            id: 'health-declining',
            icon: TrendingDown,
            iconColor: 'text-amber-400',
            text: `Project health is trending downward (${health.changeFromPrevious.toFixed(1)} points).`,
            chatPrompt: 'Why is my project health declining?',
          });
        }
      }

      // Budget insights
      if (budgetRes.status === 'fulfilled' && budgetRes.value.ok) {
        const data = await budgetRes.value.json();
        if (data.budget && data.current) {
          const cpi = data.current.costPerformanceIndex || 1;
          const variance = data.current.percentSpent - data.current.percentComplete;
          if (cpi < 0.9) {
            results.push({
              id: 'budget-over',
              icon: TrendingDown,
              iconColor: 'text-red-400',
              text: `Budget trending ${Math.abs(variance).toFixed(0)}% over. CPI is ${cpi.toFixed(2)}.`,
              chatPrompt: 'Which budget categories are over and what can I do about it?',
            });
          }
        }
      }

      // Schedule insights
      if (scheduleRes.status === 'fulfilled' && scheduleRes.value.ok) {
        const data = await scheduleRes.value.json();
        if (data.totalTasks > 0 && data.daysAheadBehind < -3) {
          results.push({
            id: 'schedule-behind',
            icon: Calendar,
            iconColor: 'text-amber-400',
            text: `Schedule ${Math.abs(data.daysAheadBehind)} days behind. ${data.criticalPathStatus === 'critical' ? 'Critical path affected.' : ''}`,
            chatPrompt: 'What tasks are causing schedule delays?',
          });
        }
      }

      // Document processing insights
      if (docsRes.status === 'fulfilled' && docsRes.value.ok) {
        const data = await docsRes.value.json();
        const total = data.totalDocuments || data.documents?.length || 0;
        const processing = data.processingCount || data.documents?.filter((d: { status: string }) => d.status === 'processing').length || 0;
        if (processing > 0) {
          results.push({
            id: 'docs-processing',
            icon: FileText,
            iconColor: 'text-blue-400',
            text: `${processing} document${processing > 1 ? 's' : ''} currently being processed. Intelligence will be available shortly.`,
          });
        }
        if (total > 0 && processing === 0) {
          results.push({
            id: 'docs-ready',
            icon: CheckCircle,
            iconColor: 'text-green-400',
            text: `${total} document${total > 1 ? 's' : ''} processed and ready for AI queries.`,
            chatPrompt: 'Summarize the key findings from my documents.',
          });
        }
      }

      // Daily report insights
      if (reportsRes.status === 'fulfilled' && reportsRes.value.ok) {
        const data = await reportsRes.value.json();
        const reports = data.reports || data.dailyReports || [];
        if (reports.length === 0) {
          results.push({
            id: 'no-reports',
            icon: ClipboardList,
            iconColor: 'text-gray-400',
            text: 'No daily reports submitted yet. Start tracking field progress.',
            chatPrompt: 'Help me create my first daily report.',
          });
        } else {
          const lastDate = new Date(reports[0].reportDate || reports[0].createdAt);
          const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince > 1) {
            results.push({
              id: 'report-stale',
              icon: ClipboardList,
              iconColor: 'text-amber-400',
              text: `No daily report submitted in ${daysSince} day${daysSince > 1 ? 's' : ''}.`,
              chatPrompt: 'Help me catch up on daily reports.',
            });
          }
        }
      }
    } catch {
      // If fetching fails entirely, show default insight
    }

    // Default fallback if no insights
    if (results.length === 0) {
      results.push({
        id: 'default',
        icon: Lightbulb,
        iconColor: 'text-orange-400',
        text: 'Ask AI about your project documents, schedule, or budget.',
        chatPrompt: 'Give me an overview of this project.',
      });
    }

    setInsights(results.slice(0, 5));
    setLoading(false);
  }, [projectSlug, projectId]);

  useEffect(() => {
    computeInsights();
  }, [computeInsights]);

  const handleAskAI = (_prompt?: string) => {
    setAiDrawerOpen(true);
    // The drawer opens with focus on input; the user can paste the prompt
  };

  return (
    <div className="bg-slate-900 border-2 border-gray-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-slate-50">AI Insights</h3>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-gray-700 flex-shrink-0" />
              <div className="flex-1 h-4 bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Insights list */}
      {!loading && (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="flex items-start gap-3 group"
            >
              <insight.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${insight.iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300">{insight.text}</p>
                {insight.chatPrompt && (
                  <button
                    onClick={() => handleAskAI(insight.chatPrompt)}
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium mt-1 transition-colors"
                  >
                    Ask AI
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ask AI button */}
      <button
        onClick={() => handleAskAI()}
        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium transition-colors min-h-[44px]"
      >
        <MessageSquare className="w-4 h-4" />
        Ask AI about your project
      </button>
    </div>
  );
}
