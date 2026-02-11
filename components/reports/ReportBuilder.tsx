'use client';

import React, { useState } from 'react';
import { 
  FileText, Download, Settings, Plus, X, Check, Clock, 
  BarChart2, PieChart, Table, Activity, Calendar, DollarSign,
  Users, Wrench, FileStack, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

interface ReportSection {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const AVAILABLE_SECTIONS: ReportSection[] = [
  { id: 'kpis', name: 'Key Performance Indicators', description: 'SPI, CPI, progress metrics', icon: <Activity className="w-4 h-4" aria-hidden="true" /> },
  { id: 'schedule', name: 'Schedule Analytics', description: 'Task status, milestones, delays', icon: <Calendar className="w-4 h-4" aria-hidden="true" /> },
  { id: 'budget', name: 'Budget Breakdown', description: 'Cost by division, variances', icon: <DollarSign className="w-4 h-4" aria-hidden="true" /> },
  { id: 'resources', name: 'Resource Utilization', description: 'Labor, equipment, materials', icon: <Users className="w-4 h-4" aria-hidden="true" /> },
  { id: 'mep', name: 'MEP Status', description: 'Mechanical, electrical, plumbing', icon: <Wrench className="w-4 h-4" aria-hidden="true" /> },
  { id: 'documents', name: 'Document Analytics', description: 'Upload trends, processing status', icon: <FileStack className="w-4 h-4" aria-hidden="true" /> },
  { id: 'trends', name: 'Progress Trends', description: 'Historical progress charts', icon: <TrendingUp className="w-4 h-4" aria-hidden="true" /> },
  { id: 'team', name: 'Team Performance', description: 'Crew productivity, hours logged', icon: <Users className="w-4 h-4" aria-hidden="true" /> }
];

interface ReportBuilderProps {
  projectId: string;
  projectSlug: string;
}

export default function ReportBuilder({ projectId, projectSlug }: ReportBuilderProps) {
  const [reportTitle, setReportTitle] = useState('');
  const [selectedSections, setSelectedSections] = useState<string[]>(['kpis', 'schedule', 'budget']);
  const [reportFormat, setReportFormat] = useState<'JSON' | 'CSV'>('JSON');
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev => 
      prev.includes(sectionId)
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleGenerate = async () => {
    if (selectedSections.length === 0) {
      toast.error('Please select at least one section');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/reports/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reportTitle || 'Custom Report',
          sections: selectedSections,
          format: reportFormat
        })
      });

      if (!response.ok) throw new Error('Failed to generate report');

      const report = await response.json();
      setGeneratedReport(report);
      toast.success('Report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedReport) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (reportFormat === 'CSV') {
      content = generatedReport.csvContent || JSON.stringify(generatedReport, null, 2);
      filename = `${generatedReport.title.replace(/\s+/g, '_')}.csv`;
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(generatedReport, null, 2);
      filename = `${generatedReport.title.replace(/\s+/g, '_')}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Report downloaded!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Custom Report Builder</h2>
        <p className="text-gray-400">Create tailored reports with the data you need</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Title */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Report Title</label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Enter report title..."
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Section Selection */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Select Report Sections</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AVAILABLE_SECTIONS.map(section => (
                <button
                  key={section.id}
                  onClick={() => toggleSection(section.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                    selectedSections.includes(section.id)
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedSections.includes(section.id) ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                    {section.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{section.name}</span>
                      {selectedSections.includes(section.id) && (
                        <Check className="w-4 h-4 text-blue-400" aria-hidden="true" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{section.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Export Format</h3>
            <div className="flex gap-4">
              <button
                onClick={() => setReportFormat('JSON')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  reportFormat === 'JSON'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                JSON
              </button>
              <button
                onClick={() => setReportFormat('CSV')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  reportFormat === 'CSV'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                <Table className="w-4 h-4" aria-hidden="true" />
                CSV
              </button>
            </div>
          </div>
        </div>

        {/* Preview & Actions Panel */}
        <div className="space-y-4">
          {/* Selected Sections */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Report Contents</h3>
            {selectedSections.length === 0 ? (
              <p className="text-gray-400 text-sm">No sections selected</p>
            ) : (
              <div className="space-y-2">
                {selectedSections.map((sectionId, index) => {
                  const section = AVAILABLE_SECTIONS.find(s => s.id === sectionId);
                  return (
                    <div key={sectionId} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">{index + 1}.</span>
                      <span className="text-white">{section?.name}</span>
                      <button
                        onClick={() => toggleSection(sectionId)}
                        className="ml-auto text-gray-400 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || selectedSections.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Clock className="w-5 h-5 animate-spin" aria-hidden="true" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" aria-hidden="true" />
                Generate Report
              </>
            )}
          </button>

          {/* Download Button */}
          {generatedReport && (
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium transition-colors"
            >
              <Download className="w-5 h-5" aria-hidden="true" />
              Download {reportFormat}
            </button>
          )}
        </div>
      </div>

      {/* Generated Report Preview */}
      {generatedReport && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Generated Report Preview</h3>
            <span className="text-sm text-gray-400">
              Generated at {new Date(generatedReport.generatedAt).toLocaleString()}
            </span>
          </div>
          
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-3 bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-400">{generatedReport.summary}</p>
            </div>

            {/* Sections Preview */}
            {generatedReport.sections?.map((section: any) => (
              <div key={section.id} className="border border-gray-700 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-700/50">
                  <h4 className="font-medium text-white">{section.title}</h4>
                </div>
                <div className="p-4 max-h-48 overflow-auto">
                  {section.type === 'kpi' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(section.data || {}).map(([key, value]) => (
                        <div key={key} className="text-center">
                          <p className="text-lg font-bold text-white">{String(value)}</p>
                          <p className="text-xs text-gray-400">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {section.type === 'table' && Array.isArray(section.data) && section.data.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            {Object.keys(section.data[0]).map(key => (
                              <th key={key} className="text-left py-2 px-2 text-gray-400 font-medium">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.data.slice(0, 5).map((row: any, i: number) => (
                            <tr key={i} className="border-b border-gray-800">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="py-2 px-2 text-gray-300">{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {section.type === 'list' && Array.isArray(section.data) && (
                    <ul className="space-y-1">
                      {section.data.slice(0, 5).map((item: any, i: number) => (
                        <li key={i} className="text-sm text-gray-300">
                          • {typeof item === 'object' ? JSON.stringify(item) : item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}

            {/* Recommendations */}
            {generatedReport.recommendations?.length > 0 && (
              <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-4">
                <h4 className="font-medium text-yellow-400 mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {generatedReport.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-sm text-gray-300">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
