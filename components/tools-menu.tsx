'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Star,
  ChevronDown,
  FileText,
  Settings,
  History,
  CloudRain,
  Ruler,
  Calendar,
  Wrench,
  DoorOpen,
  DollarSign,
  BookOpen,
  Layers,
  Pin,
  Users,
  Image as ImageIcon,
  Box,
  ClipboardList,
  Cpu,
  TrendingUp,
  BarChart2,
  Plug,
  Cloud,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY_FAVORITES = 'foremanos_tools_favorites';
const STORAGE_KEY_RECENT = 'foremanos_tools_recent';
const MAX_RECENT = 5;

export interface ToolItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  onClick: () => void;
  section: 'common' | 'analysis' | 'browsing' | 'admin';
  keywords?: string[];
  badge?: number;
}

interface ToolsMenuProps {
  /** Project slug for navigation */
  projectSlug: string;
  /** Whether the user is the project owner */
  isOwner: boolean;
  /** Pending schedule updates count */
  pendingUpdatesCount?: number;
  /** Callbacks for modal tools */
  onOpenDocumentLibrary: () => void;
  onOpenProcessingMonitor: () => void;
  onOpenReportHistory: () => void;
  onOpenWeatherWidget: () => void;
  onOpenPhotoLibrary: () => void;
  onOpenLogoUpload: () => void;
  onOpenOneDriveSettings: () => void;
  onOpenFinalizationSettings: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ToolsMenu - Enhanced tools dropdown with favorites, search, and recently used
 *
 * Features:
 * - Favorites section at top (stored in localStorage)
 * - Recently used tools (last 5)
 * - Search filter within dropdown
 * - Collapsible sections
 */
export function ToolsMenu({
  projectSlug,
  isOwner,
  pendingUpdatesCount = 0,
  onOpenDocumentLibrary,
  onOpenProcessingMonitor,
  onOpenReportHistory,
  onOpenWeatherWidget,
  onOpenPhotoLibrary,
  onOpenLogoUpload,
  onOpenOneDriveSettings,
  onOpenFinalizationSettings,
  className,
}: ToolsMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    favorites: true,
    recent: true,
    common: true,
    analysis: true,
    browsing: true,
    admin: true,
  });

  // Load favorites and recent from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedFavorites = JSON.parse(
        localStorage.getItem(STORAGE_KEY_FAVORITES) || '[]'
      );
      setFavorites(storedFavorites);

      const storedRecent = JSON.parse(
        localStorage.getItem(STORAGE_KEY_RECENT) || '[]'
      );
      setRecentlyUsed(storedRecent);
    } catch (error) {
      console.error('Error loading tools state:', error);
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites: string[]) => {
    setFavorites(newFavorites);
    try {
      localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }, []);

  // Save recent to localStorage
  const saveRecent = useCallback((toolId: string) => {
    setRecentlyUsed((prev) => {
      const filtered = prev.filter((id) => id !== toolId);
      const newRecent = [toolId, ...filtered].slice(0, MAX_RECENT);

      try {
        localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(newRecent));
      } catch (error) {
        console.error('Error saving recent:', error);
      }

      return newRecent;
    });
  }, []);

  // Toggle favorite
  const toggleFavorite = useCallback(
    (toolId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newFavorites = favorites.includes(toolId)
        ? favorites.filter((id) => id !== toolId)
        : [...favorites, toolId];
      saveFavorites(newFavorites);
    },
    [favorites, saveFavorites]
  );

  // Handle tool click
  const handleToolClick = useCallback(
    (tool: ToolItem) => {
      saveRecent(tool.id);
      setIsOpen(false);
      tool.onClick();
    },
    [saveRecent]
  );

  // Toggle section
  const toggleSection = useCallback(
    (section: keyof typeof expandedSections) => {
      setExpandedSections((prev) => ({
        ...prev,
        [section]: !prev[section],
      }));
    },
    []
  );

  // Define all tools
  const allTools: ToolItem[] = useMemo(
    () => [
      // Common tools
      {
        id: 'documents',
        label: 'Documents',
        icon: <FileText className="w-4 h-4" />,
        iconColor: 'text-gray-400',
        onClick: onOpenDocumentLibrary,
        section: 'common',
        keywords: ['files', 'library', 'browse'],
      },
      {
        id: 'processing',
        label: 'Processing Status',
        icon: <Settings className="w-4 h-4" />,
        iconColor: 'text-blue-400',
        onClick: onOpenProcessingMonitor,
        section: 'common',
        keywords: ['status', 'queue', 'jobs'],
      },
      {
        id: 'reports',
        label: 'Daily Report History',
        icon: <History className="w-4 h-4" />,
        iconColor: 'text-gray-400',
        onClick: onOpenReportHistory,
        section: 'common',
        keywords: ['daily', 'log', 'history'],
      },
      {
        id: 'weather',
        label: 'Weather Intelligence',
        icon: <CloudRain className="w-4 h-4" />,
        iconColor: 'text-cyan-400',
        onClick: onOpenWeatherWidget,
        section: 'common',
        keywords: ['forecast', 'rain', 'delay'],
      },
      // Analysis tools
      {
        id: 'takeoffs',
        label: 'Material Takeoffs',
        icon: <Ruler className="w-4 h-4" />,
        iconColor: 'text-yellow-400',
        onClick: () => router.push(`/project/${projectSlug}/takeoffs`),
        section: 'analysis',
        keywords: ['quantities', 'measurements'],
      },
      {
        id: 'schedules',
        label: 'Project Schedule',
        icon: <Calendar className="w-4 h-4" />,
        iconColor: 'text-cyan-400',
        onClick: () => router.push(`/project/${projectSlug}/schedules`),
        section: 'analysis',
        keywords: ['timeline', 'gantt', 'tasks'],
      },
      {
        id: 'intelligence',
        label: 'Intelligence Dashboard',
        icon: <Layers className="w-4 h-4" />,
        iconColor: 'text-amber-400',
        onClick: () => router.push(`/project/${projectSlug}/intelligence`),
        section: 'analysis',
        keywords: ['ai', 'insights', 'analytics'],
      },
      {
        id: 'spatial',
        label: 'Spatial Correlation',
        icon: <Layers className="w-4 h-4" />,
        iconColor: 'text-cyan-400',
        onClick: () => router.push(`/project/${projectSlug}/spatial`),
        section: 'analysis',
        keywords: ['location', 'mapping'],
      },
      {
        id: 'isometric',
        label: 'Isometric Views',
        icon: <Box className="w-4 h-4" />,
        iconColor: 'text-purple-400',
        onClick: () => router.push(`/project/${projectSlug}/isometric`),
        section: 'analysis',
        keywords: ['3d', 'view'],
      },
      // Browsing tools
      {
        id: 'mep-browse',
        label: 'MEP Equipment',
        icon: <Wrench className="w-4 h-4" />,
        iconColor: 'text-blue-400',
        onClick: () => router.push(`/project/${projectSlug}/mep`),
        section: 'browsing',
        keywords: ['mechanical', 'electrical', 'plumbing'],
      },
      {
        id: 'rooms',
        label: 'Room Browser',
        icon: <DoorOpen className="w-4 h-4" />,
        iconColor: 'text-green-400',
        onClick: () => router.push(`/project/${projectSlug}/rooms`),
        section: 'browsing',
        keywords: ['spaces', 'areas'],
      },
      {
        id: 'legends',
        label: 'Legend & Symbols',
        icon: <BookOpen className="w-4 h-4" />,
        iconColor: 'text-purple-400',
        onClick: () => router.push(`/project/${projectSlug}/legends`),
        section: 'browsing',
        keywords: ['key', 'symbols'],
      },
      {
        id: 'scales',
        label: 'Scale Validation',
        icon: <Ruler className="w-4 h-4" />,
        iconColor: 'text-cyan-400',
        onClick: () => router.push(`/project/${projectSlug}/scales`),
        section: 'browsing',
        keywords: ['measure', 'dimensions'],
      },
      {
        id: 'annotations',
        label: 'Visual Annotations',
        icon: <Pin className="w-4 h-4" />,
        iconColor: 'text-pink-400',
        onClick: () => router.push(`/project/${projectSlug}/annotations`),
        section: 'browsing',
        keywords: ['notes', 'markup'],
      },
      {
        id: 'drawing-types',
        label: 'Drawing Classification',
        icon: <Layers className="w-4 h-4" />,
        iconColor: 'text-blue-400',
        onClick: () => router.push(`/project/${projectSlug}/drawing-types`),
        section: 'browsing',
        keywords: ['types', 'categories'],
      },
      // Admin tools (owner only)
      ...(isOwner
        ? [
            {
              id: 'photos',
              label: 'Photo Library',
              icon: <ImageIcon className="w-4 h-4" />,
              iconColor: 'text-green-400',
              onClick: onOpenPhotoLibrary,
              section: 'admin' as const,
              keywords: ['images', 'pictures'],
            },
            {
              id: 'subcontractors',
              label: 'Subcontractors',
              icon: <Users className="w-4 h-4" />,
              iconColor: 'text-purple-400',
              onClick: () =>
                router.push(`/project/${projectSlug}/subcontractors`),
              section: 'admin' as const,
              keywords: ['subs', 'vendors'],
            },
            {
              id: 'crews',
              label: 'Crew Management',
              icon: <Users className="w-4 h-4" />,
              iconColor: 'text-indigo-400',
              onClick: () => router.push(`/project/${projectSlug}/crews`),
              section: 'admin' as const,
              keywords: ['workers', 'labor'],
            },
            {
              id: 'budget',
              label: 'Budget Management',
              icon: <DollarSign className="w-4 h-4" />,
              iconColor: 'text-amber-400',
              onClick: () => router.push(`/project/${projectSlug}/budget`),
              section: 'admin' as const,
              keywords: ['cost', 'finances'],
            },
            {
              id: 'models',
              label: '3D Model Viewer',
              icon: <Box className="w-4 h-4" />,
              iconColor: 'text-blue-400',
              onClick: () => router.push(`/project/${projectSlug}/models`),
              section: 'admin' as const,
              keywords: ['bim', 'revit'],
            },
            {
              id: 'field-ops',
              label: 'Field Operations',
              icon: <ClipboardList className="w-4 h-4" />,
              iconColor: 'text-orange-400',
              onClick: () => router.push(`/project/${projectSlug}/field-ops`),
              section: 'admin' as const,
              keywords: ['site', 'daily'],
            },
            {
              id: 'mep-tracking',
              label: 'MEP Tracking',
              icon: <Cpu className="w-4 h-4" />,
              iconColor: 'text-purple-400',
              onClick: () => router.push(`/project/${projectSlug}/mep`),
              section: 'admin' as const,
              keywords: ['submittals'],
            },
            {
              id: 'schedule-budget',
              label: 'Schedule & Budget Hub',
              icon: <TrendingUp className="w-4 h-4" />,
              iconColor: 'text-cyan-400',
              onClick: () =>
                router.push(`/project/${projectSlug}/schedule-budget`),
              section: 'admin' as const,
              keywords: ['evm', 'variance'],
            },
            {
              id: 'analytics',
              label: 'Reports & Analytics',
              icon: <BarChart2 className="w-4 h-4" />,
              iconColor: 'text-orange-400',
              onClick: () => router.push(`/project/${projectSlug}/reports`),
              section: 'admin' as const,
              keywords: ['charts', 'export'],
            },
            {
              id: 'integrations',
              label: 'Integrations',
              icon: <Plug className="w-4 h-4" />,
              iconColor: 'text-purple-400',
              onClick: () =>
                router.push(`/project/${projectSlug}/integrations`),
              section: 'admin' as const,
              keywords: ['connect', 'api'],
            },
            {
              id: 'logo',
              label: 'Company Logo',
              icon: <ImageIcon className="w-4 h-4" />,
              iconColor: 'text-emerald-400',
              onClick: onOpenLogoUpload,
              section: 'admin' as const,
              keywords: ['brand', 'image'],
            },
            {
              id: 'onedrive',
              label: 'OneDrive Settings',
              icon: <Cloud className="w-4 h-4" />,
              iconColor: 'text-orange-500',
              onClick: onOpenOneDriveSettings,
              section: 'admin' as const,
              keywords: ['sync', 'cloud'],
            },
            {
              id: 'finalization',
              label: 'Report Settings',
              icon: <Settings className="w-4 h-4" />,
              iconColor: 'text-blue-400',
              onClick: onOpenFinalizationSettings,
              section: 'admin' as const,
              keywords: ['config'],
            },
            {
              id: 'project-settings',
              label: 'Project Settings',
              icon: <Settings className="w-4 h-4" />,
              iconColor: 'text-orange-400',
              onClick: () => router.push(`/project/${projectSlug}/settings`),
              section: 'admin' as const,
              keywords: ['config', 'options'],
            },
            {
              id: 'templates',
              label: 'Document Templates',
              icon: <FileText className="w-4 h-4" />,
              iconColor: 'text-cyan-400',
              onClick: () => router.push(`/project/${projectSlug}/templates`),
              section: 'admin' as const,
              keywords: ['forms', 'pdf'],
            },
            {
              id: 'schedule-updates',
              label: 'Schedule Updates',
              icon: <Calendar className="w-4 h-4" />,
              iconColor: 'text-orange-400',
              onClick: () =>
                router.push(`/project/${projectSlug}/schedule-updates`),
              section: 'admin' as const,
              keywords: ['pending', 'review'],
              badge: pendingUpdatesCount > 0 ? pendingUpdatesCount : undefined,
            },
          ]
        : []),
    ],
    [
      projectSlug,
      isOwner,
      pendingUpdatesCount,
      router,
      onOpenDocumentLibrary,
      onOpenProcessingMonitor,
      onOpenReportHistory,
      onOpenWeatherWidget,
      onOpenPhotoLibrary,
      onOpenLogoUpload,
      onOpenOneDriveSettings,
      onOpenFinalizationSettings,
    ]
  );

  // Create a map for quick lookup
  const toolsMap = useMemo(() => {
    const map = new Map<string, ToolItem>();
    allTools.forEach((tool) => map.set(tool.id, tool));
    return map;
  }, [allTools]);

  // Filter tools by search query
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return allTools;

    const query = searchQuery.toLowerCase();
    return allTools.filter(
      (tool) =>
        tool.label.toLowerCase().includes(query) ||
        tool.keywords?.some((kw) => kw.includes(query))
    );
  }, [allTools, searchQuery]);

  // Get tools by section
  const getToolsBySection = useCallback(
    (section: ToolItem['section']) => {
      return filteredTools.filter((tool) => tool.section === section);
    },
    [filteredTools]
  );

  // Get favorite tools
  const favoriteTools = useMemo(() => {
    return favorites
      .map((id) => toolsMap.get(id))
      .filter((tool): tool is ToolItem => !!tool);
  }, [favorites, toolsMap]);

  // Get recently used tools
  const recentTools = useMemo(() => {
    return recentlyUsed
      .map((id) => toolsMap.get(id))
      .filter((tool): tool is ToolItem => !!tool);
  }, [recentlyUsed, toolsMap]);

  // Render a tool item
  const renderToolItem = (tool: ToolItem) => (
    <button
      key={tool.id}
      role="menuitem"
      onClick={() => handleToolClick(tool)}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface hover:text-white rounded transition-colors group focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-dark-card"
    >
      <div className="flex items-center gap-3">
        <span className={tool.iconColor}>{tool.icon}</span>
        <span>{tool.label}</span>
        {tool.badge && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-orange-600 text-white rounded-full">
            {tool.badge}
          </span>
        )}
      </div>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => toggleFavorite(tool.id, e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(tool.id, e as unknown as React.MouseEvent);
          }
        }}
        className={cn(
          'p-1 rounded transition-colors',
          favorites.includes(tool.id)
            ? 'text-yellow-400'
            : 'text-gray-600 opacity-0 group-hover:opacity-100 hover:text-yellow-400'
        )}
        title={
          favorites.includes(tool.id)
            ? 'Remove from favorites'
            : 'Add to favorites'
        }
      >
        <Star
          className="w-3.5 h-3.5"
          fill={favorites.includes(tool.id) ? 'currentColor' : 'none'}
        />
      </span>
    </button>
  );

  // Render a section
  const renderSection = (
    id: keyof typeof expandedSections,
    label: string,
    tools: ToolItem[]
  ) => {
    if (tools.length === 0) return null;

    return (
      <div className="border-b border-gray-700 last:border-b-0">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-dark-surface transition-colors focus:outline-none focus:bg-dark-surface"
        >
          <p className="text-xs font-semibold text-gray-400 tracking-wider uppercase">
            {label}
          </p>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-gray-400 transition-transform duration-200',
              !expandedSections[id] && '-rotate-90'
            )}
          />
        </button>
        <div
          className={cn(
            'overflow-hidden transition-all duration-200',
            expandedSections[id] ? 'max-h-[40rem] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="p-2">{tools.map(renderToolItem)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-lg transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 font-medium"
        title="Project Tools"
      >
        <MoreVertical className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">Tools</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
            role="button"
            tabIndex={-1}
            aria-label="Close overlay"
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-72 bg-dark-card border border-gray-700 rounded-lg shadow-2xl z-50 max-h-[80vh] overflow-hidden flex flex-col" role="menu" aria-label="Project tools">
            {/* Search */}
            <div className="p-3 border-b border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-dark-surface border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1">
              {/* Favorites section */}
              {favoriteTools.length > 0 &&
                !searchQuery &&
                renderSection('favorites', 'Favorites', favoriteTools)}

              {/* Recently used section */}
              {recentTools.length > 0 &&
                !searchQuery &&
                renderSection('recent', 'Recently Used', recentTools)}

              {/* Regular sections */}
              {renderSection('common', 'Common', getToolsBySection('common'))}
              {renderSection(
                'analysis',
                'Analysis',
                getToolsBySection('analysis')
              )}
              {renderSection(
                'browsing',
                'Browsing',
                getToolsBySection('browsing')
              )}
              {isOwner &&
                renderSection('admin', 'Admin', getToolsBySection('admin'))}

              {/* No results */}
              {filteredTools.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-400">
                  No tools found for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
