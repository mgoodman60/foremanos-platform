'use client';

import React, { useState } from 'react';
import { Crosshair, RotateCw } from 'lucide-react';

interface Props {
  documentId: string;
  projectSlug: string;
  tradeFocusRun: string[];
  detectedDisciplines: string[];
}

const TRADES = [
  'Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire Protection', 'Civil',
];

const ASPECTS = [
  'Room Data', 'Door/Window Schedules', 'Fixture Counts', 'Dimensions', 'Equipment Schedules', 'Symbol Legends',
];

export default function TradeFocusPanel({ documentId, projectSlug, tradeFocusRun, detectedDisciplines }: Props) {
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [selectedAspects, setSelectedAspects] = useState<Set<string>>(new Set());
  const [escalateTier, setEscalateTier] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const toggleTrade = (trade: string) => {
    setSelectedTrades(prev => {
      const next = new Set(prev);
      if (next.has(trade)) next.delete(trade); else next.add(trade);
      return next;
    });
  };

  const toggleAspect = (aspect: string) => {
    setSelectedAspects(prev => {
      const next = new Set(prev);
      if (next.has(aspect)) next.delete(aspect); else next.add(aspect);
      return next;
    });
  };

  const handleExtract = async () => {
    const focuses = [
      ...Array.from(selectedTrades).map(name => ({ type: 'trade' as const, name })),
      ...Array.from(selectedAspects).map(name => ({ type: 'aspect' as const, name })),
    ];
    if (focuses.length === 0) return;

    setExtracting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/trade-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focuses, escalateTier }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`${data.pagesProcessed} pages processed, ${data.fieldsUpdated} fields updated. Quality: ${data.qualityBefore} -> ${data.qualityAfter}`);
      } else {
        setResult(data.error || 'Failed');
      }
    } catch { setResult('Failed'); }
    finally { setExtracting(false); }
  };

  const totalSelected = selectedTrades.size + selectedAspects.size;

  // projectSlug is available for future use (e.g., linking back to project-level rescan)
  void projectSlug;

  return (
    <div className="bg-slate-900 border border-gray-700 rounded-xl p-6">
      <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
        <Crosshair className="h-5 w-5 text-orange-400" aria-hidden="true" />
        Trade-Focused Extraction
      </h3>
      <p className="text-xs text-gray-400 mb-4">Select disciplines or aspects for deep extraction</p>

      {result && (
        <div className="text-sm text-orange-400 bg-orange-900/30 rounded-lg px-3 py-2 mb-4">{result}</div>
      )}

      {/* Trade checkboxes */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">By Trade</div>
        <div className="flex flex-wrap gap-2">
          {TRADES.map(trade => (
            <button
              key={trade}
              onClick={() => toggleTrade(trade)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                selectedTrades.has(trade)
                  ? 'bg-orange-600 text-white'
                  : detectedDisciplines.includes(trade)
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              aria-pressed={selectedTrades.has(trade)}
              aria-label={`Select ${trade}`}
            >
              {trade}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect checkboxes */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">By Aspect</div>
        <div className="flex flex-wrap gap-2">
          {ASPECTS.map(aspect => (
            <button
              key={aspect}
              onClick={() => toggleAspect(aspect)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                selectedAspects.has(aspect) ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              aria-pressed={selectedAspects.has(aspect)}
              aria-label={`Select ${aspect}`}
            >
              {aspect}
            </button>
          ))}
        </div>
      </div>

      {/* Premium pipeline toggle */}
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={escalateTier}
          onChange={(e) => setEscalateTier(e.target.checked)}
          className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
        />
        <span className="text-xs text-gray-300">Use premium pipeline</span>
        <span className="text-xs text-gray-500">— 3x cost, higher accuracy</span>
      </label>

      {/* Previously run */}
      {tradeFocusRun.length > 0 && (
        <div className="text-xs text-gray-500 mb-4">
          Previously run: {tradeFocusRun.join(', ')}
        </div>
      )}

      {/* Extract button */}
      <button
        onClick={handleExtract}
        disabled={extracting || totalSelected === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors min-h-[44px]"
        aria-label="Extract selected focuses"
      >
        {extracting
          ? <RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          : <Crosshair className="h-4 w-4" aria-hidden="true" />
        }
        {extracting ? 'Extracting...' : `Extract Selected (${totalSelected})`}
      </button>
    </div>
  );
}
