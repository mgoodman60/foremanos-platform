'use client';

import { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface BatchUploadModalProps {
  projectSlug: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface DocumentProgress {
  status: string;
  pagesProcessed: number;
  totalPages: number;
  percentComplete: number;
  currentPhase: string;
  estimatedTimeRemaining: number;
  queuePosition: number | null;
  error: string | null;
}

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  cloudStoragePath?: string;
  documentId?: string;
  processingProgress?: DocumentProgress;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** Category keywords mirrored from lib/document-categorizer.ts CATEGORY_INFO */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  plans_drawings: ['plan', 'drawing', 'blueprint', 'architectural', 'structural', 'mep', 'electrical', 'plumbing', 'hvac', 'elevation', 'section', 'detail', 'site plan', 'floor plan', 'conformance set', 'conformance'],
  budget_cost: ['budget', 'cost', 'estimate', 'pricing', 'invoice', 'payment', 'bid', 'quote', 'financial', 'expense'],
  schedule: ['schedule', 'timeline', 'gantt', 'critical path', 'milestone', 'deadline', 'calendar', 'duration', 'phase'],
  specifications: ['spec', 'specification', 'datasheet', 'technical', 'material', 'product', 'standard', 'requirement'],
  contracts: ['contract', 'agreement', 'rfi', 'change order', 'submittal', 'legal', 'proposal', 'addendum', 'amendment'],
  daily_reports: ['daily', 'log', 'report', 'inspection', 'progress', 'status', 'field', 'observation'],
  photos: ['photo', 'image', 'picture', 'jpg', 'jpeg', 'png', 'site photo', 'progress photo'],
};

/** Sheet number patterns common in construction documents (e.g., A-101, S-001, E-203) */
const SHEET_NUMBER_PATTERN = /[AaSsEeMmPpCc]-\d+/;

/**
 * Infer document category from filename using keyword matching.
 * Falls back to 'other' when no pattern matches.
 */
function inferCategoryFromFilename(fileName: string): string {
  const lower = fileName.toLowerCase();

  // Check for construction sheet number patterns first (strong signal for plans_drawings)
  if (SHEET_NUMBER_PATTERN.test(fileName)) {
    return 'plans_drawings';
  }

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }

  return 'other';
}

export function BatchUploadModal({ projectSlug, onClose, onSuccess }: BatchUploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // Focus trap for accessibility
  const containerRef = useFocusTrap({
    isActive: true,
    onEscape: onClose,
  });

  // Poll processing progress for uploaded documents
  useEffect(() => {
    const uploadedDocs = files.filter(f => f.status === 'success' && f.documentId);
    if (uploadedDocs.length === 0) return;

    // Stop polling if all documents have completed processing
    const allDone = uploadedDocs.every(
      f => f.processingProgress?.currentPhase === 'completed' || f.processingProgress?.currentPhase === 'failed'
    );
    if (allDone) return;

    const fetchProgress = async () => {
      for (const uploadFile of uploadedDocs) {
        if (!uploadFile.documentId) continue;
        if (uploadFile.processingProgress?.currentPhase === 'completed' || uploadFile.processingProgress?.currentPhase === 'failed') continue;

        try {
          const res = await fetch(`/api/documents/${uploadFile.documentId}/progress`);
          if (res.ok) {
            const data: DocumentProgress = await res.json();
            setFiles(prev => prev.map(f =>
              f.documentId === uploadFile.documentId ? { ...f, processingProgress: data } : f
            ));
          }
        } catch { /* ignore polling errors */ }
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 5000);
    return () => clearInterval(interval);
  }, [files.filter(f => f.status === 'success').length, files.some(f => f.processingProgress?.currentPhase === 'completed')]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}: Only PDF and DOCX files are supported`;
    }
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return false;
      }
      return true;
    });

    setFiles(validFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    })));
  };

  const uploadFiles = async () => {
    setUploading(true);

    // First, resolve projectSlug to projectId
    let projectId: string;
    try {
      const projectRes = await fetch(`/api/projects/${projectSlug}`);
      if (!projectRes.ok) throw new Error('Failed to resolve project');
      const projectData = await projectRes.json();
      projectId = projectData.id || projectData.project?.id;
      if (!projectId) throw new Error('Project ID not found');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resolve project');
      setUploading(false);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i];

      // Update status to uploading
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'uploading' as const, progress: 5 } : f
      ));

      try {
        // Step 1: Get presigned URL
        const presignRes = await fetch('/api/documents/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: uploadFile.file.name,
            fileSize: uploadFile.file.size,
            contentType: uploadFile.file.type || 'application/octet-stream',
            projectId,
          }),
        });

        if (!presignRes.ok) {
          const data = await presignRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to prepare upload');
        }

        const { uploadUrl, cloudStoragePath } = await presignRes.json();

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 15 } : f
        ));

        // Step 2: Upload file directly to R2 via presigned URL
        let putRes: Response;
        try {
          putRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: uploadFile.file,
            headers: { 'Content-Type': uploadFile.file.type || 'application/octet-stream' },
          });
        } catch {
          throw new Error('Upload blocked — likely a CORS issue on the storage bucket. Run `npx tsx scripts/setup-r2-cors.ts` to fix.');
        }

        if (!putRes.ok) {
          throw new Error(putRes.status === 403
            ? 'Upload URL expired. Please try again.'
            : `Upload to storage failed (${putRes.status})`);
        }

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 80 } : f
        ));

        // Step 3: Confirm upload (infer category from filename for batch uploads)
        const inferredCategory = inferCategoryFromFilename(uploadFile.file.name);
        const confirmRes = await fetch('/api/documents/confirm-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cloudStoragePath,
            fileName: uploadFile.file.name,
            fileSize: uploadFile.file.size,
            projectId,
            category: inferredCategory,
          }),
        });

        if (!confirmRes.ok) {
          const data = await confirmRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to confirm upload');
        }

        const confirmData = await confirmRes.json().catch(() => ({}));
        const documentId = confirmData.Document?.id || confirmData.documentId || confirmData.id;

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'success' as const, progress: 100, cloudStoragePath, documentId } : f
        ));
      } catch (error: any) {
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'error' as const, error: error.message } : f
        ));
      }
    }

    setUploading(false);
    toast.success('Batch upload complete!');
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 1500);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const addMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    const validFiles = newFiles.filter(file => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }))]);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-upload-modal-title"
        className="bg-dark-card border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-client-primary text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="w-6 h-6" aria-hidden="true" />
              <h2 id="batch-upload-modal-title" className="text-xl font-bold">Batch Document Upload</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* File Input */}
          {files.length === 0 && (
            <div
              className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center"
              role="region"
              aria-label="File selection area"
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
              <label className="cursor-pointer">
                <span className="text-client-primary font-semibold hover:underline">
                  Click to select files
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                  aria-label="Select files to upload"
                />
              </label>
              <p className="text-sm text-gray-400 mt-2">
                PDF and DOCX files only
              </p>
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3" role="list" aria-label="Selected files">
              {files.map((uploadFile, index) => (
                <div key={index} className="border rounded-lg p-4" role="listitem">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-client-primary flex-shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {uploadFile.file.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {uploadFile.status === 'pending' && !uploading && (
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-600 hover:text-red-700"
                          aria-label={`Remove ${uploadFile.file.name}`}
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
                      {uploadFile.status === 'uploading' && (
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" aria-label="Uploading" />
                      )}
                      {uploadFile.status === 'success' && (
                        <CheckCircle className="w-5 h-5 text-green-600" aria-label="Upload successful" />
                      )}
                      {uploadFile.status === 'error' && (
                        <XCircle className="w-5 h-5 text-red-600" aria-label="Upload failed" />
                      )}
                    </div>
                  </div>
                  {uploadFile.status === 'error' && uploadFile.error && (
                    <p className="text-xs text-red-600 mt-2" role="alert">{uploadFile.error}</p>
                  )}
                  {/* Processing progress after upload */}
                  {uploadFile.status === 'success' && uploadFile.documentId && (() => {
                    const p = uploadFile.processingProgress;
                    if (!p || p.currentPhase === 'completed') return null;
                    const phase = p.currentPhase;
                    return (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>
                            {phase === 'queued' && (p.queuePosition ? `Queue position ${p.queuePosition}` : 'Waiting to process...')}
                            {phase === 'extracting' && 'Extracting content...'}
                            {phase === 'analyzing' && `Analyzing page ${p.pagesProcessed} of ${p.totalPages}...`}
                            {phase === 'indexing' && 'Indexing for search...'}
                            {phase === 'failed' && 'Processing failed'}
                          </span>
                          {p.percentComplete > 0 && <span>{p.percentComplete}%</span>}
                        </div>
                        <div
                          className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden"
                          role="progressbar"
                          aria-valuenow={p.percentComplete}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Processing: ${p.percentComplete}%`}
                        >
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${phase === 'queued' ? 'bg-yellow-500' : phase === 'failed' ? 'bg-red-500' : 'bg-blue-500'} ${phase !== 'failed' ? 'animate-pulse' : ''}`}
                            style={{ width: `${Math.max(2, p.percentComplete)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {files.length > 0 && (
            <div className="flex gap-3 pt-4">
              {!uploading && (
                <label className="flex-1">
                  <Button type="button" variant="outline" className="w-full" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
                      Add More Files
                    </span>
                  </Button>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx"
                    onChange={addMoreFiles}
                    className="hidden"
                    aria-label="Add more files"
                  />
                </label>
              )}
              <Button
                type="button"
                onClick={uploadFiles}
                disabled={uploading || files.length === 0}
                className="flex-1 bg-client-primary hover:bg-client-primary-dark"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
                    Upload {files.length} File{files.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
