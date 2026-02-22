'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  FileText,
  Eye,
  Search,
  X,
  FileCheck,
  AlertCircle,
  Layers,
  Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InteractivePlanViewer } from './interactive-plan-viewer';
import { toast } from 'sonner';

interface Document {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  createdAt: string;
  processed: boolean;
}

interface PlanViewerSelectorProps {
  projectSlug: string;
  onClose?: () => void;
}

export function PlanViewerSelector({ projectSlug, onClose }: PlanViewerSelectorProps) {
  const { data: _session } = useSession() || {};
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<{
    id: string;
    name: string;
    totalPages: number;
  } | null>(null);

  useEffect(() => {
    if (projectSlug) {
      fetchDocuments();
    }
  }, [projectSlug]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/documents`);
      if (!response.ok) throw new Error('Failed to fetch documents');

      const data = await response.json();
      // Handle both { documents: [...] } and flat array formats
      const docs = Array.isArray(data) ? data : (data.documents || []);
      
      // Filter for plan documents (PDFs) - show ALL PDFs for viewing, not just those named "plan"
      const plans = docs.filter((doc: Document) => 
        doc.fileType === 'pdf' || doc.fileType === 'application/pdf' || doc.fileType?.includes('pdf')
      );
      setDocuments(plans);
    } catch (error: unknown) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load plan documents');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPlan = async (doc: Document) => {
    try {
      // Fetch metadata to get total pages
      const response = await fetch(`/api/projects/${projectSlug}/plans/${doc.id}/metadata`);
      if (!response.ok) throw new Error('Failed to fetch plan metadata');

      const metadata = await response.json();
      setSelectedDocument({
        id: doc.id,
        name: doc.name,
        totalPages: metadata.totalPages || 1
      });
    } catch (error: unknown) {
      console.error('Error loading plan:', error);
      toast.error('Failed to load plan viewer');
    }
  };

  const getFilteredDocuments = (): Document[] => {
    return documents.filter((doc) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return doc.name.toLowerCase().includes(query) ||
               doc.fileName.toLowerCase().includes(query);
      }
      return true;
    });
  };

  const filteredDocs = getFilteredDocuments();

  // If a document is selected, show the plan viewer
  if (selectedDocument) {
    return (
      <InteractivePlanViewer
        projectSlug={projectSlug}
        documentId={selectedDocument.id}
        documentName={selectedDocument.name}
        totalPages={selectedDocument.totalPages}
        onClose={() => setSelectedDocument(null)}
      />
    );
  }

  // Otherwise, show the document selector
  return (
    <div className="flex h-full flex-col bg-dark-surface text-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Select Plan to View</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="border-b border-gray-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search plan documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-dark-card border-gray-600 pl-10 text-slate-50 placeholder:text-gray-400"
          />
        </div>

        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="mt-2 w-full text-blue-500 hover:text-blue-400 hover:bg-dark-card"
          >
            <X className="mr-2 h-4 w-4" />
            Clear Search
          </Button>
        )}
      </div>

      {/* Document List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Loader2 className="animate-spin text-orange-500 h-8 w-8 mb-2 inline-block" />
              <p className="text-sm text-gray-400">Loading plan documents...</p>
            </div>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Layers className="mx-auto mb-3 h-12 w-12 text-gray-600" />
              <p className="text-sm text-gray-400">
                {searchQuery
                  ? 'No plan documents match your search'
                  : 'No plan documents found'}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                {searchQuery
                  ? 'Try adjusting your search'
                  : 'Upload PDF plans to view them here'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {filteredDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleViewPlan(doc)}
                className="flex w-full items-start gap-3 rounded-lg border border-gray-700 bg-dark-card p-4 text-left hover:border-blue-500 hover:bg-dark-hover transition-all"
              >
                {/* Icon */}
                <div className="mt-1">
                  {doc.processed ? (
                    <FileCheck className="h-5 w-5 text-green-500" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-400" />
                  )}
                </div>

                {/* Document Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-slate-50 truncate">{doc.name}</h3>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {doc.fileType.toUpperCase()}
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-400 mb-2 truncate">{doc.fileName}</p>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-400">
                      Uploaded: {new Date(doc.createdAt).toLocaleDateString()}
                    </span>

                    {doc.processed ? (
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-700">
                        <FileCheck className="mr-1 h-3 w-3" />
                        Processed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-700">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Not Processed
                      </Badge>
                    )}
                  </div>
                </div>

                {/* View Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-blue-600 text-blue-400 hover:bg-blue-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewPlan(doc);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Button>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Info Bar */}
      {filteredDocs.length > 0 && (
        <div className="border-t border-gray-700 p-3 text-center text-xs text-gray-400">
          {filteredDocs.length} plan document{filteredDocs.length !== 1 ? 's' : ''} available
        </div>
      )}
    </div>
  );
}
