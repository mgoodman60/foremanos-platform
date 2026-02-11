'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Loader2,
  BarChart3,
  ListChecks,
  Package,
  ArrowRight,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  AlertOctagon,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import ShortageAlerts from './ShortageAlerts';
import CreateRFIModal from './CreateRFIModal';

interface SubmittalSummary {
  id: string;
  submittalNumber: string;
  title: string;
  status: string;
  submittalType: string;
  verificationStatus: 'NOT_VERIFIED' | 'PASS' | 'FAIL' | 'REVIEW_NEEDED';
  lineItemCount: number;
  sufficient: number;
  insufficient: number;
  excess: number;
  unverified: number;
  noRequirement: number;
}

interface ProjectSummary {
  totalSubmittals: number;
  withLineItems: number;
  passCount: number;
  failCount: number;
  reviewCount: number;
  notVerifiedCount: number;
  totalLineItems: number;
}

interface BulkVerificationReport {
  submittalId: string;
  submittalNumber: string;
  overallStatus: string;
  totalLineItems: number;
  sufficientCount: number;
  insufficientCount: number;
  excessCount: number;
  criticalShortages: any[];
}

interface BulkVerificationDashboardProps {
  projectSlug: string;
}

const STATUS_CONFIG = {
  PASS: { bg: 'bg-emerald-950', border: 'border-emerald-500', text: 'text-emerald-400', icon: CheckCircle },
  FAIL: { bg: 'bg-red-950', border: 'border-red-500', text: 'text-red-400', icon: XCircle },
  REVIEW_NEEDED: { bg: 'bg-amber-950', border: 'border-amber-500', text: 'text-amber-400', icon: AlertTriangle },
  NOT_VERIFIED: { bg: 'bg-slate-800', border: 'border-slate-600', text: 'text-slate-400', icon: HelpCircle },
};

interface Shortage {
  lineItemId: string;
  productName: string;
  submittalId: string;
  submittalNumber: string;
  submitted: number;
  required: number;
  variance: number;
  variancePercent: number;
  unit: string;
  tradeCategory?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export default function BulkVerificationDashboard({ projectSlug }: BulkVerificationDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [submittals, setSubmittals] = useState<SubmittalSummary[]>([]);
  const [lastVerificationResults, setLastVerificationResults] = useState<BulkVerificationReport[] | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [rfiShortage, setRfiShortage] = useState<Shortage | null>(null);

  useEffect(() => {
    fetchSummary();
  }, [projectSlug]);

  const fetchSummary = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/bulk-verify`);
      if (res.ok) {
        const data = await res.json();
        setProjectSummary(data.projectSummary);
        setSubmittals(data.submittals);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
      toast.error('Failed to load verification summary');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkVerify = async () => {
    setVerifying(true);
    setLastVerificationResults(null);

    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/bulk-verify`, {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        setLastVerificationResults(data.reports);
        toast.success(
          `Verified ${data.summary.verifiedSubmittals} submittals: ` +
          `${data.summary.passCount} passed, ` +
          `${data.summary.failCount} failed`
        );
        // Refresh summary
        await fetchSummary();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Verification failed');
      }
    } catch (error) {
      toast.error('Bulk verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleExportProjectReport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectWide: true })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Project_Verification_Report.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Project report exported successfully');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to export report');
      }
    } catch (error) {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const filteredSubmittals = submittals.filter(s => {
    if (filterStatus === 'all') return true;
    return s.verificationStatus === filterStatus;
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" aria-hidden="true" />
            Project-Wide Verification Dashboard
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Verify all submittals at once and view compliance summary
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBulkVerify}
            disabled={verifying || (projectSummary?.withLineItems || 0) === 0}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400
              text-white rounded-xl flex items-center gap-2 transition-colors font-semibold shadow-lg"
          >
            {verifying ? (
              <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Verifying All...</>
            ) : (
              <><RefreshCw className="w-5 h-5" aria-hidden="true" /> Verify All Submittals</>
            )}
          </button>
          <button
            onClick={handleExportProjectReport}
            disabled={exporting || (projectSummary?.totalSubmittals || 0) === 0}
            className="px-5 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-gray-800 disabled:text-gray-400
              text-white rounded-xl flex items-center gap-2 transition-colors font-semibold border border-slate-500"
          >
            {exporting ? (
              <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Exporting...</>
            ) : (
              <><Download className="w-5 h-5" aria-hidden="true" /> Export Report</>
            )}
          </button>
        </div>
      </div>

      {/* Project Summary Cards */}
      {projectSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4">
            <p className="text-3xl font-bold text-white">{projectSummary.totalSubmittals}</p>
            <p className="text-sm text-slate-400 font-medium">Total Submittals</p>
          </div>
          <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4">
            <p className="text-3xl font-bold text-blue-400">{projectSummary.withLineItems}</p>
            <p className="text-sm text-slate-400 font-medium">With Line Items</p>
          </div>
          <div className="bg-emerald-950 border-2 border-emerald-500 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-emerald-400" aria-hidden="true" />
              <p className="text-3xl font-bold text-emerald-400">{projectSummary.passCount}</p>
            </div>
            <p className="text-sm text-emerald-300 font-medium">Passing</p>
          </div>
          <div className="bg-red-950 border-2 border-red-500 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-6 h-6 text-red-400" aria-hidden="true" />
              <p className="text-3xl font-bold text-red-400">{projectSummary.failCount}</p>
            </div>
            <p className="text-sm text-red-300 font-medium">Failing</p>
          </div>
          <div className="bg-amber-950 border-2 border-amber-500 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-400" aria-hidden="true" />
              <p className="text-3xl font-bold text-amber-400">{projectSummary.reviewCount}</p>
            </div>
            <p className="text-sm text-amber-300 font-medium">Needs Review</p>
          </div>
          <div className="bg-slate-800 border-2 border-slate-500 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-slate-400" aria-hidden="true" />
              <p className="text-3xl font-bold text-slate-300">{projectSummary.notVerifiedCount}</p>
            </div>
            <p className="text-sm text-slate-400 font-medium">Not Verified</p>
          </div>
          <div className="bg-slate-900 border-2 border-purple-500 rounded-xl p-4">
            <p className="text-3xl font-bold text-purple-400">{projectSummary.totalLineItems}</p>
            <p className="text-sm text-slate-400 font-medium">Total Line Items</p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {projectSummary && projectSummary.withLineItems > 0 && (
        <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Verification Status Distribution</h3>
          <div className="h-6 rounded-full overflow-hidden flex bg-slate-800">
            {projectSummary.passCount > 0 && (
              <div 
                className="bg-emerald-500 flex items-center justify-center text-xs font-bold text-white"
                style={{ width: `${(projectSummary.passCount / projectSummary.withLineItems) * 100}%` }}
              >
                {projectSummary.passCount}
              </div>
            )}
            {projectSummary.failCount > 0 && (
              <div 
                className="bg-red-500 flex items-center justify-center text-xs font-bold text-white"
                style={{ width: `${(projectSummary.failCount / projectSummary.withLineItems) * 100}%` }}
              >
                {projectSummary.failCount}
              </div>
            )}
            {projectSummary.reviewCount > 0 && (
              <div 
                className="bg-amber-500 flex items-center justify-center text-xs font-bold text-black"
                style={{ width: `${(projectSummary.reviewCount / projectSummary.withLineItems) * 100}%` }}
              >
                {projectSummary.reviewCount}
              </div>
            )}
            {projectSummary.notVerifiedCount > 0 && (
              <div 
                className="bg-slate-600 flex items-center justify-center text-xs font-bold text-white"
                style={{ width: `${(projectSummary.notVerifiedCount / projectSummary.withLineItems) * 100}%` }}
              >
                {projectSummary.notVerifiedCount}
              </div>
            )}
          </div>
          <div className="flex items-center gap-6 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Pass</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Fail</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Review</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-600"></span> Not Verified</span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filterStatus === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          All ({submittals.length})
        </button>
        <button
          onClick={() => setFilterStatus('PASS')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${
            filterStatus === 'PASS'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <CheckCircle className="w-4 h-4" aria-hidden="true" />
          Pass ({submittals.filter(s => s.verificationStatus === 'PASS').length})
        </button>
        <button
          onClick={() => setFilterStatus('FAIL')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${
            filterStatus === 'FAIL'
              ? 'bg-red-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <XCircle className="w-4 h-4" aria-hidden="true" />
          Fail ({submittals.filter(s => s.verificationStatus === 'FAIL').length})
        </button>
        <button
          onClick={() => setFilterStatus('REVIEW_NEEDED')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${
            filterStatus === 'REVIEW_NEEDED'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          Review ({submittals.filter(s => s.verificationStatus === 'REVIEW_NEEDED').length})
        </button>
      </div>

      {/* Submittals List */}
      <div className="space-y-3">
        {filteredSubmittals.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border-2 border-slate-600 rounded-xl">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-slate-500" aria-hidden="true" />
            <p className="text-slate-300 font-medium">No submittals match this filter</p>
          </div>
        ) : (
          filteredSubmittals.map((submittal) => {
            const config = STATUS_CONFIG[submittal.verificationStatus];
            const StatusIcon = config.icon;

            return (
              <Link
                key={submittal.id}
                href={`/project/${projectSlug}/mep/submittals/${submittal.id}`}
                className={`block ${config.bg} border-2 ${config.border} rounded-xl p-4 
                  hover:bg-opacity-80 transition-all group`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-black/30">
                    <StatusIcon className={`w-6 h-6 ${config.text}`} aria-hidden="true" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-blue-400">{submittal.submittalNumber}</span>
                      <h3 className="font-medium text-white truncate">{submittal.title}</h3>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                      <span>{submittal.submittalType.replace(/_/g, ' ')}</span>
                      <span>• {submittal.lineItemCount} items</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        submittal.status === 'APPROVED' ? 'bg-emerald-900 text-emerald-300' :
                        submittal.status === 'REJECTED' ? 'bg-red-900 text-red-300' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {submittal.status}
                      </span>
                    </div>
                  </div>

                  {/* Mini stats */}
                  {submittal.lineItemCount > 0 && (
                    <div className="flex items-center gap-2">
                      {submittal.sufficient > 0 && (
                        <div className="px-2 py-1 bg-emerald-900/50 border border-emerald-600 rounded text-xs text-emerald-400">
                          ✓ {submittal.sufficient}
                        </div>
                      )}
                      {submittal.insufficient > 0 && (
                        <div className="px-2 py-1 bg-red-900/50 border border-red-600 rounded text-xs text-red-400">
                          ✗ {submittal.insufficient}
                        </div>
                      )}
                      {submittal.excess > 0 && (
                        <div className="px-2 py-1 bg-amber-900/50 border border-amber-600 rounded text-xs text-amber-400">
                          ⚠ {submittal.excess}
                        </div>
                      )}
                      {submittal.unverified > 0 && (
                        <div className="px-2 py-1 bg-slate-700 border border-slate-500 rounded text-xs text-slate-400">
                          ? {submittal.unverified}
                        </div>
                      )}
                    </div>
                  )}

                  <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" aria-hidden="true" />
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Critical Shortages Alert */}
      {lastVerificationResults && (
        <div className="space-y-3">
          {lastVerificationResults
            .filter(r => r.criticalShortages && r.criticalShortages.length > 0)
            .map(r => (
              <div key={r.submittalId} className="bg-red-950 border-2 border-red-500 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertOctagon className="w-5 h-5 text-red-400" aria-hidden="true" />
                  <h4 className="font-semibold text-red-400">
                    Critical Shortages in {r.submittalNumber}
                  </h4>
                </div>
                <div className="space-y-2">
                  {r.criticalShortages.map((shortage: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-white">{shortage.productName}</span>
                      <span className="text-red-400 font-mono">
                        {shortage.submittedQty} / {shortage.requiredQty} {shortage.unit}
                        <span className="ml-2 text-red-300">
                          (short {shortage.varianceQty})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Shortage Alerts Panel */}
      <ShortageAlerts 
        projectSlug={projectSlug} 
        onCreateRFI={(shortage) => setRfiShortage(shortage)}
      />

      {/* RFI Creation Modal */}
      {rfiShortage && (
        <CreateRFIModal
          projectSlug={projectSlug}
          shortage={rfiShortage}
          onClose={() => setRfiShortage(null)}
          onCreated={() => {
            setRfiShortage(null);
            // Optionally refresh data
          }}
        />
      )}
    </div>
  );
}
