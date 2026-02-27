'use client';

import React, { useState } from 'react';
import { AlertTriangle, RotateCw, X } from 'lucide-react';

interface DeadLetterPage {
  pageNumber: number;
  qualityScore: number | null;
  sheetNumber: string | null;
  discipline: string | null;
  deadLetterReason: string | null;
  correctionAttempts: number;
  provider: string | null;
}

interface Props {
  documentId: string;
  projectSlug: string;
  pages: DeadLetterPage[];
  onRefresh: () => void;
}

export default function DeadLetterPanel({ documentId, projectSlug, pages, onRefresh }: Props) {
  const [retrying, setRetrying] = useState<number | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  if (pages.length === 0) return null;

  const visiblePages = pages.filter(p => !dismissed.has(p.pageNumber));
  if (visiblePages.length === 0) return null;

  const handleRetryPage = async (pageNumber: number) => {
    setRetrying(pageNumber);
    try {
      const res = await fetch(`/api/documents/${documentId}/improve-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageNumber }),
      });
      if (res.ok) { onRefresh(); }
    } catch { /* ignore */ }
    finally { setRetrying(null); }
  };

  const handleRetryAll = async () => {
    setRetryingAll(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/rescan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'improve', documentIds: [documentId], includeDeadLetter: true }),
      });
      if (res.ok) { onRefresh(); }
    } catch { /* ignore */ }
    finally { setRetryingAll(false); }
  };

  return (
    <div className="bg-slate-900 border border-red-800/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
          Dead Letter Pages ({visiblePages.length})
        </h3>
        <button
          onClick={handleRetryAll}
          disabled={retryingAll}
          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-xs rounded-lg transition-colors min-h-[44px]"
          aria-label="Retry all dead letter pages"
        >
          <RotateCw className={`h-3 w-3 ${retryingAll ? 'animate-spin' : ''}`} aria-hidden="true" />
          Retry All
        </button>
      </div>

      <div className="space-y-2">
        {visiblePages.map(page => (
          <div key={page.pageNumber} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-white">
                <span className="font-medium">Page {page.pageNumber}</span>
                {page.sheetNumber && <span className="text-gray-400">| {page.sheetNumber}</span>}
                {page.discipline && (
                  <span className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-300">{page.discipline}</span>
                )}
                <span className="text-red-400 text-xs">Score: {page.qualityScore ?? 0}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1 truncate">
                {page.deadLetterReason || 'Unknown reason'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {page.correctionAttempts} correction attempt{page.correctionAttempts !== 1 ? 's' : ''}
                {page.provider && `, via ${page.provider}`}
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => handleRetryPage(page.pageNumber)}
                disabled={retrying === page.pageNumber}
                className="flex items-center gap-1 px-2 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors min-h-[44px]"
                aria-label={`Retry page ${page.pageNumber}`}
              >
                <RotateCw className={`h-3 w-3 ${retrying === page.pageNumber ? 'animate-spin' : ''}`} aria-hidden="true" />
                Retry
              </button>
              <button
                onClick={() => setDismissed(prev => new Set([...prev, page.pageNumber]))}
                className="flex items-center px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors min-h-[44px]"
                aria-label={`Dismiss page ${page.pageNumber}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
