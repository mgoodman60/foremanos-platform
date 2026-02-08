'use client';

import { useState, useEffect } from 'react';
import { Clock, FileText, Send, CheckCircle, XCircle, Edit2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface TimelineEntry {
  id: string;
  action: string;
  timestamp: string;
  user?: string;
}

interface ReportTimelineProps {
  reportId: string;
  projectSlug: string;
  reportData?: {
    createdAt?: string;
    submittedAt?: string;
    approvedAt?: string;
    status?: string;
    createdByUser?: { username: string };
  };
}

const actionConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  DAILY_REPORT_CREATED: { icon: FileText, color: 'text-blue-400', label: 'Report Created' },
  DAILY_REPORT_UPDATED: { icon: Edit2, color: 'text-gray-400', label: 'Report Updated' },
  DAILY_REPORT_SUBMITTED: { icon: Send, color: 'text-yellow-400', label: 'Submitted for Review' },
  DAILY_REPORT_APPROVED: { icon: CheckCircle, color: 'text-green-400', label: 'Report Approved' },
  DAILY_REPORT_REJECTED: { icon: XCircle, color: 'text-red-400', label: 'Report Rejected' },
  DAILY_REPORT_DRAFT: { icon: Edit2, color: 'text-gray-400', label: 'Returned to Draft' },
};

export default function ReportTimeline({ reportId, projectSlug, reportData }: ReportTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    fetchActivity();
  }, [reportId, projectSlug]);

  const fetchActivity = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/daily-reports/${reportId}/activity`);
      if (!res.ok) {
        setFetchFailed(true);
        return;
      }
      const data = await res.json();
      setEntries(data.activities || []);
    } catch {
      setFetchFailed(true);
    } finally {
      setLoading(false);
    }
  };

  // Build fallback timeline from report data
  const fallbackEntries: TimelineEntry[] = [];
  if (reportData) {
    if (reportData.createdAt) {
      fallbackEntries.push({
        id: 'created',
        action: 'DAILY_REPORT_CREATED',
        timestamp: reportData.createdAt,
        user: reportData.createdByUser?.username,
      });
    }
    if (reportData.submittedAt) {
      fallbackEntries.push({
        id: 'submitted',
        action: 'DAILY_REPORT_SUBMITTED',
        timestamp: reportData.submittedAt,
      });
    }
    if (reportData.approvedAt && reportData.status === 'APPROVED') {
      fallbackEntries.push({
        id: 'approved',
        action: 'DAILY_REPORT_APPROVED',
        timestamp: reportData.approvedAt,
      });
    }
    if (reportData.status === 'REJECTED') {
      fallbackEntries.push({
        id: 'rejected',
        action: 'DAILY_REPORT_REJECTED',
        timestamp: reportData.submittedAt || reportData.createdAt || new Date().toISOString(),
      });
    }
  }

  const displayEntries = fetchFailed || entries.length === 0 ? fallbackEntries : entries;

  if (loading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          Activity
        </h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" />
        Activity
      </h3>

      {displayEntries.length === 0 ? (
        <p className="text-gray-500 text-sm">No activity yet</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-700" />

          <div className="space-y-4">
            {displayEntries.map((entry) => {
              const config = actionConfig[entry.action] || {
                icon: Clock,
                color: 'text-gray-400',
                label: entry.action.replace(/_/g, ' ').toLowerCase(),
              };
              const IconComponent = config.icon;

              return (
                <div key={entry.id} className="flex gap-3 relative">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center z-10 ${config.color}`}>
                    <IconComponent className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200">{config.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {entry.user && (
                        <span className="text-xs text-gray-500">{entry.user}</span>
                      )}
                      <span className="text-xs text-gray-600">
                        {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
