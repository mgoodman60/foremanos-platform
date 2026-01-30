"use client";

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ProcessingStatusProps {
  documentId: string;
  documentName: string;
  onComplete?: () => void;
}

interface QueueStatus {
  status: string;
  totalPages: number;
  pagesProcessed: number;
  currentBatch: number;
  totalBatches: number;
  progress: number;
  lastError?: string;
  retriesCount: number;
}

interface DocumentStatus {
  processed: boolean;
  pagesProcessed: number;
  chunksCreated: number;
}

export function DocumentProcessingStatus({
  documentId,
  documentName,
  onComplete,
}: ProcessingStatusProps) {
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh every 5 seconds if processing
    if (autoRefresh && queueStatus?.status === 'processing') {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [documentId, autoRefresh]);

  async function fetchStatus() {
    try {
      const response = await fetch(`/api/documents/${documentId}/processing-status`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      const data = await response.json();
      setDocumentStatus(data.document);
      setQueueStatus(data.queue);

      // Call onComplete if processing just finished
      if (data.document.processed && onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  }

  async function handleResume() {
    setIsResuming(true);
    
    try {
      const response = await fetch(`/api/documents/${documentId}/resume-processing`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to resume processing');
      }

      toast.success('Processing resumed');
      setAutoRefresh(true);
      fetchStatus();
    } catch (error: any) {
      toast.error('Failed to resume processing');
      console.error('Error resuming:', error);
    } finally {
      setIsResuming(false);
    }
  }

  if (!queueStatus && documentStatus?.processed) {
    return (
      <div className="flex items-center space-x-2 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span>Processed ({documentStatus.pagesProcessed} pages, {documentStatus.chunksCreated} chunks)</span>
      </div>
    );
  }

  if (!queueStatus) {
    return null;
  }

  const statusConfig = {
    queued: {
      icon: <Loader2 className="h-4 w-4 animate-spin text-blue-600" />,
      text: 'Queued for processing',
      color: 'text-blue-600',
    },
    processing: {
      icon: <Loader2 className="h-4 w-4 animate-spin text-orange-600" />,
      text: 'Processing',
      color: 'text-orange-600',
    },
    completed: {
      icon: <CheckCircle className="h-4 w-4 text-green-600" />,
      text: 'Completed',
      color: 'text-green-600',
    },
    failed: {
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      text: 'Failed',
      color: 'text-red-600',
    },
    paused: {
      icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
      text: 'Paused',
      color: 'text-yellow-600',
    },
  };

  const config = statusConfig[queueStatus.status as keyof typeof statusConfig] || statusConfig.queued;

  return (
    <div className="space-y-3 p-4 bg-dark-card border border-gray-700 rounded-lg">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {config.icon}
          <span className={`text-sm font-medium ${config.color}`}>
            {config.text}
          </span>
        </div>
        
        {queueStatus.status === 'processing' && (
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs text-gray-400 hover:text-gray-300"
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {(queueStatus.status === 'processing' || queueStatus.status === 'queued') && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>
              Batch {queueStatus.currentBatch + 1} of {queueStatus.totalBatches}
            </span>
            <span>
              {queueStatus.pagesProcessed} / {queueStatus.totalPages} pages
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-orange-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${queueStatus.progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 text-right">
            {queueStatus.progress}% complete
          </div>
        </div>
      )}

      {/* Error Message */}
      {queueStatus.lastError && queueStatus.status === 'failed' && (
        <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
          <strong>Error:</strong> {queueStatus.lastError}
          {queueStatus.retriesCount > 0 && (
            <span className="block mt-1">Retries: {queueStatus.retriesCount}</span>
          )}
        </div>
      )}

      {/* Resume Button */}
      {queueStatus.status === 'failed' && (
        <button
          onClick={handleResume}
          disabled={isResuming}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
        >
          {isResuming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Resuming...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Resume Processing</span>
            </>
          )}
        </button>
      )}

      {/* Info */}
      {queueStatus.status === 'queued' && (
        <div className="text-xs text-gray-400">
          ⏳ This document will be processed in batches to ensure stability
        </div>
      )}

      {queueStatus.status === 'processing' && (
        <div className="text-xs text-gray-400">
          🔄 Processing with smart retry logic and Cloudflare protection
        </div>
      )}
    </div>
  );
}
