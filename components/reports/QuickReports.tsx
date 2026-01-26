'use client';

import React, { useState } from 'react';
import { 
  FileText, Download, Clock, Briefcase, DollarSign, 
  Calendar, Wrench, Users, TrendingUp, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface QuickReportType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const QUICK_REPORTS: QuickReportType[] = [
  { 
    id: 'EXECUTIVE_SUMMARY', 
    name: 'Executive Summary', 
    description: 'High-level overview for stakeholders',
    icon: <Briefcase className="w-5 h-5" />,
    color: 'bg-blue-500'
  },
  { 
    id: 'PROGRESS_REPORT', 
    name: 'Progress Report', 
    description: 'Weekly or monthly progress update',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'bg-green-500'
  },
  { 
    id: 'COST_REPORT', 
    name: 'Cost Report', 
    description: 'Budget status and EVM metrics',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'bg-yellow-500'
  },
  { 
    id: 'MEP_REPORT', 
    name: 'MEP Status Report', 
    description: 'MEP systems installation progress',
    icon: <Wrench className="w-5 h-5" />,
    color: 'bg-purple-500'
  },
  { 
    id: 'RESOURCE_REPORT', 
    name: 'Resource Report', 
    description: 'Team utilization and allocation',
    icon: <Users className="w-5 h-5" />,
    color: 'bg-cyan-500'
  }
];

interface QuickReportsProps {
  projectId: string;
  projectSlug: string;
}

export default function QuickReports({ projectId, projectSlug }: QuickReportsProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<any[]>([]);

  const generateReport = async (reportType: string) => {
    setGenerating(reportType);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: reportType })
      });

      if (!response.ok) throw new Error('Failed to generate report');

      const report = await response.json();
      setRecentReports(prev => [report, ...prev.slice(0, 4)]);
      toast.success('Report generated successfully!');

      // Auto-download
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Quick Reports</h2>
        <p className="text-gray-400">Generate standard reports with one click</p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {QUICK_REPORTS.map(report => (
          <div
            key={report.id}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={`p-3 rounded-lg ${report.color} bg-opacity-20`}>
                <div className={report.color.replace('bg-', 'text-')}>
                  {report.icon}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{report.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{report.description}</p>
              </div>
            </div>
            <button
              onClick={() => generateReport(report.id)}
              disabled={generating === report.id}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors disabled:opacity-50"
            >
              {generating === report.id ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate & Download
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Recent Reports */}
      {recentReports.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Recently Generated</h3>
          <div className="space-y-3">
            {recentReports.map((report, index) => (
              <div 
                key={`${report.id}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-white">{report.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(report.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${report.title.replace(/\s+/g, '_')}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Reports Notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-400 font-medium">Automated Reports</p>
          <p className="text-sm text-gray-400 mt-1">
            Set up scheduled reports to automatically generate and send to stakeholders.
            Contact your administrator to configure automated report distribution.
          </p>
        </div>
      </div>
    </div>
  );
}
