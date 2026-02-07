'use client';

import { X, AlertCircle, WifiOff, FileX, Server, RefreshCw, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/use-focus-trap';

export type UploadErrorType = 'network' | 'file_size' | 'file_type' | 'server' | 'unknown';

interface UploadError {
  type: UploadErrorType;
  message: string;
  fileName?: string;
  details?: string;
}

interface UploadErrorDialogProps {
  isOpen: boolean;
  error: UploadError;
  onRetry?: () => void;
  onDismiss: () => void;
  /** For resumable uploads - bytes already uploaded */
  uploadedBytes?: number;
  /** Total file size in bytes */
  totalBytes?: number;
  className?: string;
}

const ERROR_INFO: Record<UploadErrorType, {
  icon: React.ReactNode;
  title: string;
  description: string;
  recoveryActions: string[];
  canRetry: boolean;
}> = {
  network: {
    icon: <WifiOff className="w-6 h-6 text-yellow-400" />,
    title: 'Network Connection Lost',
    description: 'The upload was interrupted due to a network issue.',
    recoveryActions: [
      'Check your internet connection',
      'Move closer to your Wi-Fi router',
      'Disable VPN if connected',
      'Try using a wired connection',
    ],
    canRetry: true,
  },
  file_size: {
    icon: <FileX className="w-6 h-6 text-red-400" />,
    title: 'File Too Large',
    description: 'The file exceeds the maximum allowed size.',
    recoveryActions: [
      'Compress the file before uploading',
      'Split large documents into smaller parts',
      'Remove unnecessary pages or content',
      'Upgrade your plan for larger file limits',
    ],
    canRetry: false,
  },
  file_type: {
    icon: <FileX className="w-6 h-6 text-orange-400" />,
    title: 'Unsupported File Type',
    description: 'This file format is not supported.',
    recoveryActions: [
      'Convert the file to PDF format',
      'Use a supported format (PDF, DOCX)',
      'Check if the file extension matches the content',
    ],
    canRetry: false,
  },
  server: {
    icon: <Server className="w-6 h-6 text-red-400" />,
    title: 'Server Error',
    description: 'The server encountered an error processing your upload.',
    recoveryActions: [
      'Wait a few minutes and try again',
      'Refresh the page',
      'Clear your browser cache',
      'Contact support if the problem persists',
    ],
    canRetry: true,
  },
  unknown: {
    icon: <AlertCircle className="w-6 h-6 text-gray-400" />,
    title: 'Upload Failed',
    description: 'An unexpected error occurred during upload.',
    recoveryActions: [
      'Try the upload again',
      'Check your file is not corrupted',
      'Refresh the page and try again',
      'Contact support if the problem persists',
    ],
    canRetry: true,
  },
};

/**
 * UploadErrorDialog - Modal for upload error recovery
 *
 * Displays categorized error messages with specific recovery actions
 * and supports resumable uploads for large files.
 */
export function UploadErrorDialog({
  isOpen,
  error,
  onRetry,
  onDismiss,
  uploadedBytes,
  totalBytes,
  className,
}: UploadErrorDialogProps) {
  const errorInfo = ERROR_INFO[error.type] || ERROR_INFO.unknown;

  const containerRef = useFocusTrap({
    isActive: isOpen,
    onEscape: onDismiss,
  });

  // Calculate resume progress
  const canResume = uploadedBytes !== undefined &&
    totalBytes !== undefined &&
    uploadedBytes > 0 &&
    error.type === 'network';
  const resumePercentage = canResume
    ? Math.round((uploadedBytes! / totalBytes!) * 100)
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="upload-error-title"
        aria-describedby="upload-error-description"
        className={cn(
          'bg-dark-card border border-gray-700 rounded-lg shadow-xl max-w-md w-full',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-gray-700">
          <div className="flex-shrink-0 p-2 bg-dark-surface rounded-lg">
            {errorInfo.icon}
          </div>
          <div className="flex-1">
            <h2
              id="upload-error-title"
              className="text-lg font-semibold text-[#F8FAFC]"
            >
              {errorInfo.title}
            </h2>
            <p
              id="upload-error-description"
              className="text-sm text-gray-400 mt-1"
            >
              {errorInfo.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Details */}
        <div className="p-6 space-y-4">
          {/* File info */}
          {error.fileName && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">File:</span>
              <span className="text-gray-300 truncate">{error.fileName}</span>
            </div>
          )}

          {/* Specific error message */}
          {error.details && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error.details}</p>
            </div>
          )}

          {/* Resume progress for network errors */}
          {canResume && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-blue-400 font-medium">Progress saved</span>
                <span className="text-blue-300">{resumePercentage}% uploaded</span>
              </div>
              <div className="h-2 bg-blue-900/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${resumePercentage}%` }}
                />
              </div>
              <p className="text-xs text-blue-300/70 mt-2">
                Your upload can resume from where it left off
              </p>
            </div>
          )}

          {/* Recovery Actions */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              What you can do:
            </h3>
            <ul className="space-y-2">
              {errorInfo.recoveryActions.map((action, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-400"
                >
                  <span className="text-gray-600 mt-0.5">{index + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Dismiss
          </button>
          {errorInfo.canRetry && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {canResume ? 'Resume Upload' : 'Try Again'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Utility function to categorize upload errors
 */
export function categorizeUploadError(
  error: Error | string,
  response?: Response
): UploadError {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();

  // Check for network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('aborted')
  ) {
    return {
      type: 'network',
      message: 'Network error occurred',
      details: message,
    };
  }

  // Check for file size errors
  if (
    lowerMessage.includes('size') ||
    lowerMessage.includes('too large') ||
    lowerMessage.includes('413') ||
    (response && response.status === 413)
  ) {
    return {
      type: 'file_size',
      message: 'File is too large',
      details: 'Maximum file size is 200MB',
    };
  }

  // Check for file type errors
  if (
    lowerMessage.includes('type') ||
    lowerMessage.includes('format') ||
    lowerMessage.includes('unsupported') ||
    lowerMessage.includes('415') ||
    (response && response.status === 415)
  ) {
    return {
      type: 'file_type',
      message: 'Unsupported file type',
      details: 'Only PDF and DOCX files are supported',
    };
  }

  // Check for server errors
  if (
    lowerMessage.includes('server') ||
    lowerMessage.includes('500') ||
    lowerMessage.includes('503') ||
    (response && response.status >= 500)
  ) {
    return {
      type: 'server',
      message: 'Server error',
      details: message,
    };
  }

  // Unknown error
  return {
    type: 'unknown',
    message: 'Upload failed',
    details: message,
  };
}
