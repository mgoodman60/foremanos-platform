'use client';

import { useState, useEffect } from 'react';
import {
  FileText, Plus, Calendar, Sun, Cloud, CloudRain, CloudSnow, Wind,
  Users, Clock, AlertTriangle, ChevronRight, RefreshCw,
  CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import Link from 'next/link';
import OneDriveSyncBadge from '@/components/daily-reports/OneDriveSyncBadge';

interface DailyReport {
  id: string;
  reportNumber: number;
  reportDate: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  weatherCondition: string | null;
  temperatureHigh: number | null;
  temperatureLow: number | null;
  workPerformed: string | null;
  safetyIncidents: number;
  delayHours: number | null;
  rejectionReason: string | null;
  rejectionNotes: string | null;
  onedriveExported?: boolean;
  onedriveExportedAt?: string | null;
  onedriveExportPath?: string | null;
  createdByUser: { id: string; username: string };
  laborEntries: Array<{ tradeName: string; workerCount: number; regularHours: number }>;
}

interface DailyReportsListProps {
  projectSlug: string;
  onCreateNew?: () => void;
  onSelect?: (report: DailyReport) => void;
}

export default function DailyReportsList({ projectSlug, onCreateNew, onSelect }: DailyReportsListProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, [projectSlug, filter]);

  const fetchReports = async () => {
    try {
      const url = filter === 'all' 
        ? `/api/projects/${projectSlug}/daily-reports`
        : `/api/projects/${projectSlug}/daily-reports?status=${filter}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch reports');
      const data = await response.json();
      setReports(data.reports);
    } catch (error) {
      console.error('[Daily Reports] Error:', error);
      toast.error('Failed to load daily reports');
    } finally {
      setLoading(false);
    }
  };

  const handleInlineAction = async (reportId: string, action: 'approve' | 'reject', e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(reportId);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/daily-reports/approve-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds: [reportId], action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} report`);
      toast.success(`Report ${action === 'approve' ? 'approved' : 'rejected'}`);
      fetchReports();
    } catch (error) {
      toast.error(`Failed to ${action} report`);
    } finally {
      setActionLoading(null);
    }
  };

  const WeatherIcon = ({ condition }: { condition: string | null }) => {
    switch (condition?.toLowerCase()) {
      case 'sunny': case 'clear': return <Sun aria-hidden="true" className="w-4 h-4 text-yellow-400" />;
      case 'cloudy': case 'overcast': return <Cloud aria-hidden="true" className="w-4 h-4 text-gray-400" />;
      case 'rainy': case 'rain': return <CloudRain aria-hidden="true" className="w-4 h-4 text-blue-400" />;
      case 'snow': case 'snowy': return <CloudSnow aria-hidden="true" className="w-4 h-4 text-blue-200" />;
      case 'windy': return <Wind aria-hidden="true" className="w-4 h-4 text-gray-400" />;
      default: return <Sun aria-hidden="true" className="w-4 h-4 text-gray-400" />;
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
      SUBMITTED: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      APPROVED: 'bg-green-500/20 text-green-400 border border-green-500/30',
      REJECTED: 'bg-red-500/20 text-red-400 border border-red-500/30',
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${styles[status] || styles.DRAFT}`}>
        {status}
      </span>
    );
  };

  const getTotalWorkers = (entries: DailyReport['laborEntries']) => {
    return entries.reduce((sum, e) => sum + e.workerCount, 0);
  };

  const getTotalHours = (entries: DailyReport['laborEntries']) => {
    return entries.reduce((sum, e) => sum + (e.workerCount * e.regularHours), 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText aria-hidden="true" className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Daily Reports</h2>
          <span className="text-sm text-gray-400">({reports.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); }}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="all">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
          </select>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors"
            >
              <Plus aria-hidden="true" className="w-4 h-4" />
              New Report
            </button>
          )}
        </div>
      </div>

      {/* Reports List */}
      <div className="divide-y divide-gray-700">
        {reports.length === 0 ? (
          <div className="p-8 text-center">
            <FileText aria-hidden="true" className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No daily reports yet</p>
            {onCreateNew && (
              <button
                onClick={onCreateNew}
                className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
              >
                Create your first report
              </button>
            )}
          </div>
        ) : (
          reports.map((report) => (
            <div
              key={report.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(report)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(report); }
              }}
              className="px-6 py-4 hover:bg-gray-800/50 cursor-pointer transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Link
                      href={`/project/${projectSlug}/field-ops/daily-reports/${report.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-white font-medium hover:text-blue-400 transition-colors"
                    >
                      Report #{report.reportNumber}
                    </Link>
                    <StatusBadge status={report.status} />
                    {report.status === 'APPROVED' && (
                      <OneDriveSyncBadge
                        onedriveExported={report.onedriveExported ?? false}
                        onedriveExportedAt={report.onedriveExportedAt}
                        onedriveExportPath={report.onedriveExportPath}
                        reportId={report.id}
                        projectSlug={projectSlug}
                      />
                    )}
                    <span className="text-gray-400 text-sm flex items-center gap-1">
                      <Calendar aria-hidden="true" className="w-3.5 h-3.5" />
                      {format(new Date(report.reportDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    {/* Weather */}
                    <span className="flex items-center gap-1">
                      <WeatherIcon condition={report.weatherCondition} />
                      {report.temperatureHigh !== null && (
                        <span>{report.temperatureHigh}°F</span>
                      )}
                    </span>
                    
                    {/* Workers */}
                    <span className="flex items-center gap-1">
                      <Users aria-hidden="true" className="w-3.5 h-3.5" />
                      {getTotalWorkers(report.laborEntries)} workers
                    </span>
                    
                    {/* Hours */}
                    <span className="flex items-center gap-1">
                      <Clock aria-hidden="true" className="w-3.5 h-3.5" />
                      {getTotalHours(report.laborEntries).toFixed(0)} hrs
                    </span>
                    
                    {/* Safety */}
                    {report.safetyIncidents > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5" />
                        {report.safetyIncidents} incident(s)
                      </span>
                    )}
                    
                    {/* Delays */}
                    {report.delayHours && report.delayHours > 0 && (
                      <span className="flex items-center gap-1 text-yellow-400">
                        <Clock aria-hidden="true" className="w-3.5 h-3.5" />
                        {report.delayHours}hr delay
                      </span>
                    )}
                  </div>
                  
                  {report.workPerformed && (
                    <p className="mt-2 text-sm text-gray-300 line-clamp-2">
                      {report.workPerformed}
                    </p>
                  )}

                  {/* Rejection details for rejected reports */}
                  {report.status === 'REJECTED' && (report.rejectionReason || report.rejectionNotes) && (
                    <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      {report.rejectionReason && (
                        <p className="text-sm font-medium text-red-400">{report.rejectionReason}</p>
                      )}
                      {report.rejectionNotes && (
                        <p className="text-sm text-red-300/80 mt-1">{report.rejectionNotes}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Inline approve/reject for SUBMITTED reports */}
                  {report.status === 'SUBMITTED' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleInlineAction(report.id, 'approve', e)}
                        disabled={actionLoading === report.id}
                        aria-label={`Approve Report #${report.reportNumber}`}
                        className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === report.id ? (
                          <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle aria-hidden="true" className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleInlineAction(report.id, 'reject', e)}
                        disabled={actionLoading === report.id}
                        aria-label={`Reject Report #${report.reportNumber}`}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        <XCircle aria-hidden="true" className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <ChevronRight aria-hidden="true" className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
