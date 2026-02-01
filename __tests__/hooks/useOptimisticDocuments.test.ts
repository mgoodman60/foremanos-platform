import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOptimisticDocuments } from '@/hooks/useOptimisticDocuments';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useOptimisticDocuments', () => {
  const mockDocuments = [
    { id: 'doc-1', name: 'Document 1', accessLevel: 'admin' },
    { id: 'doc-2', name: 'Document 2', accessLevel: 'client' },
    { id: 'doc-3', name: 'Document 3', accessLevel: 'guest' },
  ];

  let documents: typeof mockDocuments;
  let setDocuments: ReturnType<typeof vi.fn>;
  let fetchDocuments: ReturnType<typeof vi.fn>;
  let onDocumentsChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    documents = [...mockDocuments];
    setDocuments = vi.fn((newDocs) => {
      documents = newDocs;
    });
    fetchDocuments = vi.fn().mockResolvedValue(undefined);
    onDocumentsChange = vi.fn();
    mockFetch.mockReset();
  });

  describe('optimisticDelete', () => {
    it('should optimistically remove documents from the list', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useOptimisticDocuments({
          documents,
          setDocuments,
          fetchDocuments,
          onDocumentsChange,
        })
      );

      await act(async () => {
        await result.current.optimisticDelete(['doc-1', 'doc-2']);
      });

      // Check setDocuments was called to remove the documents
      expect(setDocuments).toHaveBeenCalledWith([mockDocuments[2]]);
      expect(onDocumentsChange).toHaveBeenCalled();
    });

    it('should rollback on API failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useOptimisticDocuments({
          documents,
          setDocuments,
          fetchDocuments,
          onDocumentsChange,
        })
      );

      const success = await act(async () => {
        return await result.current.optimisticDelete(['doc-1']);
      });

      expect(success).toBe(false);
      // Should have rolled back to original documents
      expect(setDocuments).toHaveBeenLastCalledWith(mockDocuments);
      expect(fetchDocuments).toHaveBeenCalled();
    });

    it('should return true when deleting empty array', async () => {
      const { result } = renderHook(() =>
        useOptimisticDocuments({
          documents,
          setDocuments,
          fetchDocuments,
          onDocumentsChange,
        })
      );

      const success = await act(async () => {
        return await result.current.optimisticDelete([]);
      });

      expect(success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle partial failures', async () => {
      // First call succeeds, second fails
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false });

      const { result } = renderHook(() =>
        useOptimisticDocuments({
          documents,
          setDocuments,
          fetchDocuments,
          onDocumentsChange,
        })
      );

      const success = await act(async () => {
        return await result.current.optimisticDelete(['doc-1', 'doc-2']);
      });

      // The second one's response.ok is false, so it will throw and be caught
      expect(success).toBe(false);
    });
  });

  describe('optimisticChangeAccess', () => {
    it('should optimistically update access levels', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useOptimisticDocuments({
          documents,
          setDocuments,
          fetchDocuments,
          onDocumentsChange,
        })
      );

      await act(async () => {
        await result.current.optimisticChangeAccess(['doc-1'], 'guest');
      });

      // Check setDocuments was called with updated access level
      const setDocumentsCall = setDocuments.mock.calls[0][0];
      expect(setDocumentsCall[0].accessLevel).toBe('guest');
      expect(onDocumentsChange).toHaveBeenCalled();
    });

    it('should rollback on API failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useOptimisticDocuments({
          documents,
          setDocuments,
          fetchDocuments,
          onDocumentsChange,
        })
      );

      const success = await act(async () => {
        return await result.current.optimisticChangeAccess(['doc-1'], 'guest');
      });

      expect(success).toBe(false);
      // Should have rolled back to original documents
      expect(setDocuments).toHaveBeenLastCalledWith(mockDocuments);
    });

    it('should return true when changing access for empty array', async () => {
      const { result } = renderHook(() =>
        useOptimisticDocuments({
          documents,
          setDocuments,
          fetchDocuments,
          onDocumentsChange,
        })
      );

      const success = await act(async () => {
        return await result.current.optimisticChangeAccess([], 'guest');
      });

      expect(success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call correct API endpoint with correct payload', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useOptimisticDocuments({
          documents,
          setDocuments,
          fetchDocuments,
          onDocumentsChange,
        })
      );

      await act(async () => {
        await result.current.optimisticChangeAccess(['doc-1'], 'client');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/documents/doc-1/access',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessLevel: 'client' }),
        })
      );
    });

    it('should update multiple documents at once', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useOptimisticDocuments({
          documents,
          setDocuments,
          fetchDocuments,
          onDocumentsChange,
        })
      );

      await act(async () => {
        await result.current.optimisticChangeAccess(
          ['doc-1', 'doc-2'],
          'guest'
        );
      });

      // Check all documents were updated
      const setDocumentsCall = setDocuments.mock.calls[0][0];
      expect(setDocumentsCall[0].accessLevel).toBe('guest');
      expect(setDocumentsCall[1].accessLevel).toBe('guest');
      expect(setDocumentsCall[2].accessLevel).toBe('guest'); // doc-3 unchanged
    });
  });
});
