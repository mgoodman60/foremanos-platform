'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Home,
  ChevronRight,
  Upload,
  Settings,
  User,
  Menu,
  Cloud,
  Image as ImageIcon,
  FileText,
  LogOut,
  ChevronDown,
  ClipboardCheck,
  SlidersHorizontal,
} from 'lucide-react';
import NextImage from 'next/image';
import { useProject } from './project-context';
import { useDocumentUpload } from '@/hooks/use-document-upload';
import { useProjectModals } from '@/hooks/use-project-modals';
import { CommandPalette } from '@/components/command-palette';

export function ProjectHeader() {
  const router = useRouter();
  const {
    project,
    session,
    isOwner,
    isAdmin,
    setMobileSidebarOpen,
  } = useProject();

  const upload = useDocumentUpload();
  const modals = useProjectModals();

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (!project) return null;

  const slug = project.slug;

  return (
    <header className="bg-slate-900 border-b border-gray-700 sticky top-0 z-40" style={{ height: '64px' }}>
      <div className="h-full px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-3">
        {/* Left: Hamburger (mobile) + Logo + Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-orange-500"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo */}
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-shrink-0 cursor-pointer"
            aria-label="Go to dashboard"
          >
            <NextImage
              src="/foremanos-new-logo.png"
              alt="ForemanOS"
              width={180}
              height={48}
              className="h-10 sm:h-12 w-auto object-contain"
              priority
            />
          </button>

          {/* Breadcrumb */}
          <nav className="hidden sm:flex items-center text-sm text-gray-400 min-w-0" aria-label="Breadcrumb">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center hover:text-orange-500 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
            >
              <Home className="w-4 h-4" />
            </button>
            <ChevronRight className="w-4 h-4 mx-1 flex-shrink-0" />
            <span className="text-slate-50 font-medium truncate">{project.name}</span>
          </nav>
        </div>

        {/* Center: Search bar (desktop) */}
        <div className="hidden md:flex items-center justify-center flex-1 max-w-md">
          <CommandPalette
            projectSlug={slug}
            isAdmin={isAdmin}
            onOpenDocumentLibrary={() => modals.setShowDocumentLibrary(true)}
            onOpenWeather={() => modals.setShowWeatherWidget(true)}
            onOpenPhotoLibrary={() => modals.setShowPhotoLibrary(true)}
            onOpenReportHistory={() => modals.setShowReportHistory(true)}
            onUpload={upload.triggerUpload}
          />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Upload button */}
          <button
            onClick={upload.triggerUpload}
            disabled={upload.uploading}
            className="
              flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg
              transition-colors font-medium text-sm
              disabled:opacity-50 disabled:cursor-not-allowed
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
            "
            title={upload.uploading ? `Uploading... ${upload.uploadProgress}%` : 'Upload Document'}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* Settings gear (owner/admin only) */}
          {(isOwner || isAdmin) && (
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label="Project settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {showSettingsMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettingsMenu(false)} onKeyDown={(e) => e.key === 'Escape' && setShowSettingsMenu(false)} role="button" tabIndex={-1} aria-label="Close overlay" />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1" role="menu" aria-label="Settings menu">
                    <button
                      role="menuitem"
                      onClick={() => { modals.setShowOneDriveSettings(true); setShowSettingsMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    >
                      <Cloud className="w-4 h-4 text-blue-400" />
                      OneDrive Settings
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { modals.setShowLogoUpload(true); setShowSettingsMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      Company Logo
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { modals.setShowFinalizationSettings(true); setShowSettingsMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    >
                      <ClipboardCheck className="w-4 h-4 text-blue-400" />
                      Report Settings
                    </button>
                    <div className="border-t border-gray-700 my-1" />
                    <button
                      role="menuitem"
                      onClick={() => { router.push(`/project/${slug}/settings`); setShowSettingsMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    >
                      <SlidersHorizontal className="w-4 h-4 text-orange-400" />
                      Project Settings
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { router.push(`/project/${slug}/templates`); setShowSettingsMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-cyan-400" />
                      Document Templates
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* User avatar dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="
                flex items-center gap-2 p-1.5 rounded-lg
                hover:bg-gray-800 transition-colors
                focus-visible:ring-2 focus-visible:ring-orange-500
              "
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">
                  {(session?.user?.username || session?.user?.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-gray-400 hidden sm:block" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} onKeyDown={(e) => e.key === 'Escape' && setShowUserMenu(false)} role="button" tabIndex={-1} aria-label="Close overlay" />
                <div className="absolute right-0 top-full mt-1 w-52 bg-slate-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1" role="menu" aria-label="User menu">
                  <div className="px-4 py-2 border-b border-gray-700">
                    <p className="text-sm font-medium text-slate-50 truncate">
                      {session?.user?.username || session?.user?.email || 'User'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => { router.push('/profile'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { router.push('/dashboard'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    All Projects
                  </button>
                  <div className="border-t border-gray-700 my-1" />
                  <button
                    role="menuitem"
                    onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-gray-800 transition-colors"
                    data-testid="logout-button"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
