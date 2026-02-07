'use client';

import * as React from 'react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Check, Loader2, AlertCircle, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutosaveIndicatorProps {
  /** Current save status */
  status: AutosaveStatus;
  /** Error message when status is 'error' */
  errorMessage?: string;
  /** Time in ms to show 'saved' before fading to idle (default: 2000) */
  savedDisplayDuration?: number;
  /** Show as compact inline indicator */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AutosaveIndicator - Visual feedback for auto-saved content
 *
 * Shows "Saving..." → "Saved" → fade out states.
 * Use with form data that auto-saves on change.
 *
 * @example
 * const [saveStatus, setSaveStatus] = useState<AutosaveStatus>('idle');
 *
 * const handleChange = async (data) => {
 *   setSaveStatus('saving');
 *   try {
 *     await save(data);
 *     setSaveStatus('saved');
 *   } catch {
 *     setSaveStatus('error');
 *   }
 * };
 *
 * <AutosaveIndicator status={saveStatus} />
 */
export function AutosaveIndicator({
  status,
  errorMessage,
  savedDisplayDuration = 2000,
  compact = false,
  className,
}: AutosaveIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [displayStatus, setDisplayStatus] = useState<AutosaveStatus>(status);

  useEffect(() => {
    setDisplayStatus(status);

    if (status === 'saving' || status === 'error') {
      setVisible(true);
    } else if (status === 'saved') {
      setVisible(true);
      // Fade out after duration
      const timer = setTimeout(() => {
        setVisible(false);
      }, savedDisplayDuration);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [status, savedDisplayDuration]);

  const getIcon = () => {
    switch (displayStatus) {
      case 'saving':
        return <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />;
      case 'saved':
        return <Check className="w-4 h-4" aria-hidden="true" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" aria-hidden="true" />;
      default:
        return <Cloud className="w-4 h-4" aria-hidden="true" />;
    }
  };

  const getText = () => {
    switch (displayStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return errorMessage || 'Save failed';
      default:
        return '';
    }
  };

  const getColors = () => {
    switch (displayStatus) {
      case 'saving':
        return 'text-blue-400';
      case 'saved':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-300';
    }
  };

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs transition-opacity duration-300',
          getColors(),
          visible ? 'opacity-100' : 'opacity-0',
          className
        )}
        role="status"
        aria-live="polite"
      >
        {getIcon()}
        <span>{getText()}</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-300',
        getColors(),
        displayStatus === 'error' && 'bg-red-500/10 border border-red-500/20',
        displayStatus === 'saving' && 'bg-blue-500/10',
        displayStatus === 'saved' && 'bg-green-500/10',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {getIcon()}
      <span className="font-medium">{getText()}</span>
    </div>
  );
}

interface UseAutosaveOptions<T> {
  /** Data to watch for changes */
  data: T;
  /** Save function that returns a promise */
  onSave: (data: T) => Promise<void>;
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;
  /** Whether autosave is enabled (default: true) */
  enabled?: boolean;
}

interface UseAutosaveReturn {
  /** Current save status */
  status: AutosaveStatus;
  /** Error message if save failed */
  errorMessage: string | undefined;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Manually trigger a save */
  save: () => Promise<void>;
}

/**
 * useAutosave - Hook for automatic saving with debounce
 *
 * Watches data changes and triggers save after debounce delay.
 * Tracks dirty state and handles errors.
 *
 * @example
 * const { status, isDirty, save } = useAutosave({
 *   data: formData,
 *   onSave: async (data) => {
 *     await api.save(data);
 *   },
 *   debounceMs: 500,
 * });
 *
 * <AutosaveIndicator status={status} />
 */
export function useAutosave<T>({
  data,
  onSave,
  debounceMs = 500,
  enabled = true,
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isDirty, setIsDirty] = useState(false);

  const initialDataRef = useRef<T>(data);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  const save = useCallback(async () => {
    if (!enabled) return;

    setStatus('saving');
    setErrorMessage(undefined);

    try {
      await onSave(data);
      setStatus('saved');
      setIsDirty(false);
      initialDataRef.current = data;
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to save'
      );
    }
  }, [data, onSave, enabled]);

  useEffect(() => {
    // Skip first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled) return;

    // Mark as dirty when data changes
    const hasChanges =
      JSON.stringify(data) !== JSON.stringify(initialDataRef.current);
    setIsDirty(hasChanges);

    if (!hasChanges) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up debounced save
    timeoutRef.current = setTimeout(() => {
      save();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, debounceMs, enabled, save]);

  return { status, errorMessage, isDirty, save };
}

interface UseUnsavedChangesWarningOptions {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Custom warning message */
  message?: string;
}

/**
 * useUnsavedChangesWarning - Hook to warn users before leaving with unsaved changes
 *
 * Shows browser's native "Leave site?" dialog when user tries to
 * close tab, navigate away, or refresh with unsaved changes.
 *
 * @example
 * const { isDirty } = useAutosave({ data, onSave });
 * useUnsavedChangesWarning({ isDirty });
 */
export function useUnsavedChangesWarning({
  isDirty,
  message = 'You have unsaved changes. Are you sure you want to leave?',
}: UseUnsavedChangesWarningOptions) {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages, but we set it for legacy support
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, message]);
}
