'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, AlertCircle, RotateCw } from 'lucide-react';
import type { IntelligenceChecklistItem } from '@/lib/intelligence-score-calculator';

interface IntelligenceChecklistProps {
  checklist: IntelligenceChecklistItem[];
  overallScore: number;
  projectSlug: string;
}

export function IntelligenceChecklist({
  checklist,
  overallScore,
  projectSlug,
}: IntelligenceChecklistProps) {
  const [reprocessing, setReprocessing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const scoreColor =
    overallScore >= 80
      ? 'text-green-400'
      : overallScore >= 60
        ? 'text-yellow-400'
        : overallScore >= 40
          ? 'text-orange-400'
          : 'text-red-400';

  const progressColor =
    overallScore >= 80
      ? 'bg-green-500'
      : overallScore >= 60
        ? 'bg-yellow-500'
        : overallScore >= 40
          ? 'bg-orange-500'
          : 'bg-red-500';

  const handleReanalyze = async () => {
    setReprocessing(true);
    setToastMessage('');
    try {
      const res = await fetch(`/api/projects/${projectSlug}/rescan`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setToastMessage(data.message || 'Documents queued for re-analysis.');
      } else if (res.status === 429) {
        setToastMessage(data.error || 'Please wait before re-analyzing.');
      } else {
        setToastMessage(data.error || 'Failed to queue re-analysis.');
      }
    } catch {
      setToastMessage('Failed to queue re-analysis. Please try again.');
    } finally {
      setTimeout(() => {
        setReprocessing(false);
        setToastMessage('');
      }, 5000);
    }
  };

  const getStatusIcon = (status: IntelligenceChecklistItem['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-green-400 flex-shrink-0" />;
      case 'partial':
        return <AlertCircle aria-hidden="true" className="h-5 w-5 text-yellow-400 flex-shrink-0" />;
      case 'missing':
        return <Circle aria-hidden="true" className="h-5 w-5 text-gray-400 flex-shrink-0" />;
    }
  };

  const completeCount = checklist.filter((item) => item.status === 'complete').length;

  return (
    <div className="bg-slate-900 border border-gray-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Intelligence Quality</h3>
        <span className={`text-2xl font-bold ${scoreColor}`}>{overallScore}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
        <div
          className={`${progressColor} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, overallScore)}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mb-6">
        {completeCount} of {checklist.length} items complete
      </p>

      {/* Checklist items */}
      <div className="space-y-3">
        {checklist.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0"
          >
            {getStatusIcon(item.status)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm ${
                    item.status === 'complete' ? 'text-gray-300' : 'text-white'
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                  {item.currentValue} / {item.targetValue}
                </span>
              </div>
              {item.status !== 'complete' && item.actionLabel && item.actionHref && (
                <a
                  href={`/project/${projectSlug}/${item.actionHref}`}
                  className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 inline-block"
                >
                  {item.actionLabel} &rarr;
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Re-analyze button */}
      <button
        onClick={handleReanalyze}
        disabled={reprocessing}
        className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
      >
        <RotateCw className={`h-4 w-4 ${reprocessing ? 'animate-spin' : ''}`} aria-hidden="true" />
        {reprocessing ? 'Queuing...' : 'Re-analyze Documents'}
      </button>

      {/* Toast */}
      {toastMessage && (
        <div className="mt-3 text-center text-xs text-green-400">{toastMessage}</div>
      )}
    </div>
  );
}
