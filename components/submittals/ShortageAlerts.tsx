'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  ExternalLink,
  FileQuestion,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  Package,
  AlertOctagon,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

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

interface ShortageAlertsProps {
  projectSlug: string;
  onCreateRFI?: (shortage: Shortage) => void;
}

const SEVERITY_CONFIG = {
  CRITICAL: { bg: 'bg-red-950', border: 'border-red-500', text: 'text-red-400', icon: AlertOctagon },
  HIGH: { bg: 'bg-orange-950', border: 'border-orange-500', text: 'text-orange-400', icon: AlertTriangle },
  MEDIUM: { bg: 'bg-amber-950', border: 'border-amber-500', text: 'text-amber-400', icon: Clock },
};

export default function ShortageAlerts({ projectSlug, onCreateRFI }: ShortageAlertsProps) {
  const [loading, setLoading] = useState(true);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('all');

  useEffect(() => {
    fetchShortages();
  }, [projectSlug]);

  const fetchShortages = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/shortages`);
      if (res.ok) {
        const data = await res.json();
        setShortages(data.shortages || []);
      }
    } catch (error) {
      console.error('Failed to fetch shortages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (lineItemId: string) => {
    setDismissed(prev => new Set([...prev, lineItemId]));
    toast.success('Alert dismissed');
  };

  const handleDismissAll = () => {
    setDismissed(new Set(shortages.map(s => s.lineItemId)));
    toast.success('All alerts dismissed');
  };

  const visibleShortages = shortages
    .filter(s => !dismissed.has(s.lineItemId))
    .filter(s => filter === 'all' || s.severity === filter);

  const criticalCount = shortages.filter(s => s.severity === 'CRITICAL' && !dismissed.has(s.lineItemId)).length;
  const highCount = shortages.filter(s => s.severity === 'HIGH' && !dismissed.has(s.lineItemId)).length;
  const mediumCount = shortages.filter(s => s.severity === 'MEDIUM' && !dismissed.has(s.lineItemId)).length;

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking for shortages...
        </div>
      </div>
    );
  }

  if (shortages.length === 0) {
    return (
      <div className="bg-emerald-950 border border-emerald-700 rounded-xl p-4">
        <div className="flex items-center gap-2 text-emerald-400">
          <BellOff className="w-5 h-5" />
          <span className="font-medium">No shortages detected</span>
        </div>
        <p className="text-sm text-emerald-300/70 mt-1 ml-7">
          All verified submittals have sufficient quantities
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border-2 border-red-900 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-red-950/50 hover:bg-red-950/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-red-400" />
          <span className="font-semibold text-white">Shortage Alerts</span>
          <span className="px-2 py-0.5 bg-red-900 text-red-300 rounded-full text-sm font-medium">
            {visibleShortages.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-bold">
              {criticalCount} Critical
            </span>
          )}
          {highCount > 0 && (
            <span className="px-2 py-0.5 bg-orange-600 text-white rounded text-xs font-bold">
              {highCount} High
            </span>
          )}
          {expanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Filter & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Filter:</span>
              {(['all', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                    filter === f
                      ? f === 'all' ? 'bg-slate-600 text-white'
                        : f === 'CRITICAL' ? 'bg-red-600 text-white'
                        : f === 'HIGH' ? 'bg-orange-600 text-white'
                        : 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
            <button
              onClick={handleDismissAll}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Dismiss All
            </button>
          </div>

          {/* Shortage List */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {visibleShortages.map(shortage => {
              const config = SEVERITY_CONFIG[shortage.severity];
              const Icon = config.icon;

              return (
                <div
                  key={shortage.lineItemId}
                  className={`${config.bg} border ${config.border} rounded-lg p-3`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Icon className={`w-5 h-5 ${config.text} flex-shrink-0 mt-0.5`} />
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{shortage.productName}</p>
                        <p className="text-sm text-slate-400">
                          Short by <span className={`font-semibold ${config.text}`}>
                            {Math.abs(shortage.variance)} {shortage.unit}
                          </span>
                          {' '}({Math.abs(shortage.variancePercent).toFixed(0)}%)
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>Submitted: {shortage.submitted}</span>
                          <span>Required: {shortage.required}</span>
                          {shortage.tradeCategory && (
                            <span className="px-1.5 py-0.5 bg-slate-800 rounded">
                              {shortage.tradeCategory.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Link
                        href={`/project/${projectSlug}/mep/submittals/${shortage.submittalId}`}
                        className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                        title="View Submittal"
                      >
                        <ExternalLink className="w-4 h-4 text-slate-400" />
                      </Link>
                      {onCreateRFI && (
                        <button
                          onClick={() => onCreateRFI(shortage)}
                          className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                          title="Create RFI"
                        >
                          <FileQuestion className="w-4 h-4 text-blue-400" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(shortage.lineItemId)}
                        className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleShortages.length === 0 && (
            <p className="text-center text-slate-500 py-4">No shortages match the current filter</p>
          )}
        </div>
      )}
    </div>
  );
}
