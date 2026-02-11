'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  Brain,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  AlertCircle,
  MessageSquareMore,
  DoorOpen,
  Ruler,
  Wrench,
  Camera,
  Box,
  Paintbrush,
  BarChart2,
  Settings,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useProject } from './project-context';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export function SidebarNavigation() {
  const pathname = usePathname();
  const {
    project,
    pendingUpdatesCount,
    sidebarCollapsed,
    setSidebarCollapsed,
    aiDrawerOpen,
    setAiDrawerOpen,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useProject();

  if (!project) return null;

  const slug = project.slug;

  const sections: NavSection[] = [
    {
      label: 'OVERVIEW',
      items: [
        { label: 'Dashboard', href: `/project/${slug}`, icon: <LayoutDashboard className="w-5 h-5" /> },
      ],
    },
    {
      label: 'DOCUMENTS',
      items: [
        { label: 'Document Library', href: `/project/${slug}/documents`, icon: <FileText className="w-5 h-5" /> },
        { label: 'Intelligence', href: `/project/${slug}/intelligence`, icon: <Brain className="w-5 h-5" /> },
      ],
    },
    {
      label: 'PROJECT CONTROLS',
      items: [
        {
          label: 'Schedule & Budget',
          href: `/project/${slug}/schedule-budget`,
          icon: <CalendarClock className="w-5 h-5" />,
          badge: pendingUpdatesCount > 0 ? pendingUpdatesCount : undefined,
        },
        { label: 'Submittals', href: `/project/${slug}/mep/submittals`, icon: <ClipboardCheck className="w-5 h-5" /> },
      ],
    },
    {
      label: 'FIELD OPERATIONS',
      items: [
        { label: 'Daily Reports', href: `/project/${slug}/field-ops/daily-reports`, icon: <ClipboardList className="w-5 h-5" /> },
        { label: 'Punch List', href: `/project/${slug}/field-ops/punch-list`, icon: <AlertCircle className="w-5 h-5" /> },
        { label: 'RFIs', href: `/project/${slug}/field-ops/rfis`, icon: <MessageSquareMore className="w-5 h-5" /> },
      ],
    },
    {
      label: 'CONSTRUCTION INTEL',
      items: [
        { label: 'Room Browser', href: `/project/${slug}/rooms`, icon: <DoorOpen className="w-5 h-5" /> },
        { label: 'Material Takeoffs', href: `/project/${slug}/takeoffs`, icon: <Ruler className="w-5 h-5" /> },
        { label: 'MEP Equipment', href: `/project/${slug}/mep/equipment`, icon: <Wrench className="w-5 h-5" /> },
      ],
    },
    {
      label: 'ASSETS',
      items: [
        { label: 'Photos & Timeline', href: `/project/${slug}/photos`, icon: <Camera className="w-5 h-5" /> },
        { label: '3D Models', href: `/project/${slug}/models`, icon: <Box className="w-5 h-5" /> },
        { label: 'Renders', href: `/project/${slug}/renders`, icon: <Paintbrush className="w-5 h-5" /> },
      ],
    },
    {
      label: 'REPORTS',
      items: [
        { label: 'Analytics', href: `/project/${slug}/reports`, icon: <BarChart2 className="w-5 h-5" /> },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === `/project/${slug}`) {
      return pathname === href;
    }
    return pathname?.startsWith(href) ?? false;
  };

  const navContent = (
    <>
      {/* Project identifier */}
      <div className="p-4 border-b border-gray-700 flex items-center gap-3 min-h-[64px]">
        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-orange-400">
            {project.name.charAt(0).toUpperCase()}
          </span>
        </div>
        {!sidebarCollapsed && (
          <span className="text-sm font-semibold text-slate-50 truncate">
            {project.name}
          </span>
        )}
      </div>

      {/* Navigation sections */}
      <nav
        id="sidebar-nav"
        role="navigation"
        aria-label="Project navigation"
        className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-gray-700"
      >
        {sections.map((section, sectionIdx) => (
          <div key={section.label} className={sectionIdx > 0 ? 'mt-2' : ''}>
            {!sidebarCollapsed && (
              <div className="px-4 py-1.5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {section.label}
                </span>
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`
                    group flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-colors duration-150
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
                    ${active
                      ? 'bg-orange-500/10 text-orange-400 border-l-[3px] border-orange-500 ml-0 pl-[calc(0.75rem-1px)]'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-slate-50'
                    }
                    ${sidebarCollapsed ? 'justify-center px-0 mx-1' : ''}
                  `}
                  aria-current={active ? 'page' : undefined}
                  style={{ minHeight: '44px' }}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-orange-600 text-white rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-gray-700 p-2 space-y-1">
        {/* Settings */}
        <Link
          href={`/project/${slug}/settings`}
          onClick={() => setMobileSidebarOpen(false)}
          title={sidebarCollapsed ? 'Settings' : undefined}
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
            ${pathname === `/project/${slug}/settings`
              ? 'bg-orange-500/10 text-orange-400'
              : 'text-gray-400 hover:bg-gray-800 hover:text-slate-50'
            }
            ${sidebarCollapsed ? 'justify-center px-0' : ''}
          `}
          style={{ minHeight: '44px' }}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span>Settings</span>}
        </Link>

        {/* The Foreman toggle */}
        <button
          onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
          title={sidebarCollapsed ? 'The Foreman' : undefined}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
            ${aiDrawerOpen
              ? 'bg-orange-500/10 text-orange-400'
              : 'text-gray-400 hover:bg-gray-800 hover:text-slate-50'
            }
            ${sidebarCollapsed ? 'justify-center px-0' : ''}
          `}
          style={{ minHeight: '44px' }}
        >
          <MessageSquare className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span>The Foreman</span>}
        </button>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="
            hidden md:flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm
            text-gray-400 hover:bg-gray-800 hover:text-gray-400
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
            justify-center
          "
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ minHeight: '44px' }}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden md:flex flex-col bg-slate-900 border-r border-gray-700 flex-shrink-0
          transition-[width] duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]
          motion-reduce:transition-none
          ${sidebarCollapsed ? 'w-[60px]' : 'w-[240px]'}
        `}
      >
        {navContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/80 z-40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="
              fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-slate-900 border-r border-gray-700
              md:hidden animate-in slide-in-from-left duration-300
            "
          >
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}
