'use client';

import React from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Eye,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
} from 'lucide-react';
import { WithTooltip } from '@/components/ui/icon-button';
import { DocumentReference } from './types';
import { getReferenceTypeBadge, getReferenceTypeIcon } from './reference-helpers';

interface ReferenceListTabProps {
  filteredRefs: DocumentReference[];
  expandedRefs: Set<string>;
  sheetPreviews: Record<string, string>;
  loadingPreviews: Set<string>;
  onToggleRefExpansion: (refKey: string, sourceDocId: string, targetDocId: string) => void;
  onJumpToDocument: (docId: string, docName: string) => void;
  generateReferenceSummary: (ref: DocumentReference) => string;
}

export const ReferenceListTab = React.memo(function ReferenceListTab({
  filteredRefs,
  expandedRefs,
  sheetPreviews,
  loadingPreviews,
  onToggleRefExpansion,
  onJumpToDocument,
  generateReferenceSummary,
}: ReferenceListTabProps) {
  return (
    <div className="p-4 space-y-3">
      {filteredRefs.map((ref, idx) => {
        const refKey = `${ref.sourceDocumentId}-${ref.targetDocumentId}-${idx}`;
        const isExpanded = expandedRefs.has(refKey);
        const summary = generateReferenceSummary(ref);

        return (
          <div
            key={refKey}
            className="rounded-lg border border-gray-700 bg-dark-card overflow-hidden hover:border-blue-500 transition-all"
          >
            {/* Reference Header - Clickable to expand */}
            <button
              onClick={() => onToggleRefExpansion(refKey, ref.sourceDocumentId, ref.targetDocumentId)}
              className="flex items-center justify-between w-full px-4 py-3 bg-dark-surface border-b border-gray-700 hover:bg-dark-hover transition-colors text-left"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
                <Link2 className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getReferenceTypeBadge(ref.referenceType)}
                    <span className="text-sm font-medium text-gray-200">{ref.location}</span>
                  </div>
                  {/* Summary - Always visible */}
                  <p className="text-xs text-gray-400 mt-1">{summary}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 ml-2">#{idx + 1}</span>
            </button>

            {/* Reference Body - Always show basic info */}
            <div className="p-4">
              {/* Context/Description */}
              <p className="text-sm text-gray-300 mb-4 leading-relaxed italic">&quot;{ref.context}&quot;</p>

              {/* Document Flow - Source to Target */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
                {/* Source Document */}
                <WithTooltip tooltip="View source document">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToDocument(ref.sourceDocumentId, ref.sourceDoc?.name || 'Unknown');
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-colors w-full sm:w-auto"
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate text-sm font-medium">{ref.sourceDoc?.name || 'Source'}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
                  </button>
                </WithTooltip>

                <ArrowRight className="hidden sm:block h-5 w-5 text-gray-400 flex-shrink-0" />
                <span className="sm:hidden text-xs text-gray-400 ml-2">↓ references</span>

                {/* Target Document */}
                <WithTooltip tooltip="View target document">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToDocument(ref.targetDocumentId, ref.targetDoc?.name || 'Unknown');
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300 transition-colors w-full sm:w-auto"
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate text-sm font-medium">{ref.targetDoc?.name || 'Target'}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
                  </button>
                </WithTooltip>
              </div>

              {/* Expanded Section - Sheet Previews */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="text-xs text-gray-400 mb-3 flex items-center gap-2">
                    <Eye className="h-3 w-3" />
                    Sheet Previews
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Source Sheet Preview */}
                    <div className="border border-gray-600 rounded-lg overflow-hidden bg-dark-surface">
                      <div className="px-3 py-2 bg-blue-500/10 border-b border-gray-600">
                        <span className="text-xs font-medium text-blue-400">
                          Source: {ref.sourceDoc?.name || 'Unknown'}
                        </span>
                      </div>
                      <div className="p-3">
                        {loadingPreviews.has(ref.sourceDocumentId) ? (
                          <div className="h-32 flex items-center justify-center">
                            <Loader2 className="animate-spin text-orange-500 h-6 w-6" />
                          </div>
                        ) : sheetPreviews[ref.sourceDocumentId] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={sheetPreviews[ref.sourceDocumentId]}
                            alt={`Preview of ${ref.sourceDoc?.name}`}
                            className="w-full h-32 object-contain bg-white/5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => onJumpToDocument(ref.sourceDocumentId, ref.sourceDoc?.name || 'Unknown')}
                          />
                        ) : (
                          <div
                            className="h-32 flex flex-col items-center justify-center text-gray-400 bg-gray-800/50 rounded cursor-pointer hover:bg-gray-800 transition-colors"
                            onClick={() => onJumpToDocument(ref.sourceDocumentId, ref.sourceDoc?.name || 'Unknown')}
                          >
                            <FileText className="h-8 w-8 mb-2 opacity-50" />
                            <span className="text-xs">Click to view document</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Target Sheet Preview */}
                    <div className="border border-gray-600 rounded-lg overflow-hidden bg-dark-surface">
                      <div className="px-3 py-2 bg-green-500/10 border-b border-gray-600">
                        <span className="text-xs font-medium text-green-400">
                          Target: {ref.targetDoc?.name || 'Unknown'}
                        </span>
                      </div>
                      <div className="p-3">
                        {loadingPreviews.has(ref.targetDocumentId) ? (
                          <div className="h-32 flex items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-r-transparent" />
                          </div>
                        ) : sheetPreviews[ref.targetDocumentId] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={sheetPreviews[ref.targetDocumentId]}
                            alt={`Preview of ${ref.targetDoc?.name}`}
                            className="w-full h-32 object-contain bg-white/5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => onJumpToDocument(ref.targetDocumentId, ref.targetDoc?.name || 'Unknown')}
                          />
                        ) : (
                          <div
                            className="h-32 flex flex-col items-center justify-center text-gray-400 bg-gray-800/50 rounded cursor-pointer hover:bg-gray-800 transition-colors"
                            onClick={() => onJumpToDocument(ref.targetDocumentId, ref.targetDoc?.name || 'Unknown')}
                          >
                            <FileText className="h-8 w-8 mb-2 opacity-50" />
                            <span className="text-xs">Click to view document</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
