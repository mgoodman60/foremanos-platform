'use client';

import { useState, useEffect, useCallback } from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutAction {
  key: string;
  description: string;
  action: () => void;
}

interface KeyboardShortcutsHelpProps {
  shortcuts: ShortcutAction[];
}

export default function KeyboardShortcutsHelp({ shortcuts }: KeyboardShortcutsHelpProps) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Toggle help with ?
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowHelp(prev => !prev);
      return;
    }

    // Escape to close help
    if (e.key === 'Escape' && showHelp) {
      setShowHelp(false);
      return;
    }

    // Check registered shortcuts
    for (const shortcut of shortcuts) {
      const keys = shortcut.key.toLowerCase().split('+');
      const hasCtrl = keys.includes('ctrl');
      const hasShift = keys.includes('shift');
      const hasAlt = keys.includes('alt');
      const mainKey = keys.filter(k => !['ctrl', 'shift', 'alt'].includes(k))[0];

      if (
        (hasCtrl === (e.ctrlKey || e.metaKey)) &&
        (hasShift === e.shiftKey) &&
        (hasAlt === e.altKey) &&
        e.key.toLowerCase() === mainKey
      ) {
        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts, showHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  return (
    <>
      {/* Help Toggle Button */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600
          rounded-lg text-slate-400 hover:text-white transition-colors z-40"
        title="Keyboard Shortcuts (?)"
      >
        <Keyboard className="w-5 h-5" />
      </button>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-blue-400" />
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-slate-700 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {shortcuts.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-slate-300">{shortcut.description}</span>
                  <kbd className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm font-mono text-slate-300">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <span className="text-slate-300">Show this help</span>
                <kbd className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm font-mono text-slate-300">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Hook for using keyboard shortcuts
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  deps: any[] = []
) {
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const keys = key.toLowerCase().split('+');
    const hasCtrl = keys.includes('ctrl');
    const hasShift = keys.includes('shift');
    const hasAlt = keys.includes('alt');
    const mainKey = keys.filter(k => !['ctrl', 'shift', 'alt'].includes(k))[0];

    if (
      (hasCtrl === (e.ctrlKey || e.metaKey)) &&
      (hasShift === e.shiftKey) &&
      (hasAlt === e.altKey) &&
      e.key.toLowerCase() === mainKey
    ) {
      e.preventDefault();
      callback();
    }
  }, [key, callback, ...deps]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);
}
