'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  FileText,
  Users,
  Calendar,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  Wind,
  RefreshCw,
  Loader2,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { createScopedLogger } from '@/lib/logger';
import RejectionModal from './RejectionModal';

const log = createScopedLogger('APPROVAL_DASHBOARD');

interface LaborEntry {
  tradeName: string;
  workerCount: number;
  regularHours: number;
}

interface SubmittedReport {
  id: string;
  reportNumber: number;
  reportDate: string;
  weatherCondition: string | null;
  workPerformed: string | null;
  createdByUser: { id: string; username: string };
  laborEntries: LaborEntry[];
}

interface ApprovalDashboardProps {
  projectSlug: string;
}

export default function ApprovalDashboard({ projectSlug }: ApprovalDashboardProps) {
  const [reports, setReports] = useState<SubmittedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/daily-reports?status=SUBMITTED`
      );
      if (!res.ok) throw new Error('Failed to fetch submitted reports');
      const data = await res.json();
      setReports(data.reports || []);
      setSelected(new Set());
    } catch (error) {
      log.error('Failed to fetch submitted reports', error as Error);
      toast.error('Failed to load reports for approval');
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === reports.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reports.map((r) => r.id)));
    }
  };

  const handleApprove = async () => {
    if (selected.size === 0) return;

    setApproving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/daily-reports/approve-bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportIds: Array.from(selected),
            action: 'APPROVED',
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to approve reports');
      }

      toast.success(
        `${selected.size} report${selected.size > 1 ? 's' : ''} approved`
      );
      fetchReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve reports');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectClick = () => {
    if (selected.size === 0) return;
    setShowRejectionModal(true);
  };

  const getCrewSize = (entries: LaborEntry[]) =>
    entries.reduce((sum, e) => sum + e.workerCount, 0);

  const WeatherIcon = ({ condition }: { condition: string | null }) => {
    switch (condition?.toLowerCase()) {
      case 'sunny':
      case 'clear':
        return <Sun className="w-4 h-4 text-yellow-400" />;
      case 'cloudy':
      case 'overcast':
        return <Cloud className="w-4 h-4 text-gray-400" />;
      case 'rainy':
      case 'rain':
        return <CloudRain className="w-4 h-4 text-blue-400" />;
      case 'snow':
      case 'snowy':
        return <CloudSnow className="w-4 h-4 text-blue-200" />;
      case 'windy':
        return <Wind className="w-4 h-4 text-gray-400" />;
      default:
        return <Sun className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-dark-subtle border border-gray-700 rounded-xl p-8">
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Approval Queue</h2>
          <span className="text-sm text-gray-400">({reports.length} pending)</span>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          aria-label="Refresh approval queue"
          className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500/40 mx-auto mb-3" />
          <p className="text-gray-400">No reports pending approval</p>
        </div>
      ) : (
        <>
          {/* Bulk Actions Bar */}
          <div className="px-6 py-3 border-b border-gray-700 flex items-center justify-between bg-gray-800/30">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
              <input
                type="checkbox"
                checked={selected.size === reports.length && reports.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              Select All ({selected.size} of {reports.length})
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={handleApprove}
                disabled={selected.size === 0 || approving}
                className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {approving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Approve Selected
              </button>
              <button
                onClick={handleRejectClick}
                disabled={selected.size === 0 || approving}
                className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Reject Selected
              </button>
            </div>
          </div>

          {/* Report Cards */}
          <div className="divide-y divide-gray-700">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`px-6 py-4 transition-colors ${
                  selected.has(report.id)
                    ? 'bg-blue-500/10'
                    : 'hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(report.id)}
                    onChange={() => toggleSelect(report.id)}
                    aria-label={`Select Report #${report.reportNumber}`}
                    className="mt-1 w-4 h-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-medium">
                        Report #{report.reportNumber}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full border bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        SUBMITTED
                      </span>
                      <span className="text-gray-400 text-sm flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(report.reportDate), 'MMM d, yyyy')}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {report.createdByUser.username}
                      </span>
                      <span className="flex items-center gap-1">
                        <WeatherIcon condition={report.weatherCondition} />
                        {report.weatherCondition || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {getCrewSize(report.laborEntries)} workers
                      </span>
                    </div>

                    {report.workPerformed && (
                      <p className="mt-2 text-sm text-gray-300 line-clamp-2">
                        {report.workPerformed}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Rejection Modal */}
      <RejectionModal
        isOpen={showRejectionModal}
        onClose={() => setShowRejectionModal(false)}
        reportIds={Array.from(selected)}
        projectSlug={projectSlug}
        onRejected={fetchReports}
      />
    </div>
  );
}
