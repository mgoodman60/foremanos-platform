'use client';

import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Document } from './types';

interface DeletionImpact {
  impact: {
    rooms: number;
    doors: number;
    windows: number;
    finishes: number;
    floorPlans: number;
    hardware: number;
    takeoffs: number;
    chunks: number;
  };
  hasExtractedData: boolean;
}

interface DeleteConfirmDialogProps {
  open: boolean;
  pendingDeleteDoc: Document | null;
  deletionImpact: DeletionImpact | null;
  deletionImpactLoading: boolean;
  cleanupExtracted: boolean;
  onCleanupChange: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  open,
  pendingDeleteDoc,
  deletionImpact,
  deletionImpactLoading,
  cleanupExtracted,
  onCleanupChange,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <AlertDialogContent className="bg-dark-card border-gray-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            Delete Document
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400" asChild>
            <div>
              <p>
                Are you sure you want to delete &quot;{pendingDeleteDoc?.name}
                &quot;? This action cannot be undone.
              </p>

              {deletionImpactLoading && (
                <div className="flex items-center gap-2 mt-3 text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">
                    Checking for extracted data...
                  </span>
                </div>
              )}

              {deletionImpact && deletionImpact.hasExtractedData && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-amber-400">
                    This document has extracted data:
                  </p>
                  <ul className="text-sm text-gray-400 space-y-1 ml-2">
                    {deletionImpact.impact.rooms > 0 && (
                      <li>
                        {deletionImpact.impact.rooms} room
                        {deletionImpact.impact.rooms !== 1 ? 's' : ''}
                      </li>
                    )}
                    {deletionImpact.impact.doors > 0 && (
                      <li>
                        {deletionImpact.impact.doors} door schedule item
                        {deletionImpact.impact.doors !== 1 ? 's' : ''}
                      </li>
                    )}
                    {deletionImpact.impact.windows > 0 && (
                      <li>
                        {deletionImpact.impact.windows} window schedule item
                        {deletionImpact.impact.windows !== 1 ? 's' : ''}
                      </li>
                    )}
                    {deletionImpact.impact.finishes > 0 && (
                      <li>
                        {deletionImpact.impact.finishes} finish schedule item
                        {deletionImpact.impact.finishes !== 1 ? 's' : ''}
                      </li>
                    )}
                    {deletionImpact.impact.floorPlans > 0 && (
                      <li>
                        {deletionImpact.impact.floorPlans} floor plan
                        {deletionImpact.impact.floorPlans !== 1 ? 's' : ''}
                      </li>
                    )}
                    {deletionImpact.impact.hardware > 0 && (
                      <li>
                        {deletionImpact.impact.hardware} hardware set
                        {deletionImpact.impact.hardware !== 1 ? 's' : ''}
                      </li>
                    )}
                  </ul>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={cleanupExtracted}
                      onChange={(e) => onCleanupChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-300">
                      Also remove all extracted data (rooms, schedules, floor
                      plans)
                    </span>
                  </label>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
