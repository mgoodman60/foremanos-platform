"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Building2,
  Hammer,
  Zap,
  Droplets,
  Wind,
  PaintBucket,
  Layers,
  LayoutGrid,
  Frame,
  Wrench,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  HardHat,
  Wand2,
  RefreshCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TradeBreakdown {
  tradeType: string;
  tradeName: string;
  budgetedAmount: number;
  actualCost: number;
  variance: number;
  variancePercent: number;
  itemCount: number;
}

interface BreakdownData {
  budget: {
    totalBudget: number;
    actualCost: number;
    committedCost: number;
    contingency: number;
  };
  breakdown: {
    trades: TradeBreakdown[];
    unassigned: {
      budgetedAmount: number;
      actualCost: number;
      itemCount: number;
    };
  };
}

const TRADE_ICONS: Record<string, React.ReactNode> = {
  general_contractor: <Building2 className="h-4 w-4" />,
  concrete_masonry: <Layers className="h-4 w-4" />,
  carpentry_framing: <Frame className="h-4 w-4" />,
  electrical: <Zap className="h-4 w-4" />,
  plumbing: <Droplets className="h-4 w-4" />,
  hvac_mechanical: <Wind className="h-4 w-4" />,
  drywall_finishes: <LayoutGrid className="h-4 w-4" />,
  site_utilities: <Wrench className="h-4 w-4" />,
  structural_steel: <HardHat className="h-4 w-4" />,
  roofing: <Hammer className="h-4 w-4" />,
  glazing_windows: <LayoutGrid className="h-4 w-4" />,
  painting_coating: <PaintBucket className="h-4 w-4" />,
  flooring: <Layers className="h-4 w-4" />,
};

const TRADE_COLORS: Record<string, string> = {
  general_contractor: 'bg-blue-500',
  concrete_masonry: 'bg-gray-500',
  carpentry_framing: 'bg-amber-600',
  electrical: 'bg-yellow-500',
  plumbing: 'bg-blue-400',
  hvac_mechanical: 'bg-cyan-500',
  drywall_finishes: 'bg-slate-400',
  site_utilities: 'bg-emerald-600',
  structural_steel: 'bg-zinc-600',
  roofing: 'bg-red-600',
  glazing_windows: 'bg-sky-400',
  painting_coating: 'bg-pink-500',
  flooring: 'bg-orange-500',
};

export default function TradeBudgetBreakdown() {
  const params = useParams();
  const slug = params?.slug as string;

  const [data, setData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchTradeBreakdown();
    }
  }, [slug]);

  const fetchTradeBreakdown = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const response = await fetch(`/api/projects/${slug}/budget/trades`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else if (response.status !== 404) {
        toast.error('Failed to load trade breakdown');
      }
    } catch (error) {
      console.error('Error fetching trade breakdown:', error);
      if (!silent) toast.error('Failed to load trade breakdown');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAutoAssignTrades = async () => {
    try {
      setAutoAssigning(true);
      toast.loading('Auto-assigning trades based on item names...', { id: 'auto-assign' });
      
      const response = await fetch(`/api/projects/${slug}/budget/auto-assign-trades`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        toast.success(`Assigned ${result.results.assigned} items to trades`, { id: 'auto-assign' });
        fetchTradeBreakdown(true);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to auto-assign trades', { id: 'auto-assign' });
      }
    } catch (error) {
      console.error('Error auto-assigning trades:', error);
      toast.error('Failed to auto-assign trades', { id: 'auto-assign' });
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleSyncBudget = async () => {
    try {
      setSyncing(true);
      toast.loading('Syncing budget totals...', { id: 'sync-budget' });
      
      const response = await fetch(`/api/projects/${slug}/budget/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recalculate: true }),
      });
      
      if (response.ok) {
        const result = await response.json();
        toast.success(result.message, { id: 'sync-budget' });
        fetchTradeBreakdown(true);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to sync budget', { id: 'sync-budget' });
      }
    } catch (error) {
      console.error('Error syncing budget:', error);
      toast.error('Failed to sync budget', { id: 'sync-budget' });
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="py-12">
          <div className="flex items-center justify-center text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading trade breakdown...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.budget || data.budget.totalBudget === 0) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="py-12 text-center">
          <HardHat className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-400 mb-2">No trade breakdown available</p>
          <p className="text-sm text-gray-400">Import a budget to see cost breakdown by trade</p>
        </CardContent>
      </Card>
    );
  }

  const { trades, unassigned } = data.breakdown;
  const totalBudgeted = trades.reduce((sum, t) => sum + t.budgetedAmount, 0) + unassigned.budgetedAmount;

  return (
    <Card className="bg-dark-card border-gray-700">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-slate-50 flex items-center gap-2">
          <HardHat className="h-5 w-5 text-orange-500" />
          Cost by Trade
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* Auto-Assign Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoAssignTrades}
            disabled={autoAssigning}
            className="border-amber-600 text-amber-400 hover:bg-amber-600/20 hover:text-amber-300"
          >
            <Wand2 className={`h-4 w-4 mr-1 ${autoAssigning ? 'animate-pulse' : ''}`} />
            {autoAssigning ? 'Assigning...' : 'Auto-Assign'}
          </Button>
          {/* Sync Budget Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncBudget}
            disabled={syncing}
            className="border-blue-600 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300"
          >
            <RefreshCcw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Budget'}
          </Button>
          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchTradeBreakdown(true)}
            disabled={refreshing}
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary bar */}
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-600">
          {trades.map((trade, _index) => {
            const width = totalBudgeted > 0 ? (trade.budgetedAmount / totalBudgeted) * 100 : 0;
            return (
              <div
                key={trade.tradeType}
                className={`${TRADE_COLORS[trade.tradeType] || 'bg-gray-500'} transition-all`}
                style={{ width: `${width}%` }}
                title={`${trade.tradeName}: ${formatCurrency(trade.budgetedAmount)}`}
              />
            );
          })}
          {unassigned.budgetedAmount > 0 && (
            <div
              className="bg-gray-600"
              style={{ width: `${(unassigned.budgetedAmount / totalBudgeted) * 100}%` }}
              title={`Unassigned: ${formatCurrency(unassigned.budgetedAmount)}`}
            />
          )}
        </div>

        {/* Trade list */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {trades.map((trade) => {
            const spentPercent = trade.budgetedAmount > 0 
              ? Math.min((trade.actualCost / trade.budgetedAmount) * 100, 100) 
              : 0;
            const isOverBudget = trade.variance < 0;

            return (
              <div
                key={trade.tradeType}
                className="p-3 bg-dark-surface rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${TRADE_COLORS[trade.tradeType] || 'bg-gray-500'}`}>
                      {TRADE_ICONS[trade.tradeType] || <Wrench className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{trade.tradeName}</div>
                      <div className="text-xs text-gray-400">{trade.itemCount} items</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {formatCompactCurrency(trade.budgetedAmount)}
                    </div>
                    <div className={`text-xs flex items-center gap-0.5 justify-end ${
                      isOverBudget ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {isOverBudget ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <TrendingUp className="h-3 w-3" />
                      )}
                      {trade.variancePercent >= 0 ? '+' : ''}{trade.variancePercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(spentPercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Spent: {formatCompactCurrency(trade.actualCost)}</span>
                    <span>{spentPercent.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Unassigned items */}
          {unassigned.itemCount > 0 && (
            <div className="p-3 bg-dark-surface rounded-lg border border-dashed border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-gray-600">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-400">Unassigned to Trade</div>
                    <div className="text-xs text-gray-400">{unassigned.itemCount} items</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-400">
                  {formatCompactCurrency(unassigned.budgetedAmount)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
          {trades.slice(0, 6).map((trade) => (
            <div key={trade.tradeType} className="flex items-center gap-1 text-xs text-gray-400">
              <div className={`w-2 h-2 rounded-full ${TRADE_COLORS[trade.tradeType] || 'bg-gray-500'}`} />
              <span className="truncate max-w-[80px]">{trade.tradeName}</span>
            </div>
          ))}
          {trades.length > 6 && (
            <span className="text-xs text-gray-400">+{trades.length - 6} more</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
