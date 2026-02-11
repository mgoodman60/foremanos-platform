'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder, ChevronRight, Loader2, Home } from 'lucide-react';
import { toast } from 'sonner';

interface OneDriveFolder {
  id: string;
  name: string;
  path: string;
  parentPath?: string;
}

interface OneDriveFolderBrowserProps {
  projectSlug: string;
  onClose: () => void;
  onFolderSelected: () => void;
}

export default function OneDriveFolderBrowser({
  projectSlug,
  onClose,
  onFolderSelected,
}: OneDriveFolderBrowserProps) {
  const [folders, setFolders] = useState<OneDriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<OneDriveFolder | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('/');

  // Fetch folders
  const fetchFolders = async (path: string = '/') => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/onedrive/folders?path=${encodeURIComponent(path)}`
      );

      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setCurrentPath(path);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to load folders');
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      toast.error('Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders('/');
  }, [projectSlug]);

  // Navigate to folder
  const handleFolderClick = (folder: OneDriveFolder) => {
    fetchFolders(folder.path);
    setSelectedFolder(folder);
  };

  // Navigate up
  const handleNavigateUp = () => {
    if (currentPath === '/') return;
    const pathParts = currentPath.split('/').filter(Boolean);
    pathParts.pop();
    const parentPath = '/' + pathParts.join('/');
    fetchFolders(parentPath);
    setSelectedFolder(null);
  };

  // Save folder selection
  const handleSave = async () => {
    if (!selectedFolder) {
      toast.error('Please select a folder');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/onedrive/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolder.id,
          folderPath: selectedFolder.path,
        }),
      });

      if (res.ok) {
        toast.success('Folder configured successfully');
        onFolderSelected();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save folder');
      }
    } catch (error) {
      console.error('Error saving folder:', error);
      toast.error('Failed to save folder');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select OneDrive Folder</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Path */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Home className="h-4 w-4" aria-hidden="true" />
            <span className="font-mono">{currentPath}</span>
          </div>

          {/* Navigation */}
          {currentPath !== '/' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigateUp}
              className="w-full justify-start"
            >
              <ChevronRight className="h-4 w-4 mr-2 rotate-180" aria-hidden="true" />
              Go Up
            </Button>
          )}

          {/* Folder List */}
          <ScrollArea className="h-[400px] border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : folders.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No folders found
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={
                      `flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent ` +
                      (selectedFolder?.id === folder.id ? 'bg-accent border-2 border-primary' : '')
                    }
                    onClick={() => setSelectedFolder(folder)}
                    onDoubleClick={() => handleFolderClick(folder)}
                  >
                    <Folder className="h-5 w-5 text-blue-600" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{folder.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{folder.path}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFolderClick(folder);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected Folder */}
          {selectedFolder && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Selected:</p>
              <p className="text-sm text-muted-foreground">{selectedFolder.path}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedFolder || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              'Select Folder'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
