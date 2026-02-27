'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  pageNumber: number;
  sheetNumber: string | null;
  discipline: string | null;
  qualityScore: number | null;
  correctionAttempts: number;
  provider: string | null;
  cost: number | null;
  qualityHistory: any[];
}

function getScoreBarColor(score: number): string {
  if (score >= 60) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function PageQualityRow({
  pageNumber, sheetNumber, discipline, qualityScore,
  correctionAttempts, provider, cost, qualityHistory,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const score = qualityScore ?? 0;

  return (
    <div className="border-b border-gray-700 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-2 px-1 hover:bg-gray-800/50 transition-colors text-left min-h-[44px]"
        aria-expanded={expanded}
        aria-label={`Page ${pageNumber} quality details`}
      >
        {expanded
          ? <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" aria-hidden="true" />
          : <ChevronRight className="h-3 w-3 text-gray-500 flex-shrink-0" aria-hidden="true" />
        }
        <span className="text-sm text-white w-12">p{pageNumber}</span>
        <span className="text-xs text-gray-400 w-16 truncate">{sheetNumber || '—'}</span>
        {discipline && <span className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-300">{discipline}</span>}
        <div className="flex-1 flex items-center gap-2 ml-2">
          <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full ${getScoreBarColor(score)}`} style={{ width: `${Math.min(100, score)}%` }} />
          </div>
          <span className="text-xs text-gray-400 w-8">{score}</span>
        </div>
        {correctionAttempts > 0 && <span className="text-xs text-cyan-400 flex-shrink-0">{correctionAttempts} fix</span>}
      </button>

      {expanded && qualityHistory.length > 0 && (
        <div className="pl-8 pb-2 space-y-1">
          {qualityHistory.map((h: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-16">{h.attempt === 0 ? 'Initial' : `Fix #${h.attempt}`}</span>
              <span className={`px-1.5 py-0.5 rounded ${
                (h.score || 0) >= 60 ? 'bg-green-900/50 text-green-300' :
                (h.score || 0) >= 40 ? 'bg-yellow-900/50 text-yellow-300' :
                'bg-red-900/50 text-red-300'
              }`}>{h.score}</span>
              {h.provider && <span>via {h.provider}</span>}
              {h.normalizations?.length > 0 && <span className="text-gray-500">({h.normalizations.length} normalizations)</span>}
            </div>
          ))}
          {provider && <div className="text-xs text-gray-500">Provider: {provider}</div>}
          {cost != null && cost > 0 && <div className="text-xs text-gray-500">Cost: ${cost.toFixed(3)}</div>}
        </div>
      )}
    </div>
  );
}
