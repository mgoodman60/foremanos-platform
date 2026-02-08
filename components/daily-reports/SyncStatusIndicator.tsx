'use client';

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { isOnline } from '@/lib/offline-store';

type SyncStatus = 'online' | 'offline' | 'syncing' | 'saved-locally' | 'error';

interface SyncStatusIndicatorProps {
  status?: SyncStatus;
  pendingCount?: number;
  lastSyncedAt?: number;
  className?: string;
}

export default function SyncStatusIndicator({
  status: propStatus,
  pendingCount = 0,
  lastSyncedAt,
  className = '',
}: SyncStatusIndicatorProps) {
  const [status, setStatus] = useState<SyncStatus>(propStatus || 'online');

  useEffect(() => {
    if (propStatus) {
      setStatus(propStatus);
      return;
    }

    const updateStatus = () => {
      setStatus(isOnline() ? 'online' : 'offline');
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, [propStatus]);

  const configs: Record<SyncStatus, { icon: typeof Cloud; label: string; color: string; bgColor: string }> = {
    online: { icon: Cloud, label: 'Online', color: 'text-green-400', bgColor: 'bg-green-500/10' },
    offline: { icon: CloudOff, label: 'Offline', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    syncing: { icon: RefreshCw, label: 'Syncing...', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    'saved-locally': { icon: Check, label: 'Saved locally', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    error: { icon: AlertCircle, label: 'Sync error', color: 'text-red-400', bgColor: 'bg-red-500/10' },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} ${className}`}>
      <Icon className={`h-3 w-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {config.label}
      {pendingCount > 0 && status !== 'online' && (
        <span className="ml-0.5">({pendingCount})</span>
      )}
    </span>
  );
}
