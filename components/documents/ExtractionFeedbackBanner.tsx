'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, X, Eye, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { getDrawingTypeLabel } from '@/lib/discipline-colors';

interface Props {
  documentName: string;
  documentId: string;
  projectSlug: string;
  intelligence: {
    sheetCount: number;
    disciplines: string[];
    drawingTypes: Record<string, number>;
    averageConfidence: number | null;
    lowConfidenceCount: number;
  };
  onDismiss: () => void;
}

export default function ExtractionFeedbackBanner({ documentName, documentId, projectSlug, intelligence, onDismiss }: Props) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 30000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  const typesSummary = Object.entries(intelligence.drawingTypes)
    .sort(([,a], [,b]) => b - a)
    .map(([type, count]) => `${count} ${getDrawingTypeLabel(type)}${count > 1 ? 's' : ''}`)
    .join(', ');

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-800">
            Processing complete for &ldquo;{documentName}&rdquo;
          </p>
          <p className="text-sm text-green-700 mt-1">
            {intelligence.sheetCount} sheets: {typesSummary}
          </p>
          <div className="flex items-center gap-4 mt-1 text-sm text-green-600">
            {intelligence.averageConfidence != null && (
              <span>{Math.round(intelligence.averageConfidence * 100)}% avg confidence</span>
            )}
            <span>{intelligence.disciplines.join(', ')}</span>
          </div>
          {intelligence.lowConfidenceCount > 0 && (
            <div className="flex items-center gap-1 mt-2 text-sm text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {intelligence.lowConfidenceCount} sheet{intelligence.lowConfidenceCount > 1 ? 's' : ''} had low confidence -- review recommended
            </div>
          )}
          <Link
            href={`/project/${projectSlug}/documents/${documentId}`}
            className="inline-flex items-center gap-1 mt-2 text-sm text-green-700 hover:text-green-900 font-medium"
          >
            <Eye className="h-3.5 w-3.5" /> View Details
          </Link>
        </div>
        <button
          onClick={() => { setVisible(false); onDismiss(); }}
          className="text-green-400 hover:text-green-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Dismiss extraction feedback"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
