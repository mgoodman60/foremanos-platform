import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// Mock idb module
const mockPut = vi.fn();
const mockGet = vi.fn();
const mockGetAll = vi.fn();
const mockGetAllFromIndex = vi.fn();
const mockDelete = vi.fn();
const mockAdd = vi.fn();

const mockTransaction = {
  store: { delete: vi.fn() },
  done: Promise.resolve(),
};

const mockDB = {
  put: mockPut,
  get: mockGet,
  getAll: mockGetAll,
  getAllFromIndex: mockGetAllFromIndex,
  delete: mockDelete,
  add: mockAdd,
  transaction: vi.fn().mockReturnValue(mockTransaction),
};

vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue(mockDB),
}));

// Need to mock window for SSR guard
const originalWindow = global.window;

describe('offline-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache so getDB() re-initializes
    vi.resetModules();
    // Ensure window is defined (simulating browser environment)
    if (typeof global.window === 'undefined') {
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
        configurable: true,
      });
    }
  });

  afterAll(() => {
    if (originalWindow === undefined) {
      delete (global as any).window;
    }
  });

  describe('saveDraft', () => {
    it('should save a draft to IndexedDB with savedAt timestamp', async () => {
      const { saveDraft } = await import('@/lib/offline-store');

      await saveDraft({
        id: 'project1-2026-02-08',
        projectId: 'project1',
        projectSlug: 'test-project',
        date: '2026-02-08',
        data: { crewSize: 5, weatherCondition: 'Clear' },
      });

      expect(mockPut).toHaveBeenCalledWith(
        'drafts',
        expect.objectContaining({
          id: 'project1-2026-02-08',
          projectId: 'project1',
          projectSlug: 'test-project',
          date: '2026-02-08',
          data: { crewSize: 5, weatherCondition: 'Clear' },
          savedAt: expect.any(Number),
        })
      );
    });

    it('should overwrite existing draft with same id', async () => {
      const { saveDraft } = await import('@/lib/offline-store');

      await saveDraft({
        id: 'project1-2026-02-08',
        projectId: 'project1',
        projectSlug: 'test-project',
        date: '2026-02-08',
        data: { crewSize: 10 },
      });

      expect(mockPut).toHaveBeenCalledTimes(1);
      expect(mockPut).toHaveBeenCalledWith(
        'drafts',
        expect.objectContaining({ data: { crewSize: 10 } })
      );
    });
  });

  describe('getDraft', () => {
    it('should retrieve a draft by projectId and date composite key', async () => {
      const mockDraft = {
        id: 'project1-2026-02-08',
        projectId: 'project1',
        projectSlug: 'test-project',
        date: '2026-02-08',
        data: { crewSize: 5 },
        savedAt: Date.now(),
      };
      mockGet.mockResolvedValueOnce(mockDraft);

      const { getDraft } = await import('@/lib/offline-store');
      const result = await getDraft('project1', '2026-02-08');

      expect(mockGet).toHaveBeenCalledWith('drafts', 'project1-2026-02-08');
      expect(result).toEqual(mockDraft);
    });

    it('should return undefined for non-existent drafts', async () => {
      mockGet.mockResolvedValueOnce(undefined);

      const { getDraft } = await import('@/lib/offline-store');
      const result = await getDraft('project1', '2099-01-01');

      expect(mockGet).toHaveBeenCalledWith('drafts', 'project1-2099-01-01');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllDrafts', () => {
    it('should return all drafts when no projectId given', async () => {
      const drafts = [
        { id: 'p1-2026-02-08', projectId: 'p1', date: '2026-02-08' },
        { id: 'p2-2026-02-08', projectId: 'p2', date: '2026-02-08' },
      ];
      mockGetAll.mockResolvedValueOnce(drafts);

      const { getAllDrafts } = await import('@/lib/offline-store');
      const result = await getAllDrafts();

      expect(mockGetAll).toHaveBeenCalledWith('drafts');
      expect(result).toHaveLength(2);
    });

    it('should filter by projectId using index when given', async () => {
      const drafts = [{ id: 'p1-2026-02-08', projectId: 'p1', date: '2026-02-08' }];
      mockGetAllFromIndex.mockResolvedValueOnce(drafts);

      const { getAllDrafts } = await import('@/lib/offline-store');
      const result = await getAllDrafts('p1');

      expect(mockGetAllFromIndex).toHaveBeenCalledWith('drafts', 'by-project', 'p1');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no drafts exist', async () => {
      mockGetAll.mockResolvedValueOnce([]);

      const { getAllDrafts } = await import('@/lib/offline-store');
      const result = await getAllDrafts();

      expect(result).toHaveLength(0);
    });
  });

  describe('deleteDraft', () => {
    it('should delete a draft by id', async () => {
      const { deleteDraft } = await import('@/lib/offline-store');
      await deleteDraft('project1-2026-02-08');

      expect(mockDelete).toHaveBeenCalledWith('drafts', 'project1-2026-02-08');
    });
  });

  describe('addToSyncQueue', () => {
    it('should add a request to the sync queue with defaults', async () => {
      const { addToSyncQueue } = await import('@/lib/offline-store');

      await addToSyncQueue({
        url: '/api/projects/test/daily-reports',
        method: 'POST',
        body: JSON.stringify({ date: '2026-02-08' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(mockAdd).toHaveBeenCalledWith(
        'sync-queue',
        expect.objectContaining({
          url: '/api/projects/test/daily-reports',
          method: 'POST',
          body: JSON.stringify({ date: '2026-02-08' }),
          headers: { 'Content-Type': 'application/json' },
          retryCount: 0,
          createdAt: expect.any(Number),
        })
      );
    });

    it('should support PATCH method', async () => {
      const { addToSyncQueue } = await import('@/lib/offline-store');

      await addToSyncQueue({
        url: '/api/projects/test/daily-reports/123',
        method: 'PATCH',
        body: JSON.stringify({ notes: 'updated' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(mockAdd).toHaveBeenCalledWith(
        'sync-queue',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should support DELETE method', async () => {
      const { addToSyncQueue } = await import('@/lib/offline-store');

      await addToSyncQueue({
        url: '/api/projects/test/daily-reports/123',
        method: 'DELETE',
        body: '',
        headers: {},
      });

      expect(mockAdd).toHaveBeenCalledWith(
        'sync-queue',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('getSyncQueue', () => {
    it('should return all queued items', async () => {
      const items = [
        { id: 1, url: '/api/test', method: 'POST', retryCount: 0, createdAt: Date.now(), body: '{}', headers: {} },
      ];
      mockGetAll.mockResolvedValueOnce(items);

      const { getSyncQueue } = await import('@/lib/offline-store');
      const result = await getSyncQueue();

      expect(mockGetAll).toHaveBeenCalledWith('sync-queue');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when queue is empty', async () => {
      mockGetAll.mockResolvedValueOnce([]);

      const { getSyncQueue } = await import('@/lib/offline-store');
      const result = await getSyncQueue();

      expect(result).toHaveLength(0);
    });
  });

  describe('clearSynced', () => {
    it('should delete synced items from queue in a transaction', async () => {
      const { clearSynced } = await import('@/lib/offline-store');
      await clearSynced([1, 2, 3]);

      expect(mockDB.transaction).toHaveBeenCalledWith('sync-queue', 'readwrite');
      expect(mockTransaction.store.delete).toHaveBeenCalledTimes(3);
      expect(mockTransaction.store.delete).toHaveBeenCalledWith(1);
      expect(mockTransaction.store.delete).toHaveBeenCalledWith(2);
      expect(mockTransaction.store.delete).toHaveBeenCalledWith(3);
    });

    it('should handle empty ids array', async () => {
      const { clearSynced } = await import('@/lib/offline-store');
      await clearSynced([]);

      expect(mockDB.transaction).toHaveBeenCalledWith('sync-queue', 'readwrite');
      expect(mockTransaction.store.delete).not.toHaveBeenCalled();
    });
  });

  describe('incrementRetry', () => {
    it('should increment retryCount for existing queue item', async () => {
      const existingItem = {
        id: 1,
        url: '/api/test',
        method: 'POST',
        body: '{}',
        headers: {},
        createdAt: Date.now(),
        retryCount: 2,
      };
      mockGet.mockResolvedValueOnce(existingItem);

      const { incrementRetry } = await import('@/lib/offline-store');
      await incrementRetry(1);

      expect(mockGet).toHaveBeenCalledWith('sync-queue', 1);
      expect(mockPut).toHaveBeenCalledWith(
        'sync-queue',
        expect.objectContaining({ retryCount: 3 })
      );
    });

    it('should not update if item does not exist', async () => {
      mockGet.mockResolvedValueOnce(undefined);

      const { incrementRetry } = await import('@/lib/offline-store');
      await incrementRetry(999);

      expect(mockGet).toHaveBeenCalledWith('sync-queue', 999);
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('isOnline', () => {
    it('should return navigator.onLine when navigator is available', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true,
      });

      const { isOnline } = await import('@/lib/offline-store');
      expect(isOnline()).toBe(true);
    });

    it('should return false when navigator reports offline', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const { isOnline } = await import('@/lib/offline-store');
      expect(isOnline()).toBe(false);
    });

    it('should return true when navigator is undefined', async () => {
      const origNavigator = global.navigator;
      delete (global as any).navigator;

      const { isOnline } = await import('@/lib/offline-store');
      expect(isOnline()).toBe(true);

      // Restore
      Object.defineProperty(global, 'navigator', {
        value: origNavigator,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('SSR guard', () => {
    it('should throw error when window is undefined (server-side)', async () => {
      const origWindow = global.window;
      delete (global as any).window;

      // Re-import to get fresh module
      const { saveDraft } = await import('@/lib/offline-store');

      await expect(
        saveDraft({
          id: 'test-id',
          projectId: 'p1',
          projectSlug: 'test',
          date: '2026-02-08',
          data: {},
        })
      ).rejects.toThrow('IndexedDB is only available in the browser');

      // Restore
      Object.defineProperty(global, 'window', {
        value: origWindow ?? {},
        writable: true,
        configurable: true,
      });
    });
  });
});
