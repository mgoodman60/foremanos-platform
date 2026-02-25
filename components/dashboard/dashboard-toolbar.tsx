'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  RefreshCw,
  LayoutGrid,
  Grid3X3,
  Loader2,
} from 'lucide-react';
import { DashboardGreeting } from './dashboard-greeting';
import { QuickActionsBar } from './quick-actions-bar';
import { useDocumentUpload } from '@/hooks/use-document-upload';
import { DocumentCategoryModal } from '@/components/document-category-modal';
import type { GreetingData } from './dashboard-greeting';

interface DashboardToolbarProps {
  projectSlug: string;
  projectId: string;
  userName?: string;
  initialGreetingData?: GreetingData;
}

export function DashboardToolbar({ projectSlug, projectId, userName, initialGreetingData }: DashboardToolbarProps) {
  const { triggerUpload, fileInputRef, handleFileUpload, showCategoryModal, pendingFile, handleCategoryConfirm, handleCategoryCancel } = useDocumentUpload();

  // Density toggle
  const [density, setDensity] = useState<'compact' | 'expanded'>(() => {
    if (typeof window === 'undefined') return 'expanded';
    return (localStorage.getItem('dashboard_density') as 'compact' | 'expanded') || 'expanded';
  });

  const toggleDensity = useCallback(() => {
    setDensity((prev) => {
      const next = prev === 'compact' ? 'expanded' : 'compact';
      localStorage.setItem('dashboard_density', next);
      return next;
    });
  }, []);

  // Rescan state
  const [rescanning, setRescanning] = useState(false);
  const [rescanMessage, setRescanMessage] = useState<string | null>(null);

  const handleRescan = useCallback(async () => {
    setRescanning(true);
    setRescanMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/rescan`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setRescanMessage(data.message);
      } else {
        setRescanMessage(data.error || 'Failed to start rescan');
      }
    } catch {
      setRescanMessage('Failed to start rescan');
    } finally {
      setRescanning(false);
      setTimeout(() => setRescanMessage(null), 8000);
    }
  }, [projectSlug]);

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const touchStartY = useRef(0);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.location.reload();
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      const atTop = window.scrollY <= 0;
      if (atTop && deltaY > 80 && !refreshing) {
        handleRefresh();
      }
    },
    [handleRefresh, refreshing]
  );

  return (
    <div
      className="p-5 space-y-5"
      onTouchStart={isTouchDevice ? handleTouchStart : undefined}
      onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
    >
      {/* Pull-to-refresh spinner */}
      {refreshing && (
        <div className="flex justify-center py-3">
          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
        </div>
      )}

      {/* Greeting */}
      <DashboardGreeting
        projectSlug={projectSlug}
        projectId={projectId}
        userName={userName}
        initialData={initialGreetingData}
      />

      {/* Quick Actions */}
      <QuickActionsBar projectSlug={projectSlug} onUpload={triggerUpload} />

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Document Category Selection Modal */}
      {pendingFile && (
        <DocumentCategoryModal
          isOpen={showCategoryModal}
          fileName={pendingFile.name}
          fileType={pendingFile.name.split('.').pop() || 'pdf'}
          onConfirm={handleCategoryConfirm}
          onCancel={handleCategoryCancel}
        />
      )}

      {/* Toolbar: Rescan + Density toggle */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleRescan}
          disabled={rescanning}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${rescanning ? 'animate-spin' : ''}`} />
          {rescanning ? 'Rescanning...' : 'Rescan Documents'}
        </button>
        {rescanMessage && (
          <span className="text-xs text-blue-400">{rescanMessage}</span>
        )}
        <button
          onClick={toggleDensity}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded"
          title={density === 'compact' ? 'Switch to expanded view' : 'Switch to compact view'}
        >
          {density === 'compact' ? (
            <Grid3X3 className="w-4 h-4" />
          ) : (
            <LayoutGrid className="w-4 h-4" />
          )}
          {density === 'compact' ? 'Expanded' : 'Compact'}
        </button>
      </div>
    </div>
  );
}
