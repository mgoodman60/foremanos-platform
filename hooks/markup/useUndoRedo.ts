'use client';

import { useState, useCallback } from 'react';
import type { MarkupRecord } from '@/lib/markup/markup-types';

interface HistoryAction {
  type: 'create' | 'update' | 'delete' | 'bulk_delete';
  before: MarkupRecord | MarkupRecord[] | null;
  after: MarkupRecord | MarkupRecord[] | null;
}

const MAX_HISTORY = 100;

export function useUndoRedo(onUndo: (action: HistoryAction) => void, onRedo: (action: HistoryAction) => void) {
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const pushAction = useCallback((action: HistoryAction) => {
    setHistory((prev) => {
      // Remove any redo history
      const newHistory = prev.slice(0, currentIndex + 1);

      // Add new action
      newHistory.push(action);

      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        return newHistory.slice(newHistory.length - MAX_HISTORY);
      }

      return newHistory;
    });

    setCurrentIndex((prev) => {
      const newIndex = Math.min(prev + 1, MAX_HISTORY - 1);
      return newIndex;
    });
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex < 0) return;

    const action = history[currentIndex];
    onUndo(action);
    setCurrentIndex((prev) => prev - 1);
  }, [currentIndex, history, onUndo]);

  const redo = useCallback(() => {
    if (currentIndex >= history.length - 1) return;

    const action = history[currentIndex + 1];
    onRedo(action);
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, history, onRedo]);

  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    pushAction,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
