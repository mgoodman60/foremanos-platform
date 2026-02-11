'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cloud, CloudOff, FolderOpen, RefreshCw, History, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import OneDriveFolderBrowser from './onedrive-folder-browser';
import OneDriveSyncHistory from './onedrive-sync-history';

interface OneDriveStatus {
  connected: boolean;
  folderPath?: string;
  syncEnabled: boolean;
  lastSyncAt?: string;
  syncHistory: Array<{
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
  }>;
}

interface OneDriveSettingsProps {
  projectSlug: string;
  isOwner: boolean;
}

export default function OneDriveSettings({ projectSlug, isOwner }: OneDriveSettingsProps) {
  const [status, setStatus] = useState<OneDriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [showSyncHistory, setShowSyncHistory] = useState(false);

  // Fetch OneDrive status
  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/onedrive/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        console.error('Failed to fetch OneDrive status');
      }
    } catch (error) {
      console.error('Error fetching OneDrive status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [projectSlug]);

  // Connect OneDrive
  const handleConnect = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/onedrive/connect`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        // Redirect to Microsoft OAuth
        window.location.href = data.authUrl;
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to initiate OneDrive connection');
      }
    } catch (error) {
      console.error('Error connecting OneDrive:', error);
      toast.error('Failed to connect OneDrive');
    }
  };

  // Toggle sync
  const handleToggleSync = async (enabled: boolean) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/onedrive/folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEnabled: enabled }),
      });

      if (res.ok) {
        await fetchStatus();
        toast.success(enabled ? 'Automatic sync enabled' : 'Automatic sync disabled');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update sync settings');
      }
    } catch (error) {
      console.error('Error toggling sync:', error);
      toast.error('Failed to update sync settings');
    }
  };

  // Manual sync
  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/onedrive/sync`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(
          `Sync complete: ${data.filesAdded} added, ${data.filesUpdated} updated, ${data.filesDeleted} deleted`
        );
        await fetchStatus();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Handle folder selected
  const handleFolderSelected = async () => {
    setShowFolderBrowser(false);
    await fetchStatus();
    toast.success('OneDrive folder configured');
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="ml-2 text-sm text-muted-foreground">Loading OneDrive status...</span>
        </div>
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card className="p-6">
        <Alert>
          <AlertDescription>
            Only project owners can manage OneDrive sync settings.
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Cloud className="h-5 w-5 text-blue-600" aria-hidden="true" />
                OneDrive Integration
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Automatically sync documents from your OneDrive folder
              </p>
            </div>
            {status?.connected && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
                Connected
              </Badge>
            )}
          </div>

          {/* Connection Status */}
          {!status?.connected ? (
            <Alert>
              <CloudOff className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="ml-2">
                <div className="space-y-2">
                  <p>OneDrive is not connected to this project.</p>
                  <Button onClick={handleConnect} className="mt-2">
                    <Cloud className="h-4 w-4 mr-2" aria-hidden="true" />
                    Connect OneDrive
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {/* Folder Path */}
              {status.folderPath ? (
                <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                  <FolderOpen className="h-5 w-5 text-blue-600 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Syncing from</p>
                    <p className="text-sm text-muted-foreground">{status.folderPath}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFolderBrowser(true)}
                      className="mt-2"
                    >
                      Change Folder
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>OneDrive is connected, but no folder is selected.</p>
                      <Button onClick={() => setShowFolderBrowser(true)} variant="outline" size="sm">
                        <FolderOpen className="h-4 w-4 mr-2" aria-hidden="true" />
                        Select Folder
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Sync Settings */}
              {status.folderPath && (
                <div className="space-y-3">
                  {/* Auto Sync Toggle */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Automatic Sync</p>
                      <p className="text-xs text-muted-foreground">
                        Sync daily at 3 AM ET
                      </p>
                    </div>
                    <Button
                      variant={status.syncEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleToggleSync(!status.syncEnabled)}
                    >
                      {status.syncEnabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>

                  {/* Last Sync */}
                  {status.lastSyncAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      Last synced: {new Date(status.lastSyncAt).toLocaleString()}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleManualSync}
                      disabled={syncing}
                      className="flex-1"
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                          Sync Now
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowSyncHistory(true)}
                    >
                      <History className="h-4 w-4 mr-2" aria-hidden="true" />
                      History
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Folder Browser Modal */}
      {showFolderBrowser && (
        <OneDriveFolderBrowser
          projectSlug={projectSlug}
          onClose={() => setShowFolderBrowser(false)}
          onFolderSelected={handleFolderSelected}
        />
      )}

      {/* Sync History Modal */}
      {showSyncHistory && status && (
        <OneDriveSyncHistory
          syncHistory={status.syncHistory}
          onClose={() => setShowSyncHistory(false)}
        />
      )}
    </>
  );
}
