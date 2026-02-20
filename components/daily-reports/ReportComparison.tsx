'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowDown, ArrowUp, Minus, Calendar, Users, CloudRain, Clock, AlertTriangle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('REPORT_COMPARISON');

interface DailyReport {
  id: string;
  reportNumber: number;
  date: string;
  status: string;
  crewSize: number;
  weatherCondition: string;
  weatherDelay: boolean;
  weatherDelayHours?: number;
  workPerformed?: string;
  notes?: string;
  tomorrowPlan?: string;
  delays?: Array<{ reason: string; description: string }>;
  laborHours?: number;
}

interface ReportComparisonProps {
  projectSlug: string;
  reportId: string;
}

function DeltaIndicator({ current, previous, unit, invert }: {
  current: number;
  previous: number;
  unit?: string;
  invert?: boolean;
}) {
  const diff = current - previous;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Minus className="w-3 h-3" />
        No change
      </span>
    );
  }

  const isPositive = invert ? diff < 0 : diff > 0;
  const colorClass = isPositive ? 'text-green-400' : 'text-red-400';
  const Icon = diff > 0 ? ArrowUp : ArrowDown;

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {diff > 0 ? '+' : ''}{diff}{unit ? ` ${unit}` : ''}
    </span>
  );
}

function TextDiff({ label, current, previous }: {
  label: string;
  current?: string;
  previous?: string;
}) {
  const hasChanged = (current || '') !== (previous || '');
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        {hasChanged && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/50 text-yellow-400">
            Changed
          </Badge>
        )}
      </div>
      <p className="text-sm text-gray-300 whitespace-pre-wrap">
        {current || <span className="text-gray-600 italic">Not provided</span>}
      </p>
    </div>
  );
}

function ReportColumn({ report, label: _label }: { report: DailyReport | null; label: string }) {
  if (!report) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 flex flex-col items-center justify-center min-h-[300px]">
        <FileText className="w-10 h-10 text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No previous report</p>
      </div>
    );
  }

  const delayCount = report.delays?.length || 0;
  const totalDelayHours = report.weatherDelayHours || 0;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-700">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-gray-100">
              {new Date(report.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <span className="text-xs text-gray-400 mt-1 block">
            Report #{report.reportNumber}
          </span>
        </div>
        <Badge
          variant="outline"
          className={`text-xs ${
            report.status === 'APPROVED'
              ? 'border-green-500/50 text-green-400'
              : report.status === 'SUBMITTED'
              ? 'border-blue-500/50 text-blue-400'
              : report.status === 'REJECTED'
              ? 'border-red-500/50 text-red-400'
              : 'border-gray-600 text-gray-400'
          }`}
        >
          {report.status}
        </Badge>
      </div>

      {/* Weather */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <CloudRain className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">Weather</span>
        </div>
        <p className="text-sm text-gray-300">{report.weatherCondition || 'Not recorded'}</p>
        {report.weatherDelay && (
          <p className="text-xs text-yellow-400">
            Weather delay{totalDelayHours ? `: ${totalDelayHours}h` : ''}
          </p>
        )}
      </div>

      {/* Crew */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">Crew Size</span>
        </div>
        <p className="text-sm text-gray-300">{report.crewSize} workers</p>
      </div>

      {/* Labor Hours */}
      {report.laborHours !== undefined && report.laborHours > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-400">Labor Hours</span>
          </div>
          <p className="text-sm text-gray-300">{report.laborHours}h</p>
        </div>
      )}

      {/* Work Performed */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-gray-400">Work Performed</span>
        <p className="text-sm text-gray-300 whitespace-pre-wrap">
          {report.workPerformed || <span className="text-gray-600 italic">Not provided</span>}
        </p>
      </div>

      {/* Delays */}
      {delayCount > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-medium text-gray-400">Delays ({delayCount})</span>
          </div>
          <ul className="space-y-1">
            {report.delays?.map((delay, i) => (
              <li key={i} className="text-xs text-gray-400">
                <span className="text-orange-400">{delay.reason}:</span> {delay.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {report.notes && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-gray-400">Notes</span>
          <p className="text-xs text-gray-400 whitespace-pre-wrap">{report.notes}</p>
        </div>
      )}
    </div>
  );
}

export default function ReportComparison({ projectSlug, reportId }: ReportComparisonProps) {
  const [currentReport, setCurrentReport] = useState<DailyReport | null>(null);
  const [previousReport, setPreviousReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch the current report
      const currentRes = await fetch(`/api/projects/${projectSlug}/daily-reports/${reportId}`);
      if (!currentRes.ok) {
        throw new Error('Failed to fetch current report');
      }
      const currentData = await currentRes.json();
      const current: DailyReport = currentData.report || currentData;
      setCurrentReport(current);

      // Fetch all reports to find the previous one by reportNumber
      const listRes = await fetch(`/api/projects/${projectSlug}/daily-reports`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const reports: DailyReport[] = listData.reports || listData || [];
        // Sort by reportNumber descending
        const sorted = reports
          .filter((r) => r.reportNumber < current.reportNumber)
          .sort((a, b) => b.reportNumber - a.reportNumber);
        if (sorted.length > 0) {
          // Fetch the full previous report
          const prevRes = await fetch(
            `/api/projects/${projectSlug}/daily-reports/${sorted[0].id}`
          );
          if (prevRes.ok) {
            const prevData = await prevRes.json();
            setPreviousReport(prevData.report || prevData);
          }
        }
      }
    } catch (err) {
      log.error('Failed to fetch reports for comparison', err as Error);
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [projectSlug, reportId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <span className="ml-3 text-sm text-gray-400">Loading comparison...</span>
      </div>
    );
  }

  if (error || !currentReport) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 text-sm">{error || 'Report not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-semibold text-gray-200">Report Comparison</h3>
      </div>

      {/* Delta Summary */}
      {previousReport && (
        <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-gray-800/30 border border-gray-700/50">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-400">Crew:</span>
            <DeltaIndicator
              current={currentReport.crewSize}
              previous={previousReport.crewSize}
            />
          </div>
          {currentReport.laborHours !== undefined && previousReport.laborHours !== undefined && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-400">Hours:</span>
              <DeltaIndicator
                current={currentReport.laborHours}
                previous={previousReport.laborHours}
                unit="h"
              />
            </div>
          )}
          {currentReport.weatherCondition !== previousReport.weatherCondition && (
            <div className="flex items-center gap-2">
              <CloudRain className="w-3.5 h-3.5 text-gray-400" />
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/50 text-yellow-400">
                Weather changed
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Two-Column Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-blue-400 mb-2 uppercase tracking-wider">Current Report</p>
          <ReportColumn report={currentReport} label="Current" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Previous Report</p>
          <ReportColumn report={previousReport} label="Previous" />
        </div>
      </div>

      {/* Detailed Text Diffs */}
      {previousReport && (
        <div className="space-y-3 p-4 rounded-lg border border-gray-700 bg-gray-800/30">
          <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Detail Changes</h4>
          <TextDiff
            label="Work Performed"
            current={currentReport.workPerformed}
            previous={previousReport.workPerformed}
          />
          <TextDiff
            label="Notes"
            current={currentReport.notes}
            previous={previousReport.notes}
          />
          <TextDiff
            label="Tomorrow's Plan"
            current={currentReport.tomorrowPlan}
            previous={previousReport.tomorrowPlan}
          />
        </div>
      )}
    </div>
  );
}
