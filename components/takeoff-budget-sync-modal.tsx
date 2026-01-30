'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  FileText,
  PieChart
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

interface Budget {
  id: string;
  name: string;
  totalBudget: number;
  createdAt: string;
}

interface TakeoffBudgetSummary {
  itemCount: number;
  totals: {
    material: number;
    labor: number;
    total: number;
  };
  byTrade: Record<string, {
    items: any[];
    materialTotal: number;
    laborTotal: number;
    total: number;
  }>;
  csiDivisionBreakdown: Record<string, number>;
}

interface VarianceItem {
  category: string;
  itemName: string;
  takeoffEstimate: number;
  budgetedAmount: number;
  actualCost: number;
  variance: number;
  variancePercent: number;
  status: 'under' | 'over' | 'on-track';
}

interface TakeoffBudgetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  takeoffId: string;
  takeoffName: string;
  projectSlug: string;
  onSyncComplete?: () => void;
}

export function TakeoffBudgetSyncModal({
  isOpen,
  onClose,
  takeoffId,
  takeoffName,
  projectSlug,
  onSyncComplete,
}: TakeoffBudgetSyncModalProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<TakeoffBudgetSummary | null>(null);
  const [availableBudgets, setAvailableBudgets] = useState<Budget[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string>('');
  const [newBudgetName, setNewBudgetName] = useState('');
  const [contingencyPercent, setContingencyPercent] = useState(10);
  const [region, setRegion] = useState('default');
  const [syncMode, setSyncMode] = useState<'create' | 'sync'>('create');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [varianceReport, setVarianceReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'sync' | 'variance'>('sync');

  useEffect(() => {
    if (isOpen && takeoffId) {
      fetchSummary();
    }
  }, [isOpen, takeoffId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/takeoff/${takeoffId}/budget?action=summary&region=${region}`
      );
      if (!response.ok) throw new Error('Failed to fetch summary');

      const data = await response.json();
      setSummary(data.summary);
      setAvailableBudgets(data.availableBudgets || []);

      // Auto-select first budget if available
      if (data.availableBudgets?.length > 0 && !selectedBudget) {
        setSelectedBudget(data.availableBudgets[0].id);
        setSyncMode('sync');
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
      toast.error('Failed to load budget summary');
    } finally {
      setLoading(false);
    }
  };

  const fetchVarianceReport = async (budgetId: string) => {
    try {
      const response = await fetch(
        `/api/takeoff/${takeoffId}/budget?action=variance&budgetId=${budgetId}`
      );
      if (!response.ok) throw new Error('Failed to fetch variance report');

      const data = await response.json();
      setVarianceReport(data.report);
    } catch (error) {
      console.error('Error fetching variance report:', error);
      toast.error('Failed to load variance report');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);

      const body: any = {
        region,
      };

      if (syncMode === 'create') {
        if (!newBudgetName.trim()) {
          toast.error('Please enter a budget name');
          return;
        }
        body.action = 'create-budget';
        body.budgetName = newBudgetName;
        body.contingencyPercent = contingencyPercent;
      } else {
        if (!selectedBudget) {
          toast.error('Please select a budget');
          return;
        }
        body.action = 'sync';
        body.budgetId = selectedBudget;
        body.overwriteExisting = overwriteExisting;
      }

      const response = await fetch(`/api/takeoff/${takeoffId}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Sync failed');

      const data = await response.json();

      if (data.success) {
        const result = data.syncResult || data.result;
        toast.success(
          syncMode === 'create'
            ? `Budget created with ${result?.budgetItemsCreated || 0} items`
            : `Synced: ${result?.budgetItemsCreated || 0} created, ${result?.budgetItemsUpdated || 0} updated`
        );
        onSyncComplete?.();
        onClose();
      } else {
        toast.error('Sync failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync takeoff to budget');
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="w-full max-w-3xl bg-dark-surface rounded-lg shadow-xl border border-gray-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Layers className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Budget Integration</h2>
              <p className="text-sm text-gray-400">{takeoffName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sync'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="inline-block mr-2 h-4 w-4" />
            Sync to Budget
          </button>
          <button
            onClick={() => {
              setActiveTab('variance');
              if (selectedBudget && !varianceReport) {
                fetchVarianceReport(selectedBudget);
              }
            }}
            disabled={availableBudgets.length === 0}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'variance'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <PieChart className="inline-block mr-2 h-4 w-4" />
            Variance Analysis
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
            </div>
          ) : activeTab === 'sync' ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              {summary && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-dark-card rounded-lg p-4">
                    <div className="text-sm text-gray-400">Material Cost</div>
                    <div className="text-xl font-bold text-green-400">
                      {formatCurrency(summary.totals.material)}
                    </div>
                  </div>
                  <div className="bg-dark-card rounded-lg p-4">
                    <div className="text-sm text-gray-400">Labor Cost</div>
                    <div className="text-xl font-bold text-blue-400">
                      {formatCurrency(summary.totals.labor)}
                    </div>
                  </div>
                  <div className="bg-dark-card rounded-lg p-4">
                    <div className="text-sm text-gray-400">Total Estimate</div>
                    <div className="text-xl font-bold text-purple-400">
                      {formatCurrency(summary.totals.total)}
                    </div>
                  </div>
                </div>
              )}

              {/* Sync Mode Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Sync Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSyncMode('create')}
                    className={`p-4 rounded-lg border transition-all text-left ${
                      syncMode === 'create'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <Plus className="h-5 w-5 text-purple-400 mb-2" />
                    <div className="font-medium text-white">Create New Budget</div>
                    <div className="text-sm text-gray-400">
                      Generate a new budget from takeoff data
                    </div>
                  </button>
                  <button
                    onClick={() => setSyncMode('sync')}
                    disabled={availableBudgets.length === 0}
                    className={`p-4 rounded-lg border transition-all text-left ${
                      syncMode === 'sync'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-600 hover:border-gray-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <RefreshCw className="h-5 w-5 text-blue-400 mb-2" />
                    <div className="font-medium text-white">Sync to Existing</div>
                    <div className="text-sm text-gray-400">
                      Update an existing budget with takeoff items
                    </div>
                  </button>
                </div>
              </div>

              {/* Create Mode Options */}
              {syncMode === 'create' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Budget Name
                    </label>
                    <Input
                      value={newBudgetName}
                      onChange={(e) => setNewBudgetName(e.target.value)}
                      placeholder="e.g., Material Takeoff Budget - Phase 1"
                      className="bg-dark-card border-gray-600 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-300 mb-2 block">
                        Contingency %
                      </label>
                      <Input
                        type="number"
                        value={contingencyPercent}
                        onChange={(e) => setContingencyPercent(Number(e.target.value))}
                        min={0}
                        max={50}
                        className="bg-dark-card border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300 mb-2 block">
                        Region
                      </label>
                      <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger className="bg-dark-card border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">National Average</SelectItem>
                          <SelectItem value="northeast">Northeast (+25%)</SelectItem>
                          <SelectItem value="west">West Coast (+35%)</SelectItem>
                          <SelectItem value="southeast">Southeast (-10%)</SelectItem>
                          <SelectItem value="midwest">Midwest (-5%)</SelectItem>
                          <SelectItem value="southwest">Southwest (+5%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Sync Mode Options */}
              {syncMode === 'sync' && availableBudgets.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Select Budget
                    </label>
                    <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                      <SelectTrigger className="bg-dark-card border-gray-600 text-white">
                        <SelectValue placeholder="Select a budget" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBudgets.map((budget) => (
                          <SelectItem key={budget.id} value={budget.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{budget.name}</span>
                              <span className="text-gray-400 ml-2">
                                {formatCurrency(budget.totalBudget)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="overwrite"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    <label htmlFor="overwrite" className="text-sm text-gray-300">
                      Overwrite existing budget items with matching names
                    </label>
                  </div>
                </div>
              )}

              {/* Trade Breakdown */}
              {summary && Object.keys(summary.byTrade).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Trade Breakdown</h3>
                  <div className="space-y-2">
                    {Object.entries(summary.byTrade).map(([trade, data]) => (
                      <div
                        key={trade}
                        className="flex items-center justify-between p-3 bg-dark-card rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                            {trade}
                          </Badge>
                          <span className="text-sm text-gray-400">
                            {data.items.length} items
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-white">
                            {formatCurrency(data.total)}
                          </div>
                          <div className="text-xs text-gray-400">
                            Mat: {formatCurrency(data.materialTotal)} | Labor: {formatCurrency(data.laborTotal)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Variance Tab */
            <div className="space-y-6">
              {/* Budget Selector for Variance */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Compare Against Budget
                </label>
                <div className="flex gap-2">
                  <Select
                    value={selectedBudget}
                    onValueChange={(value) => {
                      setSelectedBudget(value);
                      fetchVarianceReport(value);
                    }}
                  >
                    <SelectTrigger className="flex-1 bg-dark-card border-gray-600 text-white">
                      <SelectValue placeholder="Select a budget" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBudgets.map((budget) => (
                        <SelectItem key={budget.id} value={budget.id}>
                          {budget.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedBudget && fetchVarianceReport(selectedBudget)}
                    className="border-gray-600"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {varianceReport ? (
                <>
                  {/* Variance Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-dark-card rounded-lg p-4">
                      <div className="text-sm text-gray-400">Takeoff Estimate</div>
                      <div className="text-xl font-bold text-purple-400">
                        {formatCurrency(varianceReport.totalTakeoffEstimate)}
                      </div>
                    </div>
                    <div className="bg-dark-card rounded-lg p-4">
                      <div className="text-sm text-gray-400">Budgeted Amount</div>
                      <div className="text-xl font-bold text-blue-400">
                        {formatCurrency(varianceReport.totalBudgetedAmount)}
                      </div>
                    </div>
                    <div className="bg-dark-card rounded-lg p-4">
                      <div className="text-sm text-gray-400">Variance</div>
                      <div
                        className={`text-xl font-bold flex items-center gap-1 ${
                          varianceReport.variance > 0
                            ? 'text-red-400'
                            : varianceReport.variance < 0
                            ? 'text-green-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {varianceReport.variance > 0 ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : varianceReport.variance < 0 ? (
                          <TrendingDown className="h-5 w-5" />
                        ) : (
                          <Minus className="h-5 w-5" />
                        )}
                        {formatCurrency(Math.abs(varianceReport.variance))}
                        <span className="text-sm ml-1">
                          ({varianceReport.variancePercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category Variance */}
                  {Object.keys(varianceReport.categoryVariance).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-300">By Category</h3>
                      <div className="space-y-2">
                        {Object.entries(varianceReport.categoryVariance).map(
                          ([category, data]: [string, any]) => (
                            <div
                              key={category}
                              className="flex items-center justify-between p-3 bg-dark-card rounded-lg"
                            >
                              <span className="font-medium text-white">{category}</span>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-sm text-gray-400">Takeoff</div>
                                  <div className="font-medium text-white">
                                    {formatCurrency(data.takeoffTotal)}
                                  </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-gray-500" />
                                <div className="text-right">
                                  <div className="text-sm text-gray-400">Budget</div>
                                  <div className="font-medium text-white">
                                    {formatCurrency(data.budgetTotal)}
                                  </div>
                                </div>
                                <div
                                  className={`px-2 py-1 rounded text-sm font-medium ${
                                    data.variance > 0
                                      ? 'bg-red-500/20 text-red-400'
                                      : data.variance < 0
                                      ? 'bg-green-500/20 text-green-400'
                                      : 'bg-gray-500/20 text-gray-400'
                                  }`}
                                >
                                  {data.variance > 0 ? '+' : ''}
                                  {formatCurrency(data.variance)}
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Item Details */}
                  {varianceReport.items.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-300">
                        Item Variance Details ({varianceReport.items.length})
                      </h3>
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {varianceReport.items
                          .filter((item: VarianceItem) => item.status !== 'on-track')
                          .map((item: VarianceItem, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-dark-card rounded text-sm"
                            >
                              <div className="flex items-center gap-2">
                                {item.status === 'over' ? (
                                  <AlertCircle className="h-4 w-4 text-red-400" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                                )}
                                <span className="text-white">{item.itemName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {item.category}
                                </Badge>
                              </div>
                              <div
                                className={`font-medium ${
                                  item.status === 'over' ? 'text-red-400' : 'text-green-400'
                                }`}
                              >
                                {item.variance > 0 ? '+' : ''}
                                {formatCurrency(item.variance)} ({item.variancePercent.toFixed(0)}%)
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <PieChart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a budget to view variance analysis</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {summary && (
              <span>
                {summary.itemCount} items • {formatCurrency(summary.totals.total)} estimated
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="border-gray-600">
              Cancel
            </Button>
            {activeTab === 'sync' && (
              <Button
                onClick={handleSync}
                disabled={syncing || (syncMode === 'create' && !newBudgetName) || (syncMode === 'sync' && !selectedBudget)}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {syncing ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing...
                  </>
                ) : syncMode === 'create' ? (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Budget
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync to Budget
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
