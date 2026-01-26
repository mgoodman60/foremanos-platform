'use client';

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Package,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  Database,
  Zap,
  DoorOpen,
  Wrench,
  Pipette,
  Thermometer,
  Lightbulb,
  Paintbrush,
  Box,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

interface Requirement {
  id?: string;
  itemName: string;
  itemCategory: string;
  csiDivision?: string;
  specSection?: string;
  requiredQty: number;
  unit: string;
  sourceType: string;
  sourceDescription: string;
  submittedQty?: number;
  approvedQty?: number;
  status?: string;
}

interface RequirementsDashboardProps {
  projectSlug: string;
}

const CATEGORY_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  doors: { icon: DoorOpen, label: 'Doors & Frames', color: 'border-amber-500 bg-amber-950' },
  door_frames: { icon: DoorOpen, label: 'Door Frames', color: 'border-amber-500 bg-amber-950' },
  door_hardware: { icon: Wrench, label: 'Door Hardware', color: 'border-orange-500 bg-orange-950' },
  windows: { icon: Layers, label: 'Windows', color: 'border-sky-500 bg-sky-950' },
  window_accessories: { icon: Layers, label: 'Window Accessories', color: 'border-sky-500 bg-sky-950' },
  glazing: { icon: Layers, label: 'Glazing', color: 'border-cyan-500 bg-cyan-950' },
  finishes: { icon: Paintbrush, label: 'Finishes', color: 'border-purple-500 bg-purple-950' },
  plumbing: { icon: Pipette, label: 'Plumbing', color: 'border-blue-500 bg-blue-950' },
  hvac: { icon: Thermometer, label: 'HVAC', color: 'border-teal-500 bg-teal-950' },
  electrical: { icon: Lightbulb, label: 'Electrical', color: 'border-yellow-500 bg-yellow-950' },
  mep_equipment: { icon: Box, label: 'MEP Equipment', color: 'border-indigo-500 bg-indigo-950' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING: { color: 'text-slate-400', label: 'Pending' },
  PARTIALLY_SUBMITTED: { color: 'text-amber-400', label: 'Partial' },
  FULLY_SUBMITTED: { color: 'text-blue-400', label: 'Submitted' },
  APPROVED: { color: 'text-emerald-400', label: 'Approved' },
  INSUFFICIENT: { color: 'text-red-400', label: 'Insufficient' },
};

export default function RequirementsDashboard({ projectSlug }: RequirementsDashboardProps) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, Requirement[]>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'live' | 'database'>('live');

  useEffect(() => {
    fetchRequirements();
  }, [projectSlug, viewMode]);

  const fetchRequirements = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/requirements?live=${viewMode === 'live'}`);
      if (res.ok) {
        const data = await res.json();
        setRequirements(data.requirements);
        
        // Group by category
        const grouped: Record<string, Requirement[]> = {};
        data.requirements.forEach((req: Requirement) => {
          const cat = req.itemCategory;
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(req);
        });
        setByCategory(grouped);
        
        // Expand first 3 categories by default
        const firstCategories = Object.keys(grouped).slice(0, 3);
        setExpandedCategories(new Set(firstCategories));
      }
    } catch (error) {
      console.error('Failed to fetch requirements:', error);
      toast.error('Failed to load requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/requirements`, {
        method: 'POST'
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`Synced ${data.synced.requirements} requirements and ${data.synced.hardwareSets} hardware sets`);
        fetchRequirements();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Sync failed');
      }
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const toggleCategory = (cat: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(cat)) {
      newExpanded.delete(cat);
    } else {
      newExpanded.add(cat);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryTotals = (items: Requirement[]) => {
    return {
      totalQty: items.reduce((sum, i) => sum + i.requiredQty, 0),
      itemCount: items.length,
    };
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-400" />
            Project Quantity Requirements
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            All required quantities aggregated from door schedules, window schedules, takeoffs, and equipment lists
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-800 rounded-lg p-1 border-2 border-slate-600">
            <button
              onClick={() => setViewMode('live')}
              className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 transition-colors
                ${viewMode === 'live' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Zap className="w-3.5 h-3.5" /> Live
            </button>
            <button
              onClick={() => setViewMode('database')}
              className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 transition-colors
                ${viewMode === 'database' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Database className="w-3.5 h-3.5" /> Saved
            </button>
          </div>
          
          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700
              text-white rounded-lg flex items-center gap-2 transition-colors font-medium
              border-2 border-emerald-500 disabled:border-slate-600"
          >
            {syncing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Syncing...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Sync from Project Data</>
            )}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border-2 border-slate-500 rounded-xl p-4">
          <p className="text-3xl font-bold text-white">{requirements.length}</p>
          <p className="text-sm text-slate-300 font-medium">Total Requirements</p>
        </div>
        <div className="bg-slate-900 border-2 border-slate-500 rounded-xl p-4">
          <p className="text-3xl font-bold text-white">{Object.keys(byCategory).length}</p>
          <p className="text-sm text-slate-300 font-medium">Categories</p>
        </div>
        <div className="bg-emerald-950 border-2 border-emerald-500 rounded-xl p-4">
          <p className="text-3xl font-bold text-emerald-400">
            {requirements.filter(r => r.status === 'APPROVED').length}
          </p>
          <p className="text-sm text-emerald-300 font-medium">Approved</p>
        </div>
        <div className="bg-amber-950 border-2 border-amber-500 rounded-xl p-4">
          <p className="text-3xl font-bold text-amber-400">
            {requirements.filter(r => r.status === 'PENDING' || !r.status).length}
          </p>
          <p className="text-sm text-amber-300 font-medium">Pending Submittal</p>
        </div>
      </div>

      {/* Requirements by Category */}
      {Object.keys(byCategory).length === 0 ? (
        <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <p className="text-slate-300 font-medium">No requirements found</p>
          <p className="text-sm text-slate-500 mt-1">
            Upload door schedules, window schedules, or material takeoffs to see requirements
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byCategory).map(([category, items]) => {
            const config = CATEGORY_CONFIG[category] || {
              icon: Package,
              label: category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              color: 'border-slate-500 bg-slate-900'
            };
            const CategoryIcon = config.icon;
            const isExpanded = expandedCategories.has(category);
            const totals = getCategoryTotals(items);

            return (
              <div
                key={category}
                className={`border-2 ${config.color} rounded-xl overflow-hidden`}
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-black/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon className="w-5 h-5 text-white" />
                    <span className="text-white font-semibold">{config.label}</span>
                    <span className="px-2 py-0.5 bg-black/30 rounded text-slate-300 text-sm">
                      {items.length} items
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Category Items */}
                {isExpanded && (
                  <div className="border-t border-white/10">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-slate-400 border-b border-white/10">
                          <th className="px-4 py-2 font-medium">Item</th>
                          <th className="px-4 py-2 font-medium">CSI</th>
                          <th className="px-4 py-2 font-medium text-right">Required</th>
                          <th className="px-4 py-2 font-medium">Source</th>
                          <th className="px-4 py-2 font-medium text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => {
                          const statusConfig = STATUS_CONFIG[item.status || 'PENDING'];
                          return (
                            <tr
                              key={item.id || idx}
                              className="border-b border-white/5 hover:bg-black/20 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <p className="text-white font-medium">{item.itemName}</p>
                                {item.specSection && (
                                  <p className="text-xs text-slate-500">Spec: {item.specSection}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                                {item.csiDivision || '-'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-white font-bold">{item.requiredQty}</span>
                                <span className="text-slate-400 ml-1">{item.unit}</span>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                                {item.sourceDescription}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-sm font-medium ${statusConfig?.color || 'text-slate-400'}`}>
                                  {statusConfig?.label || item.status || 'Pending'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
