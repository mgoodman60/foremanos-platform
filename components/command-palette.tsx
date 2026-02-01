'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Settings,
  Calendar,
  DollarSign,
  Users,
  Ruler,
  Wrench,
  Image as ImageIcon,
  CloudRain,
  History,
  Layers,
  BarChart2,
  HelpCircle,
  Home,
  Search,
  Upload,
  MessageSquare,
  BookOpen,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';

interface CommandPaletteProps {
  /** Current project slug (if on a project page) */
  projectSlug?: string;
  /** Whether the user is an admin */
  isAdmin?: boolean;
  /** Callback when a document is opened */
  onOpenDocumentLibrary?: () => void;
  /** Callback when weather widget is opened */
  onOpenWeather?: () => void;
  /** Callback when photo library is opened */
  onOpenPhotoLibrary?: () => void;
  /** Callback when report history is opened */
  onOpenReportHistory?: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  keywords?: string[];
  action: () => void;
}

interface CommandGroup {
  id: string;
  label: string;
  items: CommandItem[];
}

/**
 * CommandPalette - Global command palette for quick navigation and actions
 *
 * Triggered by Cmd+K (Mac) or Ctrl+K (Windows/Linux)
 * Provides quick access to tools, recent documents, and navigation.
 *
 * @example
 * <CommandPalette
 *   projectSlug="my-project"
 *   onOpenDocumentLibrary={() => setShowDocuments(true)}
 * />
 */
export function CommandPalette({
  projectSlug,
  isAdmin,
  onOpenDocumentLibrary,
  onOpenWeather,
  onOpenPhotoLibrary,
  onOpenReportHistory,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  // Build command groups based on context
  const getCommandGroups = (): CommandGroup[] => {
    const groups: CommandGroup[] = [];

    // Navigation group
    const navigationItems: CommandItem[] = [
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        icon: <Home className="w-4 h-4" />,
        shortcut: 'G D',
        keywords: ['home', 'main', 'projects'],
        action: () => router.push('/dashboard'),
      },
    ];

    if (projectSlug) {
      navigationItems.push(
        {
          id: 'nav-chat',
          label: 'Open Chat',
          icon: <MessageSquare className="w-4 h-4" />,
          shortcut: 'G C',
          keywords: ['assistant', 'ai', 'help'],
          action: () => router.push(`/project/${projectSlug}`),
        },
        {
          id: 'nav-intelligence',
          label: 'Intelligence Dashboard',
          icon: <Layers className="w-4 h-4" />,
          shortcut: 'G I',
          keywords: ['analytics', 'insights', 'analysis'],
          action: () => router.push(`/project/${projectSlug}/intelligence`),
        },
        {
          id: 'nav-schedule',
          label: 'Project Schedule',
          icon: <Calendar className="w-4 h-4" />,
          shortcut: 'G S',
          keywords: ['timeline', 'tasks', 'gantt'],
          action: () => router.push(`/project/${projectSlug}/schedules`),
        },
        {
          id: 'nav-budget',
          label: 'Budget Management',
          icon: <DollarSign className="w-4 h-4" />,
          shortcut: 'G B',
          keywords: ['cost', 'finances', 'money'],
          action: () => router.push(`/project/${projectSlug}/budget`),
        },
        {
          id: 'nav-takeoffs',
          label: 'Material Takeoffs',
          icon: <Ruler className="w-4 h-4" />,
          shortcut: 'G T',
          keywords: ['quantities', 'measurements', 'materials'],
          action: () => router.push(`/project/${projectSlug}/takeoffs`),
        },
        {
          id: 'nav-mep',
          label: 'MEP Equipment',
          icon: <Wrench className="w-4 h-4" />,
          keywords: ['mechanical', 'electrical', 'plumbing'],
          action: () => router.push(`/project/${projectSlug}/mep`),
        },
        {
          id: 'nav-reports',
          label: 'Reports & Analytics',
          icon: <BarChart2 className="w-4 h-4" />,
          keywords: ['data', 'charts', 'export'],
          action: () => router.push(`/project/${projectSlug}/reports`),
        }
      );
    }

    groups.push({
      id: 'navigation',
      label: 'Navigation',
      items: navigationItems,
    });

    // Quick actions group (project-specific)
    if (projectSlug) {
      const quickActions: CommandItem[] = [];

      if (onOpenDocumentLibrary) {
        quickActions.push({
          id: 'action-documents',
          label: 'Open Document Library',
          icon: <FileText className="w-4 h-4" />,
          shortcut: 'D',
          keywords: ['files', 'pdf', 'browse'],
          action: onOpenDocumentLibrary,
        });
      }

      quickActions.push({
        id: 'action-upload',
        label: 'Upload Document',
        icon: <Upload className="w-4 h-4" />,
        shortcut: 'U',
        keywords: ['add', 'new', 'file'],
        action: () => {
          // Trigger file input click - component should handle this
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (fileInput) fileInput.click();
        },
      });

      if (onOpenWeather) {
        quickActions.push({
          id: 'action-weather',
          label: 'Weather Intelligence',
          icon: <CloudRain className="w-4 h-4" />,
          shortcut: 'W',
          keywords: ['forecast', 'rain', 'delays'],
          action: onOpenWeather,
        });
      }

      if (onOpenPhotoLibrary) {
        quickActions.push({
          id: 'action-photos',
          label: 'Photo Library',
          icon: <ImageIcon className="w-4 h-4" />,
          shortcut: 'P',
          keywords: ['images', 'site', 'pictures'],
          action: onOpenPhotoLibrary,
        });
      }

      if (onOpenReportHistory) {
        quickActions.push({
          id: 'action-reports',
          label: 'Daily Report History',
          icon: <History className="w-4 h-4" />,
          keywords: ['log', 'daily', 'past'],
          action: onOpenReportHistory,
        });
      }

      if (quickActions.length > 0) {
        groups.push({
          id: 'quick-actions',
          label: 'Quick Actions',
          items: quickActions,
        });
      }

      // Team group
      groups.push({
        id: 'team',
        label: 'Team',
        items: [
          {
            id: 'team-subcontractors',
            label: 'Subcontractors',
            icon: <Users className="w-4 h-4" />,
            keywords: ['subs', 'vendors', 'contractors'],
            action: () => router.push(`/project/${projectSlug}/subcontractors`),
          },
          {
            id: 'team-crews',
            label: 'Crew Management',
            icon: <Users className="w-4 h-4" />,
            keywords: ['workers', 'labor', 'staff'],
            action: () => router.push(`/project/${projectSlug}/crews`),
          },
        ],
      });
    }

    // Admin group
    if (isAdmin) {
      groups.push({
        id: 'admin',
        label: 'Admin',
        items: [
          {
            id: 'admin-dashboard',
            label: 'Admin Dashboard',
            icon: <Settings className="w-4 h-4" />,
            keywords: ['settings', 'manage', 'control'],
            action: () => router.push('/admin'),
          },
        ],
      });
    }

    // Help group
    groups.push({
      id: 'help',
      label: 'Help',
      items: [
        {
          id: 'help-docs',
          label: 'Documentation',
          icon: <BookOpen className="w-4 h-4" />,
          shortcut: '?',
          keywords: ['guide', 'manual', 'faq'],
          action: () => window.open('https://docs.foremanos.com', '_blank'),
        },
        {
          id: 'help-support',
          label: 'Contact Support',
          icon: <HelpCircle className="w-4 h-4" />,
          keywords: ['help', 'issue', 'problem'],
          action: () => window.open('mailto:support@foremanos.com', '_blank'),
        },
      ],
    });

    return groups;
  };

  const commandGroups = getCommandGroups();

  return (
    <>
      {/* Keyboard shortcut hint */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-300 border border-gray-700 hover:border-gray-600 rounded-lg bg-dark-surface transition-colors"
        aria-label="Open command palette"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search</span>
        <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-600 bg-dark-card px-1.5 font-mono text-[10px] font-medium text-gray-400">
          <span className="text-xs">
            {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '' : 'Ctrl'}
          </span>
          K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {commandGroups.map((group, groupIndex) => (
            <div key={group.id}>
              <CommandGroup heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.keywords?.join(' ') || ''}`}
                    onSelect={() => runCommand(item.action)}
                  >
                    <span className="mr-2 text-gray-400">{item.icon}</span>
                    {item.label}
                    {item.shortcut && (
                      <CommandShortcut>{item.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {groupIndex < commandGroups.length - 1 && <CommandSeparator />}
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

/**
 * useCommandPalette - Hook to programmatically control the command palette
 *
 * @example
 * const { isOpen, open, close, toggle } = useCommandPalette();
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}
