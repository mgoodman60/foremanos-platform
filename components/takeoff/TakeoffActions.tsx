'use client';

import { CheckCircle2, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MaterialTakeoff } from '@/types/takeoff';

interface TakeoffActionsProps {
  takeoff: MaterialTakeoff | null;
  selectedItems: Set<string>;
  unverifiedCount: number;
  onSelectAllUnverified: () => void;
  onClearSelection: () => void;
  onBulkVerify: () => Promise<void>;
  bulkVerifying: boolean;
}

/**
 * Component for bulk actions toolbar
 */
export function TakeoffActions({
  takeoff,
  selectedItems,
  unverifiedCount,
  onSelectAllUnverified,
  onClearSelection,
  onBulkVerify,
  bulkVerifying,
}: TakeoffActionsProps) {
  if (!takeoff || !takeoff.lineItems.some((i) => !i.verified)) {
    return null;
  }

  return (
    <div className="border-b border-gray-700 p-3 bg-[#2D333B]/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {selectedItems.size > 0 ? (
              <span className="text-orange-400">{selectedItems.size} items selected</span>
            ) : (
              <span>{unverifiedCount} unverified items</span>
            )}
          </span>
          {selectedItems.size === 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAllUnverified}
              className="border-gray-600 text-xs"
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Select All Unverified
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-xs text-gray-400"
            >
              <X className="mr-1 h-3 w-3" />
              Clear Selection
            </Button>
          )}
        </div>
        {selectedItems.size > 0 && (
          <Button
            size="sm"
            onClick={onBulkVerify}
            disabled={bulkVerifying}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {bulkVerifying ? 'Verifying...' : `Verify ${selectedItems.size} Items`}
          </Button>
        )}
      </div>
    </div>
  );
}
