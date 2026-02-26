'use client';

import React from 'react';
import { FileDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface RoomBulkActionsProps {
  selectedCount: number;
  bulkUpdating: boolean;
  bulkExporting: boolean;
  onClearSelection: () => void;
  onBulkExport: (format: 'pdf' | 'docx') => void;
  onBulkUpdateFloor: (newFloor: number | null) => void;
}

export const RoomBulkActions = React.memo(function RoomBulkActions({
  selectedCount,
  bulkUpdating,
  bulkExporting,
  onClearSelection,
  onBulkExport,
  onBulkUpdateFloor,
}: RoomBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="border-b border-orange-500/50 bg-orange-500/10 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-orange-400">
            {selectedCount} room{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-7 text-xs text-gray-400 hover:text-white"
          >
            Clear
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk Export Buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkExport('pdf')}
            disabled={bulkExporting}
            className="h-8 text-xs bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/50"
          >
            <FileDown className="h-3 w-3 mr-1" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkExport('docx')}
            disabled={bulkExporting}
            className="h-8 text-xs bg-green-500/10 hover:bg-green-500/20 border-green-500/50"
          >
            <FileText className="h-3 w-3 mr-1" />
            Export DOCX
          </Button>

          <Separator orientation="vertical" className="h-6 bg-gray-600" />

          <span className="text-xs text-gray-400">Move to:</span>
          <Select
            disabled={bulkUpdating}
            onValueChange={(value) => {
              const floor = value === 'unassigned' ? null : parseInt(value);
              onBulkUpdateFloor(floor);
            }}
          >
            <SelectTrigger className="h-8 w-[140px] bg-dark-hover border-orange-500/50 text-slate-50 text-xs">
              <SelectValue placeholder="Select floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value="-1">Basement</SelectItem>
              <SelectItem value="0">Ground Floor</SelectItem>
              <SelectItem value="1">1st Floor</SelectItem>
              <SelectItem value="2">2nd Floor</SelectItem>
              <SelectItem value="3">3rd Floor</SelectItem>
              <SelectItem value="4">4th Floor</SelectItem>
              <SelectItem value="5">5th Floor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
});
