'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WithTooltip } from '@/components/ui/icon-button';

interface TakeoffFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterCategory: string;
  onCategoryChange: (category: string) => void;
  filterVerified: string;
  onVerifiedChange: (verified: string) => void;
  viewMode: 'csi' | 'category';
  onViewModeChange: (mode: 'csi' | 'category') => void;
  availableCategories: string[];
}

/**
 * Component for filtering and searching takeoff items
 */
export function TakeoffFilters({
  searchQuery,
  onSearchChange,
  filterCategory,
  onCategoryChange,
  filterVerified,
  onVerifiedChange,
  viewMode,
  onViewModeChange,
  availableCategories,
}: TakeoffFiltersProps) {
  const hasActiveFilters = searchQuery || filterCategory !== 'all' || filterVerified !== 'all';

  const clearFilters = () => {
    onSearchChange('');
    onCategoryChange('all');
    onVerifiedChange('all');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-700 px-4 py-2">
      {/* View Mode Toggle */}
      <div className="flex rounded-md border border-gray-600 overflow-hidden">
        <button
          onClick={() => onViewModeChange('category')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'category'
              ? 'bg-orange-500 text-white'
              : 'bg-dark-card text-gray-300 hover:bg-dark-hover'
          }`}
        >
          Category
        </button>
        <button
          onClick={() => onViewModeChange('csi')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'csi'
              ? 'bg-orange-500 text-white'
              : 'bg-dark-card text-gray-300 hover:bg-dark-hover'
          }`}
        >
          CSI Division
        </button>
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search materials..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 bg-dark-card border-gray-600 pl-8 text-sm text-slate-50 placeholder:text-gray-500"
        />
      </div>

      {/* Category Filter */}
      <Select value={filterCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="h-8 w-[140px] bg-dark-card border-gray-600 text-sm text-slate-50">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {availableCategories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select value={filterVerified} onValueChange={onVerifiedChange}>
        <SelectTrigger className="h-8 w-[110px] bg-dark-card border-gray-600 text-sm text-slate-50">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="verified">Verified</SelectItem>
          <SelectItem value="unverified">Unverified</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <WithTooltip tooltip="Clear all filters">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 text-xs text-orange-500 hover:text-orange-400 hover:bg-dark-card"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </WithTooltip>
      )}
    </div>
  );
}
