'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Filter,
  RefreshCw,
} from 'lucide-react';

interface ScheduleUpdate {
  id: string;
  scheduleId: string;
  taskId: string;
  source: string;
  sourceId: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  previousPercentComplete: number | null;
  newPercentComplete: number | null;
  confidence: number | null;
  reasoning: string | null;
  impactType: string | null;
  severity: string | null;
  status: string;
  appliedAt: Date | null;
  appliedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  Schedule: {
    id: string;
    name: string;
  };
  User_createdBy: {
    id: string;
    username: string;
  };
  User_appliedBy: {
    id: string;
    username: string;
  } | null;
  User_rejectedBy: {
    id: string;
    username: string;
  } | null;
}

interface StatusCounts {
  pending: number;
  applied: number;
  rejected: number;
  all: number;
}

export default function ScheduleUpdatesPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [updates, setUpdates] = useState<ScheduleUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'applied' | 'rejected'>('pending');
  const [confidenceFilter, setConfidenceFilter] = useState(0);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [counts, setCounts] = useState<StatusCounts>({
    pending: 0,
    applied: 0,
    rejected: 0,
    all: 0,
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [updateToReject, setUpdateToReject] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchUpdates();
    }
  }, [slug, status, statusFilter, confidenceFilter]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (confidenceFilter > 0) {
        params.set('minConfidence', confidenceFilter.toString());
      }

      const response = await fetch(`/api/projects/${slug}/schedule-updates?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch updates');
      }

      const data = await response.json();
      setUpdates(data.updates);
      setCounts(data.counts);
      setCanEdit(data.canEdit);
      setSelectedUpdates(new Set());
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load updates';
      console.error('Error fetching updates:', error);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (updateId: string) => {
    try {
      setProcessing(true);
      const response = await fetch(`/api/projects/${slug}/schedule-updates/${updateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve update');
      }

      toast.success('Schedule update approved and applied');
      fetchUpdates();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve update';
      console.error('Error approving update:', error);
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectClick = (updateId: string) => {
    setUpdateToReject(updateId);
    setRejectionReason('');
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = async () => {
    if (!updateToReject) return;

    try {
      setProcessing(true);
      const response = await fetch(`/api/projects/${slug}/schedule-updates/${updateToReject}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectionReason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject update');
      }

      toast.success('Schedule update rejected');
      setShowRejectDialog(false);
      setUpdateToReject(null);
      fetchUpdates();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reject update';
      console.error('Error rejecting update:', error);
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedUpdates.size === 0) {
      toast.error('No updates selected');
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch(`/api/projects/${slug}/schedule-updates/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateIds: Array.from(selectedUpdates),
          action: 'approve',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to bulk approve');
      }

      const data = await response.json();
      toast.success(`Approved ${data.results.processed} updates`);
      fetchUpdates();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to bulk approve';
      console.error('Error bulk approving:', error);
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedUpdates.size === 0) {
      toast.error('No updates selected');
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch(`/api/projects/${slug}/schedule-updates/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateIds: Array.from(selectedUpdates),
          action: 'reject',
          reason: 'Bulk rejection',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to bulk reject');
      }

      const data = await response.json();
      toast.success(`Rejected ${data.results.processed} updates`);
      fetchUpdates();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to bulk reject';
      console.error('Error bulk rejecting:', error);
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelectUpdate = (updateId: string) => {
    setSelectedUpdates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(updateId)) {
        newSet.delete(updateId);
      } else {
        newSet.add(updateId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUpdates.size === updates.length) {
      setSelectedUpdates(new Set());
    } else {
      setSelectedUpdates(new Set(updates.map(u => u.id)));
    }
  };

  const getImpactIcon = (impactType: string | null) => {
    switch (impactType) {
      case 'delay':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'acceleration':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case 'high':
        return 'text-red-500 border-red-500/30 bg-red-500/10';
      case 'medium':
        return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
      case 'low':
        return 'text-green-500 border-green-500/30 bg-green-500/10';
      default:
        return 'text-gray-500 border-gray-500/30 bg-gray-500/10';
    }
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 85) return 'text-green-500';
    if (confidence >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading updates...</div>
      </div>
    );
  }

  if (!session) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/project/${slug}/schedules`)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Back to schedules"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
                  <Clock className="h-8 w-8 text-orange-500" />
                  <span>Schedule Updates</span>
                </h1>
                <p className="text-gray-400 mt-1">Review and manage schedule change suggestions</p>
              </div>
            </div>
            <button
              onClick={fetchUpdates}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Refresh updates"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center space-x-2 mt-6">
            {(['all', 'pending', 'applied', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-black/20">
                  {counts[status]}
                </span>
              </button>
            ))}
          </div>

          {/* Confidence Filter */}
          <div className="mt-4 flex items-center space-x-4">
            <Filter className="h-4 w-4 text-gray-400" />
            <label className="text-sm text-gray-300">Min Confidence:</label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(Number(e.target.value))}
              className="w-48 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
            <span className="text-sm text-orange-500 font-medium">{confidenceFilter}%</span>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {canEdit && selectedUpdates.size > 0 && statusFilter === 'pending' && (
        <div className="bg-orange-600 border-b border-orange-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">
                {selectedUpdates.size} update{selectedUpdates.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleBulkApprove}
                  disabled={processing}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Approve All</span>
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={processing}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Reject All</span>
                </button>
                <button
                  onClick={() => setSelectedUpdates(new Set())}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {updates.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-12 text-center">
            <Clock className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No Updates Found</h3>
            <p className="text-gray-400">
              {statusFilter === 'pending'
                ? 'There are no pending schedule updates at the moment.'
                : `No ${statusFilter} updates found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Select All Checkbox */}
            {canEdit && statusFilter === 'pending' && (
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUpdates.size === updates.length}
                    onChange={toggleSelectAll}
                    className="w-5 h-5 rounded border-gray-600 text-orange-600 focus:ring-orange-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-sm font-medium text-gray-300">
                    Select All ({updates.length} update{updates.length !== 1 ? 's' : ''})
                  </span>
                </label>
              </div>
            )}

            {/* Update Cards */}
            {updates.map((update) => (
              <div
                key={update.id}
                className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl hover:border-orange-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    {canEdit && update.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedUpdates.has(update.id)}
                        onChange={() => toggleSelectUpdate(update.id)}
                        className="mt-1 w-5 h-5 rounded border-gray-600 text-orange-600 focus:ring-orange-500 focus:ring-offset-gray-800"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {getImpactIcon(update.impactType)}
                        <h3 className="text-lg font-semibold text-white">
                          {update.Schedule.name}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${getSeverityColor(
                            update.severity
                          )}`}
                        >
                          {update.severity?.toUpperCase() || 'N/A'}
                        </span>
                      </div>

                      {/* Changes */}
                      <div className="space-y-2 mb-4">
                        {update.previousStatus !== update.newStatus && (
                          <div className="flex items-center space-x-2 text-sm">
                            <span className="text-gray-400">Status:</span>
                            <span className="text-red-400 line-through">
                              {update.previousStatus || 'N/A'}
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className="text-green-400">{update.newStatus || 'N/A'}</span>
                          </div>
                        )}
                        {update.previousPercentComplete !== update.newPercentComplete && (
                          <div className="flex items-center space-x-2 text-sm">
                            <span className="text-gray-400">Progress:</span>
                            <span className="text-red-400 line-through">
                              {update.previousPercentComplete}%
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className="text-green-400">{update.newPercentComplete}%</span>
                          </div>
                        )}
                      </div>

                      {/* Reasoning */}
                      {update.reasoning && (
                        <div className="bg-gray-900/50 rounded-lg p-3 mb-4">
                          <p className="text-sm text-gray-300">{update.reasoning}</p>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Source: {update.source}</span>
                        <span>•</span>
                        <span>By: {update.User_createdBy.username}</span>
                        <span>•</span>
                        <span>{new Date(update.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* Applied/Rejected Info */}
                      {update.status === 'applied' && update.User_appliedBy && (
                        <div className="mt-3 flex items-center space-x-2 text-sm text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            Applied by {update.User_appliedBy.username} on{' '}
                            {new Date(update.appliedAt!).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {update.status === 'rejected' && update.User_rejectedBy && (
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center space-x-2 text-sm text-red-400">
                            <XCircle className="h-4 w-4" />
                            <span>
                              Rejected by {update.User_rejectedBy.username} on{' '}
                              {new Date(update.rejectedAt!).toLocaleDateString()}
                            </span>
                          </div>
                          {update.rejectionReason && (
                            <p className="text-xs text-gray-400 ml-6">
                              Reason: {update.rejectionReason}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Confidence & Actions */}
                  <div className="flex flex-col items-end space-y-3 ml-4">
                    {/* Confidence Score */}
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getConfidenceColor(update.confidence)}`}>
                        {update.confidence ? `${Math.round(update.confidence)}%` : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">confidence</div>
                    </div>

                    {/* Actions */}
                    {canEdit && update.status === 'pending' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleApprove(update.id)}
                          disabled={processing}
                          className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          title="Approve and apply this update"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleRejectClick(update.id)}
                          disabled={processing}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          title="Reject this update"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <span>Reject Update</span>
            </h3>
            <p className="text-gray-300 mb-4">
              Please provide a reason for rejecting this schedule update:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason (optional)"
              className="w-full px-4 py-2 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              rows={4}
            />
            <div className="flex items-center space-x-3 mt-6">
              <button
                onClick={handleRejectConfirm}
                disabled={processing}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setUpdateToReject(null);
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
