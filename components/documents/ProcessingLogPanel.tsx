'use client';

import React from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, DollarSign, Layers } from 'lucide-react';

interface ProcessingLog {
  phasesCompleted: string[];
  totalDuration: number;
  pagesProcessed: number;
  errors?: string[];
  processingDate: string;
  cost?: number;
}

interface VisionPipeline {
  tierBreakdown: Record<string, number>;
  totalPages: number;
}

interface Props {
  log: ProcessingLog;
  visionPipeline?: VisionPipeline;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

const TIER_COLORS: Record<string, string> = {
  'three-pass': 'bg-green-100 text-green-700',
  'three-pass-gpt-fallback': 'bg-yellow-100 text-yellow-700',
  'extraction-only-skip-validation': 'bg-blue-100 text-blue-700',
  'extraction-only': 'bg-blue-100 text-blue-700',
  'unknown': 'bg-gray-100 text-gray-500',
};

function getPassStatus(tierBreakdown: Record<string, number>) {
  const threePassPages = (tierBreakdown['three-pass'] || 0) + (tierBreakdown['three-pass-gpt-fallback'] || 0);
  const totalPages = Object.values(tierBreakdown).reduce((a, b) => a + b, 0);
  const extractionOnlyPages = (tierBreakdown['extraction-only-skip-validation'] || 0) + (tierBreakdown['extraction-only'] || 0);
  return {
    pass1: totalPages > 0,
    pass2: threePassPages > 0,
    pass3: threePassPages > 0,
    threePassPages,
    extractionOnlyPages,
  };
}

function formatTierLabel(tier: string): string {
  return tier
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function ProcessingLogPanel({ log, visionPipeline }: Props) {
  if (!log) {
    return null;
  }

  const allPhases = ['Phase A', 'Phase B', 'Phase C'];

  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-gray-600" aria-hidden="true" />
        Processing Log
      </h3>

      {/* Processing Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-600 mb-1">Duration</div>
          <div className="text-lg font-bold text-gray-900">
            {formatDuration(log.totalDuration)}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-600 mb-1">Pages</div>
          <div className="text-lg font-bold text-gray-900">{log.pagesProcessed}</div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-600 mb-1">Processed</div>
          <div className="text-sm font-medium text-gray-700">
            {formatDate(log.processingDate)}
          </div>
        </div>

        {log.cost !== undefined && log.cost !== null && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
              <DollarSign className="h-3 w-3" aria-hidden="true" />
              Cost
            </div>
            <div className="text-lg font-bold text-gray-900">
              ${log.cost.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Vision Pipeline */}
      {visionPipeline && visionPipeline.totalPages > 0 && (() => {
        const status = getPassStatus(visionPipeline.tierBreakdown);
        const passes = [
          { label: 'Pass 1', provider: 'Gemini Pro 3', detail: 'Extraction', active: status.pass1 },
          { label: 'Pass 2', provider: 'Gemini 2.5 Pro', detail: 'Validation', active: status.pass2 },
          { label: 'Pass 3', provider: 'Claude Opus / GPT-5.2', detail: 'Interpretation', active: status.pass3 },
        ];
        return (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              Vision Pipeline
            </h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {passes.map((pass) => (
                <div
                  key={pass.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                    pass.active
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {pass.active ? (
                    <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{pass.label}:</span>
                  <span className="font-normal">{pass.provider}</span>
                  <span className="text-[10px] opacity-70">({pass.detail})</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(visionPipeline.tierBreakdown).map(([tier, count]) => (
                <span
                  key={tier}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    TIER_COLORS[tier] || TIER_COLORS['unknown']
                  }`}
                >
                  {formatTierLabel(tier)}: {count} {count === 1 ? 'page' : 'pages'}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Phase Completion Status */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
          Processing Phases
        </h4>
        <div className="flex flex-wrap gap-2">
          {allPhases.map((phase) => {
            const completed = log.phasesCompleted?.includes(phase);
            return (
              <div
                key={phase}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium min-h-[44px] ${
                  completed
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {completed ? (
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {phase}
              </div>
            );
          })}
        </div>
      </div>

      {/* Errors */}
      {log.errors && log.errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-red-900 mb-2">
                Processing Errors
              </h4>
              <ul className="space-y-1">
                {log.errors.map((error, idx) => (
                  <li key={idx} className="text-xs text-red-700">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
