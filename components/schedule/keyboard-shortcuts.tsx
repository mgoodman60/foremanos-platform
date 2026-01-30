'use client';

import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Keyboard } from 'lucide-react';

interface ShortcutAction {
  key: string;
  description: string;
  action: () => void;
}

interface UseKeyboardShortcutsOptions {
  onJumpToToday?: () => void;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  onFocusSearch?: () => void;
  onRefresh?: () => void;
  onCloseModal?: () => void;
  onSwitchTab?: (tab: string) => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onJumpToToday,
  onPreviousWeek,
  onNextWeek,
  onFocusSearch,
  onRefresh,
  onCloseModal,
  onSwitchTab,
  enabled = true
}: UseKeyboardShortcutsOptions) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow Escape to work in inputs
      if (e.key === 'Escape') {
        (target as HTMLInputElement).blur();
        onCloseModal?.();
      }
      return;
    }

    // Handle shortcuts
    switch (e.key.toLowerCase()) {
      case 't':
        e.preventDefault();
        onJumpToToday?.();
        break;
      case 'arrowleft':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onPreviousWeek?.();
        }
        break;
      case 'arrowright':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onNextWeek?.();
        }
        break;
      case '/':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onFocusSearch?.();
        }
        break;
      case 'k':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onFocusSearch?.();
        }
        break;
      case 'r':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onRefresh?.();
        }
        break;
      case 'escape':
        e.preventDefault();
        onCloseModal?.();
        setShowHelp(false);
        break;
      case '?':
        e.preventDefault();
        setShowHelp(prev => !prev);
        break;
      case '1':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onSwitchTab?.('gantt');
        }
        break;
      case '2':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onSwitchTab?.('lookahead');
        }
        break;
      case '3':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onSwitchTab?.('analysis');
        }
        break;
      case '4':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onSwitchTab?.('health');
        }
        break;
    }
  }, [onJumpToToday, onPreviousWeek, onNextWeek, onFocusSearch, onRefresh, onCloseModal, onSwitchTab]);

  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);

  return { showHelp, setShowHelp };
}

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const shortcuts = [
    { keys: ['T'], description: 'Jump to today' },
    { keys: ['←'], description: 'Previous week (in lookahead)' },
    { keys: ['→'], description: 'Next week (in lookahead)' },
    { keys: ['/'], description: 'Focus search bar' },
    { keys: ['⌘', 'K'], description: 'Focus search bar' },
    { keys: ['R'], description: 'Refresh schedule data' },
    { keys: ['1'], description: 'Switch to Gantt Chart tab' },
    { keys: ['2'], description: 'Switch to 3-Week Lookahead tab' },
    { keys: ['3'], description: 'Switch to Analysis tab' },
    { keys: ['4'], description: 'Switch to Health Check tab' },
    { keys: ['Esc'], description: 'Close modal / Clear focus' },
    { keys: ['?'], description: 'Toggle this help menu' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-dark-card border-gray-700 text-gray-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Keyboard className="h-5 w-5 text-[#F97316]" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
              <span className="text-gray-300 text-sm">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <span key={i} className="flex items-center">
                    <kbd className="px-2 py-1 bg-gray-700 rounded text-xs font-mono text-gray-200 border border-gray-600">
                      {key}
                    </kbd>
                    {i < shortcut.keys.length - 1 && (
                      <span className="mx-1 text-gray-500 text-xs">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">?</kbd> anytime to toggle this menu
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
