import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';
import {
  AutosaveIndicator,
  useAutosave,
  useUnsavedChangesWarning,
} from '@/components/ui/autosave-indicator';

describe('AutosaveIndicator', () => {
  describe('AutosaveIndicator Component', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should render with idle status', () => {
      const { container } = render(<AutosaveIndicator status="idle" />);
      const indicator = container.querySelector('[role="status"]');

      expect(indicator).toBeInTheDocument();
    });

    it('should show saving status with spinner', () => {
      render(<AutosaveIndicator status="saving" />);
      const indicator = screen.getByRole('status');

      expect(indicator).toBeInTheDocument();
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show saved status with check icon', () => {
      render(<AutosaveIndicator status="saved" />);

      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('should show error status with alert icon', () => {
      render(<AutosaveIndicator status="error" errorMessage="Network error" />);

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should use default error message when none provided', () => {
      render(<AutosaveIndicator status="error" />);

      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });

    it('should hide after savedDisplayDuration', () => {
      const { container } = render(
        <AutosaveIndicator status="saved" savedDisplayDuration={1000} />
      );
      const indicator = container.querySelector('[role="status"]') as HTMLElement;

      // Initially visible
      expect(indicator).toHaveClass('opacity-100');

      // Advance timers
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should fade out
      expect(indicator).toHaveClass('opacity-0');
    });

    it('should apply correct colors for saving status', () => {
      render(<AutosaveIndicator status="saving" />);
      const indicator = screen.getByRole('status');

      expect(indicator).toHaveClass('text-blue-400');
    });

    it('should apply correct colors for saved status', () => {
      render(<AutosaveIndicator status="saved" />);
      const indicator = screen.getByRole('status');

      expect(indicator).toHaveClass('text-green-400');
    });

    it('should apply correct colors for error status', () => {
      render(<AutosaveIndicator status="error" />);
      const indicator = screen.getByRole('status');

      expect(indicator).toHaveClass('text-red-400');
    });

    it('should render compact variant', () => {
      render(<AutosaveIndicator status="saving" compact />);
      const indicator = screen.getByRole('status');

      expect(indicator.tagName).toBe('SPAN');
      expect(indicator).toHaveClass('inline-flex', 'text-xs');
    });

    it('should render default variant with padding', () => {
      render(<AutosaveIndicator status="saving" />);
      const indicator = screen.getByRole('status');

      expect(indicator.tagName).toBe('DIV');
      expect(indicator).toHaveClass('px-3', 'py-1.5');
    });

    it('should accept custom className', () => {
      render(<AutosaveIndicator status="saving" className="custom-class" />);
      const indicator = screen.getByRole('status');

      expect(indicator).toHaveClass('custom-class');
    });

    it('should have proper ARIA attributes', () => {
      render(<AutosaveIndicator status="saving" />);
      const indicator = screen.getByRole('status');

      expect(indicator).toHaveAttribute('aria-live', 'polite');
    });

    it('should remain visible for error status', () => {
      const { container } = render(<AutosaveIndicator status="error" />);
      const indicator = container.querySelector('[role="status"]') as HTMLElement;

      expect(indicator).toHaveClass('opacity-100');

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should still be visible
      expect(indicator).toHaveClass('opacity-100');
    });

    it('should show error background styling', () => {
      render(<AutosaveIndicator status="error" />);
      const indicator = screen.getByRole('status');

      expect(indicator).toHaveClass('bg-red-500/10', 'border', 'border-red-500/20');
    });
  });

  describe('useAutosave Hook', () => {
    it('should start with idle status', () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useAutosave({ data: { test: 'data' }, onSave })
      );

      expect(result.current.status).toBe('idle');
      expect(result.current.isDirty).toBe(false);
    });

    it('should allow manual save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useAutosave({ data: { value: 'test' }, onSave })
      );

      await act(async () => {
        await result.current.save();
      });

      expect(onSave).toHaveBeenCalledWith({ value: 'test' });
      expect(result.current.status).toBe('saved');
    });

    it('should handle save error on manual save', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() =>
        useAutosave({ data: { value: 'test' }, onSave })
      );

      await act(async () => {
        await result.current.save();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.errorMessage).toBe('Network error');
    });

    it('should not save when disabled via manual save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useAutosave({ data: { value: 'test' }, onSave, enabled: false })
      );

      await act(async () => {
        await result.current.save();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should reset dirty after successful manual save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useAutosave({ data: { value: 'test' }, onSave })
      );

      await act(async () => {
        await result.current.save();
      });

      expect(result.current.isDirty).toBe(false);
    });

    it('should handle non-Error exception', async () => {
      const onSave = vi.fn().mockRejectedValue('String error');
      const { result } = renderHook(() =>
        useAutosave({ data: { value: 'test' }, onSave })
      );

      await act(async () => {
        await result.current.save();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.errorMessage).toBe('Failed to save');
    });
  });

  describe('useUnsavedChangesWarning Hook', () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should not add listener when not dirty', () => {
      renderHook(() => useUnsavedChangesWarning({ isDirty: false }));

      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });

    it('should add beforeunload listener when dirty', () => {
      renderHook(() => useUnsavedChangesWarning({ isDirty: true }));

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });

    it('should remove listener on cleanup', () => {
      const { unmount } = renderHook(() =>
        useUnsavedChangesWarning({ isDirty: true })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });

    it('should update listener when isDirty changes', () => {
      const { rerender } = renderHook(
        ({ isDirty }) => useUnsavedChangesWarning({ isDirty }),
        {
          initialProps: { isDirty: false },
        }
      );

      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );

      rerender({ isDirty: true });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });

    it('should use custom warning message', () => {
      let capturedHandler: ((e: BeforeUnloadEvent) => void) | undefined;
      addEventListenerSpy.mockImplementation((event, handler) => {
        if (event === 'beforeunload') {
          capturedHandler = handler as (e: BeforeUnloadEvent) => void;
        }
      });

      const customMessage = 'Custom unsaved changes message';
      renderHook(() =>
        useUnsavedChangesWarning({ isDirty: true, message: customMessage })
      );

      expect(capturedHandler).toBeDefined();

      if (capturedHandler) {
        const mockEvent = {
          preventDefault: vi.fn(),
          returnValue: '',
        } as unknown as BeforeUnloadEvent;

        const result = capturedHandler(mockEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.returnValue).toBe(customMessage);
        expect(result).toBe(customMessage);
      }
    });

    it('should prevent default on beforeunload', () => {
      let capturedHandler: ((e: BeforeUnloadEvent) => void) | undefined;
      addEventListenerSpy.mockImplementation((event, handler) => {
        if (event === 'beforeunload') {
          capturedHandler = handler as (e: BeforeUnloadEvent) => void;
        }
      });

      renderHook(() => useUnsavedChangesWarning({ isDirty: true }));

      if (capturedHandler) {
        const mockEvent = {
          preventDefault: vi.fn(),
          returnValue: '',
        } as unknown as BeforeUnloadEvent;

        capturedHandler(mockEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
      }
    });
  });
});
