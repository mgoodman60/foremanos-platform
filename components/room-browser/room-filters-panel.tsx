'use client';

import React from 'react';
import { Search, ArrowUp, ArrowDown, X } from 'lucide-react';
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

type SortField = 'roomNumber' | 'name' | 'type' | 'area' | 'status' | 'progress';

interface RoomFiltersPanelProps {
  searchQuery: string;
  filterType: string;
  filterStatus: string;
  filterFloor: string;
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
  uniqueTypes: string[];
  uniqueFloors: number[];
  visibleRoomCount: number;
  selectedCount: number;
  onSearchChange: (value: string) => void;
  onFilterTypeChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onFilterFloorChange: (value: string) => void;
  onSortByChange: (value: SortField) => void;
  onSortDirectionToggle: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onClearFilters: () => void;
}

function getRoomTypeLabel(type: string) {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getFloorLabel(floor: number) {
  if (floor === -1) return 'Unassigned';
  if (floor === 0) return 'Ground Floor';
  if (floor === 1) return '1st Floor';
  if (floor === 2) return '2nd Floor';
  if (floor === 3) return '3rd Floor';
  return `${floor}th Floor`;
}

export const RoomFiltersPanel = React.memo(function RoomFiltersPanel({
  searchQuery,
  filterType,
  filterStatus,
  filterFloor,
  sortBy,
  sortDirection,
  uniqueTypes,
  uniqueFloors,
  visibleRoomCount,
  selectedCount,
  onSearchChange,
  onFilterTypeChange,
  onFilterStatusChange,
  onFilterFloorChange,
  onSortByChange,
  onSortDirectionToggle,
  onSelectAll,
  onClearSelection,
  onClearFilters,
}: RoomFiltersPanelProps) {
  const hasActiveFilters =
    searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterFloor !== 'all';

  return (
    <div className="space-y-3 border-b border-dark-hover p-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search rooms..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-dark-card border-dark-hover pl-10 text-slate-50 placeholder:text-gray-400"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={filterType} onValueChange={onFilterTypeChange}>
          <SelectTrigger className="bg-dark-card border-dark-hover text-slate-50">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {uniqueTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {getRoomTypeLabel(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="bg-dark-card border-dark-hover text-slate-50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterFloor} onValueChange={onFilterFloorChange}>
          <SelectTrigger className="bg-dark-card border-dark-hover text-slate-50">
            <SelectValue placeholder="Floor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Floors</SelectItem>
            {[...uniqueFloors].sort((a, b) => a - b).map((floor) => (
              <SelectItem key={floor} value={floor.toString()}>
                {getFloorLabel(floor)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Select All Checkbox */}
      {visibleRoomCount > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-dark-hover">
          <input
            type="checkbox"
            id="select-all"
            checked={selectedCount === visibleRoomCount && visibleRoomCount > 0}
            onChange={(e) => {
              if (e.target.checked) {
                onSelectAll();
              } else {
                onClearSelection();
              }
            }}
            className="h-4 w-4 rounded border-dark-hover bg-dark-card text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
          />
          <label htmlFor="select-all" className="text-sm text-gray-400 cursor-pointer">
            Select all visible ({visibleRoomCount})
          </label>
        </div>
      )}

      {/* Sorting Controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Sort by:</span>
        <Select
          value={sortBy}
          onValueChange={(value: SortField) => onSortByChange(value)}
        >
          <SelectTrigger className="bg-dark-card border-dark-hover text-slate-50 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="roomNumber">Room Number</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="type">Type</SelectItem>
            <SelectItem value="area">Area</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="progress">Progress</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSortDirectionToggle}
          className="text-gray-400 hover:text-slate-50 hover:bg-dark-card px-2"
          title={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
        >
          {sortDirection === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <WithTooltip tooltip="Reset all filters">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="w-full text-orange-500 hover:text-orange-400 hover:bg-dark-card"
          >
            <X className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
        </WithTooltip>
      )}
    </div>
  );
});
