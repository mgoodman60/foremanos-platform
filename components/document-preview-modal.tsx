"use client";

import { useState, useEffect } from 'react';
import { X, Download, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentPreviewModalProps {
  document: {
    id: string;
    name: string;
    fileType: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentPreviewModal({ document: doc, isOpen, onClose }: DocumentPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(100);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.document.addEventListener('keydown', handleEscape);
    return () => window.document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(false);
      setZoom(100);
    }
  }, [isOpen, doc?.id]);

  if (!isOpen || !doc) return null;

  const handleDownload = async () => {
    try {
      // Fetch the signed URL from the API
      const response = await fetch(`/api/documents/${doc.id}?download=true`);
      if (!response.ok) throw new Error('Failed to generate download URL');
      
      const data = await response.json();
      
      // Use the returned URL to trigger download
      if (data.url) {
        const a = window.document.createElement('a');
        a.href = data.url;
        a.download = data.fileName || doc.name;
        a.target = '_blank';
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        toast.success('✓ Document downloaded');
      } else {
        throw new Error('No download URL returned');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  const zoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const zoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-dialog-title"
    >
      <div className="bg-[#2d333b] border border-gray-700 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex-1 min-w-0">
            <h3 id="preview-dialog-title" className="text-lg font-semibold text-[#F8FAFC] truncate">
              {doc.name}
            </h3>
            <p className="text-sm text-gray-400">
              {doc.fileType.toUpperCase()} Document
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2 ml-4">
            {/* Zoom Controls */}
            {(doc.fileType.toLowerCase() === 'pdf' || doc.fileType.toLowerCase() === 'docx') && (
              <div className="flex items-center gap-1 border-r border-gray-700 pr-3">
                <button
                  onClick={zoomOut}
                  className="p-2 hover:bg-[#1F2328] rounded-lg transition-colors"
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4 text-gray-400" />
                </button>
                <span className="text-sm text-gray-400 min-w-[3rem] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={zoomIn}
                  className="p-2 hover:bg-[#1F2328] rounded-lg transition-colors"
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            )}
            
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-[#F97316] hover:text-white rounded-lg transition-all text-gray-400"
              aria-label="Download document"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-900/30 hover:text-red-400 rounded-lg transition-colors text-gray-400"
              aria-label="Close preview"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden bg-[#1F2328] flex items-center justify-center">
          {loading && !error && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
              <p className="text-gray-400">Loading preview...</p>
            </div>
          )}
          
          {error && (
            <div className="flex flex-col items-center gap-3 max-w-md text-center px-4">
              <div className="w-16 h-16 bg-[#2d333b] rounded-full flex items-center justify-center border-2 border-gray-700">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="text-lg font-semibold text-[#F8FAFC]">Preview Unavailable</h4>
              <p className="text-sm text-gray-400">
                Unable to load preview for this document. You can still download it to view the contents.
              </p>
              <button
                onClick={handleDownload}
                className="mt-4 px-6 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-colors"
              >
                Download Document
              </button>
            </div>
          )}
          
          {!error && (
            <div className="w-full h-full overflow-auto p-4">
              <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
                <iframe
                  src={`/api/documents/${doc.id}`}
                  className="w-full h-full min-h-[800px] bg-white rounded-lg shadow-lg"
                  title={`Preview of ${doc.name}`}
                  onLoad={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setError(true);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-[#2d333b]">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-2 py-1 bg-[#1F2328] border border-gray-600 rounded text-gray-400">ESC</kbd> to close preview
          </p>
        </div>
      </div>
    </div>
  );
}
