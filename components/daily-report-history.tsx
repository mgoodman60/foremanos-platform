'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle, Clock, Download, Eye, TrendingUp, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface DailyReportHistoryProps {
  projectSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

interface DailyReport {
  id: string;
  title: string;
  dailyReportDate: string | null;
  finalized: boolean;
  finalizedAt: string | null;
  finalizationMethod: string | null;
  documentId: string | null;
  documentUrl: string | null;
  documentName: string | null;
  messageCount: number;
  createdBy: string;
  lastActivityAt: string | null;
  updatedAt: string;
}

interface GroupedReports {
  monthKey: string;
  monthLabel: string;
  reports: DailyReport[];
}

interface Stats {
  total: number;
  finalized: number;
  inProgress: number;
}

export function DailyReportHistory({
  projectSlug,
  isOpen,
  onClose,
}: DailyReportHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [groupedReports, setGroupedReports] = useState<GroupedReports[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, finalized: 0, inProgress: 0 });
  const [projectName, setProjectName] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, projectSlug]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/daily-reports-history`);
      if (response.ok) {
        const data = await response.json();
        setGroupedReports(data.groupedReports || []);
        setStats(data.stats || { total: 0, finalized: 0, inProgress: 0 });
        setProjectName(data.project?.name || '');
      } else {
        toast.error('Failed to load daily report history');
      }
    } catch (error) {
      console.error('Error fetching daily report history:', error);
      toast.error('Failed to load daily report history');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (reportId: string) => {
    // Navigate to the conversation
    router.push(`/project/${projectSlug}?conversation=${reportId}`);
    onClose();
  };

  const handleDownloadPDF = async (report: DailyReport) => {
    try {
      // If finalized PDF exists, use that
      if (report.documentUrl) {
        window.open(report.documentUrl, '_blank');
        return;
      }

      // Otherwise generate PDF on-demand
      const loadingToast = toast.loading('Generating PDF report...');
      const pdfUrl = `/api/conversations/${report.id}/export-pdf`;
      
      // Open in new tab
      window.open(pdfUrl, '_blank');
      
      // Dismiss loading toast after a short delay
      setTimeout(() => {
        toast.dismiss(loadingToast);
        toast.success('PDF generated successfully!');
      }, 1000);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-report-history-dialog-title"
    >
      <div className="bg-dark-surface border border-gray-700 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 id="daily-report-history-dialog-title" className="text-xl font-bold text-[#F8FAFC]">Daily Report History</h2>
            <p className="text-sm text-gray-400 mt-1">
              {projectName}
            </p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-[#F8FAFC] hover:bg-dark-card"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316]"></div>
            </div>
          ) : (
            <>
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-dark-card border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-900/30 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#F8FAFC]">{stats.total}</p>
                      <p className="text-sm text-gray-400">Total Reports</p>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-card border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-900/30 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#F8FAFC]">{stats.finalized}</p>
                      <p className="text-sm text-gray-400">Finalized</p>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-card border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-900/30 rounded-lg">
                      <Clock className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#F8FAFC]">{stats.inProgress}</p>
                      <p className="text-sm text-gray-400">In Progress</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grouped Reports */}
              {groupedReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-blue-500/30">
                    <Calendar className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F8FAFC] mb-2">
                    No Daily Reports Yet
                  </h3>
                  <p className="text-base text-gray-300 text-center max-w-md mb-4">
                    Start creating daily reports to track your project progress. They will appear here.
                  </p>
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Create First Report
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedReports.map((group) => (
                    <div key={group.monthKey}>
                      {/* Month Header */}
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="h-5 w-5 text-[#F97316]" />
                        <h3 className="text-lg font-bold text-[#F8FAFC]">{group.monthLabel}</h3>
                        <div className="flex-1 h-px bg-gray-700"></div>
                      </div>

                      {/* Reports List */}
                      <div className="space-y-2">
                        {group.reports.map((report) => (
                          <div
                            key={report.id}
                            className="bg-dark-card border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                {/* Date and Status */}
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="text-sm font-medium text-[#F8FAFC]">
                                    {report.dailyReportDate
                                      ? format(new Date(report.dailyReportDate), 'EEEE, MMMM d, yyyy')
                                      : 'No date'}
                                  </p>
                                  {report.finalized ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-900/30 text-green-400 border border-green-700">
                                      <CheckCircle className="h-3 w-3" />
                                      Finalized
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-700">
                                      <Clock className="h-3 w-3" />
                                      In Progress
                                    </span>
                                  )}
                                </div>

                                {/* Metadata */}
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span>{report.messageCount} messages</span>
                                  <span>•</span>
                                  <span>Created by {report.createdBy}</span>
                                  {report.finalizedAt && (
                                    <>
                                      <span>•</span>
                                      <span>Finalized {format(new Date(report.finalizedAt), 'MMM d, h:mm a')}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() => handleViewReport(report.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                  title="View Report"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={() => handleDownloadPDF(report)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-[#F97316] hover:text-[#ea580c] hover:bg-orange-900/20"
                                  title={report.documentUrl ? "Download Finalized PDF" : "Generate PDF"}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-dark-surface">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <TrendingUp className="h-4 w-4" />
            <span>Showing {stats.total} reports</span>
          </div>
          <Button
            onClick={onClose}
            className="bg-[#F97316] hover:bg-[#ea580c] text-white"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
