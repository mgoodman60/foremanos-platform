'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Download,
  DollarSign,
  Loader2
} from 'lucide-react';

interface PriceResult {
  itemId: string;
  itemName: string;
  originalPrice: number;
  suggestedPrice: number;
  priceSource: string;
  priceDate: string;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  webSources?: string[];
}

interface PriceUpdateSession {
  sessionId: string;
  projectId: string;
  projectLocation: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  itemsToUpdate: PriceResult[];
  totalOriginalCost: number;
  totalSuggestedCost: number;
  costDifference: number;
  searchedAt: Date;
  status: 'searching' | 'ready' | 'applied' | 'cancelled';
}

interface PriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectSlug: string;
  onPricesUpdated: () => void;
}

export function PriceUpdateModal({
  isOpen,
  onClose,
  projectSlug,
  onPricesUpdated
}: PriceUpdateModalProps) {
  const [searching, setSearching] = useState(false);
  const [applying, setApplying] = useState(false);
  const [session, setSession] = useState<PriceUpdateSession | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchProgress, setSearchProgress] = useState(0);

  const handleSearch = async () => {
    setSearching(true);
    setSearchProgress(10);

    try {
      toast.loading('Searching for current material prices...', { id: 'price-search' });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setSearchProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch(`/api/projects/${projectSlug}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search' })
      });

      clearInterval(progressInterval);
      setSearchProgress(100);

      if (!response.ok) {
        throw new Error('Price search failed');
      }

      const data = await response.json();
      setSession(data.session);
      
      // Select all items with price changes by default
      const itemsWithChanges = data.session.itemsToUpdate
        .filter((item: PriceResult) => Math.abs(item.suggestedPrice - item.originalPrice) > 0.01)
        .map((item: PriceResult) => item.itemId);
      setSelectedItems(new Set(itemsWithChanges));

      toast.dismiss('price-search');
      toast.success(`Found pricing data for ${data.session.itemsToUpdate.length} items`);
    } catch (error) {
      console.error('Price search error:', error);
      toast.dismiss('price-search');
      toast.error('Failed to search for prices');
    } finally {
      setSearching(false);
      setSearchProgress(0);
    }
  };

  const handleApplyUpdates = async () => {
    if (!session || selectedItems.size === 0) return;

    setApplying(true);
    try {
      const updates = session.itemsToUpdate
        .filter(item => selectedItems.has(item.itemId))
        .map(item => ({
          itemId: item.itemId,
          newPrice: item.suggestedPrice,
          priceSource: item.priceSource
        }));

      const response = await fetch(`/api/projects/${projectSlug}/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      if (!response.ok) {
        throw new Error('Failed to apply price updates');
      }

      const data = await response.json();
      toast.success(`Updated ${data.updated} item prices`);
      onPricesUpdated();
      onClose();
    } catch (error) {
      console.error('Apply updates error:', error);
      toast.error('Failed to apply price updates');
    } finally {
      setApplying(false);
    }
  };

  const handleExportReport = async () => {
    if (!session) return;

    try {
      const response = await fetch(`/api/projects/${projectSlug}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export-report', session })
      });

      if (!response.ok) throw new Error('Export failed');

      const data = await response.json();
      
      // Download as markdown file
      const blob = new Blob([data.report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `price-comparison-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Report exported');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (session) {
      setSelectedItems(new Set(session.itemsToUpdate.map(i => i.itemId)));
    }
  };

  const selectNone = () => {
    setSelectedItems(new Set());
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-600';
      case 'medium': return 'bg-yellow-600';
      case 'low': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getPriceChangeIcon = (original: number, suggested: number) => {
    const diff = suggested - original;
    if (Math.abs(diff) < 0.01) return <Minus className="h-4 w-4 text-gray-400" />;
    if (diff > 0) return <TrendingUp className="h-4 w-4 text-red-400" />;
    return <TrendingDown className="h-4 w-4 text-green-400" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getSelectedTotals = () => {
    if (!session) return { original: 0, suggested: 0 };
    return session.itemsToUpdate
      .filter(item => selectedItems.has(item.itemId))
      .reduce((acc, item) => ({
        original: acc.original + item.originalPrice,
        suggested: acc.suggested + item.suggestedPrice
      }), { original: 0, suggested: 0 });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-[#1F2328] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-400" />
            Update Prices from Web
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Search for current material prices based on your project location
          </DialogDescription>
        </DialogHeader>

        {!session ? (
          // Initial search state
          <div className="py-8">
            {searching ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  <span className="text-lg">Searching for current prices...</span>
                </div>
                <Progress value={searchProgress} className="h-2" />
                <p className="text-center text-sm text-gray-400">
                  This may take a minute while we search supplier databases and market data
                </p>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <Globe className="h-16 w-16 mx-auto text-blue-400 opacity-50" />
                <p className="text-gray-300">
                  Click search to find current market prices for all materials in your takeoff.
                  Prices will be adjusted for your project location.
                </p>
                <Button
                  onClick={handleSearch}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Search Current Prices
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Results display
          <div className="space-y-4">
            {/* Location & Summary */}
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-400" />
                <span className="text-sm">
                  {[session.projectLocation.city, session.projectLocation.state, session.projectLocation.zip]
                    .filter(Boolean).join(', ') || 'National Average'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">{session.itemsToUpdate.length} items</span>
                <span className="text-gray-400">|</span>
                <span>
                  Difference: 
                  <span className={session.costDifference >= 0 ? 'text-red-400' : 'text-green-400'}>
                    {' '}{session.costDifference >= 0 ? '+' : ''}{formatCurrency(session.costDifference)}
                  </span>
                </span>
              </div>
            </div>

            {/* Selection controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Select None
                </Button>
                <span className="text-sm text-gray-400">
                  {selectedItems.size} of {session.itemsToUpdate.length} selected
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportReport}>
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
            </div>

            {/* Items list */}
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-2">
                {session.itemsToUpdate.map(item => {
                  const priceChange = item.suggestedPrice - item.originalPrice;
                  const changePercent = item.originalPrice > 0
                    ? ((priceChange / item.originalPrice) * 100).toFixed(1)
                    : 'N/A';
                  const isSelected = selectedItems.has(item.itemId);

                  return (
                    <div
                      key={item.itemId}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-900/30 border-blue-600'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                      onClick={() => toggleItemSelection(item.itemId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleItemSelection(item.itemId)}
                          />
                          <div>
                            <p className="font-medium text-sm">{item.itemName}</p>
                            <p className="text-xs text-gray-400">{item.priceSource}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-sm">
                                {formatCurrency(item.originalPrice)}
                              </span>
                              {getPriceChangeIcon(item.originalPrice, item.suggestedPrice)}
                              <span className="font-medium">
                                {formatCurrency(item.suggestedPrice)}
                              </span>
                            </div>
                            <p className={`text-xs ${
                              priceChange > 0 ? 'text-red-400' : priceChange < 0 ? 'text-green-400' : 'text-gray-400'
                            }`}>
                              {priceChange >= 0 ? '+' : ''}{formatCurrency(priceChange)} ({changePercent}%)
                            </p>
                          </div>
                          <Badge className={getConfidenceColor(item.confidence)}>
                            {item.confidence}
                          </Badge>
                        </div>
                      </div>
                      {item.notes && (
                        <p className="mt-2 text-xs text-gray-400 pl-8">{item.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Selected totals */}
            {selectedItems.size > 0 && (
              <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Selected Items Impact</span>
                  <div className="text-right">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400">
                        Original: {formatCurrency(getSelectedTotals().original)}
                      </span>
                      <span className="text-blue-400">→</span>
                      <span className="font-bold">
                        New: {formatCurrency(getSelectedTotals().suggested)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {session && (
            <>
              <Button
                variant="outline"
                onClick={handleSearch}
                disabled={searching}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${searching ? 'animate-spin' : ''}`} />
                Re-Search
              </Button>
              <Button
                onClick={handleApplyUpdates}
                disabled={applying || selectedItems.size === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {applying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Apply {selectedItems.size} Updates
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
