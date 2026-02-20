'use client';

import React, { useState, useEffect } from 'react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import {
  LayoutDashboard,
  FolderOpen,
  Camera,
  ClipboardList,
  Menu,
  X,
  Calendar,
  FileCheck,
  Ruler,
  Building,
  Cpu,
  MessageSquare,
  CloudSun,
  Activity,
  Eye,
  Settings,
  User,
  LogOut,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MobileBottomNavProps {
  activeTab: 'overview' | 'docs' | 'capture' | 'field' | 'more';
  projectSlug: string;
  onShowDocuments: () => void;
  onShowCamera: () => void;
  onOpenAiDrawer?: () => void;
  onShowWeather?: () => void;
  onShowProcessingMonitor?: () => void;
  onShowLookahead?: () => void;
  pendingUpdatesCount?: number;
}

interface MoreMenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

interface MoreMenuSection {
  title: string;
  items: MoreMenuItem[];
}

export function MobileBottomNav({
  activeTab,
  projectSlug,
  onShowDocuments,
  onShowCamera,
  onOpenAiDrawer,
  onShowWeather,
  onShowProcessingMonitor,
  onShowLookahead,
  pendingUpdatesCount = 0
}: MobileBottomNavProps) {
  const router = useRouter();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showCaptureMenu, setShowCaptureMenu] = useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide nav on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const moreMenuRef = useFocusTrap({ isActive: showMoreMenu, onEscape: () => setShowMoreMenu(false) });

  const moreMenuSections: MoreMenuSection[] = [
    {
      title: 'Project',
      items: [
        {
          icon: Calendar,
          label: 'Schedule & Budget',
          onClick: () => { router.push(`/project/${projectSlug}/schedule-budget`); setShowMoreMenu(false); },
        },
        {
          icon: FileCheck,
          label: 'Submittals',
          onClick: () => { router.push(`/project/${projectSlug}/mep/submittals`); setShowMoreMenu(false); },
        },
        {
          icon: Ruler,
          label: 'Takeoffs',
          onClick: () => { router.push(`/project/${projectSlug}/takeoffs`); setShowMoreMenu(false); },
        },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        {
          icon: Building,
          label: 'Room Browser',
          onClick: () => { router.push(`/project/${projectSlug}/rooms`); setShowMoreMenu(false); },
        },
        {
          icon: Cpu,
          label: 'MEP Equipment',
          onClick: () => { router.push(`/project/${projectSlug}/mep/equipment`); setShowMoreMenu(false); },
        },
        {
          icon: Eye,
          label: 'Document Intelligence',
          onClick: () => { router.push(`/project/${projectSlug}/intelligence`); setShowMoreMenu(false); },
        },
      ],
    },
    {
      title: 'Tools',
      items: [
        {
          icon: MessageSquare,
          label: 'The Foreman',
          onClick: () => { onOpenAiDrawer?.(); setShowMoreMenu(false); },
        },
        {
          icon: CloudSun,
          label: 'Weather',
          onClick: () => { onShowWeather?.(); setShowMoreMenu(false); },
        },
        {
          icon: Activity,
          label: 'Processing Status',
          onClick: () => { onShowProcessingMonitor?.(); setShowMoreMenu(false); },
        },
        {
          icon: Calendar,
          label: '3-Week Look-Ahead',
          onClick: () => { onShowLookahead?.(); setShowMoreMenu(false); },
        },
      ],
    },
    {
      title: 'Settings',
      items: [
        {
          icon: Settings,
          label: 'Project Settings',
          onClick: () => { router.push(`/project/${projectSlug}/settings`); setShowMoreMenu(false); },
        },
        {
          icon: User,
          label: 'Profile',
          onClick: () => { router.push('/profile'); setShowMoreMenu(false); },
        },
        {
          icon: LogOut,
          label: 'Sign Out',
          onClick: () => { router.push('/api/auth/signout'); setShowMoreMenu(false); },
        },
      ],
    },
  ];

  const navItems = [
    {
      id: 'overview' as const,
      icon: LayoutDashboard,
      label: 'Overview',
      onClick: () => router.push(`/project/${projectSlug}`),
    },
    {
      id: 'docs' as const,
      icon: FolderOpen,
      label: 'Docs',
      onClick: onShowDocuments,
    },
    {
      id: 'capture' as const,
      icon: Camera,
      label: 'Capture',
      onClick: onShowCamera,
      isCenter: true,
    },
    {
      id: 'field' as const,
      icon: ClipboardList,
      label: 'Field',
      onClick: () => router.push(`/project/${projectSlug}/field-ops/daily-reports`),
    },
    {
      id: 'more' as const,
      icon: Menu,
      label: 'More',
      onClick: () => setShowMoreMenu(!showMoreMenu),
      badge: pendingUpdatesCount > 0 ? pendingUpdatesCount : undefined,
    },
  ];

  return (
    <>
      {/* More Menu Full-Screen Overlay */}
      {showMoreMenu && (
        <div
          ref={moreMenuRef}
          className="fixed inset-0 bg-slate-900/98 z-40 md:hidden motion-safe:animate-in motion-safe:fade-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-more-menu-title"
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 id="mobile-more-menu-title" className="text-lg font-semibold text-gray-100">More</h2>
            <button
              onClick={() => setShowMoreMenu(false)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-6 pb-24 space-y-6">
            {moreMenuSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={item.onClick}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
                        style={{ minHeight: '48px' }}
                      >
                        <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                        <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                        <ChevronRight className="w-4 h-4 text-gray-600" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className={`fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-gray-700 z-50 md:hidden transition-transform motion-reduce:transition-none duration-300 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'more' && showMoreMenu);

            if (item.isCenter) {
              return (
                <div key={item.id} className="relative">
                  {/* Long-press popover */}
                  {showCaptureMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowCaptureMenu(false)}
                        aria-hidden="true"
                      />
                      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-gray-600 rounded-xl shadow-xl py-2 w-44 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
                        <button
                          onClick={() => { onShowCamera(); setShowCaptureMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                          style={{ minHeight: '44px' }}
                        >
                          <Camera className="w-4 h-4 text-orange-400" aria-hidden="true" />
                          Photo
                        </button>
                        <button
                          onClick={() => { router.push(`/project/${projectSlug}/field-ops/daily-reports?new=true`); setShowCaptureMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                          style={{ minHeight: '44px' }}
                        >
                          <ClipboardList className="w-4 h-4 text-blue-400" aria-hidden="true" />
                          Daily Report
                        </button>
                        <button
                          onClick={() => { router.push(`/project/${projectSlug}/field-ops/punch-list?new=true`); setShowCaptureMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                          style={{ minHeight: '44px' }}
                        >
                          <AlertCircle className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                          Punch List
                        </button>
                      </div>
                    </>
                  )}
                  <button
                    aria-label="Quick capture (hold for options)"
                    className="relative -mt-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg bg-orange-500 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
                    onTouchStart={() => {
                      longPressTimer.current = setTimeout(() => {
                        longPressTimer.current = null;
                        setShowCaptureMenu(true);
                      }, 500);
                    }}
                    onTouchEnd={() => {
                      if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                        onShowCamera();
                      }
                    }}
                    onTouchCancel={() => {
                      if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                      }
                    }}
                    onClick={(_e) => {
                      // Desktop click fallback (touch events won't fire on desktop)
                      if (!('ontouchstart' in window)) {
                        onShowCamera();
                      }
                    }}
                  >
                    <Icon className="w-6 h-6 text-white" aria-hidden="true" />
                  </button>
                </div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors relative focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none ${
                  isActive ? 'text-orange-500' : 'text-gray-400'
                }`}
                style={{ minHeight: '48px' }}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                {item.badge && (
                  <span
                    className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
                    aria-label={`${item.badge} notifications`}
                  >
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
