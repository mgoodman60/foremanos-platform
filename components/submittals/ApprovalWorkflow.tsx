'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Send,
  FileEdit,
  Eye,
  Loader2,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  User,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type ApprovalAction = 'SUBMITTED' | 'REVIEWED' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED' | 'REVISION_REQUESTED';

interface ApprovalHistoryEntry {
  id: string;
  action: ApprovalAction;
  fromStatus: string | null;
  toStatus: string;
  performedBy: string;
  performerName: string | null;
  comments: string | null;
  createdAt: string;
}

interface ApprovalWorkflowProps {
  projectSlug: string;
  submittalId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

const ACTION_CONFIG: Record<ApprovalAction, { label: string; icon: any; color: string; bgColor: string }> = {
  SUBMITTED: { label: 'Submit for Review', icon: Send, color: 'text-blue-400', bgColor: 'bg-blue-600 hover:bg-blue-700' },
  REVIEWED: { label: 'Mark as Reviewed', icon: Eye, color: 'text-purple-400', bgColor: 'bg-purple-600 hover:bg-purple-700' },
  APPROVED: { label: 'Approve', icon: CheckCircle, color: 'text-emerald-400', bgColor: 'bg-emerald-600 hover:bg-emerald-700' },
  REJECTED: { label: 'Reject', icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-600 hover:bg-red-700' },
  RESUBMITTED: { label: 'Resubmit', icon: Send, color: 'text-blue-400', bgColor: 'bg-blue-600 hover:bg-blue-700' },
  REVISION_REQUESTED: { label: 'Request Revisions', icon: FileEdit, color: 'text-amber-400', bgColor: 'bg-amber-600 hover:bg-amber-700' },
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  draft: { label: 'Draft', bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-500' },
  submitted: { label: 'Submitted', bg: 'bg-blue-950', text: 'text-blue-400', border: 'border-blue-500' },
  reviewed: { label: 'Reviewed', bg: 'bg-purple-950', text: 'text-purple-400', border: 'border-purple-500' },
  approved: { label: 'Approved', bg: 'bg-emerald-950', text: 'text-emerald-400', border: 'border-emerald-500' },
  rejected: { label: 'Rejected', bg: 'bg-red-950', text: 'text-red-400', border: 'border-red-500' },
  revision_requested: { label: 'Revisions Requested', bg: 'bg-amber-950', text: 'text-amber-400', border: 'border-amber-500' },
};

export default function ApprovalWorkflow({
  projectSlug,
  submittalId,
  currentStatus,
  onStatusChange,
}: ApprovalWorkflowProps) {
  const [loading, setLoading] = useState(true);
  const [performing, setPerforming] = useState<ApprovalAction | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [availableActions, setAvailableActions] = useState<ApprovalAction[]>([]);
  const [status, setStatus] = useState(currentStatus);
  const [expandedHistory, setExpandedHistory] = useState(true);
  const [showCommentModal, setShowCommentModal] = useState<ApprovalAction | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchApprovalData();
  }, [submittalId]);

  const fetchApprovalData = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/${submittalId}/approval`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history);
        setAvailableActions(data.availableActions);
        setStatus(data.submittal.currentStatus);
      }
    } catch (error) {
      console.error('Failed to fetch approval data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: ApprovalAction) => {
    // For approval/rejection/revision requests, require a comment
    if (['APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'REVIEWED'].includes(action) && !comment) {
      setShowCommentModal(action);
      return;
    }

    setPerforming(action);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/${submittalId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comments: comment || undefined }),
      });

      if (res.ok) {
        const data = await res.json();
        setHistory(data.history);
        setAvailableActions(data.availableActions);
        setStatus(data.newStatus);
        setComment('');
        setShowCommentModal(null);
        onStatusChange?.(data.newStatus);
        toast.success(`Submittal ${ACTION_CONFIG[action].label.toLowerCase()} successfully`);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to perform action');
      }
    } catch (error) {
      toast.error('Failed to perform action');
    } finally {
      setPerforming(null);
    }
  };

  const confirmAction = () => {
    if (showCommentModal) {
      handleAction(showCommentModal);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="ml-2 text-slate-400">Loading approval workflow...</span>
        </div>
      </div>
    );
  }

  const statusBadge = STATUS_BADGES[status.toLowerCase()] || STATUS_BADGES.draft;

  return (
    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 space-y-4">
      {/* Header with Current Status */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          Approval Workflow
        </h3>
        <div className={`px-3 py-1.5 rounded-lg border-2 ${statusBadge.bg} ${statusBadge.border}`}>
          <span className={`font-medium ${statusBadge.text}`}>{statusBadge.label}</span>
        </div>
      </div>

      {/* Action Buttons */}
      {availableActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableActions.map((action) => {
            const config = ACTION_CONFIG[action];
            const Icon = config.icon;
            return (
              <button
                key={action}
                onClick={() => handleAction(action)}
                disabled={performing !== null}
                className={`px-4 py-2 ${config.bgColor} text-white rounded-lg flex items-center gap-2
                  transition-colors font-medium disabled:opacity-50 border-2 border-transparent
                  hover:border-white/20`}
              >
                {performing === action ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {config.label}
              </button>
            );
          })}
        </div>
      )}

      {/* No Actions Available */}
      {availableActions.length === 0 && (
        <div className="flex items-center gap-2 text-slate-400 py-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">No actions available for current status</span>
        </div>
      )}

      {/* Approval History */}
      <div className="border-t border-slate-700 pt-4">
        <button
          onClick={() => setExpandedHistory(!expandedHistory)}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors w-full"
        >
          {expandedHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-medium">Approval History</span>
          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{history.length}</span>
        </button>

        {expandedHistory && (
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-slate-500 text-sm py-2">No approval history yet</p>
            ) : (
              history.map((entry) => {
                const config = ACTION_CONFIG[entry.action];
                const Icon = config?.icon || Clock;
                return (
                  <div
                    key={entry.id}
                    className="bg-slate-800 border border-slate-700 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${config?.color || 'text-slate-400'}`} />
                        <span className="font-medium text-white">{config?.label || entry.action}</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                      <User className="w-3 h-3" />
                      <span>{entry.performerName || 'Unknown'}</span>
                      <span className="text-slate-600">•</span>
                      <span>{entry.fromStatus} → {entry.toStatus}</span>
                    </div>
                    {entry.comments && (
                      <div className="mt-2 flex items-start gap-2 text-sm bg-slate-900 p-2 rounded">
                        <MessageSquare className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-300">{entry.comments}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-6 w-full max-w-md mx-4">
            <h4 className="text-lg font-semibold text-white mb-4">
              {ACTION_CONFIG[showCommentModal].label}
            </h4>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Comments {['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(showCommentModal) && (
                  <span className="text-red-400">*</span>
                )}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                  text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="Add comments for this action..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCommentModal(null);
                  setComment('');
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={!comment.trim() && ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(showCommentModal)}
                className={`flex-1 px-4 py-2 ${ACTION_CONFIG[showCommentModal].bgColor} text-white rounded-lg
                  font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
