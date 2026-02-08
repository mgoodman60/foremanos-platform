'use client';

import { useState } from 'react';
import { Check, RefreshCw, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { createScopedLogger } from '@/lib/logger';
import { semanticColors, neutralColors } from '@/lib/design-tokens';
import { toast } from 'sonner';

const log = createScopedLogger('ONEDRIVE_SYNC_BADGE');

interface OneDriveSyncBadgeProps {
  onedriveExported: boolean;
  onedriveExportedAt?: string | null;
  onedriveExportPath?: string | null;
  reportId?: string;
  projectSlug?: string;
}

export default function OneDriveSyncBadge({
  onedriveExported,
  onedriveExportedAt,
  onedriveExportPath,
  reportId,
  projectSlug,
}: OneDriveSyncBadgeProps) {
  const [syncing, setSyncing] = useState(false);

  const handleResync = async () => {
    if (!reportId || !projectSlug) return;
    setSyncing(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/daily-reports/${reportId}/onedrive-upload`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error('Failed to sync to OneDrive');
      }
      toast.success('Synced to OneDrive');
    } catch (error) {
      log.error('OneDrive re-sync failed', error as Error);
      toast.error('Failed to sync to OneDrive');
    } finally {
      setSyncing(false);
    }
  };

  if (!onedriveExported) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: neutralColors.slate[400] }}
      >
        <Cloud className="h-3 w-3" />
        Not synced
      </span>
    );
  }

  const formattedDate = onedriveExportedAt
    ? new Date(onedriveExportedAt).toLocaleString()
    : null;

  return (
    <TooltipProvider>
      <span className="inline-flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex items-center gap-1 text-xs font-medium cursor-default"
              style={{ color: semanticColors.success[600] }}
            >
              <Check className="h-3 w-3" />
              Synced
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-xs space-y-1">
              {formattedDate && <p>Synced: {formattedDate}</p>}
              {onedriveExportPath && (
                <p className="text-muted-foreground truncate">
                  {onedriveExportPath}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {reportId && projectSlug && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs"
            onClick={handleResync}
            disabled={syncing}
            aria-label="Re-sync to OneDrive"
          >
            <RefreshCw
              className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`}
            />
          </Button>
        )}
      </span>
    </TooltipProvider>
  );
}
