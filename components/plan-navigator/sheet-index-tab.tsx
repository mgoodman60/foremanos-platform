'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileStack,
  FileText,
  FolderOpen,
  Hash,
  Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SheetDocument } from './types';
import { DISCIPLINE_CONFIG } from './discipline-utils';

interface SheetIndexTabProps {
  documentsByDiscipline: Record<string, SheetDocument[]>;
  disciplineOrder: string[];
  expandedDisciplines: Set<string>;
  sheetSearch: string;
  onToggleDiscipline: (discipline: string) => void;
  onJumpToDocument: (docId: string, docName: string) => void;
}

export const SheetIndexTab = React.memo(function SheetIndexTab({
  documentsByDiscipline,
  disciplineOrder,
  expandedDisciplines,
  sheetSearch,
  onToggleDiscipline,
  onJumpToDocument,
}: SheetIndexTabProps) {
  const hasDocuments = Object.keys(documentsByDiscipline).length > 0;

  return (
    <div className="p-4 space-y-2">
      {!hasDocuments ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <FileStack className="mx-auto mb-3 h-12 w-12 text-gray-600" />
            <p className="text-sm text-gray-400">
              {sheetSearch ? 'No sheets match your search' : 'No documents found'}
            </p>
            <p className="mt-2 text-xs text-gray-400">Upload documents to see them organized here</p>
          </div>
        </div>
      ) : (
        <>
          {disciplineOrder
            .filter(d => documentsByDiscipline[d]?.length > 0)
            .map((discipline) => {
              const docs = documentsByDiscipline[discipline];
              const config = DISCIPLINE_CONFIG[discipline] || { icon: FileText, color: 'text-gray-400', patterns: [] };
              const Icon = config.icon;

              return (
                <div key={discipline}>
                  {/* Discipline Header */}
                  <button
                    onClick={() => onToggleDiscipline(discipline)}
                    className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-left hover:bg-dark-hover transition-colors"
                  >
                    {expandedDisciplines.has(discipline) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className="flex-1 font-medium text-slate-50">{discipline}</span>
                    <Badge variant="secondary" className="text-xs">
                      {docs.length} sheets
                    </Badge>
                  </button>

                  {/* Sheets in Discipline */}
                  {expandedDisciplines.has(discipline) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {docs.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => onJumpToDocument(doc.id, doc.name)}
                          className="flex w-full items-center gap-3 rounded-lg border border-gray-700 bg-dark-surface p-3 text-left hover:border-blue-500 hover:bg-dark-card transition-all group"
                        >
                          {/* Sheet Number */}
                          {doc.sheetNumber ? (
                            <div className="flex-shrink-0 w-16 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-center">
                              <span className="text-sm font-mono font-medium text-blue-400">{doc.sheetNumber}</span>
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-16 px-2 py-1 bg-gray-500/20 border border-gray-500/30 rounded text-center">
                              <Hash className="h-4 w-4 text-gray-400 mx-auto" />
                            </div>
                          )}

                          {/* Sheet Name & Summary */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-50 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{doc.summary}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{doc.category}</p>
                          </div>

                          {/* View Icon */}
                          <Eye className="h-4 w-4 text-gray-400 group-hover:text-blue-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {/* "Other" discipline rendered last if not in the ordered list */}
          {documentsByDiscipline['Other']?.length > 0 && !disciplineOrder.includes('Other') && (
            <div>
              <button
                onClick={() => onToggleDiscipline('Other')}
                className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-left hover:bg-dark-hover transition-colors"
              >
                {expandedDisciplines.has('Other') ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
                <FolderOpen className="h-4 w-4 text-gray-400" />
                <span className="flex-1 font-medium text-slate-50">Other Documents</span>
                <Badge variant="secondary" className="text-xs">
                  {documentsByDiscipline['Other'].length}
                </Badge>
              </button>
              {expandedDisciplines.has('Other') && (
                <div className="ml-6 mt-1 space-y-1">
                  {documentsByDiscipline['Other'].map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => onJumpToDocument(doc.id, doc.name)}
                      className="flex w-full items-center gap-3 rounded-lg border border-gray-700 bg-dark-surface p-3 text-left hover:border-blue-500 hover:bg-dark-card transition-all group"
                    >
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-50 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{doc.summary}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{doc.category}</p>
                      </div>
                      <Eye className="h-4 w-4 text-gray-400 group-hover:text-blue-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
});
