'use client';

import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnnounceOptional } from '@/components/ui/announcer';
import { useEffect, useRef } from 'react';

interface UploadProgressProps {
  /** File name being uploaded */
  fileName: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Upload status */
  status: 'uploading' | 'processing' | 'success' | 'error';
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Callback to cancel the upload */
  onCancel?: () => void;
  /** Callback to retry the upload */
  onRetry?: () => void;
  /** Callback to dismiss after completion */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Total file size in bytes (for speed/ETA calculation) */
  totalBytes?: number;
  /** Bytes uploaded so far (for speed/ETA calculation) */
  uploadedBytes?: number;
  /** Upload speed in bytes/second (optional, will be calculated if uploadedBytes provided) */
  speed?: number;
  /** For chunked uploads: current chunk number */
  currentChunk?: number;
  /** For chunked uploads: total number of chunks */
  totalChunks?: number;
  /** Current retry attempt (for showing retry count) */
  retryAttempt?: number;
  /** Max retry attempts */
  maxRetries?: number;
}

/**
 * UploadProgress - Displays upload progress with status and controls
 *
 * Shows a progress bar with file name, percentage, and action buttons
 * for canceling or retrying uploads.
 *
 * @example
 * <UploadProgress
 *   fileName="document.pdf"
 *   progress={45}
 *   status="uploading"
 *   onCancel={() => handleCancel()}
 * />
 */
export function UploadProgress({
  fileName,
  progress,
  status,
  errorMessage,
  onCancel,
  onRetry,
  onDismiss,
  className,
  totalBytes,
  uploadedBytes,
  speed,
  currentChunk,
  totalChunks,
  retryAttempt,
  maxRetries,
}: UploadProgressProps) {
  const announcer = useAnnounceOptional();
  const previousStatus = useRef(status);
  const previousBytesRef = useRef(uploadedBytes || 0);
  const lastUpdateTimeRef = useRef(Date.now());
  const calculatedSpeedRef = useRef(0);

  // Announce status changes to screen readers
  useEffect(() => {
    if (!announcer) return;

    if (status !== previousStatus.current) {
      if (status === 'success') {
        announcer.announce(`${fileName} uploaded successfully`);
      } else if (status === 'error') {
        announcer.announce(`Upload failed for ${fileName}. ${errorMessage || ''}`, 'assertive');
      } else if (status === 'processing') {
        announcer.announce(`Processing ${fileName}`);
      }
      previousStatus.current = status;
    }
  }, [status, fileName, errorMessage, announcer]);

  // Announce progress milestones
  useEffect(() => {
    if (!announcer || status !== 'uploading') return;

    // Announce at 25%, 50%, 75%, and 100%
    const milestones = [25, 50, 75, 100];
    if (milestones.includes(progress)) {
      announcer.announce(`${fileName} upload ${progress}% complete`);
    }
  }, [progress, fileName, status, announcer]);

  // Calculate upload speed
  useEffect(() => {
    if (uploadedBytes !== undefined && status === 'uploading') {
      const now = Date.now();
      const timeDelta = (now - lastUpdateTimeRef.current) / 1000; // seconds
      const bytesDelta = uploadedBytes - previousBytesRef.current;

      if (timeDelta > 0.1 && bytesDelta > 0) {
        calculatedSpeedRef.current = bytesDelta / timeDelta;
      }

      previousBytesRef.current = uploadedBytes;
      lastUpdateTimeRef.current = now;
    }
  }, [uploadedBytes, status]);

  // Helper to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Helper to format speed
  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  // Helper to format time remaining
  const formatETA = (seconds: number): string => {
    if (!isFinite(seconds) || seconds <= 0) return '';
    if (seconds < 60) return `~${Math.ceil(seconds)} sec remaining`;
    if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min remaining`;
    return `~${Math.ceil(seconds / 3600)} hr remaining`;
  };

  // Get actual speed (provided or calculated)
  const actualSpeed = speed || calculatedSpeedRef.current;

  // Calculate ETA
  const getETA = (): string => {
    if (!totalBytes || !uploadedBytes || actualSpeed <= 0) return '';
    const remainingBytes = totalBytes - uploadedBytes;
    const secondsRemaining = remainingBytes / actualSpeed;
    return formatETA(secondsRemaining);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'processing':
        return 'bg-blue-500';
      default:
        return 'bg-orange-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'success':
        return 'Uploaded';
      case 'error':
        return errorMessage || 'Upload failed';
      case 'processing':
        return 'Processing...';
      default:
        return `${progress}%`;
    }
  };

  // Build detailed progress info for chunked uploads
  const getDetailedProgress = (): string | null => {
    if (status !== 'uploading') return null;

    const parts: string[] = [];

    // Chunk info
    if (currentChunk !== undefined && totalChunks !== undefined) {
      parts.push(`Chunk ${currentChunk}/${totalChunks}`);
    }

    // Speed info
    if (actualSpeed > 0) {
      parts.push(formatSpeed(actualSpeed));
    }

    // ETA
    const eta = getETA();
    if (eta) {
      parts.push(eta);
    }

    return parts.length > 0 ? parts.join(' · ') : null;
  };

  // Get retry info
  const getRetryInfo = (): string | null => {
    if (retryAttempt !== undefined && retryAttempt > 0) {
      const max = maxRetries || 3;
      return `Retrying... (attempt ${retryAttempt}/${max})`;
    }
    return null;
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />;
      default:
        return <Upload className="w-5 h-5 text-orange-500 animate-pulse" aria-hidden="true" />;
    }
  };

  return (
    <div
      className={cn(
        'bg-dark-card border border-gray-700 rounded-lg p-4 shadow-lg',
        className
      )}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Uploading ${fileName}`}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getStatusIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* File name and status */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-gray-100 truncate" title={fileName}>
              {fileName}
            </p>
            <span
              className={cn(
                'text-xs font-medium whitespace-nowrap',
                status === 'success' && 'text-green-400',
                status === 'error' && 'text-red-400',
                status === 'processing' && 'text-blue-400',
                status === 'uploading' && 'text-orange-400'
              )}
            >
              {getStatusText()}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300 ease-out rounded-full',
                getStatusColor(),
                status === 'uploading' && 'animate-pulse'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Detailed progress info (speed, ETA, chunks) */}
          {(() => {
            const detailedProgress = getDetailedProgress();
            const retryInfo = getRetryInfo();
            if (detailedProgress || retryInfo) {
              return (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-300">
                  {retryInfo && (
                    <span className="text-yellow-400">{retryInfo}</span>
                  )}
                  {detailedProgress && !retryInfo && (
                    <span>{detailedProgress}</span>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {/* Error message */}
          {status === 'error' && errorMessage && (
            <p className="mt-2 text-xs text-red-400">{errorMessage}</p>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex items-center gap-2">
            {/* Cancel button - only show during upload */}
            {status === 'uploading' && onCancel && (
              <button
                onClick={onCancel}
                className="px-3 py-1 text-xs font-medium text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded transition-colors"
              >
                Cancel
              </button>
            )}

            {/* Retry button - only show on error */}
            {status === 'error' && onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1 text-xs font-medium text-orange-400 hover:text-orange-300 border border-orange-600 hover:border-orange-500 rounded transition-colors"
              >
                Retry
              </button>
            )}

            {/* Dismiss button - show on success or error */}
            {(status === 'success' || status === 'error') && onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1 text-xs font-medium text-gray-300 hover:text-white transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>

        {/* Close button */}
        {(status === 'success' || status === 'error') && onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface UploadProgressListProps {
  uploads: Array<{
    id: string;
    fileName: string;
    progress: number;
    status: 'uploading' | 'processing' | 'success' | 'error';
    errorMessage?: string;
    totalBytes?: number;
    uploadedBytes?: number;
    speed?: number;
    currentChunk?: number;
    totalChunks?: number;
    retryAttempt?: number;
    maxRetries?: number;
  }>;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDismiss?: (id: string) => void;
  className?: string;
}

/**
 * UploadProgressList - Displays multiple uploads in a stacked list
 *
 * @example
 * <UploadProgressList
 *   uploads={[
 *     { id: '1', fileName: 'doc1.pdf', progress: 45, status: 'uploading' },
 *     { id: '2', fileName: 'doc2.pdf', progress: 100, status: 'success' },
 *   ]}
 *   onCancel={(id) => handleCancel(id)}
 *   onDismiss={(id) => handleDismiss(id)}
 * />
 */
export function UploadProgressList({
  uploads,
  onCancel,
  onRetry,
  onDismiss,
  className,
}: UploadProgressListProps) {
  if (uploads.length === 0) return null;

  return (
    <div
      className={cn('space-y-2', className)}
      role="region"
      aria-label="Upload progress"
    >
      {uploads.map((upload) => (
        <UploadProgress
          key={upload.id}
          fileName={upload.fileName}
          progress={upload.progress}
          status={upload.status}
          errorMessage={upload.errorMessage}
          totalBytes={upload.totalBytes}
          uploadedBytes={upload.uploadedBytes}
          speed={upload.speed}
          currentChunk={upload.currentChunk}
          totalChunks={upload.totalChunks}
          retryAttempt={upload.retryAttempt}
          maxRetries={upload.maxRetries}
          onCancel={onCancel ? () => onCancel(upload.id) : undefined}
          onRetry={onRetry ? () => onRetry(upload.id) : undefined}
          onDismiss={onDismiss ? () => onDismiss(upload.id) : undefined}
        />
      ))}
    </div>
  );
}
