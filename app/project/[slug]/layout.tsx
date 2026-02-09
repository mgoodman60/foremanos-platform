'use client';

import React from 'react';
import { useParams, usePathname } from 'next/navigation';
import { ProjectProvider, useProject } from '@/components/layout/project-context';
import { ProjectHeader } from '@/components/layout/project-header';
import { SidebarNavigation } from '@/components/layout/sidebar-navigation';
import { AIAssistantDrawer } from '@/components/layout/ai-assistant-drawer';
import { useDocumentUpload } from '@/hooks/use-document-upload';
import { useScheduleUpdates } from '@/hooks/use-schedule-updates';
import { useProjectModals } from '@/hooks/use-project-modals';
import { DocumentCategoryModal } from '@/components/document-category-modal';
import { SkeletonProjectWorkspace } from '@/components/ui/skeleton-card';
import { X } from 'lucide-react';
import { KeyboardShortcutsProvider } from '@/components/shared/keyboard-shortcuts-modal';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

// Inner layout that has access to ProjectContext
function ProjectLayoutInner({ children }: { children: React.ReactNode }) {
  const {
    project,
    loading,
    session,
    isOwner,
    refreshProject,
    setPendingUpdatesCount,
    setAiDrawerOpen,
  } = useProject();

  const slug = project?.slug || '';
  const pathname = usePathname();

  // Wire schedule updates polling into context
  const scheduleUpdates = useScheduleUpdates(
    slug,
    !!session
  );

  // Sync polling count into context via effect
  const scheduleCount = scheduleUpdates.pendingUpdatesCount;
  React.useEffect(() => {
    setPendingUpdatesCount(scheduleCount);
  }, [scheduleCount, setPendingUpdatesCount]);

  // Upload hook
  const upload = useDocumentUpload();

  // Modal hook
  const modals = useProjectModals();

  // Determine active tab from pathname
  const getActiveTab = (): 'overview' | 'docs' | 'capture' | 'field' | 'more' => {
    if (!pathname) return 'overview';
    if (pathname.includes('/documents')) return 'docs';
    if (pathname.includes('/field-ops')) return 'field';
    if (pathname.includes('/schedule') || pathname.includes('/budget')) return 'more';
    if (pathname.includes('/mep')) return 'more';
    return 'overview';
  };

  if (loading) {
    return <SkeletonProjectWorkspace />;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <KeyboardShortcutsProvider>
      <div className="min-h-screen bg-dark-surface flex flex-col">
        {/* Skip links */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>
        <a
          href="#sidebar-nav"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-lg"
        >
          Skip to navigation
        </a>
        <a
          href="#ai-drawer"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-lg"
        >
          Skip to The Foreman
        </a>

        {/* Header */}
        <ProjectHeader />

        {/* Body: Sidebar + Main + Drawer */}
        <div className="flex flex-1 overflow-hidden">
          <SidebarNavigation />

          <main
            id="main-content"
            role="main"
            className="flex-1 overflow-y-auto pb-16 md:pb-0"
          >
            {children}
          </main>

          <AIAssistantDrawer />
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav
          activeTab={getActiveTab()}
          projectSlug={slug}
          onShowDocuments={() => modals.setShowDocumentLibrary(true)}
          onShowCamera={() => upload.triggerUpload()}
          onOpenAiDrawer={() => setAiDrawerOpen(true)}
          onShowWeather={() => modals.setShowWeatherWidget(true)}
          onShowProcessingMonitor={() => modals.setShowProcessingMonitor(true)}
          onShowLookahead={() => modals.setShowLookahead(true)}
          pendingUpdatesCount={scheduleCount}
        />

      {/* Hidden file input for document upload */}
      <input
        ref={upload.fileInputRef}
        type="file"
        accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc"
        onChange={upload.handleFileUpload}
        className="hidden"
        aria-label="Upload document"
      />

      {/* Document Category Selection Modal */}
      {upload.pendingFile && (
        <DocumentCategoryModal
          isOpen={upload.showCategoryModal}
          fileName={upload.pendingFile.name}
          fileType={upload.pendingFile.name.split('.').pop() || 'pdf'}
          onConfirm={upload.handleCategoryConfirm}
          onCancel={upload.handleCategoryCancel}
        />
      )}

      {/* ===== Modals from useProjectModals ===== */}

      {/* Document Library Modal */}
      {modals.showDocumentLibrary && project && session?.user && (
        <ModalWrapper
          title="Project Documents"
          onClose={() => modals.setShowDocumentLibrary(false)}
        >
          <LazyDocumentLibrary
            userRole={session.user.role || 'guest'}
            projectId={project.id}
            onDocumentsChange={() => refreshProject()}
          />
        </ModalWrapper>
      )}

      {/* Company Logo Upload Modal */}
      {modals.showLogoUpload && (
        <LogoUploadModal modals={modals} />
      )}

      {/* OneDrive Settings Modal */}
      {modals.showOneDriveSettings && (
        <ModalWrapper
          title="OneDrive Sync Settings"
          onClose={() => modals.setShowOneDriveSettings(false)}
        >
          <LazyOneDriveSettings
            projectSlug={slug}
            isOwner={isOwner}
          />
        </ModalWrapper>
      )}

      {/* Finalization Settings Modal */}
      <LazyFinalizationSettings
        projectSlug={slug}
        isOpen={modals.showFinalizationSettings}
        onClose={() => modals.setShowFinalizationSettings(false)}
      />

      {/* Daily Report History Modal */}
      <LazyDailyReportHistory
        projectSlug={slug}
        isOpen={modals.showReportHistory}
        onClose={() => modals.setShowReportHistory(false)}
      />

      {/* Weather Widget Modal */}
      {modals.showWeatherWidget && (
        <ModalWrapper
          title="Weather Intelligence"
          onClose={() => modals.setShowWeatherWidget(false)}
          maxWidth="max-w-4xl"
        >
          <LazyWeatherWidget
            projectId={project.id}
            onOpenPreferences={() => {
              modals.setShowWeatherWidget(false);
              modals.setShowWeatherPreferences(true);
            }}
          />
        </ModalWrapper>
      )}

      {/* Weather Preferences Modal */}
      <LazyWeatherPreferencesModal
        projectId={project.id}
        isOpen={modals.showWeatherPreferences}
        onClose={() => modals.setShowWeatherPreferences(false)}
      />

      {/* Photo Library Modal */}
      {modals.showPhotoLibrary && project && (
        <LazyPhotoLibrary
          projectSlug={project.slug}
          onClose={() => modals.setShowPhotoLibrary(false)}
        />
      )}

      {/* Processing Monitor Modal */}
      {modals.showProcessingMonitor && project && (
        <ModalWrapper
          title="Document Processing Status"
          onClose={() => modals.setShowProcessingMonitor(false)}
          maxWidth="max-w-6xl"
        >
          <LazyDocumentProcessingMonitor
            projectId={project.id}
            projectSlug={slug}
            autoRefresh={true}
            refreshInterval={10}
          />
        </ModalWrapper>
      )}

      {/* 3-Week Look-Ahead Modal */}
      {modals.showLookahead && (
        <ModalWrapper
          title="3-Week Look-Ahead Schedule"
          onClose={() => modals.setShowLookahead(false)}
          maxWidth="max-w-7xl"
        >
          <LazyThreeWeekLookahead
            projectSlug={slug}
            onTaskClick={(taskId: string) => {
              // Navigate to task or show details
            }}
          />
        </ModalWrapper>
      )}
      </div>
    </KeyboardShortcutsProvider>
  );
}

// Reusable modal wrapper
function ModalWrapper({
  title,
  onClose,
  maxWidth = 'max-w-5xl',
  children,
}: {
  title: string;
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className={`bg-dark-card rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-hidden flex flex-col border border-gray-700`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-slate-50">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-surface text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// Logo upload modal (uses modals hook state)
function LogoUploadModal({ modals }: { modals: ReturnType<typeof useProjectModals> }) {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-md border border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-slate-50">Upload Company Logo</h2>
          <button
            onClick={modals.closeLogoUpload}
            className="p-2 hover:bg-dark-surface text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-400">
            Upload your company logo to appear on daily report PDFs. Accepted formats: PNG, JPG, SVG (max 5MB).
          </div>
          {!modals.logoPreview ? (
            <div
              className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer"
              onClick={() => document.getElementById('logo-file-input')?.click()}
            >
              <svg className="w-12 h-12 mx-auto text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="text-sm text-gray-400">Click to select logo file</div>
              <input
                id="logo-file-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                onChange={modals.handleLogoFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                <img
                  src={modals.logoPreview}
                  alt="Logo preview"
                  className="max-h-32 max-w-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Clear and re-select
                    modals.closeLogoUpload();
                    modals.setShowLogoUpload(true);
                  }}
                  className="flex-1 px-4 py-2 bg-dark-surface hover:bg-dark-base text-gray-300 rounded-lg transition-colors"
                >
                  Change File
                </button>
                <button
                  onClick={modals.handleLogoUpload}
                  disabled={modals.uploadingLogo}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {modals.uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Lazy-loaded modal content components to avoid pulling everything into the layout bundle
import { DocumentLibrary } from '@/components/document-library';
import OneDriveSettings from '@/components/onedrive-settings';
import { FinalizationSettingsModal } from '@/components/finalization-settings-modal';
import { DailyReportHistory } from '@/components/daily-report-history';
import WeatherWidget from '@/components/weather-widget';
import WeatherPreferencesModal from '@/components/weather-preferences-modal';
import { PhotoLibrary } from '@/components/photo-library';
import DocumentProcessingMonitor from '@/components/document-processing-monitor';
import ThreeWeekLookahead from '@/components/three-week-lookahead';

// Simple wrappers for type compatibility
function LazyDocumentLibrary(props: { userRole: string; projectId: string; onDocumentsChange: () => void }) {
  return <DocumentLibrary {...props} />;
}
function LazyOneDriveSettings(props: { projectSlug: string; isOwner: boolean }) {
  return <OneDriveSettings {...props} />;
}
function LazyFinalizationSettings(props: { projectSlug: string; isOpen: boolean; onClose: () => void }) {
  return <FinalizationSettingsModal {...props} />;
}
function LazyDailyReportHistory(props: { projectSlug: string; isOpen: boolean; onClose: () => void }) {
  return <DailyReportHistory {...props} />;
}
function LazyWeatherWidget(props: { projectId: string; onOpenPreferences: () => void }) {
  return <WeatherWidget {...props} />;
}
function LazyWeatherPreferencesModal(props: { projectId: string; isOpen: boolean; onClose: () => void }) {
  return <WeatherPreferencesModal {...props} />;
}
function LazyPhotoLibrary(props: { projectSlug: string; onClose: () => void }) {
  return <PhotoLibrary {...props} />;
}
function LazyDocumentProcessingMonitor(props: { projectId: string; projectSlug: string; autoRefresh: boolean; refreshInterval: number }) {
  return <DocumentProcessingMonitor {...props} />;
}
function LazyThreeWeekLookahead(props: { projectSlug: string; onTaskClick: (taskId: string) => void }) {
  return <ThreeWeekLookahead {...props} />;
}

// Outer layout component
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const slug = params?.slug as string;

  if (!slug) return null;

  return (
    <ProjectProvider slug={slug}>
      <ProjectLayoutInner>{children}</ProjectLayoutInner>
    </ProjectProvider>
  );
}
