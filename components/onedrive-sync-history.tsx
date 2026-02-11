'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Clock, FileUp, FileDown, FileX, FileCheck } from 'lucide-react';

interface SyncHistoryEntry {
  id: string;
  triggerType: string;
  status: string;
  filesAdded: number;
  filesUpdated: number;
  filesDeleted: number;
  filesSkipped: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface OneDriveSyncHistoryProps {
  syncHistory: SyncHistoryEntry[];
  onClose: () => void;
}

export default function OneDriveSyncHistory({ syncHistory, onClose }: OneDriveSyncHistoryProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" aria-hidden="true" />
            Failed
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="default" className="bg-yellow-600">
            <AlertCircle className="h-3 w-3 mr-1" aria-hidden="true" />
            Partial
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
            In Progress
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTriggerBadge = (triggerType: string) => {
    return (
      <Badge variant="outline">
        {triggerType === 'manual' ? 'Manual' : 'Scheduled'}
      </Badge>
    );
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    if (!completedAt) return 'In progress...';
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const duration = Math.round((end - start) / 1000);
    return `${duration}s`;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Sync History</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px]">
          {syncHistory.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No sync history available
            </div>
          ) : (
            <div className="space-y-4 pr-4">
              {syncHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(entry.status)}
                      {getTriggerBadge(entry.triggerType)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      {formatDuration(entry.startedAt, entry.completedAt)}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-sm text-muted-foreground">
                    {new Date(entry.startedAt).toLocaleString()}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <FileUp className="h-4 w-4 text-green-600" aria-hidden="true" />
                      <div>
                        <p className="font-medium">{entry.filesAdded}</p>
                        <p className="text-xs text-muted-foreground">Added</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileDown className="h-4 w-4 text-blue-600" aria-hidden="true" />
                      <div>
                        <p className="font-medium">{entry.filesUpdated}</p>
                        <p className="text-xs text-muted-foreground">Updated</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileX className="h-4 w-4 text-red-600" aria-hidden="true" />
                      <div>
                        <p className="font-medium">{entry.filesDeleted}</p>
                        <p className="text-xs text-muted-foreground">Deleted</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileCheck className="h-4 w-4 text-gray-600" aria-hidden="true" />
                      <div>
                        <p className="font-medium">{entry.filesSkipped}</p>
                        <p className="text-xs text-muted-foreground">Skipped</p>
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  {entry.errorMessage && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm text-destructive font-medium mb-1">Error:</p>
                      <p className="text-sm text-muted-foreground">{entry.errorMessage}</p>
                    </div>
                  )}

                  {/* Total Files */}
                  <div className="pt-2 border-t text-sm text-muted-foreground">
                    Total: {entry.filesAdded + entry.filesUpdated + entry.filesDeleted + entry.filesSkipped} files processed
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
