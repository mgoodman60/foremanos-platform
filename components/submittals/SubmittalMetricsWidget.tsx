'use client';

import { useState, useEffect } from 'react';
import {
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Loader2,
  TrendingUp,
  FileEdit,
} from 'lucide-react';
import Link from 'next/link';

interface SubmittalStats {
  total: number;
  byStatus: Record<string, number>;
  pendingReview: number;
  recentlyApproved: number;
  recentlyRejected: number;
  verificationStats: {
    sufficient: number;
    insufficient: number;
    excess: number;
    unverified: number;
  };
}

interface SubmittalMetricsWidgetProps {
  projectSlug: string;
  compact?: boolean;
}

export default function SubmittalMetricsWidget({
  projectSlug,
  compact = false,
}: SubmittalMetricsWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SubmittalStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [projectSlug]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        setError('Failed to load stats');
      }
    } catch (err) {
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4">
        <p className="text-slate-400 text-sm text-center py-4">{error || 'No data'}</p>
      </div>
    );
  }

  const approvedCount = stats.byStatus['approved'] || 0;
  const submittedCount = stats.byStatus['submitted'] || 0;
  const reviewedCount = stats.byStatus['reviewed'] || 0;
  const rejectedCount = stats.byStatus['rejected'] || 0;
  const revisionCount = stats.byStatus['revision_requested'] || 0;
  const draftCount = stats.byStatus['draft'] || 0;

  if (compact) {
    // Compact version for sidebar or small spaces
    return (
      <Link
        href={`/project/${projectSlug}/mep/submittals`}
        className="block bg-slate-900 border-2 border-slate-600 hover:border-blue-500 rounded-xl p-4 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white">Submittals</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-400">Total</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-400">{approvedCount}</p>
            <p className="text-xs text-slate-400">Approved</p>
          </div>
          <div>
            <p className="text-xl font-bold text-amber-400">{stats.pendingReview}</p>
            <p className="text-xs text-slate-400">Pending</p>
          </div>
        </div>
      </Link>
    );
  }

  // Full widget version
  return (
    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-white">Submittal Overview</h3>
        </div>
        <Link
          href={`/project/${projectSlug}/mep/submittals`}
          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-800 border-2 border-slate-500 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <FileEdit className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-emerald-950 border-2 border-emerald-500 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-300">Approved</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
        </div>
        <div className="bg-amber-950 border-2 border-amber-500 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-300">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{stats.pendingReview}</p>
        </div>
        <div className="bg-red-950 border-2 border-red-500 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-300">Rejected</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{rejectedCount}</p>
        </div>
      </div>

      {/* Verification Summary */}
      <div className="border-t border-slate-700 pt-4">
        <h4 className="text-sm font-medium text-slate-300 mb-2">Quantity Verification</h4>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <p className="text-lg font-semibold text-emerald-400">{stats.verificationStats.sufficient}</p>
            <p className="text-xs text-slate-500">Sufficient</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-red-400">{stats.verificationStats.insufficient}</p>
            <p className="text-xs text-slate-500">Shortage</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-amber-400">{stats.verificationStats.excess}</p>
            <p className="text-xs text-slate-500">Excess</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-400">{stats.verificationStats.unverified}</p>
            <p className="text-xs text-slate-500">Unverified</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="border-t border-slate-700 pt-4">
        <h4 className="text-sm font-medium text-slate-300 mb-2">This Week</h4>
        <div className="flex items-center gap-4 text-sm">
          {stats.recentlyApproved > 0 && (
            <div className="flex items-center gap-1 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              <span>{stats.recentlyApproved} approved</span>
            </div>
          )}
          {stats.recentlyRejected > 0 && (
            <div className="flex items-center gap-1 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>{stats.recentlyRejected} rejected</span>
            </div>
          )}
          {stats.recentlyApproved === 0 && stats.recentlyRejected === 0 && (
            <span className="text-slate-500">No recent activity</span>
          )}
        </div>
      </div>
    </div>
  );
}
