'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Combine,
  FileStack,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  Download,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface TakeoffSummary {
  id: string;
  name: string;
  documentName: string | null;
  itemCount: number;
}

interface SheetInfo {
  sheetNumber: string;
  documentName: string | null;
  itemCount: number;
}

interface AggregatedItem {
  id: string;
  itemName: string;
  category: string;
  totalQuantity: number;
  unit: string;
  totalCost: number | null;
  mergedCount: number;
  sources: Array<{
    takeoffName: string;
    sheetNumber: string | null;
    quantity: number;
  }>;
}

interface AggregationResult {
  id: string;
  name: string;
  totalItems: number;
  totalCost: number;
  duplicatesMerged: number;
  aggregatedItems: AggregatedItem[];
  categorySummary: Array<{
    category: string;
    itemCount: number;
    totalCost: number;
  }>;
  tradeBreakdown: Array<{
    trade: string;
    itemCount: number;
    totalCost: number;
  }>;
}

interface TakeoffAggregationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectSlug: string;
  onAggregationCreated?: (result: AggregationResult) => void;
}

export function TakeoffAggregationModal({
  isOpen,
  onClose,
  projectSlug,
  onAggregationCreated
}: TakeoffAggregationModalProps) {
  const containerRef = useFocusTrap({ isActive: isOpen, onEscape: onClose });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [takeoffs, setTakeoffs] = useState<TakeoffSummary[]>([]);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedTakeoffs, setSelectedTakeoffs] = useState<Set<string>>(new Set());
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<'takeoffs' | 'sheets'>('takeoffs');
  const [aggregationName, setAggregationName] = useState('');
  const [mergeStrategy, setMergeStrategy] = useState<'smart' | 'sum_all' | 'keep_separate'>('smart');
  const [result, setResult] = useState<AggregationResult | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchAvailableData();
      setResult(null);
      setSelectedTakeoffs(new Set());
      setSelectedSheets(new Set());
      setAggregationName(`Aggregation ${new Date().toLocaleDateString()}`);
    }
  }, [isOpen]);

  const fetchAvailableData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/takeoffs/aggregations?action=available`);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      setTakeoffs(data.takeoffs || []);
      setSheets(data.sheets || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load takeoff data');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeoffToggle = (id: string) => {
    const newSelected = new Set(selectedTakeoffs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTakeoffs(newSelected);
  };

  const handleSheetToggle = (sheet: string) => {
    const newSelected = new Set(selectedSheets);
    if (newSelected.has(sheet)) {
      newSelected.delete(sheet);
    } else {
      newSelected.add(sheet);
    }
    setSelectedSheets(newSelected);
  };

  const selectAll = () => {
    if (selectionMode === 'takeoffs') {
      setSelectedTakeoffs(new Set(takeoffs.map(t => t.id)));
    } else {
      setSelectedSheets(new Set(sheets.map(s => s.sheetNumber)));
    }
  };

  const clearAll = () => {
    if (selectionMode === 'takeoffs') {
      setSelectedTakeoffs(new Set());
    } else {
      setSelectedSheets(new Set());
    }
  };

  const handleCreateAggregation = async () => {
    if (!aggregationName.trim()) {
      toast.error('Please enter an aggregation name');
      return;
    }

    const hasSelection = selectionMode === 'takeoffs' 
      ? selectedTakeoffs.size > 0 
      : selectedSheets.size > 0;

    if (!hasSelection) {
      toast.error(`Please select at least one ${selectionMode === 'takeoffs' ? 'takeoff' : 'sheet'}`);
      return;
    }

    try {
      setCreating(true);
      
      const body: Record<string, unknown> = {
        name: aggregationName,
        mergeStrategy,
        includeUnverified: true
      };

      if (selectionMode === 'takeoffs') {
        body.takeoffIds = Array.from(selectedTakeoffs);
      } else {
        body.sheetNumbers = Array.from(selectedSheets);
      }

      const response = await fetch(`/api/projects/${projectSlug}/takeoffs/aggregations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create aggregation');
      }

      const data = await response.json();
      setResult(data.aggregation);
      toast.success(`Aggregation created with ${data.aggregation.totalItems} items (${data.aggregation.duplicatesMerged} merged)`);
      onAggregationCreated?.(data.aggregation);
    } catch (error) {
      console.error('Error creating aggregation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create aggregation');
    } finally {
      setCreating(false);
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

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const exportToCSV = () => {
    if (!result) return;

    const headers = ['Category', 'Item Name', 'Quantity', 'Unit', 'Total Cost', 'Sources', 'Merged Count'];
    const rows = result.aggregatedItems.map(item => [
      item.category,
      item.itemName,
      item.totalQuantity.toFixed(2),
      item.unit,
      item.totalCost?.toFixed(2) || '',
      item.sources.map(s => `${s.takeoffName}${s.sheetNumber ? ` (${s.sheetNumber})` : ''}`).join('; '),
      item.mergedCount.toString()
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.name.replace(/[^a-z0-9]/gi, '_')}_aggregation.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div ref={containerRef} role="dialog" aria-modal="true" className="w-full max-w-4xl bg-dark-surface rounded-lg shadow-xl border border-gray-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Combine className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Multi-Sheet Aggregation</h2>
              <p className="text-sm text-gray-400">Combine takeoffs from multiple sheets</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
            </div>
          ) : result ? (
            /* Result View */
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-dark-card rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{result.totalItems}</div>
                  <div className="text-sm text-gray-400">Total Items</div>
                </div>
                <div className="bg-dark-card rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{formatCurrency(result.totalCost)}</div>
                  <div className="text-sm text-gray-400">Total Cost</div>
                </div>
                <div className="bg-dark-card rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{result.duplicatesMerged}</div>
                  <div className="text-sm text-gray-400">Duplicates Merged</div>
                </div>
              </div>

              {/* Category Summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-300">Category Summary</h3>
                <div className="space-y-2">
                  {result.categorySummary?.map((cat) => (
                    <div key={cat.category} className="bg-dark-card rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleCategory(cat.category)}
                        className="w-full flex items-center justify-between p-3 hover:bg-dark-hover transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {expandedCategories.has(cat.category) ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-medium text-white">{cat.category}</span>
                          <Badge variant="outline" className="ml-2">{cat.itemCount} items</Badge>
                        </div>
                        <span className="text-green-400 font-medium">{formatCurrency(cat.totalCost)}</span>
                      </button>
                      
                      {expandedCategories.has(cat.category) && (
                        <div className="px-4 pb-3 space-y-2">
                          {result.aggregatedItems
                            .filter(item => item.category === cat.category)
                            .map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-2 bg-dark-surface rounded text-sm">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white">{item.itemName}</span>
                                    {item.mergedCount > 1 && (
                                      <Badge variant="outline" className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">
                                        <Sparkles className="h-3 w-3 mr-1" />
                                        {item.mergedCount} merged
                                      </Badge>
                                    )}
                                  </div>
                                  {item.sources.length > 1 && (
                                    <div className="text-xs text-gray-400 mt-1">
                                      From: {item.sources.map(s => s.sheetNumber || s.takeoffName).join(', ')}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-white">{item.totalQuantity.toFixed(2)} {item.unit}</div>
                                  {item.totalCost != null && (
                                    <div className="text-gray-400 text-xs">{formatCurrency(item.totalCost)}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Selection View */
            <div className="space-y-6">
              {/* Aggregation Name */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Aggregation Name</label>
                <Input
                  value={aggregationName}
                  onChange={(e) => setAggregationName(e.target.value)}
                  placeholder="Enter a name for this aggregation"
                  className="bg-dark-card border-gray-600 text-white"
                />
              </div>

              {/* Selection Mode */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectionMode('takeoffs')}
                  className={`p-4 rounded-lg border transition-all text-left ${
                    selectionMode === 'takeoffs'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <FileStack className="h-5 w-5 text-cyan-400 mb-2" />
                  <div className="font-medium text-white">By Takeoff</div>
                  <div className="text-sm text-gray-400">
                    Select entire takeoffs ({takeoffs.length} available)
                  </div>
                </button>
                <button
                  onClick={() => setSelectionMode('sheets')}
                  className={`p-4 rounded-lg border transition-all text-left ${
                    selectionMode === 'sheets'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <Layers className="h-5 w-5 text-blue-400 mb-2" />
                  <div className="font-medium text-white">By Sheet</div>
                  <div className="text-sm text-gray-400">
                    Select specific sheets ({sheets.length} available)
                  </div>
                </button>
              </div>

              {/* Merge Strategy */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Merge Strategy</label>
                <Select value={mergeStrategy} onValueChange={(v: 'smart' | 'sum_all' | 'keep_separate') => setMergeStrategy(v)}>
                  <SelectTrigger className="bg-dark-card border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smart">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-400" />
                        Smart Merge (AI-assisted name matching)
                      </div>
                    </SelectItem>
                    <SelectItem value="sum_all">
                      <div className="flex items-center gap-2">
                        <Combine className="h-4 w-4 text-cyan-400" />
                        Sum All (exact name + category + unit match)
                      </div>
                    </SelectItem>
                    <SelectItem value="keep_separate">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-gray-400" />
                        Keep Separate (no merging)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">
                  {mergeStrategy === 'smart' && 'Uses AI to detect similar items across sheets and merges them intelligently'}
                  {mergeStrategy === 'sum_all' && 'Only merges items with exactly matching names, categories, and units'}
                  {mergeStrategy === 'keep_separate' && 'Keeps all items separate, useful for comparing sheet-by-sheet'}
                </p>
              </div>

              {/* Selection List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">
                    Select {selectionMode === 'takeoffs' ? 'Takeoffs' : 'Sheets'}
                  </label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll} className="text-gray-400 hover:text-white">
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearAll} className="text-gray-400 hover:text-white">
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                  {selectionMode === 'takeoffs' ? (
                    takeoffs.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No takeoffs available</p>
                      </div>
                    ) : (
                      takeoffs.map((takeoff) => (
                        <button
                          key={takeoff.id}
                          onClick={() => handleTakeoffToggle(takeoff.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                            selectedTakeoffs.has(takeoff.id)
                              ? 'border-cyan-500 bg-cyan-500/10'
                              : 'border-gray-700 hover:border-gray-600 bg-dark-card'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                              selectedTakeoffs.has(takeoff.id)
                                ? 'bg-cyan-500 border-cyan-500'
                                : 'border-gray-500'
                            }`}>
                              {selectedTakeoffs.has(takeoff.id) && (
                                <CheckCircle2 className="h-4 w-4 text-white" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-white">{takeoff.name}</div>
                              {takeoff.documentName && (
                                <div className="text-xs text-gray-400">{takeoff.documentName}</div>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline">{takeoff.itemCount} items</Badge>
                        </button>
                      ))
                    )
                  ) : (
                    sheets.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No sheets available</p>
                      </div>
                    ) : (
                      sheets.map((sheet) => (
                        <button
                          key={sheet.sheetNumber}
                          onClick={() => handleSheetToggle(sheet.sheetNumber)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                            selectedSheets.has(sheet.sheetNumber)
                              ? 'border-cyan-500 bg-cyan-500/10'
                              : 'border-gray-700 hover:border-gray-600 bg-dark-card'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                              selectedSheets.has(sheet.sheetNumber)
                                ? 'bg-cyan-500 border-cyan-500'
                                : 'border-gray-500'
                            }`}>
                              {selectedSheets.has(sheet.sheetNumber) && (
                                <CheckCircle2 className="h-4 w-4 text-white" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-white">Sheet {sheet.sheetNumber}</div>
                              {sheet.documentName && (
                                <div className="text-xs text-gray-400">{sheet.documentName}</div>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline">{sheet.itemCount} items</Badge>
                        </button>
                      ))
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {result ? (
              <span>{result.totalItems} items aggregated</span>
            ) : (
              <span>
                {selectionMode === 'takeoffs'
                  ? `${selectedTakeoffs.size} of ${takeoffs.length} takeoffs selected`
                  : `${selectedSheets.size} of ${sheets.length} sheets selected`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {result ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setResult(null)}
                  className="border-gray-600"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  New Aggregation
                </Button>
                <Button
                  onClick={exportToCSV}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose} className="border-gray-600">
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateAggregation}
                  disabled={creating || (selectionMode === 'takeoffs' ? selectedTakeoffs.size === 0 : selectedSheets.size === 0)}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {creating ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Combine className="mr-2 h-4 w-4" />
                      Aggregate Items
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
