'use client';

import { useEffect } from 'react';
import { useMarkupState } from './useMarkupState';

export function useKeyboardShortcuts(
  onUndo?: () => void,
  onRedo?: () => void,
  onCopy?: () => void,
  onPaste?: () => void,
  onCut?: () => void,
  onDelete?: () => void
) {
  const {
    setActiveTool,
    setZoom,
    zoom,
    selectedIds,
    deleteShapes,
    clearSelection,
  } = useMarkupState();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Tool shortcuts (single key)
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            setActiveTool('select');
            e.preventDefault();
            break;
          case 'l':
            setActiveTool('line');
            e.preventDefault();
            break;
          case 'r':
            setActiveTool('rectangle');
            e.preventDefault();
            break;
          case 'e':
            setActiveTool('ellipse');
            e.preventDefault();
            break;
          case 'p':
            setActiveTool('freehand');
            e.preventDefault();
            break;
          case 't':
            setActiveTool('text');
            e.preventDefault();
            break;
          case 'a':
            setActiveTool('arrow');
            e.preventDefault();
            break;
          case 'h':
            setActiveTool('pan');
            e.preventDefault();
            break;
          case 'escape':
            clearSelection();
            e.preventDefault();
            break;
          case 'delete':
          case 'backspace':
            if (selectedIds.size > 0) {
              if (onDelete) {
                onDelete();
              } else {
                deleteShapes(Array.from(selectedIds));
              }
              e.preventDefault();
            }
            break;
          case '+':
          case '=':
            setZoom(Math.min(5, zoom + 0.1));
            e.preventDefault();
            break;
          case '-':
          case '_':
            setZoom(Math.max(0.25, zoom - 0.1));
            e.preventDefault();
            break;
        }
      }

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            if (e.shiftKey) {
              // Redo
              if (onRedo) {
                onRedo();
                e.preventDefault();
              }
            } else {
              // Undo
              if (onUndo) {
                onUndo();
                e.preventDefault();
              }
            }
            break;
          case 'y':
            // Redo
            if (onRedo) {
              onRedo();
              e.preventDefault();
            }
            break;
          case 'c':
            if (onCopy) {
              onCopy();
              e.preventDefault();
            }
            break;
          case 'v':
            if (onPaste) {
              onPaste();
              e.preventDefault();
            }
            break;
          case 'x':
            if (onCut) {
              onCut();
              e.preventDefault();
            }
            break;
          case 'a':
            // Select all (handled by store)
            e.preventDefault();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    setActiveTool,
    setZoom,
    zoom,
    selectedIds,
    deleteShapes,
    clearSelection,
    onUndo,
    onRedo,
    onCopy,
    onPaste,
    onCut,
    onDelete,
  ]);
}
