'use client';

import React, { useState } from 'react';
import { Play, RotateCw, CheckCircle2, Circle, Layers } from 'lucide-react';

interface Props {
  documentId: string;
  phasesRun: string[];
  phaseResults?: {
    titleBlocksExtracted?: number;
    scalesFound?: number;
    legendsFound?: number;
    dimensionsFound?: number;
    annotationsFound?: number;
    roomsIdentified?: number;
    spatialCorrelationsBuilt?: number;
    mepElementsMapped?: number;
  };
}

const PHASES = [
  {
    id: 'A',
    name: 'Phase A — Foundation Intelligence',
    description: 'Title blocks, scales, legends, basic metadata',
    metrics: (r: any) => r ? `Title blocks: ${r.titleBlocksExtracted || 0} | Scales: ${r.scalesFound || 0} | Legends: ${r.legendsFound || 0}` : null,
  },
  {
    id: 'B',
    name: 'Phase B — Advanced Features',
    description: 'Dimensions, annotations, rooms, schedules',
    metrics: (r: any) => r ? `Dimensions: ${r.dimensionsFound || 0} | Annotations: ${r.annotationsFound || 0} | Rooms: ${r.roomsIdentified || 0}` : null,
  },
  {
    id: 'C',
    name: 'Phase C — Advanced Intelligence',
    description: 'Spatial correlation, MEP path tracing, symbol learning',
    metrics: (r: any) => r ? `Correlations: ${r.spatialCorrelationsBuilt || 0} | MEP: ${r.mepElementsMapped || 0}` : null,
  },
];

export default function ExtractionPhasePicker({ documentId, phasesRun, phaseResults }: Props) {
  const [running, setRunning] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);

  const handleRunPhase = async (phase: string) => {
    setRunning(phase);
    setRunResult(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/run-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phases: [phase] }),
      });
      const data = await res.json();
      if (res.ok) {
        setRunResult(`Phase ${phase} complete — ${data.pagesProcessed || 0} pages processed`);
      } else {
        setRunResult(data.error || 'Failed');
      }
    } catch { setRunResult('Failed to run phase'); }
    finally { setRunning(null); }
  };

  const handleRunAll = async () => {
    const unchecked = PHASES.filter(p => !phasesRun.includes(p.id)).map(p => p.id);
    if (unchecked.length === 0) return;
    setRunning('all');
    setRunResult(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/run-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phases: unchecked }),
      });
      const data = await res.json();
      if (res.ok) {
        setRunResult(`Phases ${unchecked.join(', ')} complete`);
      } else {
        setRunResult(data.error || 'Failed');
      }
    } catch { setRunResult('Failed'); }
    finally { setRunning(null); }
  };

  const uncheckedCount = PHASES.filter(p => !phasesRun.includes(p.id)).length;

  return (
    <div className="bg-slate-900 border border-gray-700 rounded-xl p-6">
      <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
        <Layers className="h-5 w-5 text-purple-400" aria-hidden="true" />
        Extraction Phases
      </h3>

      {runResult && (
        <div className="text-sm text-purple-400 bg-purple-900/30 rounded-lg px-3 py-2 mb-4">{runResult}</div>
      )}

      <div className="space-y-2">
        {PHASES.map(phase => {
          const isDone = phasesRun.includes(phase.id);
          const isRunning = running === phase.id || running === 'all';
          const metricsText = phase.metrics(phaseResults);

          return (
            <div key={phase.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isDone
                    ? <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" aria-hidden="true" />
                    : <Circle className="h-4 w-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
                  }
                  <div className="min-w-0">
                    <div className="text-sm text-white">{phase.name}</div>
                    <div className="text-xs text-gray-400">{phase.description}</div>
                    {isDone && metricsText && (
                      <div className="text-xs text-gray-500 mt-0.5">{metricsText}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRunPhase(phase.id)}
                  disabled={isRunning}
                  className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors flex-shrink-0 ml-2 min-h-[44px]"
                  aria-label={isDone ? `Re-run phase ${phase.id}` : `Run phase ${phase.id}`}
                >
                  {isRunning
                    ? <RotateCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                    : <Play className="h-3 w-3" aria-hidden="true" />
                  }
                  {isDone ? 'Re-Run' : 'Run Now'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {uncheckedCount > 0 && (
        <button
          onClick={handleRunAll}
          disabled={running !== null}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors min-h-[44px]"
          aria-label="Run all unchecked phases"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          Run All Unchecked Phases ({uncheckedCount})
        </button>
      )}
    </div>
  );
}
