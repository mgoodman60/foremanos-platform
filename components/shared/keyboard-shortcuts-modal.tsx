'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { X } from 'lucide-react';

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

const sections: ShortcutSection[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'then', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'then', 'O'], description: 'Go to Documents' },
      { keys: ['G', 'then', 'S'], description: 'Go to Schedule & Budget' },
      { keys: ['G', 'then', 'F'], description: 'Go to Field Operations' },
      { keys: ['G', 'then', 'M'], description: 'Go to MEP' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['Cmd', 'K'], description: 'Quick search / command palette' },
      { keys: ['Cmd', '\\'], description: 'Toggle The Foreman' },
      { keys: ['U'], description: 'Upload document' },
      { keys: ['N'], description: 'New daily report' },
      { keys: ['?'], description: 'Show this shortcuts panel' },
    ],
  },
  {
    title: 'Chat (when Foreman drawer is open)',
    shortcuts: [
      { keys: ['Cmd', 'Enter'], description: 'Send message' },
      { keys: ['Escape'], description: 'Close Foreman drawer' },
    ],
  },
];

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((document.activeElement as HTMLElement)?.isContentEditable) return true;
  return false;
}

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const projectSlug = params?.slug as string | undefined;
  const gPending = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isInputFocused()) return;

    // ? key — show shortcuts modal
    if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      setOpen(prev => !prev);
      return;
    }

    // Escape — close modal
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }

    // G-key navigation sequences
    if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !gPending.current) {
      gPending.current = true;
      if (gTimer.current) clearTimeout(gTimer.current);
      gTimer.current = setTimeout(() => { gPending.current = false; }, 500);
      return;
    }

    if (gPending.current && projectSlug) {
      gPending.current = false;
      if (gTimer.current) clearTimeout(gTimer.current);
      const routes: Record<string, string> = {
        d: `/project/${projectSlug}`,
        o: `/project/${projectSlug}/documents`,
        s: `/project/${projectSlug}/schedule-budget`,
        f: `/project/${projectSlug}/field-ops/daily-reports`,
        m: `/project/${projectSlug}/mep/submittals`,
      };
      const target = routes[e.key.toLowerCase()];
      if (target) {
        e.preventDefault();
        router.push(target);
        return;
      }
    }

    // N — new daily report
    if (e.key === 'n' && !e.metaKey && !e.ctrlKey && projectSlug) {
      router.push(`/project/${projectSlug}/field-ops/daily-reports`);
      return;
    }
  }, [open, projectSlug, router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Cleanup G-key timer
  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, []);

  return (
    <>
      {children}
      {open && (
        <KeyboardShortcutsModal onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac');
  const modKey = isMac ? 'Cmd' : 'Ctrl';

  // Focus trap: focus the close button when modal opens
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="bg-slate-900 border border-gray-700 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Keyboard Shortcuts</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
            aria-label="Close shortcuts panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-gray-300">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => {
                        const displayKey = key === 'Cmd' ? modKey : key;
                        if (displayKey === 'then') {
                          return <span key={i} className="text-xs text-gray-500 mx-1">then</span>;
                        }
                        return (
                          <kbd
                            key={i}
                            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono text-gray-300 bg-gray-800 border border-gray-600 rounded"
                          >
                            {displayKey}
                          </kbd>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-800 border border-gray-600 rounded">?</kbd> to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
