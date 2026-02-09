'use client';

import React from 'react';
import { DISCIPLINE_COLORS, getConfidenceLevel, getDrawingTypeLabel } from '@/lib/discipline-colors';

interface IntelligenceData {
  sheetCount?: number;
  disciplines?: string[];
  drawingTypes?: Record<string, number>;
  averageConfidence?: number | null;
  lowConfidenceCount?: number;
}

interface Props {
  intelligence: IntelligenceData | null;
  compact?: boolean;
}

export default function DocumentIntelligenceBadges({ intelligence, compact = false }: Props) {
  if (!intelligence || !intelligence.sheetCount) return null;

  const confidenceLevel = getConfidenceLevel(intelligence.averageConfidence ?? null);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{intelligence.sheetCount} sheets</span>
        {intelligence.averageConfidence != null && (
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: confidenceLevel.dot }}
            />
            {Math.round(intelligence.averageConfidence * 100)}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      {/* Discipline pills */}
      {intelligence.disciplines?.map(d => {
        const colors = DISCIPLINE_COLORS[d] || DISCIPLINE_COLORS['General'];
        return (
          <span
            key={d}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
            style={{ backgroundColor: `${colors.dot}15`, color: colors.dot }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: colors.dot }}
            />
            {d}
          </span>
        );
      })}

      {/* Sheet count */}
      <span className="text-xs text-gray-500">{intelligence.sheetCount} sheets</span>

      {/* Top drawing types */}
      {intelligence.drawingTypes && Object.entries(intelligence.drawingTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([type, count]) => (
          <span key={type} className="text-xs text-gray-400">
            {count} {getDrawingTypeLabel(type)}
          </span>
        ))
      }

      {/* Confidence dot */}
      {intelligence.averageConfidence != null && (
        <span
          className="flex items-center gap-1 text-xs"
          title={`Average confidence: ${Math.round(intelligence.averageConfidence * 100)}%`}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: confidenceLevel.dot }}
          />
          {Math.round(intelligence.averageConfidence * 100)}%
        </span>
      )}
    </div>
  );
}
