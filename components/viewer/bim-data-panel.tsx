'use client';

import { useState, useEffect } from 'react';
import {
  Database, ArrowRight, RefreshCw, CheckCircle2, AlertCircle,
  Layers, Ruler, Wrench, DollarSign, MessageSquare, Clock,
  TrendingUp, Box, FileText, Zap, ChevronDown, ChevronRight,
  Building2, Plug, Flame, Droplets, Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';

interface BIMDataFlowItem {
  id: string;
  source: string;
  destination: string;
  dataType: string;
  count: number;
  lastSync: Date | null;
  status: 'active' | 'pending' | 'error';
}

interface BIMSummary {
  totalElements: number;
  categories: Record<string, number>;
  structural: number;
  mep: number;
  architectural: number;
  site: number;
  measurements: {
    totalArea: number;
    totalVolume: number;
    totalLength: number;
  };
  lastExtraction: Date | null;
}

interface BIMDataPanelProps {
  projectSlug: string;
  modelId?: string;
  modelUrn?: string;
  onRefresh?: () => void;
}

export default function BIMDataPanel({
  projectSlug,
  modelId,
  modelUrn,
  onRefresh,
}: BIMDataPanelProps) {
  const [summary, setSummary] = useState<BIMSummary | null>(null);
  const [dataFlows, setDataFlows] = useState<BIMDataFlowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [showFlows, setShowFlows] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['structural', 'mep']);

  // Load BIM data summary
  useEffect(() => {
    if (!modelId) return;
    loadBIMData();
  }, [modelId, projectSlug]);

  const loadBIMData = async () => {
    if (!modelId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/autodesk/models/${modelId}/extract`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || null);
        
        // Build data flow items based on extraction results
        if (data.summary) {
          buildDataFlows(data.summary);
        }
      }
    } catch (error) {
      console.error('Failed to load BIM data:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildDataFlows = (bimSummary: BIMSummary) => {
    const flows: BIMDataFlowItem[] = [];

    // Structural -> Takeoff
    if (bimSummary.structural > 0) {
      flows.push({
        id: 'structural-takeoff',
        source: 'Structural Elements',
        destination: 'Material Takeoff',
        dataType: 'Quantities (SF, LF, CY)',
        count: bimSummary.structural,
        lastSync: bimSummary.lastExtraction,
        status: 'active',
      });
    }

    // MEP -> Equipment Tracking
    if (bimSummary.mep > 0) {
      flows.push({
        id: 'mep-equipment',
        source: 'MEP Elements',
        destination: 'MEP Equipment Tracking',
        dataType: 'Equipment data, specs',
        count: bimSummary.mep,
        lastSync: bimSummary.lastExtraction,
        status: 'active',
      });
    }

    // Architectural -> Takeoff
    if (bimSummary.architectural > 0) {
      flows.push({
        id: 'arch-takeoff',
        source: 'Architectural Elements',
        destination: 'Material Takeoff',
        dataType: 'Doors, windows, finishes',
        count: bimSummary.architectural,
        lastSync: bimSummary.lastExtraction,
        status: 'active',
      });
    }

    // All -> RAG Index
    flows.push({
      id: 'all-rag',
      source: 'All BIM Data',
      destination: 'AI Chat (RAG)',
      dataType: 'Searchable text chunks',
      count: bimSummary.totalElements,
      lastSync: bimSummary.lastExtraction,
      status: 'active',
    });

    // Measurements -> Budget
    if (bimSummary.measurements.totalArea > 0 || bimSummary.measurements.totalVolume > 0) {
      flows.push({
        id: 'measurements-budget',
        source: 'BIM Measurements',
        destination: 'Project Budget',
        dataType: 'Area, volume quantities',
        count: Math.round(bimSummary.measurements.totalArea + bimSummary.measurements.totalVolume),
        lastSync: bimSummary.lastExtraction,
        status: 'active',
      });
    }

    setDataFlows(flows);
  };

  const triggerExtraction = async () => {
    if (!modelId) return;

    setExtracting(true);
    try {
      const res = await fetch(`/api/autodesk/models/${modelId}/extract`, {
        method: 'POST',
      });

      if (res.ok) {
        toast.success('BIM data extraction started');
        // Reload after a delay
        setTimeout(loadBIMData, 3000);
        onRefresh?.();
      } else {
        toast.error('Failed to start extraction');
      }
    } catch (error) {
      toast.error('Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toFixed(0);
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      structural: <Building2 className="w-4 h-4" />,
      mep: <Plug className="w-4 h-4" />,
      mechanical: <Wrench className="w-4 h-4" />,
      electrical: <Lightbulb className="w-4 h-4" />,
      plumbing: <Droplets className="w-4 h-4" />,
      fire_protection: <Flame className="w-4 h-4" />,
      architectural: <Layers className="w-4 h-4" />,
      site: <Box className="w-4 h-4" />,
    };
    return icons[category] || <Box className="w-4 h-4" />;
  };

  if (!modelId) {
    return (
      <div className="bg-[#161B22] border border-gray-700 rounded-xl p-6 text-center">
        <Database className="w-10 h-10 text-gray-500 mx-auto mb-3" />
        <p className="text-gray-400">Select a model to view BIM data</p>
      </div>
    );
  }

  return (
    <div className="bg-[#161B22] border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Database className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">BIM Data Flow</h3>
            <p className="text-xs text-gray-400">Auto-extracted to app systems</p>
          </div>
        </div>
        <button
          onClick={triggerExtraction}
          disabled={extracting}
          className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${extracting ? 'animate-spin' : ''}`} />
          <span className="text-sm">{extracting ? 'Extracting...' : 'Re-extract'}</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto" />
          <p className="text-gray-400 mt-2">Loading BIM data...</p>
        </div>
      ) : summary ? (
        <>
          {/* Summary Stats */}
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Box className="w-3 h-3" />
                Total Elements
              </div>
              <p className="text-xl font-bold text-white">{formatNumber(summary.totalElements)}</p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Ruler className="w-3 h-3" />
                Total Area
              </div>
              <p className="text-xl font-bold text-white">{formatNumber(summary.measurements.totalArea)} SF</p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Box className="w-3 h-3" />
                Total Volume
              </div>
              <p className="text-xl font-bold text-white">{formatNumber(summary.measurements.totalVolume)} CF</p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Clock className="w-3 h-3" />
                Last Sync
              </div>
              <p className="text-sm font-medium text-white">
                {summary.lastExtraction
                  ? new Date(summary.lastExtraction).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="px-4 pb-4">
            <h4 className="text-gray-400 text-sm font-medium mb-2">Element Categories</h4>
            <div className="space-y-2">
              {/* Structural */}
              {summary.structural > 0 && (
                <div className="bg-gray-800/30 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory('structural')}
                    className="w-full p-3 flex items-center justify-between hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-400" />
                      <span className="text-white">Structural</span>
                      <span className="text-gray-500 text-sm">({summary.structural})</span>
                    </div>
                    {expandedCategories.includes('structural') ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedCategories.includes('structural') && (
                    <div className="px-3 pb-3 text-sm text-gray-400">
                      <p className="flex items-center gap-2">
                        <ArrowRight className="w-3 h-3 text-green-400" />
                        Auto-mapped to Material Takeoff (CSI Div 03-07)
                      </p>
                      <p className="flex items-center gap-2 mt-1">
                        <ArrowRight className="w-3 h-3 text-green-400" />
                        Quantities: Concrete (CY), Steel (Tons), Area (SF)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* MEP */}
              {summary.mep > 0 && (
                <div className="bg-gray-800/30 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory('mep')}
                    className="w-full p-3 flex items-center justify-between hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <Plug className="w-4 h-4 text-orange-400" />
                      <span className="text-white">MEP Systems</span>
                      <span className="text-gray-500 text-sm">({summary.mep})</span>
                    </div>
                    {expandedCategories.includes('mep') ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedCategories.includes('mep') && (
                    <div className="px-3 pb-3 text-sm text-gray-400">
                      <p className="flex items-center gap-2">
                        <ArrowRight className="w-3 h-3 text-green-400" />
                        Auto-creates MEP Equipment records
                      </p>
                      <p className="flex items-center gap-2 mt-1">
                        <ArrowRight className="w-3 h-3 text-green-400" />
                        Tracks: HVAC, Electrical, Plumbing, Fire Protection
                      </p>
                      <p className="flex items-center gap-2 mt-1">
                        <ArrowRight className="w-3 h-3 text-green-400" />
                        Schedules submittals, inspections, commissioning
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Architectural */}
              {summary.architectural > 0 && (
                <div className="bg-gray-800/30 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory('architectural')}
                    className="w-full p-3 flex items-center justify-between hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span className="text-white">Architectural</span>
                      <span className="text-gray-500 text-sm">({summary.architectural})</span>
                    </div>
                    {expandedCategories.includes('architectural') ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedCategories.includes('architectural') && (
                    <div className="px-3 pb-3 text-sm text-gray-400">
                      <p className="flex items-center gap-2">
                        <ArrowRight className="w-3 h-3 text-green-400" />
                        Door/Window schedules to Takeoff
                      </p>
                      <p className="flex items-center gap-2 mt-1">
                        <ArrowRight className="w-3 h-3 text-green-400" />
                        Finish schedules (CSI Div 08-12)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Data Flow Diagram */}
          <div className="border-t border-gray-700">
            <button
              onClick={() => setShowFlows(!showFlows)}
              className="w-full p-3 flex items-center justify-between hover:bg-gray-800/30"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-white font-medium">Automated Data Flows</span>
                <span className="text-gray-500 text-sm">({dataFlows.length} active)</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showFlows ? '' : '-rotate-90'}`} />
            </button>

            {showFlows && (
              <div className="p-4 pt-0 space-y-2">
                {dataFlows.map(flow => (
                  <div
                    key={flow.id}
                    className="p-3 bg-gray-800/30 rounded-lg flex items-center gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-cyan-400 font-medium">{flow.source}</span>
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                        <span className="text-green-400 font-medium">{flow.destination}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {flow.dataType} • {flow.count} items
                      </p>
                    </div>
                    <div className={`p-1.5 rounded-full ${
                      flow.status === 'active' ? 'bg-green-500/20' :
                      flow.status === 'pending' ? 'bg-yellow-500/20' :
                      'bg-red-500/20'
                    }`}>
                      {flow.status === 'active' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : flow.status === 'pending' ? (
                        <Clock className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Chat Integration */}
          <div className="p-4 border-t border-gray-700 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-purple-400 mt-0.5" />
              <div>
                <h4 className="text-white font-medium">AI Chat Integration</h4>
                <p className="text-sm text-gray-400 mt-1">
                  BIM data is indexed for natural language queries. Ask questions like:
                </p>
                <ul className="text-sm text-gray-500 mt-2 space-y-1">
                  <li>“How many HVAC units are in the model?”</li>
                  <li>“What's the total concrete volume?”</li>
                  <li>“List all doors on Level 2”</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-8 text-center">
          <Database className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No BIM data extracted yet</p>
          <button
            onClick={triggerExtraction}
            className="mt-3 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-all"
          >
            Extract BIM Data
          </button>
        </div>
      )}
    </div>
  );
}
