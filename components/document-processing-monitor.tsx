'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle, RefreshCw, FileText } from 'lucide-react';
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'processing':
      case 'queued':
        return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'none':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
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
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
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
            <div className="text-xs text-gray-500">
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
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
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
                    {doc.queueStatus === 'none' && (
                      <button
                        onClick={() => handleProcessDocument(doc.id)}
                        className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                      >
                        Process Now
                      </button>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>File: {doc.fileName} • Category: {doc.category}</div>
                    <div>
                      Pages: {doc.queueInfo?.totalPages || doc.pagesProcessed || 0} • 
                      Uploaded: {new Date(doc.createdAt).toLocaleString()}
                    </div>
                    
                    {/* Progress Bar for Processing Documents */}
                    {(doc.queueStatus === 'processing' || doc.queueStatus === 'queued') && doc.queueInfo && doc.queueInfo.totalPages > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>{doc.queueStatus === 'queued' ? 'Waiting to process...' : 'Processing pages...'}</span>
                          <span>{doc.queueInfo.pagesProcessed}/{doc.queueInfo.totalPages} pages ({Math.round((doc.queueInfo.pagesProcessed / doc.queueInfo.totalPages) * 100)}%)</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className={`h-2.5 rounded-full transition-all duration-500 ease-out ${doc.queueStatus === 'queued' ? 'bg-yellow-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.max(2, (doc.queueInfo.pagesProcessed / doc.queueInfo.totalPages) * 100)}%` }}
                          >
                            <div className={`w-full h-full bg-gradient-to-r ${doc.queueStatus === 'queued' ? 'from-yellow-500 to-yellow-400' : 'from-blue-500 to-blue-400'} animate-pulse`} />
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Batch {doc.queueInfo.currentBatch + 1} of {doc.queueInfo.totalBatches}</span>
                          {doc.queueInfo.retriesCount > 0 && (
                            <span className="text-yellow-400">Retries: {doc.queueInfo.retriesCount}</span>
                          )}
                        </div>
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
