import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';
import {
  SyncStatusBanner,
  useSyncStatus,
} from '@/components/sync-status-banner';

describe('SyncStatusBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('SyncStatusBanner Component', () => {
    it('should not render when status is synced and alwaysShow is false', () => {
      const { container } = render(
        <SyncStatusBanner status="synced" lastSynced={new Date()} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when alwaysShow is true', () => {
      render(
        <SyncStatusBanner
          status="synced"
          lastSynced={new Date()}
          alwaysShow={true}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should render syncing status', () => {
      render(<SyncStatusBanner status="syncing" />);

      expect(screen.getByText('Syncing data...')).toBeInTheDocument();
    });

    it('should render error status with message', () => {
      render(
        <SyncStatusBanner status="error" errorMessage="Network connection failed" />
      );

      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    });

    it('should use default error message when none provided', () => {
      render(<SyncStatusBanner status="error" />);

      expect(screen.getByText('Some data may be outdated')).toBeInTheDocument();
    });

    it('should show retry button for error status', () => {
      const onRetry = vi.fn().mockResolvedValue(undefined);
      render(<SyncStatusBanner status="error" onRetry={onRetry} />);

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call onRetry when retry button clicked', async () => {
      vi.useRealTimers();
      const onRetry = vi.fn().mockResolvedValue(undefined);
      render(<SyncStatusBanner status="error" onRetry={onRetry} />);

      const retryButton = screen.getByText('Retry');

      await act(async () => {
        fireEvent.click(retryButton);
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(onRetry).toHaveBeenCalled();
      vi.useFakeTimers();
    });

    it('should show sync now button for stale status', () => {
      const onSync = vi.fn().mockResolvedValue(undefined);
      render(<SyncStatusBanner status="stale" onSync={onSync} />);

      expect(screen.getByText('Sync Now')).toBeInTheDocument();
    });

    it('should call onSync when sync now button clicked', async () => {
      vi.useRealTimers();
      const onSync = vi.fn().mockResolvedValue(undefined);
      render(<SyncStatusBanner status="stale" onSync={onSync} />);

      const syncButton = screen.getByText('Sync Now');

      await act(async () => {
        fireEvent.click(syncButton);
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(onSync).toHaveBeenCalled();
      vi.useFakeTimers();
    });

    it('should show dismiss button except when syncing', () => {
      const { rerender } = render(<SyncStatusBanner status="error" />);

      expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();

      rerender(<SyncStatusBanner status="syncing" />);

      expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
    });

    it('should dismiss banner when dismiss button clicked', () => {
      const { container, rerender } = render(<SyncStatusBanner status="error" />);

      const dismissButton = screen.getByLabelText('Dismiss');
      fireEvent.click(dismissButton);

      // Rerender to trigger state update
      rerender(<SyncStatusBanner status="error" />);

      // The banner should be dismissed after click
      expect(container.querySelector('[role="status"]')).toBeNull();
    });

    it('should format last synced time correctly', () => {
      const lastSynced = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      render(
        <SyncStatusBanner status="synced" lastSynced={lastSynced} alwaysShow />
      );

      expect(screen.getByText('Last synced Just now')).toBeInTheDocument();
    });

    it('should show minutes ago for recent syncs', () => {
      const lastSynced = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
      render(
        <SyncStatusBanner status="synced" lastSynced={lastSynced} alwaysShow />
      );

      expect(screen.getByText('Last synced 3 min ago')).toBeInTheDocument();
    });

    it('should show hours ago for older syncs', () => {
      const lastSynced = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      render(
        <SyncStatusBanner status="synced" lastSynced={lastSynced} alwaysShow />
      );

      expect(screen.getByText('Last synced 2 hr ago')).toBeInTheDocument();
    });

    it('should show date for very old syncs', () => {
      const lastSynced = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      render(
        <SyncStatusBanner status="synced" lastSynced={lastSynced} alwaysShow />
      );

      const text = screen.getByRole('status').textContent;
      expect(text).toContain('Last synced');
      expect(text).not.toContain('hr ago');
    });

    it('should show "Never" when lastSynced is null', () => {
      render(
        <SyncStatusBanner status="synced" lastSynced={null} alwaysShow />
      );

      expect(screen.getByText('Last synced Never')).toBeInTheDocument();
    });

    it('should apply correct styles for synced status', () => {
      render(
        <SyncStatusBanner status="synced" lastSynced={new Date()} alwaysShow />
      );

      const banner = screen.getByRole('status');
      expect(banner).toHaveClass('bg-green-500/10', 'border-green-500/30');
    });

    it('should apply correct styles for syncing status', () => {
      render(<SyncStatusBanner status="syncing" />);

      const banner = screen.getByRole('status');
      expect(banner).toHaveClass('bg-blue-500/10', 'border-blue-500/30');
    });

    it('should apply correct styles for error status', () => {
      render(<SyncStatusBanner status="error" />);

      const banner = screen.getByRole('status');
      expect(banner).toHaveClass('bg-red-500/10', 'border-red-500/30');
    });

    it('should apply correct styles for stale status', () => {
      render(<SyncStatusBanner status="stale" />);

      const banner = screen.getByRole('status');
      expect(banner).toHaveClass('bg-yellow-500/10', 'border-yellow-500/30');
    });

    it('should accept custom className', () => {
      render(
        <SyncStatusBanner status="error" className="custom-banner-class" />
      );

      const banner = screen.getByRole('status');
      expect(banner).toHaveClass('custom-banner-class');
    });

    it('should have proper ARIA attributes', () => {
      render(<SyncStatusBanner status="syncing" />);

      const banner = screen.getByRole('status');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('useSyncStatus Hook', () => {
    it('should start with synced status', () => {
      const checkSync = vi.fn().mockResolvedValue(true);
      const { result } = renderHook(() => useSyncStatus({ checkSync }));

      expect(result.current.status).toBe('synced');
      expect(result.current.lastSynced).toBeNull();
    });

    it('should sync and update status', async () => {
      const checkSync = vi.fn().mockResolvedValue(true);
      const { result } = renderHook(() => useSyncStatus({ checkSync }));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('synced');
      expect(result.current.lastSynced).toBeInstanceOf(Date);
    });

    it('should set error status on sync failure', async () => {
      const checkSync = vi.fn().mockResolvedValue(false);
      const { result } = renderHook(() => useSyncStatus({ checkSync }));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.errorMessage).toBe('Sync failed');
    });

    it('should handle exceptions during sync', async () => {
      const checkSync = vi.fn().mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useSyncStatus({ checkSync }));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.errorMessage).toBe('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      const checkSync = vi.fn().mockRejectedValue('String error');
      const { result } = renderHook(() => useSyncStatus({ checkSync }));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.errorMessage).toBe('Sync failed');
    });

    it('should clear error message on successful sync', async () => {
      const checkSync = vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const { result } = renderHook(() => useSyncStatus({ checkSync }));

      // First sync fails
      await act(async () => {
        await result.current.sync();
      });
      expect(result.current.errorMessage).toBe('Sync failed');

      // Second sync succeeds
      await act(async () => {
        await result.current.sync();
      });
      expect(result.current.errorMessage).toBeUndefined();
    });

    it('should provide retry function', async () => {
      const checkSync = vi.fn().mockResolvedValue(true);
      const { result } = renderHook(() => useSyncStatus({ checkSync }));

      await act(async () => {
        await result.current.retry();
      });

      expect(checkSync).toHaveBeenCalled();
      expect(result.current.status).toBe('synced');
    });

    it('should markSynced update status', () => {
      const checkSync = vi.fn().mockResolvedValue(true);
      const { result } = renderHook(() => useSyncStatus({ checkSync }));

      act(() => {
        result.current.markSynced();
      });

      expect(result.current.status).toBe('synced');
      expect(result.current.lastSynced).toBeInstanceOf(Date);
      expect(result.current.errorMessage).toBeUndefined();
    });

    it('should markError update status', () => {
      const checkSync = vi.fn().mockResolvedValue(true);
      const { result } = renderHook(() => useSyncStatus({ checkSync }));

      act(() => {
        result.current.markError('Custom error message');
      });

      expect(result.current.status).toBe('error');
      expect(result.current.errorMessage).toBe('Custom error message');
    });

    it('should use default error message in markError', () => {
      const checkSync = vi.fn().mockResolvedValue(true);
      const { result } = renderHook(() => useSyncStatus({ checkSync }));

      act(() => {
        result.current.markError();
      });

      expect(result.current.errorMessage).toBe('Sync failed');
    });
  });
});
