'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';

interface Props {
  callouts: any[];
  onNavigateSheet: (sheet: string) => void;
}

export default function CrossReferenceMap({ callouts, onNavigateSheet }: Props) {
  if (callouts.length === 0) {
    return <p className="text-sm text-gray-400 italic">No cross references found</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {callouts.map((callout: any, i: number) => {
        const targetSheet = callout.targetSheet || callout.referencedSheet;
        const label = callout.calloutLabel || callout.detailNumber || `Ref ${i + 1}`;
        const description = callout.description || callout.note;

        return (
          <button
            key={i}
            onClick={() => targetSheet && onNavigateSheet(targetSheet)}
            disabled={!targetSheet}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[44px] ${
              targetSheet
                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer'
                : 'bg-gray-100 text-gray-400 cursor-default'
            }`}
            title={description ? `${label}: ${description}` : label}
            aria-label={targetSheet ? `Navigate to sheet ${targetSheet}` : label}
          >
            <span>{label}</span>
            {targetSheet && (
              <>
                <span className="text-blue-400">&rarr;</span>
                <span>{targetSheet}</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
