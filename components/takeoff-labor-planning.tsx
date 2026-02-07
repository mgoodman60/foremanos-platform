'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Users,
  Clock,
  Calendar,
  HardHat,
  TrendingUp,
  Link2,
  AlertCircle,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Wrench,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface LaborRequirement {
  takeoffItemId: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  laborHoursPerUnit: number;
  totalLaborHours: number;
  suggestedCrewSize: number;
  suggestedDuration: number;
  tradeType: string;
}

interface ScheduleLink {
  takeoffItemId: string;
  scheduleTaskId: string;
  taskName: string;
  linkType: 'direct' | 'inferred' | 'manual';
  matchConfidence: number;
  assignedQuantity: number;
  assignedLaborHours: number;
}

interface ScheduleSuggestion {
  taskId: string;
  taskName: string;
  currentDuration: number;
  suggestedDuration: number;
  reason: string;
  laborDelta: number;
}

interface LaborSummary {
  totalLaborHours: number;
  byTrade: Array<{
    trade: string;
    laborHours: number;
    itemCount: number;
    suggestedCrewDays: number;
  }>;
  byCategory: Array<{
    category: string;
    laborHours: number;
    itemCount: number;
  }>;
  peakCrewSize: number;
  estimatedDuration: number;
}

interface TakeoffLaborPlanningProps {
  isOpen: boolean;
  onClose: () => void;
  takeoffId: string;
  takeoffName: string;
}

export function TakeoffLaborPlanning({
  isOpen,
  onClose,
  takeoffId,
  takeoffName
}: TakeoffLaborPlanningProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'schedule' | 'suggestions'>('overview');
  const trapRef = useFocusTrap({ isActive: isOpen, onEscape: onClose });
  const [summary, setSummary] = useState<LaborSummary | null>(null);
  const [requirements, setRequirements] = useState<LaborRequirement[]>([]);
  const [links, setLinks] = useState<ScheduleLink[]>([]);
  const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([]);
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && takeoffId) {
      fetchLaborData();
    }
  }, [isOpen, takeoffId]);

  const fetchLaborData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/takeoff/${takeoffId}/labor?action=full`);
      if (!response.ok) throw new Error('Failed to fetch labor data');

      const data = await response.json();
      setSummary(data.summary);
      setRequirements(data.requirements || []);
      setLinks(data.links || []);
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error fetching labor data:', error);
      toast.error('Failed to load labor planning data');
    } finally {
      setLoading(false);
    }
  };

  const toggleTrade = (trade: string) => {
    const newExpanded = new Set(expandedTrades);
    if (newExpanded.has(trade)) {
      newExpanded.delete(trade);
    } else {
      newExpanded.add(trade);
    }
    setExpandedTrades(newExpanded);
  };

  const exportToCSV = async () => {
    try {
      const response = await fetch(`/api/takeoff/${takeoffId}/labor?action=export`);
      if (!response.ok) throw new Error('Failed to export');

      const { plan } = await response.json();
      
      // Create CSV content
      const headers = ['Day', 'Trade', 'Crew Size', 'Hours', 'Items'];
      const rows = plan.dailyPlan.map((d: { day: number; trade: string; crewSize: number; hours: number; items: string[] }) => [
        d.day,
        d.trade,
        d.crewSize,
        d.hours,
        d.items.join('; ')
      ]);

      const csv = [headers, ...rows].map(row => row.map((cell: string | number) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${takeoffName.replace(/[^a-z0-9]/gi, '_')}_labor_plan.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Labor plan exported');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export labor plan');
    }
  };

  const formatHours = (hours: number) => {
    if (hours >= 1000) {
      return `${(hours / 1000).toFixed(1)}k`;
    }
    return hours.toFixed(0);
  };

  const getTradeColor = (trade: string): string => {
    const colors: Record<string, string> = {
      'Concrete': 'bg-gray-500',
      'Masonry': 'bg-amber-700',
      'Structural Steel': 'bg-slate-600',
      'Carpentry': 'bg-orange-700',
      'HVAC': 'bg-sky-600',
      'Plumbing': 'bg-cyan-600',
      'Electrical': 'bg-yellow-500',
      'Drywall': 'bg-stone-400',
      'Flooring': 'bg-neutral-500',
      'Painting': 'bg-zinc-400',
      'Roofing': 'bg-red-800',
      'Sitework': 'bg-lime-700',
      'Paving': 'bg-neutral-800'
    };
    return colors[trade] || 'bg-blue-600';
  };

  const getLinkTypeColor = (type: string) => {
    switch (type) {
      case 'direct': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'inferred': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'manual': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="labor-planning-title" className="w-full max-w-5xl bg-dark-surface rounded-lg shadow-xl border border-gray-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <HardHat className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h2 id="labor-planning-title" className="text-lg font-semibold text-white">Labor Planning</h2>
              <p className="text-sm text-gray-400">{takeoffName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {(['overview', 'requirements', 'schedule', 'suggestions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'requirements' && `Requirements (${requirements.length})`}
              {tab === 'schedule' && `Schedule Links (${links.length})`}
              {tab === 'suggestions' && `Suggestions (${suggestions.length})`}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && summary && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-dark-card rounded-lg p-4 text-center">
                      <Clock className="h-6 w-6 text-orange-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{formatHours(summary.totalLaborHours)}</div>
                      <div className="text-sm text-gray-400">Total Labor Hours</div>
                    </div>
                    <div className="bg-dark-card rounded-lg p-4 text-center">
                      <Users className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{summary.peakCrewSize}</div>
                      <div className="text-sm text-gray-400">Peak Crew Size</div>
                    </div>
                    <div className="bg-dark-card rounded-lg p-4 text-center">
                      <Calendar className="h-6 w-6 text-green-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{summary.estimatedDuration}</div>
                      <div className="text-sm text-gray-400">Est. Days</div>
                    </div>
                    <div className="bg-dark-card rounded-lg p-4 text-center">
                      <Wrench className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{summary.byTrade.length}</div>
                      <div className="text-sm text-gray-400">Trades</div>
                    </div>
                  </div>

                  {/* Trade Breakdown */}
                  <div className="bg-dark-card rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Labor Hours by Trade
                    </h3>
                    <div className="space-y-3">
                      {summary.byTrade.map((trade) => (
                        <div key={trade.trade} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded ${getTradeColor(trade.trade)}`} />
                              <span className="text-white">{trade.trade}</span>
                              <Badge variant="outline" className="text-xs">{trade.itemCount} items</Badge>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-gray-400">{formatHours(trade.laborHours)} hrs</span>
                              <span className="text-orange-400">{trade.suggestedCrewDays} days</span>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getTradeColor(trade.trade)}`}
                              style={{ width: `${Math.min((trade.laborHours / summary.totalLaborHours) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category Summary */}
                  <div className="bg-dark-card rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-3">By Category</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {summary.byCategory.slice(0, 9).map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between p-2 bg-dark-surface rounded">
                          <span className="text-sm text-gray-300 truncate">{cat.category}</span>
                          <span className="text-sm text-orange-400 font-medium">{formatHours(cat.laborHours)}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Requirements Tab */}
              {activeTab === 'requirements' && (
                <div className="space-y-4">
                  {/* Group by trade */}
                  {Array.from(new Set(requirements.map(r => r.tradeType))).map((trade) => {
                    const tradeItems = requirements.filter(r => r.tradeType === trade);
                    const totalHours = tradeItems.reduce((sum, r) => sum + r.totalLaborHours, 0);

                    return (
                      <div key={trade} className="bg-dark-card rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleTrade(trade)}
                          className="w-full flex items-center justify-between p-3 hover:bg-[#373e47] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {expandedTrades.has(trade) ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                            <div className={`w-3 h-3 rounded ${getTradeColor(trade)}`} />
                            <span className="font-medium text-white">{trade}</span>
                            <Badge variant="outline">{tradeItems.length} items</Badge>
                          </div>
                          <span className="text-orange-400 font-medium">{formatHours(totalHours)} hrs</span>
                        </button>

                        {expandedTrades.has(trade) && (
                          <div className="border-t border-gray-700">
                            <table className="w-full text-sm">
                              <thead className="bg-dark-surface">
                                <tr className="text-gray-400">
                                  <th className="text-left p-2 pl-10">Item</th>
                                  <th className="text-right p-2">Qty</th>
                                  <th className="text-right p-2">Hrs/Unit</th>
                                  <th className="text-right p-2">Total Hrs</th>
                                  <th className="text-right p-2">Crew</th>
                                  <th className="text-right p-2 pr-4">Days</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tradeItems.map((req) => (
                                  <tr key={req.takeoffItemId} className="border-t border-gray-800 hover:bg-[#373e47]">
                                    <td className="p-2 pl-10 text-white">
                                      <div className="truncate max-w-[200px]">{req.itemName}</div>
                                      <div className="text-xs text-gray-500">{req.category}</div>
                                    </td>
                                    <td className="p-2 text-right text-gray-300">
                                      {req.quantity.toFixed(1)} {req.unit}
                                    </td>
                                    <td className="p-2 text-right text-gray-400">{req.laborHoursPerUnit}</td>
                                    <td className="p-2 text-right text-orange-400 font-medium">
                                      {formatHours(req.totalLaborHours)}
                                    </td>
                                    <td className="p-2 text-right text-blue-400">{req.suggestedCrewSize}</td>
                                    <td className="p-2 pr-4 text-right text-green-400">{req.suggestedDuration}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Schedule Links Tab */}
              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  {links.length === 0 ? (
                    <div className="text-center py-12">
                      <Link2 className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-white">No Schedule Links Found</h3>
                      <p className="text-gray-400">No matching schedule tasks were found for this takeoff</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 mb-4">
                        <Badge variant="outline" className={getLinkTypeColor('direct')}>
                          {links.filter(l => l.linkType === 'direct').length} Direct
                        </Badge>
                        <Badge variant="outline" className={getLinkTypeColor('inferred')}>
                          {links.filter(l => l.linkType === 'inferred').length} Inferred
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {links.map((link) => (
                          <div
                            key={`${link.takeoffItemId}-${link.scheduleTaskId}`}
                            className="bg-dark-card rounded-lg p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <Link2 className="h-4 w-4 text-gray-400" />
                              <div>
                                <div className="text-white font-medium">{link.taskName}</div>
                                <div className="text-xs text-gray-400">
                                  {link.assignedQuantity.toFixed(1)} units • {formatHours(link.assignedLaborHours)} labor hrs
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={getLinkTypeColor(link.linkType)}>
                                {link.linkType}
                              </Badge>
                              <div className="text-sm">
                                <span className="text-gray-400">Confidence:</span>
                                <span className={`ml-1 font-medium ${
                                  link.matchConfidence >= 70 ? 'text-green-400' :
                                  link.matchConfidence >= 50 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                  {link.matchConfidence}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Suggestions Tab */}
              {activeTab === 'suggestions' && (
                <div className="space-y-4">
                  {suggestions.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="h-12 w-12 text-green-400 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-white">Schedule Looks Good</h3>
                      <p className="text-gray-400">No duration adjustments suggested based on takeoff data</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-blue-400">Schedule Adjustment Suggestions</h4>
                            <p className="text-sm text-gray-300 mt-1">
                              Based on takeoff labor hours, the following schedule tasks may need duration adjustments.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {suggestions.map((sug) => (
                          <div
                            key={sug.taskId}
                            className={`bg-dark-card rounded-lg p-4 border-l-4 ${
                              sug.laborDelta > 0 ? 'border-red-500' : 'border-green-500'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium text-white">{sug.taskName}</h4>
                                <p className="text-sm text-gray-400 mt-1">{sug.reason}</p>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400">{sug.currentDuration}d</span>
                                  <span className="text-gray-500">→</span>
                                  <span className={sug.laborDelta > 0 ? 'text-red-400' : 'text-green-400'}>
                                    {sug.suggestedDuration}d
                                  </span>
                                </div>
                                <div className={`text-sm mt-1 ${
                                  sug.laborDelta > 0 ? 'text-red-400' : 'text-green-400'
                                }`}>
                                  {sug.laborDelta > 0 ? '+' : ''}{sug.laborDelta} days
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLaborData}
            disabled={loading}
            className="text-gray-400"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={exportToCSV}
              className="border-green-600 text-green-400 hover:bg-green-600/20"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Plan
            </Button>
            <Button variant="outline" onClick={onClose} className="border-gray-600">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
