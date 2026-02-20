'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle, RefreshCw, FileText, Circle, Loader2, X } from 'lucide-react';
import { primaryColors, semanticColors } from '@/lib/design-tokens';
import { toast } from 'sonner';

interface ProcessingStatus {
  id: string;
  name: string;
  fileName: string;
  category: string;
  processed: boolean;
  pagesProcessed: number | null;
  processingCost: number | null;
  queueStatus: string;
  lastProcessingError: string | null;
  processingRetries: number;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  queueInfo: {
    status: string;
    totalPages: number;
    pagesProcessed: number;
    currentBatch: number;
    totalBatches: number;
    lastError: string | null;
    retriesCount: number;
  } | null;
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
  concurrency?: number;
  activeBatches?: number[];
  failedBatchRanges?: string[];
  processingMode?: string;
}

interface Stats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  pending: number;
  totalPages: number;
  totalCost: number;
}

interface DocumentProcessingMonitorProps {
  projectId: string;
  projectSlug: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
}

export default function DocumentProcessingMonitor({ 
  projectId,
  projectSlug,
  autoRefresh = true, 
  refreshInterval = 10 
}: DocumentProcessingMonitorProps) {
  const [documents, setDocuments] = useState<ProcessingStatus[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [progressMap, setProgressMap] = useState<Record<string, DocumentProgress>>({});

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/documents/processing-status?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch status');
      
      const data = await response.json();
      setDocuments(data.documents);
      setStats(data.stats);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching processing status:', error);
      toast.error('Failed to fetch processing status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchStatus, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [projectId, autoRefresh, refreshInterval]);

  // Per-document progress polling for actively processing documents
  useEffect(() => {
    const activeDocIds = documents
      .filter(d => d.queueStatus === 'processing' || d.queueStatus === 'queued' || d.queueStatus === 'pending')
      .map(d => d.id);

    if (activeDocIds.length === 0) return;

    const fetchProgress = async () => {
      for (const docId of activeDocIds) {
        try {
          const res = await fetch(`/api/documents/${docId}/progress`);
          if (res.ok) {
            const data: DocumentProgress = await res.json();
            setProgressMap(prev => ({ ...prev, [docId]: data }));
          }
        } catch { /* ignore polling errors */ }
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 5000);
    return () => clearInterval(interval);
  }, [documents]);

  type MonitorStage = 'upload' | 'scanning' | 'analysis' | 'extraction' | 'indexing' | 'complete';

  const MONITOR_STAGES: { key: MonitorStage; label: string }[] = [
    { key: 'upload', label: 'Uploaded' },
    { key: 'scanning', label: 'Scanning' },
    { key: 'analysis', label: 'Analysis' },
    { key: 'extraction', label: 'Extraction' },
    { key: 'indexing', label: 'Indexing' },
    { key: 'complete', label: 'Complete' },
  ];

  const getMonitorStageIndex = (phase: string): number => {
    switch (phase) {
      case 'queued': return 0;
      case 'pending': return 0;
      case 'extracting': return 1;
      case 'analyzing': return 2;
      case 'processing': return 3;
      case 'indexing': return 4;
      case 'completed': return 5;
      case 'failed': return -1;
      default: return 0;
    }
  };

  const getMonitorStageIcon = (idx: number, activeIdx: number, failed: boolean) => {
    if (failed && idx === activeIdx) return <X aria-hidden="true" className="w-3.5 h-3.5 text-red-500" />;
    if (failed && idx > activeIdx) return <Circle aria-hidden="true" className="w-3.5 h-3.5 text-gray-600" />;
    if (idx < activeIdx) return <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" style={{ color: semanticColors.success[500] }} />;
    if (idx === activeIdx) return <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" style={{ color: primaryColors.orange[500] }} />;
    return <Circle aria-hidden="true" className="w-3.5 h-3.5 text-gray-600" />;
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return '';
    if (seconds < 60) return `~${seconds}s remaining`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes}m remaining`;
  };

  const _getPhaseLabel = (phase: string, progress: DocumentProgress | undefined): string => {
    if (!progress) return '';
    const concurrencyLabel = progress.concurrency && progress.concurrency > 1 ? ` (${progress.concurrency} parallel)` : '';
    switch (phase) {
      case 'queued':
        return progress.queuePosition ? `Waiting in queue (position ${progress.queuePosition})...` : 'Waiting in queue...';
      case 'extracting':
        return `Extracting content from pages${concurrencyLabel}...`;
      case 'analyzing':
        return `Analyzing page ${progress.pagesProcessed} of ${progress.totalPages}${concurrencyLabel}...`;
      case 'indexing':
        return 'Indexing content for search...';
      case 'completed':
        return 'Processing complete';
      case 'failed':
        return 'Processing failed';
      default:
        return 'Processing...';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 aria-hidden="true" className="w-5 h-5 text-green-500" />;
      case 'pending':
      case 'processing':
      case 'queued':
        return <Clock aria-hidden="true" className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'failed':
        return <XCircle aria-hidden="true" className="w-5 h-5 text-red-500" />;
      case 'none':
        return <AlertCircle aria-hidden="true" className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle aria-hidden="true" className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pending':
      case 'processing':
      case 'queued':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'none':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'none':
        return 'pending';
      default:
        return status;
    }
  };

  const handleProcessDocument = async (documentId: string) => {
    try {
      toast.loading('Starting document processing...');
      const response = await fetch(`/api/projects/${projectSlug}/documents/${documentId}/reprocess`, {
        method: 'POST',
      });
      toast.dismiss();
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start processing');
      }
      
      toast.success('Document processing started');
      fetchStatus(); // Refresh status
    } catch (error: any) {
      toast.error(error.message || 'Failed to process document');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw aria-hidden="true" className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-400">Loading processing status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total Documents</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
            <div className="text-green-400 text-sm mb-1">Completed</div>
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
            <div className="text-blue-400 text-sm mb-1">Processing</div>
            <div className="text-2xl font-bold text-blue-500">{stats.processing}</div>
          </div>
          <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
            <div className="text-red-400 text-sm mb-1">Failed</div>
            <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
          </div>
        </div>
      )}

      {/* Processing Summary */}
      {stats && (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">Total Pages Processed</div>
              <div className="text-xl font-bold text-white">{stats.totalPages.toLocaleString()}</div>
            </div>
            <div className="text-xs text-gray-400">
              Last updated: {lastRefresh.toLocaleTimeString()}
              <button
                onClick={() => fetchStatus()}
                className="ml-2 p-1 hover:bg-gray-700 rounded"
                title="Refresh now"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white mb-4">Document Processing Status</h3>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileText aria-hidden="true" className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No documents found</p>
          </div>
        ) : (
          documents.map(doc => (
            <div
              key={doc.id}
              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(doc.queueStatus)}
                    <h4 className="font-medium text-white">{doc.name}</h4>
                    <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(doc.queueStatus)}`}>
                      {getStatusLabel(doc.queueStatus)}
                    </span>
                    {doc.queueStatus === 'failed' && (
                      <button
                        onClick={() => handleProcessDocument(doc.id)}
                        className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>File: {doc.fileName} • Category: {doc.category}</div>
                    <div>
                      Pages: {doc.queueInfo?.totalPages || doc.pagesProcessed || 0} • 
                      Uploaded: {new Date(doc.createdAt).toLocaleString()}
                    </div>
                    
                    {/* Processing Stage Stepper */}
                    {(doc.queueStatus === 'processing' || doc.queueStatus === 'queued') && (doc.queueInfo?.totalPages || progressMap[doc.id]?.totalPages) && (() => {
                      const progress = progressMap[doc.id];
                      const totalPages = progress?.totalPages || doc.queueInfo?.totalPages || 0;
                      const pagesProcessed = progress?.pagesProcessed || doc.queueInfo?.pagesProcessed || 0;
                      const percent = totalPages > 0 ? Math.round((pagesProcessed / totalPages) * 100) : 0;
                      const phase = progress?.currentPhase || (doc.queueStatus === 'queued' ? 'queued' : 'analyzing');
                      const isFailed = phase === 'failed';
                      const activeIdx = getMonitorStageIndex(phase);

                      return (
                        <div className="mt-3 space-y-2">
                          {/* Stage stepper row */}
                          <div className="flex items-center gap-0.5" role="list" aria-label="Processing stages">
                            {MONITOR_STAGES.map((stage, idx) => {
                              const isDone = idx < activeIdx;
                              const isActive = idx === activeIdx;
                              return (
                                <div key={stage.key} className="flex items-center flex-1 min-w-0" role="listitem">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <div className="flex-shrink-0">{getMonitorStageIcon(idx, activeIdx, isFailed)}</div>
                                    <span className={`text-[10px] truncate ${isActive ? 'text-slate-200 font-semibold' : isDone ? 'text-gray-400' : 'text-gray-600'}`}>
                                      {stage.label}
                                    </span>
                                  </div>
                                  {idx < MONITOR_STAGES.length - 1 && (
                                    <div className={`h-px flex-1 mx-1 min-w-[4px] ${isDone ? 'bg-green-700' : 'bg-gray-700'}`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Progress bar */}
                          <div
                            className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden"
                            role="progressbar"
                            aria-valuenow={percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Processing progress: ${percent}%`}
                          >
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${isFailed ? 'bg-red-500' : phase === 'indexing' ? 'bg-green-500' : 'bg-orange-500'}`}
                              style={{ width: `${Math.max(2, percent)}%` }}
                            />
                          </div>

                          {/* Stats row */}
                          <div className="flex justify-between text-xs text-gray-400">
                            <span className="flex items-center gap-2">
                              <span>{pagesProcessed}/{totalPages} pages ({percent}%)</span>
                              {doc.queueInfo && <span>· Batch {doc.queueInfo.currentBatch + 1}/{doc.queueInfo.totalBatches}</span>}
                            </span>
                            <span className="flex items-center gap-2">
                              {progress?.estimatedTimeRemaining ? (
                                <span className="text-gray-400">{formatTimeRemaining(progress.estimatedTimeRemaining)}</span>
                              ) : null}
                              {(doc.queueInfo?.retriesCount || 0) > 0 && (
                                <span className="text-yellow-400">Retries: {doc.queueInfo?.retriesCount}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {doc.queueStatus === 'pending' && (
                      <div className="mt-2 text-xs text-blue-400">
                        {new Date(doc.createdAt).getTime() < Date.now() - 5 * 60 * 1000 ? (
                          <>
                            <span className="text-yellow-400">Processing delayed — retrying automatically...</span>
                            <button
                              onClick={() => handleProcessDocument(doc.id)}
                              className="ml-2 text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors"
                            >
                              Retry Now
                            </button>
                          </>
                        ) : (
                          'Preparing to process...'
                        )}
                      </div>
                    )}

                    {(doc.queueStatus === 'processing' || doc.queueStatus === 'queued') &&
                     new Date(doc.updatedAt).getTime() < Date.now() - 10 * 60 * 1000 && (
                      <div className="mt-1 text-xs text-yellow-400">
                        Processing appears stalled — will retry automatically
                      </div>
                    )}

                    {/* Queue Information for completed docs */}
                    {doc.queueStatus === 'completed' && (
                      <div className="mt-2 text-xs text-green-400">
                        ✓ Processed {doc.pagesProcessed || doc.queueInfo?.pagesProcessed || 0} pages
                      </div>
                    )}

                    {/* Error Information */}
                    {doc.lastProcessingError && (
                      <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded">
                        <div className="text-xs text-red-400">
                          <div className="font-semibold mb-1">Error:</div>
                          <div className="font-mono">{doc.lastProcessingError}</div>
                          {doc.processingRetries > 0 && (
                            <div className="mt-1">Retry attempts: {doc.processingRetries}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {doc.queueInfo?.lastError && (
                      <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded">
                        <div className="text-xs text-red-400">
                          <div className="font-semibold mb-1">Queue Error:</div>
                          <div className="font-mono">{doc.queueInfo.lastError}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
