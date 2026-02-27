'use client';

import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface DisciplineBreakdown {
  discipline: string;
  count: number;
}

interface DrawingTypeBreakdown {
  type: string;
  count: number;
}

interface Summary {
  totalSheets: number;
  disciplineBreakdown: DisciplineBreakdown[];
  drawingTypeBreakdown: DrawingTypeBreakdown[];
  averageConfidence: number | null;
  lowConfidenceCount: number;
  fixtureCount: number;
  roomCount: number;
  avgQualityScore?: number | null;
  correctionPassesRun?: number;
  deadLetterCount?: number;
  pendingQuestionCount?: number;
}

interface Props {
  summary: Summary;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.6) return 'text-yellow-600';
  return 'text-red-600';
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-50';
  if (confidence >= 0.6) return 'bg-yellow-50';
  return 'bg-red-50';
}

export default function IntelligenceSummary({ summary }: Props) {
  if (!summary) {
    return null;
  }

  const confidenceColor = summary.averageConfidence != null ? getConfidenceColor(summary.averageConfidence) : 'text-gray-600';
  const confidenceBg = summary.averageConfidence != null ? getConfidenceBg(summary.averageConfidence) : 'bg-gray-50';

  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Intelligence Summary
      </h3>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-600 mb-1">Total Sheets</div>
          <div className="text-xl font-bold text-gray-900">{summary.totalSheets}</div>
        </div>

        <div className={`rounded-lg p-3 ${confidenceBg}`}>
          <div className="text-xs text-gray-600 mb-1">Avg Confidence</div>
          <div className={`text-xl font-bold ${confidenceColor}`}>
            {summary.averageConfidence != null
              ? `${Math.round(summary.averageConfidence * 100)}%`
              : 'N/A'}
          </div>
        </div>

        <div className={`rounded-lg p-3 ${summary.lowConfidenceCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className="text-xs text-gray-600 mb-1">Low Confidence</div>
          <div className={`text-xl font-bold ${summary.lowConfidenceCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {summary.lowConfidenceCount}
          </div>
        </div>

        {summary.roomCount !== undefined && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Rooms</div>
            <div className="text-xl font-bold text-gray-900">{summary.roomCount}</div>
          </div>
        )}

        {summary.fixtureCount !== undefined && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Fixtures</div>
            <div className="text-xl font-bold text-gray-900">{summary.fixtureCount}</div>
          </div>
        )}

        {summary.avgQualityScore != null && (
          <div className={`rounded-lg p-3 ${(summary.avgQualityScore || 0) >= 60 ? 'bg-green-50' : (summary.avgQualityScore || 0) >= 40 ? 'bg-yellow-50' : 'bg-red-50'}`}>
            <div className="text-xs text-gray-600 mb-1">Avg Quality</div>
            <div className={`text-xl font-bold ${(summary.avgQualityScore || 0) >= 60 ? 'text-green-600' : (summary.avgQualityScore || 0) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
              {Math.round(summary.avgQualityScore)}
            </div>
          </div>
        )}

        {summary.correctionPassesRun != null && summary.correctionPassesRun > 0 && (
          <div className="bg-cyan-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Corrections</div>
            <div className="text-xl font-bold text-cyan-600">{summary.correctionPassesRun}</div>
          </div>
        )}

        {summary.deadLetterCount != null && summary.deadLetterCount > 0 && (
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Dead Letters</div>
            <div className="text-xl font-bold text-red-600">{summary.deadLetterCount}</div>
          </div>
        )}

        {summary.pendingQuestionCount != null && summary.pendingQuestionCount > 0 && (
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Questions</div>
            <div className="text-xl font-bold text-yellow-600">{summary.pendingQuestionCount}</div>
          </div>
        )}
      </div>

      {/* Discipline Breakdown */}
      {summary.disciplineBreakdown && summary.disciplineBreakdown.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Disciplines
          </h4>
          <div className="flex flex-wrap gap-2">
            {summary.disciplineBreakdown.map((item, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
              >
                {item.discipline} ({item.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Drawing Type Breakdown */}
      {summary.drawingTypeBreakdown && summary.drawingTypeBreakdown.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Drawing Types
          </h4>
          <div className="space-y-2">
            {summary.drawingTypeBreakdown.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <div className="flex-1 min-w-0">
                  <span className="text-gray-900 font-medium truncate block">
                    {item.type}
                  </span>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${(item.count / summary.totalSheets) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-gray-600 font-mono w-8 text-right">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning for low confidence */}
      {summary.lowConfidenceCount > 0 && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs text-yellow-800">
            <span className="font-semibold">{summary.lowConfidenceCount} sheet{summary.lowConfidenceCount !== 1 ? 's' : ''}</span>{' '}
            with low confidence (&lt;60%). Review these sheets for accuracy.
          </div>
        </div>
      )}
    </div>
  );
}
