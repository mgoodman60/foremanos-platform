'use client';

import { useEffect, useState } from 'react';
import { FileText, CheckCircle, XCircle, Clock, Loader2, TrendingUp } from 'lucide-react';
import { getErrorMessage } from '@/lib/fetch-with-retry';

interface ProcessingStats {
  documentId: string;
  documentName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'paused';
  totalPages: number;
  pagesProcessed: number;
  currentBatch: number;
  totalBatches: number;
  providerBreakdown: {
    provider: string;
    pagesProcessed: number;
    avgTimePerPage: number;
  }[];
  startedAt: string;
  estimatedCompletionTime?: string;
  lastError?: string;
}

interface ProcessingProgressCardProps {
  documentId: string;
  onComplete?: () => void;
  className?: string;
}

export function ProcessingProgressCard({
  documentId,
  onComplete,
  className = '',
}: ProcessingProgressCardProps) {
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Poll for updates every 3 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/processing/stats?documentId=${documentId}`);
        
        if (!res.ok) {
          const errorMessage = await getErrorMessage(res, 'Failed to fetch processing stats');
          throw new Error(errorMessage);
        }
        
        const data = await res.json();
        setStats(data);
        setLoading(false);

        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          if (interval) clearInterval(interval);
          if (data.status === 'completed' && onComplete) {
            onComplete();
          }
        }
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchStats();
    interval = setInterval(fetchStats, 3000); // Poll every 3 seconds

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [documentId, onComplete]);

  if (loading) {
    return (
      <div className={`bg-[#2d333b] border border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <span className="text-gray-300">Loading processing status...</span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={`bg-[#2d333b] border border-red-500 rounded-lg p-6 ${className}`}>
        <div className="flex items-center space-x-2 text-red-400">
          <XCircle className="h-5 w-5" />
          <span>{error || 'Failed to load processing stats'}</span>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.round((stats.pagesProcessed / stats.totalPages) * 100);
  const isProcessing = stats.status === 'processing' || stats.status === 'queued';
  const isComplete = stats.status === 'completed';
  const isFailed = stats.status === 'failed';

  // Status colors and icons
  const statusConfig = {
    queued: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Clock, label: 'Queued' },
    processing: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Loader2, label: 'Processing' },
    completed: { color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle, label: 'Completed' },
    failed: { color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle, label: 'Failed' },
    paused: { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: Clock, label: 'Paused' },
  };

  const config = statusConfig[stats.status];
  const StatusIcon = config.icon;

  return (
    <div className={`bg-[#2d333b] border border-gray-700 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#1F2328] rounded-lg">
            <FileText className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">{stats.documentName}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <div className={`flex items-center space-x-1 ${config.bg} ${config.color} px-2 py-1 rounded text-sm`}>
                <StatusIcon className={`h-3 w-3 ${stats.status === 'processing' ? 'animate-spin' : ''}`} />
                <span className="font-medium">{config.label}</span>
              </div>
              {stats.estimatedCompletionTime && isProcessing && (
                <span className="text-xs text-gray-400">
                  Est: {new Date(stats.estimatedCompletionTime).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-300">Progress</span>
          <span className="text-gray-400">{progressPercentage}%</span>
        </div>
        <div className="w-full h-2.5 bg-[#1F2328] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isComplete
                ? 'bg-green-500'
                : isFailed
                ? 'bg-red-500'
                : 'bg-gradient-to-r from-blue-500 to-blue-400'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
          <span>Pages: {stats.pagesProcessed} / {stats.totalPages}</span>
          <span>Batch: {stats.currentBatch} / {stats.totalBatches}</span>
        </div>
      </div>

      {/* Provider Breakdown */}
      {stats.providerBreakdown.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">AI Provider Distribution</span>
          </div>
          <div className="space-y-2">
            {stats.providerBreakdown.map((provider, index) => {
              const providerPercentage = Math.round(
                (provider.pagesProcessed / stats.pagesProcessed) * 100
              );
              
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">{provider.provider}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">{provider.pagesProcessed} pages</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">{provider.avgTimePerPage.toFixed(1)}s/page</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[#1F2328] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                      style={{ width: `${providerPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Message */}
      {isFailed && stats.lastError && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-300">
              <p className="font-medium mb-1">Processing Failed</p>
              <p className="text-red-400/80">{stats.lastError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Completion Message */}
      {isComplete && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-sm text-green-300 font-medium">
              Processing completed successfully!
            </span>
          </div>
        </div>
      )}

      {/* Time Info */}
      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
        <span>Started: {new Date(stats.startedAt).toLocaleString()}</span>
        {isProcessing && (
          <div className="flex items-center space-x-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
