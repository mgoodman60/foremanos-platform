'use client';

import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  FolderOpen, 
  Camera, 
  Menu,
  X,
  Upload,
  Calendar,
  BarChart2,
  Settings,
  Home,
  Plus
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MobileBottomNavProps {
  activeTab: 'chat' | 'documents' | 'tools' | 'menu';
  projectSlug: string;
  onShowDocuments: () => void;
  onShowCamera: () => void;
  onUpload: () => void;
  onToggleSidebar: () => void;
  pendingUpdatesCount?: number;
}

export function MobileBottomNav({
  activeTab,
  projectSlug,
  onShowDocuments,
  onShowCamera,
  onUpload,
  onToggleSidebar,
  pendingUpdatesCount = 0
}: MobileBottomNavProps) {
  const router = useRouter();
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

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

  const navItems = [
    {
      id: 'chat' as const,
      icon: MessageSquare,
      label: 'Chat',
      onClick: () => {/* already on chat */},
    },
    {
      id: 'documents' as const,
      icon: FolderOpen,
      label: 'Docs',
      onClick: onShowDocuments,
    },
    {
      id: 'tools' as const,
      icon: Plus,
      label: 'Actions',
      onClick: () => setShowQuickMenu(!showQuickMenu),
      isCenter: true,
    },
    {
      id: 'menu' as const,
      icon: Menu,
      label: 'Menu',
      onClick: onToggleSidebar,
      badge: pendingUpdatesCount > 0 ? pendingUpdatesCount : undefined,
    },
  ];

  const quickActions = [
    {
      icon: Camera,
      label: 'Quick Capture',
      onClick: () => { onShowCamera(); setShowQuickMenu(false); },
      color: 'bg-orange-500',
    },
    {
      icon: Upload,
      label: 'Upload Doc',
      onClick: () => { onUpload(); setShowQuickMenu(false); },
      color: 'bg-blue-500',
    },
    {
      icon: Calendar,
      label: 'Schedule',
      onClick: () => { router.push(`/project/${projectSlug}/schedule-budget`); setShowQuickMenu(false); },
      color: 'bg-green-500',
    },
    {
      icon: BarChart2,
      label: 'Reports',
      onClick: () => { router.push(`/project/${projectSlug}/reports`); setShowQuickMenu(false); },
      color: 'bg-purple-500',
    },
  ];

  return (
    <>
      {/* Quick Actions Overlay */}
      {showQuickMenu && (
        <div
          className="fixed inset-0 bg-black/90 z-40 md:hidden"
          onClick={() => setShowQuickMenu(false)}
        >
          <div 
            className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {quickActions.map((action, index) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className={`${action.color} w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-lg transform transition-all animate-in zoom-in-50 slide-in-from-bottom-4`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <action.icon className="w-6 h-6 text-white" />
              </button>
            ))}
          </div>
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
            {quickActions.map((action) => (
              <span key={action.label} className="text-xs text-white font-medium px-2">
                {action.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav 
        className={`fixed bottom-0 left-0 right-0 bg-[#1F2328] border-t border-gray-700 z-50 md:hidden transition-transform duration-300 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'tools' && showQuickMenu);
            
            if (item.isCenter) {
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`relative -mt-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-95 ${showQuickMenu ? 'bg-red-500 rotate-45' : 'bg-[#F97316]'}`}
                >
                  {showQuickMenu ? (
                    <X className="w-6 h-6 text-white" />
                  ) : (
                    <Icon className="w-6 h-6 text-white" />
                  )}
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg transition-colors relative ${isActive ? 'text-[#F97316]' : 'text-gray-400'}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
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
