"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, Download, Loader2, ZoomIn, ZoomOut, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface DocumentPreviewModalProps {
  document: {
    id: string;
    name: string;
    fileType: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ErrorDetails {
  code: string;
  message: string;
  status: number;
}

export default function DocumentPreviewModal({ document: doc, isOpen, onClose }: DocumentPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>('');
  const [zoom, setZoom] = useState(100);

  const containerRef = useFocusTrap({ isActive: isOpen, onEscape: onClose });

  // Clean up blob URL when it changes or component unmounts
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Fetch document content when modal opens
  useEffect(() => {
    if (!isOpen || !doc) return;

    setLoading(true);
    setError(false);
    setErrorDetails(null);
    setBlobUrl(null);
    setContentType('');
    setZoom(100);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    fetch(`/api/documents/${doc.id}`, { signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timeout);
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error', code: 'UNKNOWN' }));
          setError(true);
          setErrorDetails({
            code: body.code || 'HTTP_ERROR',
            message: body.error || body.details || `HTTP ${res.status}`,
            status: res.status,
          });
          setLoading(false);
          return;
        }
        const ct = res.headers.get('content-type') || '';
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setContentType(ct);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(timeout);
        setError(true);
        if (err.name === 'AbortError') {
          setErrorDetails({
            code: 'TIMEOUT',
            message: 'Preview timed out after 30 seconds. Try downloading instead.',
            status: 0,
          });
        } else {
          setErrorDetails({
            code: 'NETWORK',
            message: err.message || 'Network error',
            status: 0,
          });
        }
        setLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, doc?.id]);

  const handleDownload = useCallback(async () => {
    if (!doc) return;
    try {
      const response = await fetch(`/api/documents/${doc.id}?download=true`);
      if (!response.ok) throw new Error('Failed to generate download URL');

      const data = await response.json();

      if (data.url) {
        const a = window.document.createElement('a');
        a.href = data.url;
        a.download = data.fileName || doc.name;
        a.target = '_blank';
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        toast.success('Document downloaded');
      } else {
        throw new Error('No download URL returned');
      }
    } catch {
      toast.error('Failed to download document');
    }
  }, [doc]);

  const handleOpenInNewTab = useCallback(async () => {
    if (!doc) return;
    try {
      const response = await fetch(`/api/documents/${doc.id}?download=true`);
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No URL returned');
      }
    } catch {
      toast.error('Failed to open document');
    }
  }, [doc]);

  const zoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const zoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

  if (!isOpen || !doc) return null;

  const isPdf = contentType.includes('application/pdf');
  const isImage = contentType.startsWith('image/');
  const canZoom = isPdf;
  const canPreview = isPdf || isImage;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-dialog-title"
    >
      <div className="bg-dark-card border border-gray-700 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex-1 min-w-0">
            <h3 id="preview-dialog-title" className="text-lg font-semibold text-slate-50 truncate">
              {doc.name}
            </h3>
            <p className="text-sm text-gray-400">
              {doc.fileType.toUpperCase()} Document
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 ml-4">
            {/* Zoom Controls - only for PDF */}
            {canZoom && !loading && !error && (
              <div className="flex items-center gap-1 border-r border-gray-700 pr-3">
                <button
                  onClick={zoomOut}
                  className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
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
                  className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
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
              className="p-2 hover:bg-orange-500 hover:text-white rounded-lg transition-all text-gray-400"
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
        <div className="flex-1 overflow-hidden bg-dark-surface flex items-center justify-center">
          {loading && !error && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-orange-500" />
              <p className="text-gray-400">Loading preview...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 max-w-md text-center px-4">
              <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center border-2 border-red-500/30">
                <AlertTriangle aria-hidden="true" className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="text-lg font-semibold text-slate-50">Preview Error</h4>
              {errorDetails && (
                <>
                  <p className="text-sm text-gray-400">{errorDetails.message}</p>
                  <p className="text-xs text-gray-400">
                    Error code: {errorDetails.code}{errorDetails.status > 0 ? ` (HTTP ${errorDetails.status})` : ''}
                  </p>
                </>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleDownload}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  Download Document
                </button>
                <button
                  onClick={handleOpenInNewTab}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <ExternalLink aria-hidden="true" className="w-4 h-4" />
                  Open in New Tab
                </button>
              </div>
            </div>
          )}

          {!loading && !error && blobUrl && (
            <>
              {isPdf && (
                <div className="w-full h-full overflow-auto p-4">
                  <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
                    <iframe
                      src={blobUrl}
                      className="w-full h-full min-h-[800px] bg-white rounded-lg shadow-lg"
                      title={`Preview of ${doc.name}`}
                    />
                  </div>
                </div>
              )}

              {isImage && (
                <div className="w-full h-full overflow-auto p-4 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={blobUrl}
                    alt={doc.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              )}

              {!canPreview && (
                <div className="flex flex-col items-center gap-3 max-w-md text-center px-4">
                  <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center border-2 border-gray-700">
                    <Download aria-hidden="true" className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-50">Preview Not Available</h4>
                  <p className="text-sm text-gray-400">
                    Preview is not available for {doc.fileType.toUpperCase()} files. Download the document to view its contents.
                  </p>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleDownload}
                      className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                    >
                      Download Document
                    </button>
                    <button
                      onClick={handleOpenInNewTab}
                      className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <ExternalLink aria-hidden="true" className="w-4 h-4" />
                      Open in New Tab
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-dark-card">
          <p className="text-xs text-gray-400 text-center">
            Press <kbd className="px-2 py-1 bg-dark-surface border border-gray-600 rounded text-gray-400">ESC</kbd> to close preview
          </p>
        </div>
      </div>
    </div>
  );
}
