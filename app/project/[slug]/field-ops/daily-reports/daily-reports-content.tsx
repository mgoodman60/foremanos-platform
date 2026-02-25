'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileText, BarChart3, TrendingUp, ChevronLeft, ClipboardCheck } from 'lucide-react';
import DailyReportsList from '@/components/field-ops/DailyReportsList';
import ProjectHealthWidget from '@/components/field-ops/ProjectHealthWidget';
import ProgressDetectionPanel from '@/components/daily-reports/ProgressDetectionPanel';
import ReportAnalyticsDashboard from '@/components/daily-reports/ReportAnalyticsDashboard';
import ApprovalDashboard from '@/components/daily-reports/ApprovalDashboard';
import CreateDailyReportDialog from '@/components/daily-reports/CreateDailyReportDialog';

type TabType = 'reports' | 'analytics' | 'progress' | 'approval';

export function DailyReportsContent({ projectSlug }: { projectSlug: string }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('reports');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Auto-open dialog when ?new=true is in the URL
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowCreateDialog(true);
    }
  }, [searchParams]);

  const tabs = [
    { id: 'reports' as TabType, label: 'Reports', icon: FileText },
    { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 },
    { id: 'progress' as TabType, label: 'Progress Detection', icon: TrendingUp },
    { id: 'approval' as TabType, label: 'Approval', icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen bg-dark-surface p-6">
      {/* Back Link */}
      <div className="mb-6">
        <Link
          href={`/project/${projectSlug}`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Project
        </Link>
      </div>

      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Daily Reports</h1>
          <p className="text-gray-400 mt-1">Track site activities, analyze trends, and detect progress</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-6 px-6">
        <div className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-lg w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DailyReportsList
              projectSlug={projectSlug}
              onCreateNew={() => setShowCreateDialog(true)}
              onSelect={(report) => {
                setSelectedReportId(report.id);
                setActiveTab('progress'); // Switch to progress tab
              }}
            />
          </div>
          <div className="space-y-6">
            <ProjectHealthWidget projectSlug={projectSlug} />

            {/* Quick Progress Detection */}
            <ProgressDetectionPanel
              projectSlug={projectSlug}
              reportId={selectedReportId || undefined}
              onProgressApplied={() => {
                // Refresh health widget
              }}
            />
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <ReportAnalyticsDashboard projectSlug={projectSlug} />
      )}

      {activeTab === 'progress' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">AI Progress Detection</h3>
              <p className="text-gray-400 mb-6">
                Select a daily report from the list, then click &quot;Detect Progress&quot; to analyze
                photos and report content for schedule updates.
              </p>

              {selectedReportId ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                  <div className="text-green-400 font-medium">Report Selected</div>
                  <div className="text-gray-400 text-sm mt-1">
                    Ready to analyze. Click the button below to detect progress.
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                  <div className="text-yellow-400 font-medium">No Report Selected</div>
                  <div className="text-gray-400 text-sm mt-1">
                    Go to the Reports tab and click on a report to select it for analysis.
                  </div>
                </div>
              )}

              <ProgressDetectionPanel
                projectSlug={projectSlug}
                reportId={selectedReportId || undefined}
                onProgressApplied={() => {
                  // Refresh data
                }}
              />
            </div>
          </div>

          <div>
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
              <h4 className="text-white font-medium mb-3">How It Works</h4>
              <ol className="space-y-3 text-sm text-gray-400">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">1</span>
                  <span>AI analyzes photos attached to daily reports to identify construction activities</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">2</span>
                  <span>Report text is parsed for progress indicators (&quot;completed&quot;, &quot;started&quot;, percentages)</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">3</span>
                  <span>Detected progress is matched to schedule tasks</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">4</span>
                  <span>Review suggestions and apply updates to your schedule</span>
                </li>
              </ol>
            </div>

            <div className="mt-4 bg-gray-800/50 rounded-lg border border-gray-700 p-4">
              <h4 className="text-white font-medium mb-3">Tips for Better Detection</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  Take clear photos showing work progress
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  Include room/area numbers in photos when possible
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  Be specific in work performed descriptions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  Mention percentages when known
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'approval' && (
        <ApprovalDashboard projectSlug={projectSlug} />
      )}
      </div>

      {/* Create Dialog */}
      <CreateDailyReportDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        projectSlug={projectSlug}
      />
    </div>
  );
}
