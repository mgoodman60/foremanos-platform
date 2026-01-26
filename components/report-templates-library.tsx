/**
 * Report Templates Library
 * Pre-built report templates with customization options
 */

'use client';

import { useState } from 'react';
import {
  FileText,
  Download,
  Settings,
  Calendar,
  DollarSign,
  Users,
  Building2,
  TrendingUp,
  ClipboardCheck,
  Loader2,
  ChevronRight,
  Check,
  Printer,
  Mail,
  Clock,
  Eye,
  Wrench,
  HardHat,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, subWeeks } from 'date-fns';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  sections: string[];
  frequency: string;
  estimatedTime: string;
}

interface ReportConfig {
  templateId: string;
  dateRange: { start: string; end: string };
  sections: string[];
  includeCharts: boolean;
  includePhotos: boolean;
  recipientEmails: string[];
  format: 'pdf' | 'html';
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'owner-report',
    name: 'Owner Report',
    description: 'Executive summary for project owners with key metrics, milestones, and budget status',
    icon: Building2,
    color: 'from-blue-600 to-blue-800',
    sections: ['executive_summary', 'schedule_status', 'budget_status', 'milestones', 'risks', 'photos'],
    frequency: 'Weekly/Monthly',
    estimatedTime: '~30 sec',
  },
  {
    id: 'weekly-progress',
    name: 'Weekly Progress Report',
    description: 'Detailed progress update with work completed, upcoming activities, and issues',
    icon: TrendingUp,
    color: 'from-emerald-600 to-emerald-800',
    sections: ['work_completed', 'upcoming_work', 'schedule_status', 'manpower', 'weather_impacts', 'issues'],
    frequency: 'Weekly',
    estimatedTime: '~20 sec',
  },
  {
    id: 'subcontractor-summary',
    name: 'Subcontractor Summary',
    description: 'Performance metrics, work progress, and payment status by subcontractor',
    icon: Users,
    color: 'from-purple-600 to-purple-800',
    sections: ['subcontractor_list', 'work_by_trade', 'performance_metrics', 'payment_status', 'upcoming_work'],
    frequency: 'Weekly/Monthly',
    estimatedTime: '~25 sec',
  },
  {
    id: 'cost-report',
    name: 'Cost Report',
    description: 'Budget vs actual analysis, cost breakdown by trade, and forecast',
    icon: DollarSign,
    color: 'from-amber-600 to-amber-800',
    sections: ['budget_summary', 'cost_breakdown', 'change_orders', 'forecast', 'variance_analysis'],
    frequency: 'Monthly',
    estimatedTime: '~35 sec',
  },
  {
    id: 'daily-report',
    name: 'Daily Field Report',
    description: 'Daily summary of site activities, manpower, weather, and work performed',
    icon: ClipboardCheck,
    color: 'from-cyan-600 to-cyan-800',
    sections: ['weather', 'manpower', 'work_performed', 'materials', 'equipment', 'visitors', 'issues'],
    frequency: 'Daily',
    estimatedTime: '~15 sec',
  },
  {
    id: 'submittal-status',
    name: 'Submittal Status Report',
    description: 'Summary of all submittals with approval status, shortages, and pending items',
    icon: FileText,
    color: 'from-pink-600 to-pink-800',
    sections: ['submittal_summary', 'pending_review', 'approved', 'rejected', 'shortages', 'rfi_status'],
    frequency: 'Weekly',
    estimatedTime: '~20 sec',
  },
  {
    id: 'safety-report',
    name: 'Safety Report',
    description: 'Safety metrics, incidents, inspections, and compliance status',
    icon: HardHat,
    color: 'from-red-600 to-red-800',
    sections: ['safety_summary', 'incidents', 'inspections', 'training', 'compliance', 'action_items'],
    frequency: 'Weekly/Monthly',
    estimatedTime: '~25 sec',
  },
  {
    id: 'lookahead-schedule',
    name: '3-Week Lookahead',
    description: 'Upcoming activities by trade with resource allocation and weather impacts',
    icon: Calendar,
    color: 'from-indigo-600 to-indigo-800',
    sections: ['schedule_summary', 'week1_activities', 'week2_activities', 'week3_activities', 'resources', 'weather'],
    frequency: 'Weekly',
    estimatedTime: '~20 sec',
  },
];

const SECTION_LABELS: Record<string, string> = {
  executive_summary: 'Executive Summary',
  schedule_status: 'Schedule Status',
  budget_status: 'Budget Status',
  milestones: 'Key Milestones',
  risks: 'Risks & Issues',
  photos: 'Progress Photos',
  work_completed: 'Work Completed',
  upcoming_work: 'Upcoming Work',
  manpower: 'Manpower Summary',
  weather_impacts: 'Weather Impacts',
  issues: 'Issues & Delays',
  subcontractor_list: 'Subcontractor List',
  work_by_trade: 'Work by Trade',
  performance_metrics: 'Performance Metrics',
  payment_status: 'Payment Status',
  budget_summary: 'Budget Summary',
  cost_breakdown: 'Cost Breakdown',
  change_orders: 'Change Orders',
  forecast: 'Cost Forecast',
  variance_analysis: 'Variance Analysis',
  weather: 'Weather',
  work_performed: 'Work Performed',
  materials: 'Materials Delivered',
  equipment: 'Equipment On-Site',
  visitors: 'Visitors',
  submittal_summary: 'Submittal Summary',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  shortages: 'Quantity Shortages',
  rfi_status: 'RFI Status',
  safety_summary: 'Safety Summary',
  incidents: 'Incidents',
  inspections: 'Inspections',
  training: 'Training Records',
  compliance: 'Compliance Status',
  action_items: 'Action Items',
  schedule_summary: 'Schedule Summary',
  week1_activities: 'Week 1 Activities',
  week2_activities: 'Week 2 Activities',
  week3_activities: 'Week 3 Activities',
  resources: 'Resource Allocation',
};

interface ReportTemplatesLibraryProps {
  projectSlug: string;
  projectName?: string;
}

export default function ReportTemplatesLibrary({ projectSlug, projectName }: ReportTemplatesLibraryProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [config, setConfig] = useState<ReportConfig>({
    templateId: '',
    dateRange: {
      start: format(subWeeks(new Date(), 1), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    },
    sections: [],
    includeCharts: true,
    includePhotos: true,
    recipientEmails: [],
    format: 'pdf',
  });
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setConfig(prev => ({
      ...prev,
      templateId: template.id,
      sections: [...template.sections],
    }));
    setGeneratedReport(null);
  };

  const toggleSection = (section: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.includes(section)
        ? prev.sections.filter(s => s !== section)
        : [...prev.sections, section],
    }));
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mapTemplateToReportType(selectedTemplate.id),
          period: config.dateRange,
          sections: config.sections,
          includeCharts: config.includeCharts,
          includePhotos: config.includePhotos,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate report');

      const report = await res.json();
      setGeneratedReport(report);
      toast.success('Report generated successfully');
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedReport) return;

    try {
      const res = await fetch(`/api/projects/${projectSlug}/reports/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: generatedReport,
          format: config.format,
        }),
      });

      if (!res.ok) throw new Error('Failed to export report');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate?.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.${config.format}`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Report downloaded');
    } catch (error) {
      toast.error('Failed to download report');
    }
  };

  const mapTemplateToReportType = (templateId: string): string => {
    const mapping: Record<string, string> = {
      'owner-report': 'EXECUTIVE_SUMMARY',
      'weekly-progress': 'PROGRESS_REPORT',
      'subcontractor-summary': 'RESOURCE_REPORT',
      'cost-report': 'COST_REPORT',
      'daily-report': 'PROGRESS_REPORT',
      'submittal-status': 'MEP_REPORT',
      'safety-report': 'SAFETY_REPORT',
      'lookahead-schedule': 'SCHEDULE_REPORT',
    };
    return mapping[templateId] || 'CUSTOM';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="w-7 h-7 text-blue-400" />
            Report Templates
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Generate professional reports with one click
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-medium text-white">Select a Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORT_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${template.color}`}>
                    <template.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-medium">{template.name}</h4>
                      {selectedTemplate?.id === template.id && (
                        <Check className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {template.frequency}
                      </span>
                      <span>{template.estimatedTime}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="space-y-4">
          {selectedTemplate ? (
            <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-medium text-white">Configure Report</h3>
              </div>

              {/* Date Range */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={config.dateRange.start}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value },
                    }))}
                    className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                  />
                  <input
                    type="date"
                    value={config.dateRange.end}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value },
                    }))}
                    className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                  />
                </div>
              </div>

              {/* Sections */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Sections</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedTemplate.sections.map(section => (
                    <label
                      key={section}
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-1.5 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={config.sections.includes(section)}
                        onChange={() => toggleSection(section)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600"
                      />
                      <span className="text-gray-300 text-sm">
                        {SECTION_LABELS[section] || section}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="mb-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeCharts}
                    onChange={e => setConfig(prev => ({ ...prev, includeCharts: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600"
                  />
                  <span className="text-gray-300 text-sm">Include Charts</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includePhotos}
                    onChange={e => setConfig(prev => ({ ...prev, includePhotos: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600"
                  />
                  <span className="text-gray-300 text-sm">Include Photos</span>
                </label>
              </div>

              {/* Format */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Output Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, format: 'pdf' }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      config.format === 'pdf'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, format: 'html' }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      config.format === 'html'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    HTML
                  </button>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generating || config.sections.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Generate Report
                  </>
                )}
              </button>

              {/* Generated Report Actions */}
              {generatedReport && (
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                  <p className="text-emerald-400 text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Report ready!
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewMode(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-8 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Select a template to configure</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewMode && generatedReport && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-gray-100">
              <h3 className="font-semibold text-gray-900">{selectedTemplate?.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <Printer className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <Download className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => setPreviewMode(false)}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <span className="text-gray-600">✕</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              {/* Report Preview Content */}
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-gray-900">{generatedReport.title}</h1>
                  <p className="text-gray-500 mt-2">
                    {projectName || 'Project Report'} • {format(new Date(), 'MMMM d, yyyy')}
                  </p>
                </div>

                {generatedReport.sections?.map((section: any, idx: number) => (
                  <div key={idx} className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">
                      {section.title}
                    </h2>
                    {section.type === 'kpi' && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(section.data || {}).map(([key, value]) => (
                          <div key={key} className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-gray-500 text-sm capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                            <p className="text-xl font-bold text-gray-900">
                              {typeof value === 'number' ? value.toLocaleString() : String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {section.type === 'text' && (
                      <p className="text-gray-700">{section.data}</p>
                    )}
                    {section.type === 'list' && (
                      <ul className="list-disc list-inside text-gray-700 space-y-1">
                        {(section.data || []).map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                {generatedReport.recommendations?.length > 0 && (
                  <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-blue-800 mb-2">Recommendations</h3>
                    <ul className="list-disc list-inside text-blue-700 space-y-1">
                      {generatedReport.recommendations.map((rec: string, i: number) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
