'use client';

import React from 'react';
import { getDisciplineColor, getDrawingTypeLabel } from '@/lib/discipline-colors';

interface Props {
  sheets: any[];
  drawingTypes: any[];
  selectedSheet: string | null;
  onSelectSheet: (sheet: string) => void;
  qualityScores?: Record<number, { score: number | null; isDeadLetter: boolean }>;
}

export default function SheetNavigator({ sheets, drawingTypes, selectedSheet, onSelectSheet, qualityScores }: Props) {
  const typeMap: Record<string, any> = {};
  for (const dt of drawingTypes) {
    typeMap[dt.sheetNumber] = dt;
  }

  const grouped: Record<string, any[]> = {};
  for (const sheet of sheets) {
    const discipline = sheet.discipline || 'General';
    if (!grouped[discipline]) grouped[discipline] = [];
    grouped[discipline].push(sheet);
  }

  const sortedDisciplines = Object.keys(grouped).sort();

  return (
    <div className="py-2">
      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Sheets ({sheets.length})
      </div>
      {sortedDisciplines.map(discipline => {
        const color = getDisciplineColor(discipline);
        return (
          <div key={discipline} role="group" aria-label={`${discipline} sheets`}>
            <div
              className={`px-3 py-1.5 text-xs font-medium ${color.text} ${color.bg} border-l-2`}
              style={{ borderColor: color.dot }}
            >
              {discipline} ({grouped[discipline].length})
            </div>
            {grouped[discipline].map(sheet => {
              const dt = typeMap[sheet.sheetNumber];
              const isSelected = sheet.sheetNumber === selectedSheet;
              return (
                <button
                  key={sheet.sheetNumber}
                  onClick={() => onSelectSheet(sheet.sheetNumber)}
                  aria-current={isSelected ? 'page' : undefined}
                  className={`w-full text-left px-3 py-2 text-sm border-l-2 transition-colors min-h-[44px] ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 text-blue-900'
                      : 'border-transparent hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{sheet.sheetNumber}</span>
                    {qualityScores && sheet.pageNumber != null && qualityScores[sheet.pageNumber] && (
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          qualityScores[sheet.pageNumber].isDeadLetter ? 'bg-gray-400' :
                          (qualityScores[sheet.pageNumber].score || 0) >= 60 ? 'bg-green-500' :
                          (qualityScores[sheet.pageNumber].score || 0) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        title={`Quality: ${qualityScores[sheet.pageNumber].score ?? 'N/A'}/100`}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {dt ? getDrawingTypeLabel(dt.type) : 'Unknown type'}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
