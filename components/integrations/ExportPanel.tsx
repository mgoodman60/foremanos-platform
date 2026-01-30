'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExportPanelProps {
  projectSlug: string;
}

const exportTypes = [
  { id: 'daily_reports', label: 'Daily Reports', icon: Calendar, description: 'Weather, crews, work completed' },
  { id: 'budget', label: 'Budget', icon: FileSpreadsheet, description: 'Line items, costs, variances' },
  { id: 'schedule', label: 'Schedule', icon: Calendar, description: 'Tasks, dates, progress' },
  { id: 'mep', label: 'MEP Equipment', icon: FileSpreadsheet, description: 'Equipment status, specs' },
  { id: 'change_orders', label: 'Change Orders', icon: FileSpreadsheet, description: 'COs, amounts, status' },
  { id: 'crew_performance', label: 'Crew Performance', icon: FileSpreadsheet, description: 'Productivity, hours, quality' },
];

export default function ExportPanel({ projectSlug }: ExportPanelProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const handleExport = async (exportType: string) => {
    setDownloading(exportType);
    try {
      let url = `/api/projects/${projectSlug}/export?type=${exportType}`;
      
      if (dateRange.start && dateRange.end) {
        url += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
      }

      const res = await fetch(url);
      
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `${exportType}_export.csv`;

      // Download file
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      toast.error('Export failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-dark-surface rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Download className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Export Data</h3>
      </div>

      {/* Date Range Filter */}
      <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
        <p className="text-sm text-gray-400 mb-3">Optional Date Range Filter</p>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {exportTypes.map((type) => {
          const Icon = type.icon;
          const isDownloading = downloading === type.id;
          
          return (
            <button
              key={type.id}
              onClick={() => handleExport(type.id)}
              disabled={isDownloading}
              className="flex items-start gap-3 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="h-5 w-5 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
              ) : (
                <Icon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-white font-medium">{type.label}</p>
                <p className="text-sm text-gray-400">{type.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">
        All exports are in CSV format for easy import into Excel or Google Sheets
      </p>
    </div>
  );
}
