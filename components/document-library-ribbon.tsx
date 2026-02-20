'use client';

import { useState, useEffect } from 'react';
import { FileText, ChevronDown, ChevronRight, Download, Eye, FileImage, Lock, Globe, Shield } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import DocumentPreviewModal from './document-preview-modal';

interface DocumentLibraryRibbonProps {
  projectId: string;
  userRole?: string;
}

interface Document {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  accessLevel: string;
  filePath: string | null;
  fileSize: number | null;
  lastModified: string | null;
  updatedAt: string;
}

export function DocumentLibraryRibbon({ projectId, userRole }: DocumentLibraryRibbonProps) {
  const { data: session } = useSession() || {};
  const _effectiveRole = userRole || session?.user?.role || 'guest';
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchDocuments();
    }
  }, [projectId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/documents?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      // Fetch the signed URL from the API
      const response = await fetch(`/api/documents/${doc.id}?download=true`);
      if (!response.ok) throw new Error('Failed to generate download URL');
      
      const data = await response.json();
      
      // Use the returned URL to trigger download
      if (data.url) {
        const a = document.createElement('a');
        a.href = data.url;
        a.download = data.fileName || doc.fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Document downloaded');
      } else {
        throw new Error('No download URL returned');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  const handlePreview = (doc: Document) => {
    setPreviewDocument(doc);
    setPreviewModalOpen(true);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return <FileImage aria-hidden="true" className="h-4 w-4" />;
    return <FileText aria-hidden="true" className="h-4 w-4" />;
  };

  const getAccessIcon = (accessLevel: string) => {
    switch (accessLevel) {
      case 'admin':
        return <Lock aria-hidden="true" className="h-3 w-3 text-purple-400" />;
      case 'client':
        return <Shield aria-hidden="true" className="h-3 w-3 text-blue-400" />;
      case 'guest':
        return <Globe aria-hidden="true" className="h-3 w-3 text-green-400" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
    return `${Math.round(mb * 10) / 10} MB`;
  };

  return (
    <>
      <div className="border-b border-gray-700 bg-dark-surface">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-dark-card transition-colors"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
            <FileText aria-hidden="true" className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-slate-50">Documents</span>
            <span className="text-xs text-gray-400">({documents.length})</span>
          </div>
        </button>

        {/* Document List */}
        {isExpanded && (
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto"></div>
                <p className="text-xs text-gray-400 mt-2">Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-4 text-center">
                <FileText aria-hidden="true" className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No documents yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2 hover:bg-dark-card transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-gray-400">
                        {getFileIcon(doc.fileType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-medium text-slate-50 truncate">
                            {doc.name}
                          </p>
                          {getAccessIcon(doc.accessLevel)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-gray-400">
                            {formatFileSize(doc.fileSize)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={() => handlePreview(doc)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-orange-500 hover:bg-dark-surface"
                          title="Preview"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={() => handleDownload(doc)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-orange-500 hover:bg-dark-surface"
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          isOpen={previewModalOpen}
          onClose={() => {
            setPreviewModalOpen(false);
            setPreviewDocument(null);
          }}
          document={previewDocument}
        />
      )}
    </>
  );
}
