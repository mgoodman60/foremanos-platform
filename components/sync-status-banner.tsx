'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, CheckCircle, Clock, X, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'stale';

interface SyncStatusBannerProps {
  /** Current sync status */
  status: SyncStatus;
  /** Last successful sync timestamp */
  lastSynced?: Date | null;
  /** Error message when status is 'error' */
  errorMessage?: string;
  /** Callback to retry sync */
  onRetry?: () => Promise<void>;
  /** Callback to manually trigger sync */
  onSync?: () => Promise<void>;
  /** Threshold in minutes before data is considered stale (default: 5) */
  staleThresholdMinutes?: number;
  /** Whether to show the banner even when synced (default: false) */
  alwaysShow?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SyncStatusBanner - Visible data sync status indicator
 *
 * Replaces silent failures with visible status. Shows error banner with retry,
 * manual sync button, and auto-retry with exponential backoff.
 *
 * @example
 * const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
 * const [lastSynced, setLastSynced] = useState<Date>(new Date());
 *
 * <SyncStatusBanner
 *   status={syncStatus}
 *   lastSynced={lastSynced}
 *   onRetry={handleRetry}
 *   onSync={handleManualSync}
 * />
 */
export function SyncStatusBanner({
  status,
  lastSynced,
  errorMessage,
  onRetry,
  onSync,
  staleThresholdMinutes = 5,
  alwaysShow = false,
  className,
}: SyncStatusBannerProps) {
  const [visible, setVisible] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-retry with exponential backoff on error
  useEffect(() => {
    if (status === 'error' && onRetry && retryCount < 3) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds

      retryTimeoutRef.current = setTimeout(async () => {
        setRetrying(true);
        try {
          await onRetry();
          setRetryCount(0); // Reset on success
        } catch {
          setRetryCount((prev) => prev + 1);
        } finally {
          setRetrying(false);
        }
      }, delay);
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [status, retryCount, onRetry]);

  // Check if data is stale
  useEffect(() => {
    if (!lastSynced || status !== 'synced') return;

    const checkStale = () => {
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSynced.getTime()) / 1000 / 60;
      if (diffMinutes >= staleThresholdMinutes) {
        setVisible(true);
      }
    };

    // Check immediately and set up interval
    checkStale();
    const interval = setInterval(checkStale, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lastSynced, staleThresholdMinutes, status]);

  // Show banner based on status
  useEffect(() => {
    setVisible(status !== 'synced' || alwaysShow);
  }, [status, alwaysShow]);

  const handleRetry = async () => {
    if (!onRetry || retrying) return;

    setRetrying(true);
    try {
      await onRetry();
      setRetryCount(0);
    } catch {
      setRetryCount((prev) => prev + 1);
    } finally {
      setRetrying(false);
    }
  };

  const handleSync = async () => {
    if (!onSync || retrying) return;

    setRetrying(true);
    try {
      await onSync();
    } finally {
      setRetrying(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    // Reset retry count when user dismisses
    setRetryCount(0);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
  };

  // Format last synced time
  const formatLastSynced = (): string => {
    if (!lastSynced) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - lastSynced.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHrs < 24) return `${diffHrs} hr ago`;
    return lastSynced.toLocaleDateString();
  };

  if (!visible) return null;

  // Styles based on status
  const statusStyles = {
    synced: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      icon: <CheckCircle className="w-4 h-4" />,
    },
    syncing: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: <RefreshCw className="w-4 h-4 animate-spin" />,
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      icon: <WifiOff className="w-4 h-4" />,
    },
    stale: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      icon: <Clock className="w-4 h-4" />,
    },
  };

  const style = statusStyles[status];

  const getMessage = (): string => {
    switch (status) {
      case 'syncing':
        return 'Syncing data...';
      case 'error':
        return errorMessage || 'Some data may be outdated';
      case 'stale':
        return `Data may be outdated. Last synced ${formatLastSynced()}`;
      default:
        return `Last synced ${formatLastSynced()}`;
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 px-4 py-2 rounded-lg border transition-all duration-300',
        style.bg,
        style.border,
        className
      )}
    >
      {/* Status icon */}
      <span className={style.text}>{style.icon}</span>

      {/* Message */}
      <span className={cn('flex-1 text-sm', style.text)}>
        {getMessage()}
        {retrying && retryCount > 0 && (
          <span className="ml-2 text-xs text-gray-500">
            (Retry {retryCount}/3)
          </span>
        )}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Retry button for errors */}
        {status === 'error' && onRetry && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
              retrying
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            )}
          >
            {retrying ? (
              <>
                <RefreshCw className="w-3 h-3 inline mr-1 animate-spin" />
                Retrying...
              </>
            ) : (
              'Retry'
            )}
          </button>
        )}

        {/* Sync now button for stale/synced */}
        {(status === 'stale' || status === 'synced') && onSync && (
          <button
            type="button"
            onClick={handleSync}
            disabled={retrying}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
              retrying
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-[#F97316]/20 text-[#F97316] hover:bg-[#F97316]/30'
            )}
          >
            {retrying ? (
              <>
                <RefreshCw className="w-3 h-3 inline mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              'Sync Now'
            )}
          </button>
        )}

        {/* Dismiss button (except when syncing) */}
        {status !== 'syncing' && (
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface UseSyncStatusOptions {
  /** Function to check sync status */
  checkSync: () => Promise<boolean>;
  /** Interval in ms to poll sync status (default: 30000) */
  pollInterval?: number;
  /** Threshold in minutes before data is considered stale */
  staleThresholdMinutes?: number;
}

interface UseSyncStatusReturn {
  /** Current sync status */
  status: SyncStatus;
  /** Last successful sync timestamp */
  lastSynced: Date | null;
  /** Error message if any */
  errorMessage: string | undefined;
  /** Trigger a manual sync */
  sync: () => Promise<void>;
  /** Retry after an error */
  retry: () => Promise<void>;
  /** Mark as synced (call after successful data fetch) */
  markSynced: () => void;
  /** Mark as error */
  markError: (message?: string) => void;
}

/**
 * useSyncStatus - Hook to manage sync status state
 *
 * Tracks sync status, handles polling, and provides actions for
 * manual sync and retry.
 *
 * @example
 * const { status, lastSynced, sync, markSynced } = useSyncStatus({
 *   checkSync: async () => {
 *     const res = await fetch('/api/data');
 *     return res.ok;
 *   },
 * });
 *
 * // After successful data fetch:
 * markSynced();
 */
export function useSyncStatus({
  checkSync,
  pollInterval: _pollInterval = 30000, // Reserved for future auto-polling feature
  staleThresholdMinutes = 5,
}: UseSyncStatusOptions): UseSyncStatusReturn {
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Check if data is stale
  useEffect(() => {
    if (!lastSynced) return;

    const checkStale = () => {
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSynced.getTime()) / 1000 / 60;
      if (diffMinutes >= staleThresholdMinutes && status === 'synced') {
        setStatus('stale');
      }
    };

    const interval = setInterval(checkStale, 60000);
    return () => clearInterval(interval);
  }, [lastSynced, staleThresholdMinutes, status]);

  const sync = useCallback(async () => {
    setStatus('syncing');
    setErrorMessage(undefined);

    try {
      const success = await checkSync();
      if (success) {
        setStatus('synced');
        setLastSynced(new Date());
      } else {
        setStatus('error');
        setErrorMessage('Sync failed');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Sync failed'
      );
    }
  }, [checkSync]);

  const retry = useCallback(async () => {
    await sync();
  }, [sync]);

  const markSynced = useCallback(() => {
    setStatus('synced');
    setLastSynced(new Date());
    setErrorMessage(undefined);
  }, []);

  const markError = useCallback((message?: string) => {
    setStatus('error');
    setErrorMessage(message || 'Sync failed');
  }, []);

  return {
    status,
    lastSynced,
    errorMessage,
    sync,
    retry,
    markSynced,
    markError,
  };
}
