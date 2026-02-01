/**
 * Bulk Photo Upload Modal
 *
 * Allows users to upload multiple photos at once with drag-and-drop support.
 * Shows upload progress and results.
 */

'use client';

import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/fetch-with-retry';

interface BulkUploadModalProps {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
}

interface FileWithPreview extends File {
  preview?: string;
}

const MAX_FILES = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function BulkUploadModal({
  conversationId,
  open,
  onOpenChange,
  onUploadComplete,
}: BulkUploadModalProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    uploaded: number;
    failed: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return `${file.name} is not an image`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} is too large (max 10MB)`;
    }
    return null;
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const validFiles: FileWithPreview[] = [];

    for (let i = 0; i < Math.min(selectedFiles.length, MAX_FILES); i++) {
      const file = selectedFiles[i];
      const error = validateFile(file);

      if (error) {
        toast.error(error);
        continue;
      }

      // Create preview
      const fileWithPreview = file as FileWithPreview;
      fileWithPreview.preview = URL.createObjectURL(file);
      validFiles.push(fileWithPreview);
    }

    if (selectedFiles.length > MAX_FILES) {
      toast.warning(`Only first ${MAX_FILES} files will be uploaded`);
    }

    setFiles(validFiles);
    setResults(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });

      const response = await fetch(
        `/api/conversations/${conversationId}/photos-bulk`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, 'Upload failed');
        throw new Error(errorMessage);
      }

      const data = await response.json();

      setResults({
        uploaded: data.uploaded.length,
        failed: data.failed.length,
        total: data.totalCount,
      });

      if (data.uploaded.length > 0) {
        toast.success(`${data.uploaded.length} photos uploaded successfully`);
        onUploadComplete?.();
      }

      if (data.failed.length > 0) {
        toast.error(`${data.failed.length} photos failed to upload`);
      }

      // Clear files after successful upload
      if (data.failed.length === 0) {
        setFiles([]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photos');
    } finally {
      setUploading(false);
      setProgress(100);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    if (newFiles[index].preview) {
      URL.revokeObjectURL(newFiles[index].preview!);
    }
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const handleClose = () => {
    if (!uploading) {
      // Cleanup previews
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
      setFiles([]);
      setResults(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" aria-hidden="true" />
            Bulk Photo Upload
          </DialogTitle>
        </DialogHeader>

        {/* Results Summary */}
        {results && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2" role="status" aria-live="polite">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" aria-hidden="true" />
              <span className="font-semibold">
                {results.uploaded} photos uploaded successfully
              </span>
            </div>
            {results.failed > 0 && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
                <span>{results.failed} photos failed</span>
              </div>
            )}
            <div className="text-sm text-gray-600">
              Total photos in report: {results.total}
            </div>
          </div>
        )}

        {/* Drop Zone */}
        {files.length === 0 && (
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            role="region"
            aria-label="File drop zone"
          >
            <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600 mb-2">
              Drag and drop photos here, or click to select
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Upload up to {MAX_FILES} photos at once (max 10MB each)
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Select Photos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              aria-label="Select photos to upload"
            />
          </div>
        )}

        {/* File List */}
        {files.length > 0 && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {files.length} photo{files.length !== 1 ? 's' : ''} selected
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Add More
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFileSelect(e.target.files);
                    }
                  }}
                  aria-label="Add more photos"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto" role="list">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
                    role="listitem"
                  >
                    {file.preview && (
                      <img
                        src={file.preview}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {!uploading && (
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                      {file.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress Bar */}
            {uploading && (
              <div className="space-y-2" role="status" aria-live="polite">
                <Progress value={progress} className="w-full" aria-label="Upload progress" />
                <p className="text-sm text-center text-gray-600">
                  Uploading and analyzing photos...
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={uploading}
              >
                {results ? 'Close' : 'Cancel'}
              </Button>
              {!results && (
                <Button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || files.length === 0}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {uploading ? 'Uploading...' : `Upload ${files.length} Photo${files.length !== 1 ? 's' : ''}`}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
