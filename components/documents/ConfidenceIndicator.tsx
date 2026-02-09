'use client';

import React from 'react';
import { getConfidenceLevel } from '@/lib/discipline-colors';

interface Props {
  confidence: number | null;
}

export default function ConfidenceIndicator({ confidence }: Props) {
  const level = getConfidenceLevel(confidence);
  const pct = confidence !== null && confidence !== undefined
    ? `${Math.round(confidence * 100)}%`
    : 'N/A';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${level.bg} ${level.color}`}
      title={`Confidence: ${pct} (${level.label})`}
      aria-label={`Extraction confidence: ${pct}`}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: level.dot }}
        aria-hidden="true"
      />
      {pct}
    </span>
  );
}
