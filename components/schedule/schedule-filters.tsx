'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Zap
} from 'lucide-react';

export interface ScheduleFilters {
  search: string;
  statuses: string[];
  trades: string[];
  assignees: string[];
  criticalPathOnly: boolean;
}

interface ScheduleFiltersProps {
  filters: ScheduleFilters;
  onFiltersChange: (filters: ScheduleFilters) => void;
  availableTrades: string[];
  availableAssignees: string[];
}

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started', color: 'bg-gray-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'completed', label: 'Completed', color: 'bg-green-500' },
  { value: 'delayed', label: 'Delayed', color: 'bg-red-500' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-amber-500' },
];

export function ScheduleFilters({
  filters,
  onFiltersChange,
  availableTrades,
  availableAssignees,
}: ScheduleFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleStatus = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const toggleTrade = (trade: string) => {
    const newTrades = filters.trades.includes(trade)
      ? filters.trades.filter(t => t !== trade)
      : [...filters.trades, trade];
    onFiltersChange({ ...filters, trades: newTrades });
  };

  const toggleAssignee = (assignee: string) => {
    const newAssignees = filters.assignees.includes(assignee)
      ? filters.assignees.filter(a => a !== assignee)
      : [...filters.assignees, assignee];
    onFiltersChange({ ...filters, assignees: newAssignees });
  };

  const clearFilters = () => {
    setSearchInput('');
    onFiltersChange({
      search: '',
      statuses: [],
      trades: [],
      assignees: [],
      criticalPathOnly: false,
    });
  };

  const activeFilterCount = 
    filters.statuses.length + 
    filters.trades.length + 
    filters.assignees.length + 
    (filters.criticalPathOnly ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
        <Input
          placeholder="Search tasks, IDs, descriptions..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 bg-dark-surface border-gray-700 text-gray-100 placeholder:text-gray-400"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={cn(
              "gap-2 bg-dark-hover border-gray-500 text-gray-200 hover:bg-gray-700 hover:border-gray-400",
              filters.statuses.length > 0 && "border-orange-500/50 bg-orange-500/10"
            )}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Status
            {filters.statuses.length > 0 && (
              <Badge className="ml-1 bg-orange-500 text-white border-orange-400">
                {filters.statuses.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-dark-card border-gray-700 w-48">
          <DropdownMenuLabel className="text-gray-400">Task Status</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-gray-700" />
          {STATUS_OPTIONS.map((status) => (
            <DropdownMenuCheckboxItem
              key={status.value}
              checked={filters.statuses.includes(status.value)}
              onCheckedChange={() => toggleStatus(status.value)}
              className="text-gray-200 focus:bg-gray-700"
            >
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', status.color)} />
                {status.label}
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Trade Filter */}
      {availableTrades.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className={cn(
                "gap-2 bg-dark-hover border-gray-500 text-gray-200 hover:bg-gray-700 hover:border-gray-400",
                filters.trades.length > 0 && "border-blue-500/50 bg-blue-500/10"
              )}
            >
              Trade
              {filters.trades.length > 0 && (
                <Badge className="ml-1 bg-blue-500 text-white border-blue-400">
                  {filters.trades.length}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-dark-card border-gray-700 w-56 max-h-64 overflow-y-auto">
            <DropdownMenuLabel className="text-gray-400">Trade/Division</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-700" />
            {availableTrades.map((trade) => (
              <DropdownMenuCheckboxItem
                key={trade}
                checked={filters.trades.includes(trade)}
                onCheckedChange={() => toggleTrade(trade)}
                className="text-gray-200 focus:bg-gray-700"
              >
                {trade.replace(/_/g, ' ')}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Assignee Filter */}
      {availableAssignees.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className={cn(
                "gap-2 bg-dark-hover border-gray-500 text-gray-200 hover:bg-gray-700 hover:border-gray-400",
                filters.assignees.length > 0 && "border-purple-500/50 bg-purple-500/10"
              )}
            >
              Assignee
              {filters.assignees.length > 0 && (
                <Badge className="ml-1 bg-purple-500 text-white border-purple-400">
                  {filters.assignees.length}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-dark-card border-gray-700 w-56 max-h-64 overflow-y-auto">
            <DropdownMenuLabel className="text-gray-400">Assigned Company</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-700" />
            {availableAssignees.map((assignee) => (
              <DropdownMenuCheckboxItem
                key={assignee}
                checked={filters.assignees.includes(assignee)}
                onCheckedChange={() => toggleAssignee(assignee)}
                className="text-gray-200 focus:bg-gray-700"
              >
                {assignee}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Critical Path Toggle */}
      <Button
        variant={filters.criticalPathOnly ? 'default' : 'outline'}
        onClick={() => onFiltersChange({ ...filters, criticalPathOnly: !filters.criticalPathOnly })}
        className={cn(
          'gap-2',
          filters.criticalPathOnly 
            ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20' 
            : 'bg-dark-hover border-gray-500 text-gray-200 hover:bg-gray-700 hover:border-gray-400'
        )}
      >
        <Zap className={cn("h-4 w-4", filters.criticalPathOnly && "text-yellow-300")} aria-hidden="true" />
        Critical Path
      </Button>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          onClick={clearFilters}
          className="text-gray-400 hover:text-gray-200"
        >
          <X className="h-4 w-4 mr-1" aria-hidden="true" />
          Clear ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}

export const defaultFilters: ScheduleFilters = {
  search: '',
  statuses: [],
  trades: [],
  assignees: [],
  criticalPathOnly: false,
};
