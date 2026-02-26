'use client';

import React from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DocumentNode, DocumentReference } from './types';
import { getReferenceTypeBadge, getReferenceTypeIcon } from './reference-helpers';

interface ReferenceNetworkTabProps {
  nodes: DocumentNode[];
  referencesByDoc: Record<string, DocumentReference[]>;
  expandedDocs: Set<string>;
  searchQuery: string;
  filterType: string;
  selectedDoc: string;
  onToggleDoc: (docId: string) => void;
  onJumpToDocument: (docId: string, docName: string) => void;
  generateReferenceSummary: (ref: DocumentReference) => string;
}

export const ReferenceNetworkTab = React.memo(function ReferenceNetworkTab({
  nodes,
  referencesByDoc,
  expandedDocs,
  searchQuery,
  filterType,
  selectedDoc,
  onToggleDoc,
  onJumpToDocument,
  generateReferenceSummary,
}: ReferenceNetworkTabProps) {
  return (
    <div className="p-4 space-y-2">
      {nodes
        .filter(node => {
          const hasRefs = (node.outgoingRefs + node.incomingRefs) > 0;
          if (!hasRefs) return false;
          if (selectedDoc !== 'all' && node.id !== selectedDoc) return false;
          return true;
        })
        .sort((a, b) => (b.outgoingRefs + b.incomingRefs) - (a.outgoingRefs + a.incomingRefs))
        .map((node) => {
          const docRefs = referencesByDoc[node.id] || [];
          const filteredDocRefs = docRefs.filter((ref: any) => {
            if (searchQuery) {
              const query = searchQuery.toLowerCase();
              return (
                ref.context.toLowerCase().includes(query) ||
                ref.location.toLowerCase().includes(query)
              );
            }
            if (filterType !== 'all' && ref.referenceType !== filterType) return false;
            return true;
          });

          if (filteredDocRefs.length === 0 && (searchQuery || filterType !== 'all')) {
            return null;
          }

          return (
            <div key={node.id}>
              {/* Document Header */}
              <button
                onClick={() => onToggleDoc(node.id)}
                className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-left hover:bg-dark-hover transition-colors"
              >
                {expandedDocs.has(node.id) ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="flex-1 font-medium text-slate-50">{node.name}</span>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="text-green-400">
                    {node.outgoingRefs} out
                  </Badge>
                  <Badge variant="secondary" className="text-orange-400">
                    {node.incomingRefs} in
                  </Badge>
                </div>
              </button>

              {/* Document References */}
              {expandedDocs.has(node.id) && filteredDocRefs.length > 0 && (
                <div className="ml-6 mt-1 space-y-1">
                  {filteredDocRefs.map((ref: any, idx: number) => {
                    const summary = generateReferenceSummary(ref);
                    return (
                      <div
                        key={`${ref.sourceDocumentId}-${ref.targetDocumentId}-${idx}`}
                        className="flex items-start gap-3 rounded-lg border border-gray-700 bg-dark-surface p-3 text-sm hover:border-blue-500 transition-all"
                      >
                        <div className="mt-1">
                          {getReferenceTypeIcon(ref.referenceType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400">{ref.location}</span>
                            {getReferenceTypeBadge(ref.referenceType)}
                          </div>
                          <p className="text-xs text-gray-400 mb-1">{summary}</p>
                          <p className="text-xs text-gray-400 mb-2 italic">&quot;{ref.context}&quot;</p>
                          <button
                            onClick={() => onJumpToDocument(ref.targetDocumentId, ref.targetDoc?.name || 'Unknown')}
                            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <ArrowRight className="h-3 w-3" />
                            <span>{ref.targetDoc?.name || 'Unknown Document'}</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
});
