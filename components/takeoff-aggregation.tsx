'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Layers,
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  RefreshCw,
  Check,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Merge,
  FileText,
  Filter,
  Search
} from 'lucide-react';

interface SourceReference {
  takeoffId: string;
  takeoffName: string;
  lineItemId: string;
  sheetNumber: string | null;
  documentName: string | null;
  quantity: number;
  location: string | null;
}

interface AggregatedItem {
  id: string;
  itemName: string;
  description: string | null;
  category: string;
  totalQuantity: number;
  unit: string;
  unitCost: number | null;
  totalCost: number | null;
  sources: SourceReference[];
  mergedCount: number;
  confidence: number;
  tradeType: string | null;
  csiCode: string | null;
}

interface CategorySummary {
  category: string;
  itemCount: number;
  totalQuantity: number;
  totalCost: number;
  units: string[];
}

interface TradeBreakdown {
  trade: string;
  itemCount: number;
  totalCost: number;
  categories: string[];
}

interface Aggregation {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sourceSheets: string[];
  sourceTakeoffs: string[];
  totalItems: number;
  totalCost: number | null;
  duplicatesMerged: number;
  createdAt: string;
  creator: { id: string; username: string };
  aggregatedItems?: AggregatedItem[];
  categorySummary?: CategorySummary[];
  tradeBreakdown?: TradeBreakdown[];
}

interface AvailableSheet {
  sheetNumber: string;
  documentName: string | null;
  itemCount: number;
}

interface AvailableTakeoff {
  id: string;
  name: string;
  documentName: string | null;
  itemCount: number;
}

export default function TakeoffAggregation() {
  const params = useParams();
  const slug = params?.slug as string;

  const [aggregations, setAggregations] = useState<Aggregation[]>([]);
  const [selectedAggregation, setSelectedAggregation] = useState<Aggregation | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // New aggregation form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<AvailableSheet[]>([]);
  const [availableTakeoffs, setAvailableTakeoffs] = useState<AvailableTakeoff[]>([]);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [selectedTakeoffs, setSelectedTakeoffs] = useState<string[]>([]);
  const [mergeStrategy, setMergeStrategy] = useState<'smart' | 'sum_all' | 'keep_separate'>('smart');
  const [includeUnverified, setIncludeUnverified] = useState(false);

  // Detail view
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterTrade, setFilterTrade] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAggregations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${slug}/takeoffs/aggregations`);
      if (!res.ok) throw new Error('Failed to fetch aggregations');
      const data = await res.json();
      setAggregations(data.aggregations || []);
    } catch (error) {
      console.error('Error fetching aggregations:', error);
      toast.error('Failed to load aggregations');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchAvailableSheets = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/takeoffs/aggregations?action=available-sheets`);
      if (!res.ok) throw new Error('Failed to fetch sheets');
      const data = await res.json();
      setAvailableSheets(data.sheets || []);
      setAvailableTakeoffs(data.takeoffs || []);
    } catch (error) {
      console.error('Error fetching sheets:', error);
      toast.error('Failed to load available sheets');
    }
  };

  const fetchAggregationDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/takeoffs/aggregations/${id}`);
      if (!res.ok) throw new Error('Failed to fetch details');
      const data = await res.json();
      setSelectedAggregation(data.aggregation);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Failed to load aggregation details');
    }
  };

  useEffect(() => {
    if (slug) {
      fetchAggregations();
    }
  }, [slug, fetchAggregations]);

  const handleCreateAggregation = async () => {
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }

    if (selectedSheets.length === 0 && selectedTakeoffs.length === 0) {
      toast.error('Select at least one sheet or takeoff');
      return;
    }

    try {
      setCreating(true);
      const res = await fetch(`/api/projects/${slug}/takeoffs/aggregations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          sheetNumbers: selectedSheets.length > 0 ? selectedSheets : undefined,
          takeoffIds: selectedTakeoffs.length > 0 ? selectedTakeoffs : undefined,
          mergeStrategy,
          includeUnverified
        })
      });

      if (!res.ok) throw new Error('Failed to create aggregation');

      const data = await res.json();
      toast.success(`Aggregation created: ${data.aggregation.totalItems} items, ${data.aggregation.duplicatesMerged} merged`);
      
      setShowCreateModal(false);
      setNewName('');
      setNewDescription('');
      setSelectedSheets([]);
      setSelectedTakeoffs([]);
      fetchAggregations();
    } catch (error) {
      console.error('Error creating aggregation:', error);
      toast.error('Failed to create aggregation');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this aggregation?')) return;

    try {
      const res = await fetch(`/api/projects/${slug}/takeoffs/aggregations/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Aggregation deleted');
      if (selectedAggregation?.id === id) {
        setSelectedAggregation(null);
      }
      fetchAggregations();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete aggregation');
    }
  };

  const handleExport = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/takeoffs/aggregations/${id}?format=csv`);
      if (!res.ok) throw new Error('Failed to export');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9]/gi, '_')}_takeoff.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export');
    }
  };

  const handleEnhanceWithAI = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/takeoffs/aggregations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enhance' })
      });
      if (!res.ok) throw new Error('Failed to enhance');
      const data = await res.json();
      toast.success(`AI enhancement: ${data.enhancedItems} items improved, ${data.mergesSuggested} merge suggestions`);
      fetchAggregationDetails(id);
    } catch (error) {
      console.error('Error enhancing:', error);
      toast.error('Failed to enhance with AI');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/takeoffs/aggregations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      });
      if (!res.ok) throw new Error('Failed to approve');
      toast.success('Aggregation approved');
      fetchAggregations();
      if (selectedAggregation?.id === id) {
        fetchAggregationDetails(id);
      }
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Failed to approve');
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-900/30 text-green-400 border-green-700';
      case 'finalized': return 'bg-blue-900/30 text-blue-400 border-blue-700';
      default: return 'bg-gray-700 text-gray-300 border-gray-600';
    }
  };

  // Filter items for detail view
  const filteredItems = selectedAggregation?.aggregatedItems?.filter(item => {
    if (filterCategory && item.category !== filterCategory) return false;
    if (filterTrade && item.tradeType !== filterTrade) return false;
    if (searchTerm && !item.itemName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }) || [];

  // Get unique categories and trades for filters
  const uniqueCategories = [...new Set(selectedAggregation?.aggregatedItems?.map(i => i.category) || [])];
  const uniqueTrades = [...new Set(selectedAggregation?.aggregatedItems?.map(i => i.tradeType).filter(Boolean) || [])];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Multi-Plan Aggregation</h2>
        </div>
        <button
          onClick={() => {
            setShowCreateModal(true);
            fetchAvailableSheets();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Aggregation
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Aggregations</p>
          <p className="text-2xl font-bold text-white">{aggregations.length}</p>
        </div>
        <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Approved</p>
          <p className="text-2xl font-bold text-green-400">
            {aggregations.filter(a => a.status === 'approved').length}
          </p>
        </div>
        <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Items</p>
          <p className="text-2xl font-bold text-blue-400">
            {aggregations.reduce((sum, a) => sum + a.totalItems, 0)}
          </p>
        </div>
        <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Value</p>
          <p className="text-2xl font-bold text-emerald-400">
            {formatCurrency(aggregations.reduce((sum, a) => sum + (a.totalCost || 0), 0))}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aggregation List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-lg font-medium text-white">Aggregations</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : aggregations.length === 0 ? (
            <div className="bg-[#1F2328] rounded-lg p-6 border border-gray-700 text-center">
              <FileSpreadsheet className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No aggregations yet</p>
              <p className="text-sm text-gray-500 mt-1">Create one to consolidate takeoffs</p>
            </div>
          ) : (
            <div className="space-y-2">
              {aggregations.map(agg => (
                <div
                  key={agg.id}
                  onClick={() => fetchAggregationDetails(agg.id)}
                  className={`bg-[#1F2328] rounded-lg p-4 border cursor-pointer transition-colors ${
                    selectedAggregation?.id === agg.id
                      ? 'border-blue-500 bg-blue-900/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{agg.name}</h4>
                      <p className="text-sm text-gray-400 mt-1">
                        {agg.totalItems} items • {agg.sourceSheets?.length || 0} sheets
                      </p>
                      {agg.duplicatesMerged > 0 && (
                        <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                          <Merge className="w-3 h-3" />
                          {agg.duplicatesMerged} duplicates merged
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-xs rounded border ${getStatusColor(agg.status)}`}>
                      {agg.status}
                    </span>
                  </div>
                  {agg.totalCost && (
                    <p className="text-sm text-emerald-400 mt-2 font-medium">
                      {formatCurrency(agg.totalCost)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport(agg.id, agg.name); }}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                      title="Export CSV"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(agg.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail View */}
        <div className="lg:col-span-2">
          {selectedAggregation ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedAggregation.name}</h3>
                    {selectedAggregation.description && (
                      <p className="text-gray-400 text-sm mt-1">{selectedAggregation.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span>{selectedAggregation.totalItems} items</span>
                      <span>{selectedAggregation.sourceSheets?.length || 0} sheets</span>
                      {selectedAggregation.duplicatesMerged > 0 && (
                        <span className="text-blue-400">{selectedAggregation.duplicatesMerged} merged</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEnhanceWithAI(selectedAggregation.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-lg transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      AI Enhance
                    </button>
                    {selectedAggregation.status !== 'approved' && (
                      <button
                        onClick={() => handleApprove(selectedAggregation.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Summary */}
              {selectedAggregation.categorySummary && selectedAggregation.categorySummary.length > 0 && (
                <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">By Category</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedAggregation.categorySummary.slice(0, 6).map(cat => (
                      <div key={cat.category} className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 truncate">{cat.category}</p>
                        <p className="text-lg font-semibold text-white">{cat.itemCount}</p>
                        <p className="text-xs text-emerald-400">{formatCurrency(cat.totalCost)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#1F2328] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 bg-[#1F2328] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select
                  value={filterTrade}
                  onChange={(e) => setFilterTrade(e.target.value)}
                  className="px-3 py-2 bg-[#1F2328] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Trades</option>
                  {uniqueTrades.map(trade => (
                    <option key={trade || ''} value={trade || ''}>{trade}</option>
                  ))}
                </select>
              </div>

              {/* Items Table */}
              <div className="bg-[#1F2328] rounded-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Unit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total Cost</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Sources</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {filteredItems.slice(0, 50).map(item => (
                        <tr key={item.id} className="hover:bg-gray-800/30">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm text-white">{item.itemName}</p>
                              {item.tradeType && (
                                <p className="text-xs text-blue-400">{item.tradeType}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">{item.category}</td>
                          <td className="px-4 py-3 text-sm text-white text-right font-medium">
                            {formatNumber(item.totalQuantity)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">{item.unit}</td>
                          <td className="px-4 py-3 text-sm text-emerald-400 text-right">
                            {formatCurrency(item.totalCost)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.mergedCount > 1 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded">
                                <Merge className="w-3 h-3" />
                                {item.mergedCount} sheets
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                {item.sources[0]?.sheetNumber || '1 source'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredItems.length > 50 && (
                  <div className="px-4 py-3 bg-gray-800/30 text-center text-sm text-gray-400">
                    Showing 50 of {filteredItems.length} items
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#1F2328] rounded-lg p-8 border border-gray-700 text-center">
              <Layers className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Select an aggregation to view details</p>
              <p className="text-sm text-gray-500 mt-1">
                Or create a new one to consolidate takeoffs from multiple sheets
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1F2328] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Create New Aggregation</h3>
              <p className="text-sm text-gray-400 mt-1">Consolidate takeoffs from multiple sheets into a unified list</p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Name & Description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Full Project Takeoff"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Optional description..."
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Sheet Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Sheets</label>
                <div className="bg-gray-800/50 rounded-lg border border-gray-600 p-3 max-h-40 overflow-y-auto">
                  {availableSheets.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">No sheets available</p>
                  ) : (
                    <div className="space-y-2">
                      {availableSheets.map(sheet => (
                        <label key={sheet.sheetNumber} className="flex items-center gap-3 cursor-pointer hover:bg-gray-700/50 rounded p-1">
                          <input
                            type="checkbox"
                            checked={selectedSheets.includes(sheet.sheetNumber)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSheets([...selectedSheets, sheet.sheetNumber]);
                              } else {
                                setSelectedSheets(selectedSheets.filter(s => s !== sheet.sheetNumber));
                              }
                            }}
                            className="rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-sm text-white">{sheet.sheetNumber}</span>
                          <span className="text-xs text-gray-400">({sheet.itemCount} items)</span>
                          {sheet.documentName && (
                            <span className="text-xs text-gray-500 truncate">{sheet.documentName}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedSheets.length} sheets selected
                </p>
              </div>

              {/* Or by Takeoff */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Or Select Takeoffs</label>
                <div className="bg-gray-800/50 rounded-lg border border-gray-600 p-3 max-h-40 overflow-y-auto">
                  {availableTakeoffs.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">No takeoffs available</p>
                  ) : (
                    <div className="space-y-2">
                      {availableTakeoffs.map(takeoff => (
                        <label key={takeoff.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-700/50 rounded p-1">
                          <input
                            type="checkbox"
                            checked={selectedTakeoffs.includes(takeoff.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTakeoffs([...selectedTakeoffs, takeoff.id]);
                              } else {
                                setSelectedTakeoffs(selectedTakeoffs.filter(t => t !== takeoff.id));
                              }
                            }}
                            className="rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-sm text-white">{takeoff.name}</span>
                          <span className="text-xs text-gray-400">({takeoff.itemCount} items)</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Merge Strategy */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Merge Strategy</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setMergeStrategy('smart')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      mergeStrategy === 'smart'
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <Sparkles className={`w-5 h-5 mb-1 ${mergeStrategy === 'smart' ? 'text-blue-400' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-white">Smart Merge</p>
                    <p className="text-xs text-gray-400">AI-assisted matching</p>
                  </button>
                  <button
                    onClick={() => setMergeStrategy('sum_all')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      mergeStrategy === 'sum_all'
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <Merge className={`w-5 h-5 mb-1 ${mergeStrategy === 'sum_all' ? 'text-blue-400' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-white">Sum All</p>
                    <p className="text-xs text-gray-400">Exact name match</p>
                  </button>
                  <button
                    onClick={() => setMergeStrategy('keep_separate')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      mergeStrategy === 'keep_separate'
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <FileText className={`w-5 h-5 mb-1 ${mergeStrategy === 'keep_separate' ? 'text-blue-400' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-white">Keep Separate</p>
                    <p className="text-xs text-gray-400">No merging</p>
                  </button>
                </div>
              </div>

              {/* Options */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUnverified}
                  onChange={(e) => setIncludeUnverified(e.target.checked)}
                  className="rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">Include unverified items</span>
              </label>
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAggregation}
                disabled={creating || !newName.trim() || (selectedSheets.length === 0 && selectedTakeoffs.length === 0)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {creating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Layers className="w-4 h-4" />
                )}
                Create Aggregation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
