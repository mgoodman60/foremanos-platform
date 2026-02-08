'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Calendar, Sun, Cloud, CloudRain, Users, Clock,
  AlertTriangle, Wrench, CheckCircle, XCircle, Send, Edit2,
  Save, X, FileText, MapPin, Truck, HardHat, RefreshCw, Loader2,
  ImageIcon, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import InlineEditSection from './InlineEditSection';
import ReportTimeline from './ReportTimeline';
import OneDriveSyncBadge from './OneDriveSyncBadge';

interface LaborEntry {
  id: string;
  tradeName: string;
  workerCount: number;
  regularHours: number;
  overtimeHours: number;
  description?: string | null;
}

interface EquipmentEntry {
  id: string;
  equipmentName: string;
  equipmentType?: string | null;
  hours: number;
  status?: string | null;
  notes?: string | null;
}

interface ProgressEntry {
  id: string;
  activityName: string;
  location?: string | null;
  unitsCompleted: number;
  unitOfMeasure?: string | null;
  percentComplete: number;
  notes?: string | null;
}

interface DailyReportFull {
  id: string;
  reportNumber: number;
  reportDate: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  weatherCondition: string | null;
  temperatureHigh: number | null;
  temperatureLow: number | null;
  humidity: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  weatherNotes: string | null;
  workPerformed: string | null;
  workPlanned: string | null;
  delaysEncountered: string | null;
  delayHours: number | null;
  delayReason: string | null;
  safetyIncidents: number;
  safetyNotes: string | null;
  visitors: string | null;
  equipmentOnSite: string | null;
  materialsReceived: string | null;
  photoIds: string[];
  photos: unknown;
  rejectionReason: string | null;
  rejectionNotes: string | null;
  onedriveExported?: boolean;
  onedriveExportedAt?: string | null;
  onedriveExportPath?: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  createdByUser: { id: string; username: string };
  laborEntries: LaborEntry[];
  equipmentEntries: EquipmentEntry[];
  progressEntries: ProgressEntry[];
}

interface DailyReportDetailProps {
  projectSlug: string;
  reportId: string;
}

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  SUBMITTED: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  APPROVED: 'bg-green-500/20 text-green-300 border-green-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const WeatherIcon = ({ condition }: { condition: string | null }) => {
  switch (condition?.toLowerCase()) {
    case 'sunny': case 'clear': return <Sun className="w-5 h-5 text-yellow-400" />;
    case 'cloudy': case 'overcast': return <Cloud className="w-5 h-5 text-gray-400" />;
    case 'rainy': case 'rain': return <CloudRain className="w-5 h-5 text-blue-400" />;
    default: return <Sun className="w-5 h-5 text-gray-500" />;
  }
};

export default function DailyReportDetail({ projectSlug, reportId }: DailyReportDetailProps) {
  const router = useRouter();
  const [report, setReport] = useState<DailyReportFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit state for each section
  const [editWeather, setEditWeather] = useState({
    weatherCondition: '',
    temperatureHigh: '',
    temperatureLow: '',
    humidity: '',
    windSpeed: '',
    precipitation: '',
    weatherNotes: '',
  });
  const [editWork, setEditWork] = useState({ workPerformed: '', workPlanned: '' });
  const [editDelay, setEditDelay] = useState({ delayHours: '', delayReason: '', delaysEncountered: '' });
  const [editSafety, setEditSafety] = useState({ safetyIncidents: '', safetyNotes: '' });
  const [editNotes, setEditNotes] = useState({ visitors: '', materialsReceived: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/daily-reports/${reportId}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('Report not found');
          router.push(`/project/${projectSlug}/field-ops/daily-reports`);
          return;
        }
        throw new Error('Failed to fetch report');
      }
      const data = await res.json();
      setReport(data.report);
      syncEditState(data.report);
    } catch (error) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [projectSlug, reportId, router]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const syncEditState = (r: DailyReportFull) => {
    setEditWeather({
      weatherCondition: r.weatherCondition || '',
      temperatureHigh: r.temperatureHigh?.toString() || '',
      temperatureLow: r.temperatureLow?.toString() || '',
      humidity: r.humidity?.toString() || '',
      windSpeed: r.windSpeed?.toString() || '',
      precipitation: r.precipitation?.toString() || '',
      weatherNotes: r.weatherNotes || '',
    });
    setEditWork({
      workPerformed: r.workPerformed || '',
      workPlanned: r.workPlanned || '',
    });
    setEditDelay({
      delayHours: r.delayHours?.toString() || '',
      delayReason: r.delayReason || '',
      delaysEncountered: r.delaysEncountered || '',
    });
    setEditSafety({
      safetyIncidents: r.safetyIncidents?.toString() || '0',
      safetyNotes: r.safetyNotes || '',
    });
    setEditNotes({
      visitors: typeof r.visitors === 'string' ? r.visitors : (r.visitors ? JSON.stringify(r.visitors) : ''),
      materialsReceived: typeof r.materialsReceived === 'string' ? r.materialsReceived : (r.materialsReceived ? JSON.stringify(r.materialsReceived) : ''),
    });
  };

  const canEdit = report?.status === 'DRAFT' || report?.status === 'REJECTED';

  const patchReport = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/projects/${projectSlug}/daily-reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update' }));
      throw new Error(err.error || 'Failed to update');
    }
    const result = await res.json();
    setReport(result.report);
    syncEditState(result.report);
    return result.report;
  };

  const handleStatusAction = async (action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DRAFT') => {
    setActionLoading(action);
    try {
      const payload: Record<string, unknown> = { status: action };
      if (action === 'REJECTED') {
        if (!rejectReason.trim()) {
          toast.error('Rejection reason is required');
          setActionLoading(null);
          return;
        }
        payload.rejectionReason = rejectReason;
      }
      await patchReport(payload);
      toast.success(
        action === 'SUBMITTED' ? 'Report submitted' :
        action === 'APPROVED' ? 'Report approved' :
        action === 'REJECTED' ? 'Report rejected' :
        'Report returned to draft'
      );
      setShowRejectDialog(false);
      setRejectReason('');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Report not found</p>
          <Link
            href={`/project/${projectSlug}/field-ops/daily-reports`}
            className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
          >
            Back to reports
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      {/* Back Link */}
      <div className="mb-6">
        <Link
          href={`/project/${projectSlug}/field-ops/daily-reports`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Daily Reports
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">
              Report #{report.reportNumber}
            </h1>
            <span className={`px-2.5 py-1 text-xs rounded-full font-medium border ${statusStyles[report.status]}`}>
              {report.status}
            </span>
            {report.status === 'APPROVED' && (
              <OneDriveSyncBadge
                onedriveExported={report.onedriveExported ?? false}
                onedriveExportedAt={report.onedriveExportedAt}
                onedriveExportPath={report.onedriveExportPath}
                reportId={report.id}
                projectSlug={projectSlug}
              />
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(report.reportDate), 'EEEE, MMMM d, yyyy')}
            </span>
            <span>by {report.createdByUser.username}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {report.status === 'DRAFT' && (
            <button
              onClick={() => handleStatusAction('SUBMITTED')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {actionLoading === 'SUBMITTED' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit
            </button>
          )}
          {report.status === 'SUBMITTED' && (
            <>
              <button
                onClick={() => handleStatusAction('APPROVED')}
                disabled={actionLoading !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading === 'APPROVED' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Approve
              </button>
              <button
                onClick={() => setShowRejectDialog(true)}
                disabled={actionLoading !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </>
          )}
          {report.status === 'REJECTED' && (
            <button
              onClick={() => handleStatusAction('DRAFT')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {actionLoading === 'DRAFT' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
              Return to Draft
            </button>
          )}
        </div>
      </div>

      {/* Rejection Banner */}
      {report.status === 'REJECTED' && (report.rejectionReason || report.rejectionNotes) && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium text-sm">Rejected</span>
          </div>
          {report.rejectionReason && (
            <p className="text-red-300 text-sm">{report.rejectionReason}</p>
          )}
          {report.rejectionNotes && (
            <p className="text-red-300/70 text-sm mt-1">{report.rejectionNotes}</p>
          )}
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-white font-semibold mb-4">Reject Report</h3>
            <label className="block text-sm text-gray-400 mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowRejectDialog(false); setRejectReason(''); }}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusAction('REJECTED')}
                disabled={actionLoading !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading === 'REJECTED' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weather Section */}
          <InlineEditSection
            title="Weather"
            icon={<WeatherIcon condition={report.weatherCondition} />}
            canEdit={!!canEdit}
            onSave={async () => {
              await patchReport({
                weatherCondition: editWeather.weatherCondition || null,
                temperatureHigh: editWeather.temperatureHigh ? parseFloat(editWeather.temperatureHigh) : null,
                temperatureLow: editWeather.temperatureLow ? parseFloat(editWeather.temperatureLow) : null,
                humidity: editWeather.humidity ? parseInt(editWeather.humidity, 10) : null,
                windSpeed: editWeather.windSpeed ? parseFloat(editWeather.windSpeed) : null,
                precipitation: editWeather.precipitation ? parseFloat(editWeather.precipitation) : null,
                weatherNotes: editWeather.weatherNotes || null,
              });
              toast.success('Weather updated');
            }}
            onCancel={() => syncEditState(report)}
            editForm={
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Condition</label>
                  <select
                    value={editWeather.weatherCondition}
                    onChange={(e) => setEditWeather({ ...editWeather, weatherCondition: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    <option value="Sunny">Sunny</option>
                    <option value="Cloudy">Cloudy</option>
                    <option value="Overcast">Overcast</option>
                    <option value="Rainy">Rainy</option>
                    <option value="Snow">Snow</option>
                    <option value="Windy">Windy</option>
                    <option value="Clear">Clear</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">High Temp (F)</label>
                  <input type="number" value={editWeather.temperatureHigh} onChange={(e) => setEditWeather({ ...editWeather, temperatureHigh: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Low Temp (F)</label>
                  <input type="number" value={editWeather.temperatureLow} onChange={(e) => setEditWeather({ ...editWeather, temperatureLow: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Humidity (%)</label>
                  <input type="number" value={editWeather.humidity} onChange={(e) => setEditWeather({ ...editWeather, humidity: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Wind (mph)</label>
                  <input type="number" value={editWeather.windSpeed} onChange={(e) => setEditWeather({ ...editWeather, windSpeed: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Precip (in)</label>
                  <input type="number" step="0.01" value={editWeather.precipitation} onChange={(e) => setEditWeather({ ...editWeather, precipitation: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="text-xs text-gray-400 mb-1 block">Weather Notes</label>
                  <textarea value={editWeather.weatherNotes} onChange={(e) => setEditWeather({ ...editWeather, weatherNotes: e.target.value })} rows={2} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs block">Condition</span>
                <span className="text-gray-200">{report.weatherCondition || '--'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Temperature</span>
                <span className="text-gray-200">
                  {report.temperatureLow != null && report.temperatureHigh != null
                    ? `${report.temperatureLow}F - ${report.temperatureHigh}F`
                    : report.temperatureHigh != null
                    ? `${report.temperatureHigh}F`
                    : '--'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Humidity</span>
                <span className="text-gray-200">{report.humidity != null ? `${report.humidity}%` : '--'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Wind</span>
                <span className="text-gray-200">{report.windSpeed != null ? `${report.windSpeed} mph` : '--'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Precipitation</span>
                <span className="text-gray-200">{report.precipitation != null ? `${report.precipitation} in` : '--'}</span>
              </div>
              {report.weatherNotes && (
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-gray-500 text-xs block">Notes</span>
                  <span className="text-gray-300">{report.weatherNotes}</span>
                </div>
              )}
            </div>
          </InlineEditSection>

          {/* Work Performed */}
          <InlineEditSection
            title="Work Performed"
            icon={<HardHat className="w-5 h-5" />}
            canEdit={!!canEdit}
            onSave={async () => {
              await patchReport({ workPerformed: editWork.workPerformed || null });
              toast.success('Work performed updated');
            }}
            onCancel={() => syncEditState(report)}
            editForm={
              <textarea
                value={editWork.workPerformed}
                onChange={(e) => setEditWork({ ...editWork, workPerformed: e.target.value })}
                rows={5}
                placeholder="Describe work performed today..."
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
            }
          >
            <p className="text-gray-300 text-sm whitespace-pre-wrap">
              {report.workPerformed || <span className="text-gray-600 italic">No work description recorded</span>}
            </p>
          </InlineEditSection>

          {/* Work Planned */}
          <InlineEditSection
            title="Work Planned"
            icon={<FileText className="w-5 h-5" />}
            canEdit={!!canEdit}
            onSave={async () => {
              await patchReport({ workPlanned: editWork.workPlanned || null });
              toast.success('Work planned updated');
            }}
            onCancel={() => syncEditState(report)}
            editForm={
              <textarea
                value={editWork.workPlanned}
                onChange={(e) => setEditWork({ ...editWork, workPlanned: e.target.value })}
                rows={4}
                placeholder="Describe work planned for tomorrow..."
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
            }
          >
            <p className="text-gray-300 text-sm whitespace-pre-wrap">
              {report.workPlanned || <span className="text-gray-600 italic">No planned work recorded</span>}
            </p>
          </InlineEditSection>

          {/* Labor */}
          <InlineEditSection
            title="Labor"
            icon={<Users className="w-5 h-5" />}
            canEdit={false}
          >
            {report.laborEntries.length === 0 ? (
              <p className="text-gray-600 italic text-sm">No labor entries</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-700">
                      <th className="text-left pb-2 pr-4">Trade</th>
                      <th className="text-right pb-2 pr-4">Workers</th>
                      <th className="text-right pb-2 pr-4">Reg Hrs</th>
                      <th className="text-right pb-2 pr-4">OT Hrs</th>
                      <th className="text-left pb-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {report.laborEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-2 pr-4 text-gray-200">{entry.tradeName}</td>
                        <td className="py-2 pr-4 text-right text-gray-300">{entry.workerCount}</td>
                        <td className="py-2 pr-4 text-right text-gray-300">{entry.regularHours}</td>
                        <td className="py-2 pr-4 text-right text-gray-300">{entry.overtimeHours || 0}</td>
                        <td className="py-2 text-gray-400">{entry.description || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-700 text-gray-300 font-medium">
                      <td className="pt-2 pr-4">Total</td>
                      <td className="pt-2 pr-4 text-right">
                        {report.laborEntries.reduce((sum, e) => sum + e.workerCount, 0)}
                      </td>
                      <td className="pt-2 pr-4 text-right">
                        {report.laborEntries.reduce((sum, e) => sum + e.regularHours, 0).toFixed(1)}
                      </td>
                      <td className="pt-2 pr-4 text-right">
                        {report.laborEntries.reduce((sum, e) => sum + (e.overtimeHours || 0), 0).toFixed(1)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </InlineEditSection>

          {/* Equipment */}
          <InlineEditSection
            title="Equipment"
            icon={<Truck className="w-5 h-5" />}
            canEdit={false}
          >
            {report.equipmentEntries.length === 0 ? (
              <p className="text-gray-600 italic text-sm">No equipment entries</p>
            ) : (
              <div className="space-y-2">
                {report.equipmentEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                    <div>
                      <span className="text-gray-200 text-sm">{entry.equipmentName}</span>
                      {entry.equipmentType && (
                        <span className="text-gray-500 text-xs ml-2">({entry.equipmentType})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400">{entry.hours}h</span>
                      {entry.status && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">{entry.status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InlineEditSection>

          {/* Progress */}
          <InlineEditSection
            title="Progress"
            icon={<MapPin className="w-5 h-5" />}
            canEdit={false}
          >
            {report.progressEntries.length === 0 ? (
              <p className="text-gray-600 italic text-sm">No progress entries</p>
            ) : (
              <div className="space-y-3">
                {report.progressEntries.map((entry) => (
                  <div key={entry.id} className="py-2 border-b border-gray-700/50 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-200 text-sm">{entry.activityName}</span>
                      <span className="text-blue-400 text-sm font-medium">{entry.percentComplete}%</span>
                    </div>
                    <div className="mt-1.5 w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(entry.percentComplete, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {entry.location && <span>{entry.location}</span>}
                      {entry.unitsCompleted > 0 && (
                        <span>{entry.unitsCompleted} {entry.unitOfMeasure || 'units'}</span>
                      )}
                    </div>
                    {entry.notes && <p className="text-xs text-gray-400 mt-1">{entry.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </InlineEditSection>

          {/* Delays */}
          <InlineEditSection
            title="Delays"
            icon={<AlertTriangle className="w-5 h-5" />}
            canEdit={!!canEdit}
            onSave={async () => {
              await patchReport({
                delayHours: editDelay.delayHours ? parseFloat(editDelay.delayHours) : null,
                delayReason: editDelay.delayReason || null,
                delaysEncountered: editDelay.delaysEncountered || null,
              });
              toast.success('Delays updated');
            }}
            onCancel={() => syncEditState(report)}
            editForm={
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Delay Hours</label>
                    <input type="number" step="0.5" value={editDelay.delayHours} onChange={(e) => setEditDelay({ ...editDelay, delayHours: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Reason</label>
                    <input type="text" value={editDelay.delayReason} onChange={(e) => setEditDelay({ ...editDelay, delayReason: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Description</label>
                  <textarea value={editDelay.delaysEncountered} onChange={(e) => setEditDelay({ ...editDelay, delaysEncountered: e.target.value })} rows={3} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              </div>
            }
          >
            {!report.delayHours && !report.delayReason && !report.delaysEncountered ? (
              <p className="text-gray-600 italic text-sm">No delays reported</p>
            ) : (
              <div className="space-y-2">
                {report.delayHours != null && report.delayHours > 0 && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-300 text-sm font-medium">{report.delayHours} hours</span>
                    {report.delayReason && (
                      <span className="text-gray-400 text-sm">- {report.delayReason}</span>
                    )}
                  </div>
                )}
                {report.delaysEncountered && (
                  <p className="text-gray-300 text-sm">{report.delaysEncountered}</p>
                )}
              </div>
            )}
          </InlineEditSection>

          {/* Safety */}
          <InlineEditSection
            title="Safety"
            icon={<Wrench className="w-5 h-5" />}
            canEdit={!!canEdit}
            onSave={async () => {
              await patchReport({
                safetyIncidents: editSafety.safetyIncidents ? parseInt(editSafety.safetyIncidents, 10) : 0,
                safetyNotes: editSafety.safetyNotes || null,
              });
              toast.success('Safety updated');
            }}
            onCancel={() => syncEditState(report)}
            editForm={
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Incidents</label>
                  <input type="number" min="0" value={editSafety.safetyIncidents} onChange={(e) => setEditSafety({ ...editSafety, safetyIncidents: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 max-w-[120px]" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Safety Notes</label>
                  <textarea value={editSafety.safetyNotes} onChange={(e) => setEditSafety({ ...editSafety, safetyNotes: e.target.value })} rows={3} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              </div>
            }
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {report.safetyIncidents > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-red-300 text-sm font-medium">{report.safetyIncidents} incident(s)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-300 text-sm">No incidents</span>
                  </>
                )}
              </div>
              {report.safetyNotes && (
                <p className="text-gray-300 text-sm">{report.safetyNotes}</p>
              )}
            </div>
          </InlineEditSection>

          {/* Photos */}
          <InlineEditSection
            title="Photos"
            icon={<ImageIcon className="w-5 h-5" />}
            canEdit={false}
          >
            {report.photoIds.length === 0 ? (
              <p className="text-gray-600 italic text-sm">No photos attached</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {report.photoIds.map((photoId) => (
                  <div
                    key={photoId}
                    className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center border border-gray-600"
                  >
                    <ImageIcon className="w-6 h-6 text-gray-500" />
                  </div>
                ))}
              </div>
            )}
          </InlineEditSection>

          {/* Notes */}
          <InlineEditSection
            title="Notes"
            icon={<MessageSquare className="w-5 h-5" />}
            canEdit={!!canEdit}
            onSave={async () => {
              await patchReport({
                visitors: editNotes.visitors || null,
                materialsReceived: editNotes.materialsReceived || null,
              });
              toast.success('Notes updated');
            }}
            onCancel={() => syncEditState(report)}
            editForm={
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Visitors</label>
                  <textarea value={editNotes.visitors} onChange={(e) => setEditNotes({ ...editNotes, visitors: e.target.value })} rows={2} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Materials Received</label>
                  <textarea value={editNotes.materialsReceived} onChange={(e) => setEditNotes({ ...editNotes, materialsReceived: e.target.value })} rows={2} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              </div>
            }
          >
            <div className="space-y-3">
              <div>
                <span className="text-gray-500 text-xs block">Visitors</span>
                <span className="text-gray-300 text-sm">
                  {report.visitors
                    ? (typeof report.visitors === 'string' ? report.visitors : JSON.stringify(report.visitors))
                    : <span className="text-gray-600 italic">None</span>}
                </span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Materials Received</span>
                <span className="text-gray-300 text-sm">
                  {report.materialsReceived
                    ? (typeof report.materialsReceived === 'string' ? report.materialsReceived : JSON.stringify(report.materialsReceived))
                    : <span className="text-gray-600 italic">None</span>}
                </span>
              </div>
            </div>
          </InlineEditSection>
        </div>

        {/* Right Column: Timeline */}
        <div className="space-y-6">
          <ReportTimeline
            reportId={report.id}
            projectSlug={projectSlug}
            reportData={{
              createdAt: report.createdAt,
              submittedAt: report.submittedAt ?? undefined,
              approvedAt: report.approvedAt ?? undefined,
              status: report.status,
              createdByUser: report.createdByUser,
            }}
          />

          {/* Report Metadata */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Details
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Report #</span>
                <span className="text-gray-300">{report.reportNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-300">{format(new Date(report.createdAt), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Updated</span>
                <span className="text-gray-300">{format(new Date(report.updatedAt), 'MMM d, yyyy h:mm a')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created By</span>
                <span className="text-gray-300">{report.createdByUser.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Labor Entries</span>
                <span className="text-gray-300">{report.laborEntries.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Equipment</span>
                <span className="text-gray-300">{report.equipmentEntries.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Photos</span>
                <span className="text-gray-300">{report.photoIds.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
