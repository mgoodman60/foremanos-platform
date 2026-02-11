'use client';

import React from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react';

interface ProcessingLog {
  phasesCompleted: string[];
  totalDuration: number;
  pagesProcessed: number;
  errors?: string[];
  processingDate: string;
  cost?: number;
}

interface Props {
  log: ProcessingLog;
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

export default function ProcessingLogPanel({ log }: Props) {
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
