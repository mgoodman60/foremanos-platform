'use client';

import { useState, useEffect } from 'react';
import {
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  User,
  FileEdit,
  Shield,
  Loader2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ResultsSummary {
  totalItems: number;
  sufficient: number;
  insufficient: number;
  excess: number;
  noRequirement: number;
  unverified: number;
}

interface AuditLogEntry {
  id: string;
  verificationType: string;
  submittalId: string | null;
  submittalNumber?: string;
  triggeredByName: string | null;
  triggerReason: string | null;
  resultsSummary: ResultsSummary;
  overallStatus: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  overrideCount: number;
}

interface OverrideEntry {
  id: string;
  lineItemId: string | null;
  productName?: string;
  overrideType: string;
  previousStatus: string;
  newStatus: string;
  previousQty: number | null;
  newQty: number | null;
  overriddenByName: string | null;
  justification: string;
  approved: boolean;
  approvedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface VerificationHistoryProps {
  projectSlug: string;
  submittalId?: string; // Optional - for single submittal view
}

const STATUS_BADGES: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  PASS: { bg: 'bg-emerald-950', border: 'border-emerald-500', text: 'text-emerald-400', icon: CheckCircle },
  FAIL: { bg: 'bg-red-950', border: 'border-red-500', text: 'text-red-400', icon: XCircle },
  REVIEW_NEEDED: { bg: 'bg-amber-950', border: 'border-amber-500', text: 'text-amber-400', icon: AlertTriangle },
  INCOMPLETE: { bg: 'bg-slate-800', border: 'border-slate-500', text: 'text-slate-400', icon: Clock },
};

const TYPE_LABELS: Record<string, string> = {
  SINGLE_SUBMITTAL: 'Single Verification',
  BULK_PROJECT: 'Bulk Project Verification',
  RE_VERIFICATION: 'Auto Re-verification',
};

const OVERRIDE_TYPE_LABELS: Record<string, string> = {
  STATUS_CHANGE: 'Status Changed',
  QUANTITY_ADJUSTMENT: 'Qty Adjusted',
  WAIVER: 'Requirement Waived',
  SUBSTITUTION: 'Substitution',
};

export default function VerificationHistory({ projectSlug, submittalId }: VerificationHistoryProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pendingOverrides, setPendingOverrides] = useState<OverrideEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [expandedLogDetails, setExpandedLogDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'overrides'>('history');
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  useEffect(() => {
    fetchHistory();
    fetchPendingOverrides();
  }, [projectSlug, submittalId]);

  const fetchHistory = async () => {
    try {
      let url = `/api/projects/${projectSlug}/mep/submittals/audit?limit=${limit}&offset=${offset}`;
      if (submittalId) {
        url += `&submittalId=${submittalId}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotalCount(data.totalCount);
      }
    } catch (error) {
      console.error('Failed to fetch audit history:', error);
      toast.error('Failed to load verification history');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingOverrides = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/overrides?pending=true`);
      if (res.ok) {
        const data = await res.json();
        setPendingOverrides(data.overrides);
      }
    } catch (error) {
      console.error('Failed to fetch pending overrides:', error);
    }
  };

  const fetchLogDetails = async (logId: string) => {
    if (expandedLog === logId) {
      setExpandedLog(null);
      setExpandedLogDetails(null);
      return;
    }

    setLoadingDetails(true);
    setExpandedLog(logId);

    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/audit?logId=${logId}`);
      if (res.ok) {
        const data = await res.json();
        setExpandedLogDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch log details:', error);
      toast.error('Failed to load details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleApproveOverride = async (overrideId: string, approved: boolean) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/overrides`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrideId, approved })
      });

      if (res.ok) {
        toast.success(approved ? 'Override approved' : 'Override rejected');
        fetchPendingOverrides();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to process override');
      }
    } catch (error) {
      toast.error('Failed to process override');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <History className="w-4 h-4" aria-hidden="true" />
          Verification History
          <span className="px-2 py-0.5 text-xs bg-slate-700 rounded-full">{totalCount}</span>
        </button>
        <button
          onClick={() => setActiveTab('overrides')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'overrides'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <FileEdit className="w-4 h-4" aria-hidden="true" />
          Pending Overrides
          {pendingOverrides.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-amber-500 text-black font-bold rounded-full">
              {pendingOverrides.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'history' && (
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p>No verification history yet</p>
              <p className="text-sm mt-1">Run a verification to see results here</p>
            </div>
          ) : (
            <>
              {logs.map((log) => {
                const statusConfig = STATUS_BADGES[log.overallStatus] || STATUS_BADGES.INCOMPLETE;
                const StatusIcon = statusConfig.icon;
                const isExpanded = expandedLog === log.id;

                return (
                  <div
                    key={log.id}
                    className={`border-2 ${statusConfig.border} ${statusConfig.bg} rounded-xl overflow-hidden`}
                  >
                    {/* Log Header */}
                    <button
                      onClick={() => fetchLogDetails(log.id)}
                      className="w-full p-4 flex items-center gap-4 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-400" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" aria-hidden="true" />
                        )}
                      </div>

                      <div className="flex-shrink-0">
                        <StatusIcon className={`w-8 h-8 ${statusConfig.text}`} aria-hidden="true" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className={`font-semibold ${statusConfig.text}`}>
                            {log.overallStatus.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-slate-400">
                            {TYPE_LABELS[log.verificationType] || log.verificationType}
                          </span>
                          {log.submittalNumber && (
                            <span className="text-sm text-blue-400 font-mono">
                              {log.submittalNumber}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" aria-hidden="true" />
                            {log.triggeredByName || 'System'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" aria-hidden="true" />
                            {format(new Date(log.startedAt), 'MMM d, yyyy h:mm a')}
                          </span>
                          {log.durationMs && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              {log.durationMs}ms
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Summary Pills */}
                      <div className="flex items-center gap-2">
                        <div className="px-2 py-1 bg-emerald-900/50 border border-emerald-600 rounded text-xs text-emerald-400">
                          ✓ {log.resultsSummary.sufficient}
                        </div>
                        <div className="px-2 py-1 bg-red-900/50 border border-red-600 rounded text-xs text-red-400">
                          ✗ {log.resultsSummary.insufficient}
                        </div>
                        <div className="px-2 py-1 bg-amber-900/50 border border-amber-600 rounded text-xs text-amber-400">
                          ⚠ {log.resultsSummary.excess}
                        </div>
                        {log.overrideCount > 0 && (
                          <div className="px-2 py-1 bg-purple-900/50 border border-purple-600 rounded text-xs text-purple-400">
                            <FileEdit className="w-3 h-3 inline mr-1" aria-hidden="true" />
                            {log.overrideCount}
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-slate-700 p-4">
                        {loadingDetails ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" aria-hidden="true" />
                          </div>
                        ) : expandedLogDetails ? (
                          <div className="space-y-4">
                            {/* Line Item Results */}
                            <div>
                              <h4 className="text-sm font-semibold text-slate-300 mb-2">
                                Line Item Results ({expandedLogDetails.lineItemResults.length})
                              </h4>
                              <div className="max-h-64 overflow-y-auto space-y-2">
                                {expandedLogDetails.lineItemResults.map((item: any, idx: number) => {
                                  const itemConfig = STATUS_BADGES[item.status] || STATUS_BADGES.INCOMPLETE;
                                  return (
                                    <div
                                      key={idx}
                                      className={`p-3 rounded-lg border ${itemConfig.border} ${itemConfig.bg}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-white">{item.productName}</span>
                                        <span className={`text-sm ${itemConfig.text}`}>
                                          {item.status.replace(/_/g, ' ')}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                                        <span>Submitted: {item.submittedQty} {item.unit}</span>
                                        <span>Required: {item.requiredQty ?? 'N/A'} {item.unit}</span>
                                        {item.varianceQty !== null && (
                                          <span className={item.varianceQty >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                            Variance: {item.varianceQty > 0 ? '+' : ''}{item.varianceQty}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Overrides for this verification */}
                            {expandedLogDetails.overrides.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-slate-300 mb-2">
                                  Manual Overrides ({expandedLogDetails.overrides.length})
                                </h4>
                                <div className="space-y-2">
                                  {expandedLogDetails.overrides.map((override: OverrideEntry) => (
                                    <div
                                      key={override.id}
                                      className="p-3 rounded-lg border border-purple-600 bg-purple-950/50"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-white">
                                          {override.productName || 'Unknown Item'}
                                        </span>
                                        <span className="text-xs px-2 py-1 bg-purple-800 rounded text-purple-300">
                                          {OVERRIDE_TYPE_LABELS[override.overrideType] || override.overrideType}
                                        </span>
                                      </div>
                                      <p className="text-sm text-slate-400 mt-1">
                                        {override.previousStatus} → {override.newStatus}
                                      </p>
                                      <p className="text-sm text-slate-300 mt-1 italic">
                                        "{override.justification}"
                                      </p>
                                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                        <span>By: {override.overriddenByName}</span>
                                        {override.approved ? (
                                          <span className="text-emerald-400 flex items-center gap-1">
                                            <Shield className="w-3 h-3" aria-hidden="true" /> Approved by {override.approvedByName}
                                          </span>
                                        ) : (
                                          <span className="text-amber-400">Pending approval</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-center py-4">No details available</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pagination */}
              {totalCount > limit && (
                <div className="flex items-center justify-center gap-4 pt-4">
                  <button
                    onClick={() => {
                      setOffset(Math.max(0, offset - limit));
                      fetchHistory();
                    }}
                    disabled={offset === 0}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 
                      disabled:cursor-not-allowed text-white rounded-lg"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-400">
                    {offset + 1} - {Math.min(offset + limit, totalCount)} of {totalCount}
                  </span>
                  <button
                    onClick={() => {
                      setOffset(offset + limit);
                      fetchHistory();
                    }}
                    disabled={offset + limit >= totalCount}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 
                      disabled:cursor-not-allowed text-white rounded-lg"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'overrides' && (
        <div className="space-y-3">
          {pendingOverrides.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p>No pending overrides</p>
              <p className="text-sm mt-1">All manual overrides have been reviewed</p>
            </div>
          ) : (
            pendingOverrides.map((override) => (
              <div
                key={override.id}
                className="p-4 border-2 border-amber-600 bg-amber-950/30 rounded-xl"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-white">
                        {override.productName || 'Unknown Item'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-amber-800 rounded text-amber-200">
                        {OVERRIDE_TYPE_LABELS[override.overrideType] || override.overrideType}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      <span className="text-red-400">{override.previousStatus}</span>
                      <span className="mx-2">→</span>
                      <span className="text-emerald-400">{override.newStatus}</span>
                      {override.previousQty !== null && override.newQty !== null && (
                        <span className="ml-4 text-slate-400">
                          (Qty: {override.previousQty} → {override.newQty})
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-400 italic">
                      Justification: "{override.justification}"
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      By {override.overriddenByName} • {format(new Date(override.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleApproveOverride(override.id, true)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg 
                        flex items-center gap-1 text-sm font-medium transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" aria-hidden="true" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleApproveOverride(override.id, false)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg 
                        flex items-center gap-1 text-sm font-medium transition-colors"
                    >
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
