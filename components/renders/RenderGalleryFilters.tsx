'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Filters {
  viewType: string;
  style: string;
  status: string;
}

interface RenderGalleryFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  renderCount: number;
}

export function RenderGalleryFilters({
  filters,
  onFiltersChange,
  renderCount,
}: RenderGalleryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* View Type */}
      <Select
        value={filters.viewType}
        onValueChange={(v) => onFiltersChange({ ...filters, viewType: v })}
      >
        <SelectTrigger className="w-[140px] bg-dark-base border-gray-700 text-white text-sm">
          <SelectValue placeholder="View Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Views</SelectItem>
          <SelectItem value="exterior">Exterior</SelectItem>
          <SelectItem value="interior">Interior</SelectItem>
          <SelectItem value="aerial">Aerial</SelectItem>
        </SelectContent>
      </Select>

      {/* Style */}
      <Select
        value={filters.style}
        onValueChange={(v) => onFiltersChange({ ...filters, style: v })}
      >
        <SelectTrigger className="w-[160px] bg-dark-base border-gray-700 text-white text-sm">
          <SelectValue placeholder="Style" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Styles</SelectItem>
          <SelectItem value="photorealistic">Photorealistic</SelectItem>
          <SelectItem value="conceptual">Conceptual</SelectItem>
          <SelectItem value="sketch">Sketch</SelectItem>
          <SelectItem value="watercolor">Watercolor</SelectItem>
          <SelectItem value="blueprint">Blueprint</SelectItem>
        </SelectContent>
      </Select>

      {/* Status */}
      <Select
        value={filters.status}
        onValueChange={(v) => onFiltersChange({ ...filters, status: v })}
      >
        <SelectTrigger className="w-[140px] bg-dark-base border-gray-700 text-white text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="generating">Generating</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>

      {/* Count */}
      <span className="text-sm text-gray-400">
        {renderCount} render{renderCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
