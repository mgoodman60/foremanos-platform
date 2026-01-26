'use client';

import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, ExternalLink, Book } from 'lucide-react';

export interface Citation {
  id: string;
  documentName: string;
  documentId: string;
  pageNumber?: number | null;
  sheetNumber?: string | null;
  excerpt?: string;
  relevanceScore?: number;
}

interface SourceCitationsProps {
  citations: Citation[];
  onDocumentClick?: (documentId: string, pageNumber?: number | null) => void;
}

export function SourceCitations({ citations, onDocumentClick }: SourceCitationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!citations || citations.length === 0) return null;

  // Group citations by document
  const groupedCitations = citations.reduce((acc, citation) => {
    const key = citation.documentId;
    if (!acc[key]) {
      acc[key] = {
        documentName: citation.documentName,
        documentId: citation.documentId,
        pages: []
      };
    }
    if (citation.pageNumber || citation.sheetNumber) {
      acc[key].pages.push({
        pageNumber: citation.pageNumber,
        sheetNumber: citation.sheetNumber,
        excerpt: citation.excerpt
      });
    }
    return acc;
  }, {} as Record<string, { documentName: string; documentId: string; pages: Array<{ pageNumber?: number | null; sheetNumber?: string | null; excerpt?: string }> }>);

  const uniqueDocs = Object.values(groupedCitations);
  const visibleDocs = isExpanded ? uniqueDocs : uniqueDocs.slice(0, 2);

  return (
    <div className="mt-3 border-t border-gray-700 pt-3">
      <div className="flex items-center gap-2 mb-2">
        <Book className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Sources ({uniqueDocs.length} document{uniqueDocs.length !== 1 ? 's' : ''})
        </span>
      </div>
      
      <div className="space-y-2">
        {visibleDocs.map((doc, idx) => (
          <div
            key={doc.documentId + idx}
            className="flex items-start gap-2 p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors group cursor-pointer"
            onClick={() => onDocumentClick?.(doc.documentId, doc.pages[0]?.pageNumber)}
          >
            <FileText className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300 truncate font-medium">
                  {doc.documentName}
                </span>
                <ExternalLink className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {doc.pages.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {doc.pages.slice(0, 5).map((page, pageIdx) => (
                    <span
                      key={pageIdx}
                      className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded"
                    >
                      {page.sheetNumber || `Page ${page.pageNumber}`}
                    </span>
                  ))}
                  {doc.pages.length > 5 && (
                    <span className="text-xs px-1.5 py-0.5 text-gray-500">
                      +{doc.pages.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {uniqueDocs.length > 2 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show {uniqueDocs.length - 2} more source{uniqueDocs.length - 2 !== 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  );
}
