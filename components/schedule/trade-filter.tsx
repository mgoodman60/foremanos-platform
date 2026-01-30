"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TradeOption {
  id: string;
  name: string;
  companyName?: string;
  tradeType: string;
  taskCount?: number;
  color?: string;
}

interface TradeFilterProps {
  trades: TradeOption[];
  selectedTrades: string[];
  onSelectionChange: (tradeIds: string[]) => void;
  className?: string;
}

const TRADE_COLORS: Record<string, string> = {
  'ELECTRICAL': 'bg-yellow-500',
  'PLUMBING': 'bg-blue-500',
  'HVAC': 'bg-cyan-500',
  'MECHANICAL': 'bg-cyan-500',
  'STRUCTURAL': 'bg-gray-500',
  'CONCRETE': 'bg-stone-500',
  'FRAMING': 'bg-amber-600',
  'DRYWALL': 'bg-neutral-500',
  'FIRE_PROTECTION': 'bg-red-500',
  'ROOFING': 'bg-amber-700',
  'FLOORING': 'bg-orange-600',
  'SITEWORK': 'bg-lime-600',
  'GRADING': 'bg-lime-600',
  'GLAZING': 'bg-sky-500',
  'GENERAL': 'bg-purple-500',
  'PAINTING': 'bg-pink-500',
  'LANDSCAPING': 'bg-green-500',
  'MASONRY': 'bg-orange-800',
};

export function TradeFilter({
  trades,
  selectedTrades,
  onSelectionChange,
  className
}: TradeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleToggleTrade = (tradeId: string) => {
    if (selectedTrades.includes(tradeId)) {
      onSelectionChange(selectedTrades.filter(id => id !== tradeId));
    } else {
      onSelectionChange([...selectedTrades, tradeId]);
    }
  };
  
  const handleSelectAll = () => {
    onSelectionChange(trades.map(t => t.id));
  };
  
  const handleClearAll = () => {
    onSelectionChange([]);
  };
  
  const formatTrade = (tradeType: string) => {
    return tradeType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  
  const getTradeColor = (tradeType: string) => {
    return TRADE_COLORS[tradeType.toUpperCase()] || 'bg-gray-500';
  };

  // Group trades by type
  const groupedTrades = trades.reduce((acc, trade) => {
    const type = trade.tradeType || 'OTHER';
    if (!acc[type]) acc[type] = [];
    acc[type].push(trade);
    return acc;
  }, {} as Record<string, TradeOption[]>);

  const selectedCount = selectedTrades.length;
  const totalCount = trades.length;
  const isFiltered = selectedCount > 0 && selectedCount < totalCount;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-2 border-gray-600 text-gray-200 hover:bg-gray-700',
            isFiltered && 'border-orange-500 text-orange-400',
            className
          )}
        >
          <Filter className="h-4 w-4" />
          <span>Trade Filter</span>
          {isFiltered && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-orange-500/20 text-orange-400">
              {selectedCount}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-80 p-0 bg-dark-card border-gray-700"
        align="start"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm font-medium text-gray-200">Filter by Trade</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-gray-400 hover:text-white"
              onClick={handleSelectAll}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-gray-400 hover:text-white"
              onClick={handleClearAll}
            >
              Clear
            </Button>
          </div>
        </div>
        
        {/* Trade List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {Object.entries(groupedTrades).map(([tradeType, tradeList]) => (
            <div key={tradeType} className="mb-3">
              {/* Trade Type Header */}
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                <div className={cn('w-2 h-2 rounded-full', getTradeColor(tradeType))} />
                <span className="text-xs font-semibold text-gray-400 uppercase">
                  {formatTrade(tradeType)}
                </span>
                <span className="text-xs text-gray-500">({tradeList.length})</span>
              </div>
              
              {/* Subcontractors in this trade */}
              {tradeList.map(trade => (
                <label
                  key={trade.id}
                  className="flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-700/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTrades.includes(trade.id)}
                    onCheckedChange={() => handleToggleTrade(trade.id)}
                    className="border-gray-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 truncate">
                      {trade.companyName || trade.name}
                    </div>
                    {trade.taskCount !== undefined && (
                      <div className="text-xs text-gray-500">
                        {trade.taskCount} task{trade.taskCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          ))}
          
          {trades.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No trades available
            </div>
          )}
        </div>
        
        {/* Footer */}
        {isFiltered && (
          <div className="px-4 py-2 border-t border-gray-700 bg-gray-800/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Showing {selectedCount} of {totalCount} trades
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-orange-400 hover:text-orange-300"
                onClick={handleClearAll}
              >
                <X className="h-3 w-3 mr-1" />
                Clear Filter
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Quick filter badges for inline use
export function TradeFilterBadges({
  trades,
  selectedTrades,
  onToggle,
  maxVisible = 5
}: {
  trades: TradeOption[];
  selectedTrades: string[];
  onToggle: (tradeId: string) => void;
  maxVisible?: number;
}) {
  const visibleTrades = trades.slice(0, maxVisible);
  const hiddenCount = trades.length - maxVisible;
  
  const formatTrade = (tradeType: string) => {
    return tradeType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleTrades.map(trade => {
        const isSelected = selectedTrades.length === 0 || selectedTrades.includes(trade.id);
        return (
          <Badge
            key={trade.id}
            variant="outline"
            className={cn(
              'cursor-pointer transition-all text-xs',
              isSelected
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-transparent border-gray-700 text-gray-500 opacity-50'
            )}
            onClick={() => onToggle(trade.id)}
          >
            {formatTrade(trade.tradeType)}
            {trade.companyName && ` - ${trade.companyName}`}
          </Badge>
        );
      })}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="bg-gray-700 border-gray-600 text-gray-400 text-xs">
          +{hiddenCount} more
        </Badge>
      )}
    </div>
  );
}
