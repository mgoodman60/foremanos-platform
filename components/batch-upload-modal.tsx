'use client';

import { useState } from 'react';
import { X, Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface BatchUploadModalProps {
  projectSlug: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function BatchUploadModal({ projectSlug, onClose, onSuccess }: BatchUploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // Focus trap for accessibility
  const containerRef = useFocusTrap({
    isActive: true,
    onEscape: onClose,
  });

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

    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i];

      // Update status to uploading
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'uploading' as const } : f
      ));

      try {
        const formData = new FormData();
        formData.append('file', uploadFile.file);

        const res = await fetch(`/api/documents/upload?projectSlug=${projectSlug}`, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'success' as const, progress: 100 } : f
          ));
        } else {
          const data = await res.json();
          throw new Error(data.error || 'Upload failed');
        }
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
