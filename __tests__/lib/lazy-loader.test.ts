import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createPaginationParams,
  createPaginatedResponse,
  BatchLoader,
  VirtualScrollManager,
  InfiniteScrollManager,
  ProgressiveImageLoader,
  debounce,
  throttle,
  type PaginationOptions,
  type PaginatedResponse,
  type InfiniteScrollOptions,
} from '@/lib/lazy-loader';

describe('lazy-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // ============================================
  // createPaginationParams Tests
  // ============================================
  describe('createPaginationParams', () => {
    it('should create correct pagination params for first page', () => {
      const options: PaginationOptions = {
        page: 1,
        pageSize: 10,
      };

      const result = createPaginationParams(options);

      expect(result.skip).toBe(0);
      expect(result.take).toBe(10);
      expect(result.orderBy).toBeUndefined();
    });

    it('should create correct pagination params for second page', () => {
      const options: PaginationOptions = {
        page: 2,
        pageSize: 20,
      };

      const result = createPaginationParams(options);

      expect(result.skip).toBe(20);
      expect(result.take).toBe(20);
    });

    it('should create correct pagination params for third page with custom page size', () => {
      const options: PaginationOptions = {
        page: 3,
        pageSize: 50,
      };

      const result = createPaginationParams(options);

      expect(result.skip).toBe(100);
      expect(result.take).toBe(50);
    });

    it('should include orderBy when sortBy is provided with default asc order', () => {
      const options: PaginationOptions = {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
      };

      const result = createPaginationParams(options);

      expect(result.orderBy).toEqual({ createdAt: 'asc' });
    });

    it('should include orderBy when sortBy and sortOrder are provided', () => {
      const options: PaginationOptions = {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      };

      const result = createPaginationParams(options);

      expect(result.orderBy).toEqual({ name: 'desc' });
    });

    it('should handle filters without affecting pagination params', () => {
      const options: PaginationOptions = {
        page: 2,
        pageSize: 15,
        filters: { status: 'active', type: 'document' },
      };

      const result = createPaginationParams(options);

      expect(result.skip).toBe(15);
      expect(result.take).toBe(15);
      expect(result.orderBy).toBeUndefined();
    });

    it('should handle page 0 edge case', () => {
      const options: PaginationOptions = {
        page: 0,
        pageSize: 10,
      };

      const result = createPaginationParams(options);

      expect(result.skip).toBe(-10);
      expect(result.take).toBe(10);
    });

    it('should handle large page numbers', () => {
      const options: PaginationOptions = {
        page: 100,
        pageSize: 25,
      };

      const result = createPaginationParams(options);

      expect(result.skip).toBe(2475);
      expect(result.take).toBe(25);
    });
  });

  // ============================================
  // createPaginatedResponse Tests
  // ============================================
  describe('createPaginatedResponse', () => {
    it('should create paginated response for first page with more data', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const total = 10;
      const options: PaginationOptions = { page: 1, pageSize: 3 };

      const result = createPaginatedResponse(data, total, options);

      expect(result.data).toEqual(data);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(3);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.totalPages).toBe(4);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should create paginated response for last page', () => {
      const data = [{ id: 10 }];
      const total = 10;
      const options: PaginationOptions = { page: 4, pageSize: 3 };

      const result = createPaginatedResponse(data, total, options);

      expect(result.data).toEqual(data);
      expect(result.pagination.page).toBe(4);
      expect(result.pagination.pageSize).toBe(3);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.totalPages).toBe(4);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle empty data', () => {
      const data: never[] = [];
      const total = 0;
      const options: PaginationOptions = { page: 1, pageSize: 10 };

      const result = createPaginatedResponse(data, total, options);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle exact page division', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
      const total = 10;
      const options: PaginationOptions = { page: 2, pageSize: 5 };

      const result = createPaginatedResponse(data, total, options);

      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle single item per page', () => {
      const data = [{ id: 5 }];
      const total = 100;
      const options: PaginationOptions = { page: 5, pageSize: 1 };

      const result = createPaginatedResponse(data, total, options);

      expect(result.pagination.totalPages).toBe(100);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should handle large page size', () => {
      const data = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
      const total = 50;
      const options: PaginationOptions = { page: 1, pageSize: 100 };

      const result = createPaginatedResponse(data, total, options);

      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should preserve data type in response', () => {
      interface CustomType {
        name: string;
        value: number;
      }
      const data: CustomType[] = [
        { name: 'test1', value: 1 },
        { name: 'test2', value: 2 },
      ];
      const total = 5;
      const options: PaginationOptions = { page: 1, pageSize: 2 };

      const result: PaginatedResponse<CustomType> = createPaginatedResponse(data, total, options);

      expect(result.data[0].name).toBe('test1');
      expect(result.data[0].value).toBe(1);
    });
  });

  // ============================================
  // BatchLoader Tests
  // ============================================
  describe('BatchLoader', () => {
    it('should create instance with default batch size', () => {
      const loader = new BatchLoader();
      expect(loader).toBeInstanceOf(BatchLoader);
    });

    it('should create instance with custom batch size', () => {
      const loader = new BatchLoader(100);
      expect(loader).toBeInstanceOf(BatchLoader);
    });

    it('should load and cache single item', async () => {
      const loader = new BatchLoader();
      const mockLoader = vi.fn().mockResolvedValue(
        new Map([['id1', { name: 'Item 1' }]])
      );

      const result = await loader.load('id1', mockLoader);

      expect(result).toEqual({ name: 'Item 1' });
      expect(mockLoader).toHaveBeenCalledTimes(1);
      expect(mockLoader).toHaveBeenCalledWith(['id1']);
    });

    it('should return cached item on second load', async () => {
      const loader = new BatchLoader();
      const mockLoader = vi.fn().mockResolvedValue(
        new Map([['id1', { name: 'Item 1' }]])
      );

      const result1 = await loader.load('id1', mockLoader);
      const result2 = await loader.load('id1', mockLoader);

      expect(result1).toEqual(result2);
      expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it('should handle pending requests', async () => {
      const loader = new BatchLoader();
      const mockLoader = vi.fn().mockResolvedValue(
        new Map([['id1', { name: 'Item 1' }]])
      );

      const promise1 = loader.load('id1', mockLoader);
      const promise2 = loader.load('id1', mockLoader);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(result2);
      expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it('should cache multiple items from batch loader', async () => {
      const loader = new BatchLoader();
      const mockLoader = vi.fn().mockResolvedValue(
        new Map([
          ['id1', { name: 'Item 1' }],
          ['id2', { name: 'Item 2' }],
        ])
      );

      await loader.load('id1', mockLoader);

      expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it('should handle loader returning null for missing item', async () => {
      const loader = new BatchLoader();
      const mockLoader = vi.fn().mockResolvedValue(new Map());

      const result = await loader.load('missing-id', mockLoader);

      expect(result).toBeUndefined();
    });

    it('should handle loader errors', async () => {
      const loader = new BatchLoader();
      const mockLoader = vi.fn().mockRejectedValue(new Error('Load failed'));

      await expect(loader.load('id1', mockLoader)).rejects.toThrow('Load failed');
    });

    it('should clear pending on error', async () => {
      const loader = new BatchLoader();
      const mockLoader = vi
        .fn()
        .mockRejectedValueOnce(new Error('Load failed'))
        .mockResolvedValueOnce(new Map([['id1', { name: 'Item 1' }]]));

      await expect(loader.load('id1', mockLoader)).rejects.toThrow('Load failed');

      const result = await loader.load('id1', mockLoader);
      expect(result).toEqual({ name: 'Item 1' });
      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    it('should clear cache', async () => {
      const loader = new BatchLoader();
      const mockLoader = vi.fn().mockResolvedValue(
        new Map([['id1', { name: 'Item 1' }]])
      );

      await loader.load('id1', mockLoader);
      loader.clear();

      await loader.load('id1', mockLoader);

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    it('should clear pending requests', () => {
      const loader = new BatchLoader();
      loader.clear();
      expect(loader).toBeInstanceOf(BatchLoader);
    });

    it('should handle different types of items', async () => {
      interface CustomItem {
        id: string;
        data: number[];
      }
      const loader = new BatchLoader<CustomItem>();
      const mockLoader = vi.fn().mockResolvedValue(
        new Map([['id1', { id: 'id1', data: [1, 2, 3] }]])
      );

      const result = await loader.load('id1', mockLoader);

      expect(result).toEqual({ id: 'id1', data: [1, 2, 3] });
    });
  });

  // ============================================
  // VirtualScrollManager Tests
  // ============================================
  describe('VirtualScrollManager', () => {
    it('should create instance with default buffer', () => {
      const manager = new VirtualScrollManager(500, 50);
      expect(manager).toBeInstanceOf(VirtualScrollManager);
    });

    it('should create instance with custom buffer', () => {
      const manager = new VirtualScrollManager(500, 50, 10);
      expect(manager).toBeInstanceOf(VirtualScrollManager);
    });

    it('should calculate visible range at scroll position 0', () => {
      const manager = new VirtualScrollManager(500, 50, 5);

      const result = manager.getVisibleRange(0, 100);

      expect(result.start).toBe(0);
      expect(result.end).toBe(20); // ceil(500/50) + 5*2 = 10 + 10 = 20
      expect(result.offset).toBe(0);
    });

    it('should calculate visible range with scroll position', () => {
      const manager = new VirtualScrollManager(500, 50, 5);

      const result = manager.getVisibleRange(250, 100);

      expect(result.start).toBe(0); // max(0, floor(250/50) - 5) = max(0, 0) = 0
      expect(result.end).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should calculate visible range at middle of list', () => {
      const manager = new VirtualScrollManager(500, 50, 5);

      const result = manager.getVisibleRange(2500, 200);

      expect(result.start).toBe(45); // max(0, floor(2500/50) - 5) = max(0, 45)
      expect(result.end).toBe(65); // min(200, 45 + 10 + 10)
      expect(result.offset).toBe(2250); // 45 * 50
    });

    it('should not exceed total items', () => {
      const manager = new VirtualScrollManager(500, 50, 5);

      const result = manager.getVisibleRange(5000, 50);

      expect(result.end).toBeLessThanOrEqual(50);
    });

    it('should calculate visible range near end of list', () => {
      const manager = new VirtualScrollManager(500, 50, 5);

      const result = manager.getVisibleRange(4500, 100);

      expect(result.start).toBe(85); // max(0, floor(4500/50) - 5) = max(0, 85)
      expect(result.end).toBe(100); // min(100, 85 + 10 + 10)
    });

    it('should handle zero buffer', () => {
      const manager = new VirtualScrollManager(500, 50, 0);

      const result = manager.getVisibleRange(100, 100);

      expect(result.start).toBe(2); // max(0, floor(100/50) - 0) = 2
      expect(result.end).toBe(12); // min(100, 2 + 10 + 0)
    });

    it('should calculate total height', () => {
      const manager = new VirtualScrollManager(500, 50);

      const height = manager.getTotalHeight(100);

      expect(height).toBe(5000); // 100 * 50
    });

    it('should calculate total height for zero items', () => {
      const manager = new VirtualScrollManager(500, 50);

      const height = manager.getTotalHeight(0);

      expect(height).toBe(0);
    });

    it('should handle small item height', () => {
      const manager = new VirtualScrollManager(500, 10, 2);

      const result = manager.getVisibleRange(200, 1000);

      expect(result.start).toBe(18); // max(0, floor(200/10) - 2)
      expect(result.end).toBe(72); // min(1000, 18 + ceil(500/10) + 2*2) = min(1000, 18 + 50 + 4) = 72
    });

    it('should handle large item height', () => {
      const manager = new VirtualScrollManager(500, 200, 1);

      const result = manager.getVisibleRange(600, 100);

      expect(result.start).toBe(2); // max(0, floor(600/200) - 1)
      expect(result.end).toBe(7); // min(100, 2 + ceil(500/200) + 1*2) = min(100, 2 + 3 + 2) = 7
    });
  });

  // ============================================
  // InfiniteScrollManager Tests
  // ============================================
  describe('InfiniteScrollManager', () => {
    it('should create instance with default page size', () => {
      const manager = new InfiniteScrollManager();
      expect(manager).toBeInstanceOf(InfiniteScrollManager);
      expect(manager.getData()).toEqual([]);
      expect(manager.isLoading()).toBe(false);
      expect(manager.canLoadMore()).toBe(true);
    });

    it('should create instance with custom page size', () => {
      const manager = new InfiniteScrollManager(50);
      expect(manager).toBeInstanceOf(InfiniteScrollManager);
    });

    it('should load first page', async () => {
      const manager = new InfiniteScrollManager(10);
      const mockLoader = vi.fn().mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }],
        hasMore: true,
      });

      await manager.loadMore(mockLoader);

      expect(manager.getData()).toEqual([{ id: 1 }, { id: 2 }]);
      expect(mockLoader).toHaveBeenCalledWith(1, 10);
      expect(manager.isLoading()).toBe(false);
      expect(manager.canLoadMore()).toBe(true);
    });

    it('should load multiple pages sequentially', async () => {
      const manager = new InfiniteScrollManager(5);
      const mockLoader = vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ id: 1 }, { id: 2 }],
          hasMore: true,
        })
        .mockResolvedValueOnce({
          data: [{ id: 3 }, { id: 4 }],
          hasMore: true,
        });

      await manager.loadMore(mockLoader);
      await manager.loadMore(mockLoader);

      expect(manager.getData()).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ]);
      expect(mockLoader).toHaveBeenCalledTimes(2);
      expect(mockLoader).toHaveBeenNthCalledWith(1, 1, 5);
      expect(mockLoader).toHaveBeenNthCalledWith(2, 2, 5);
    });

    it('should stop loading when hasMore is false', async () => {
      const manager = new InfiniteScrollManager(10);
      const mockLoader = vi.fn().mockResolvedValue({
        data: [{ id: 1 }],
        hasMore: false,
      });

      await manager.loadMore(mockLoader);
      await manager.loadMore(mockLoader);

      expect(mockLoader).toHaveBeenCalledTimes(1);
      expect(manager.canLoadMore()).toBe(false);
    });

    it('should prevent concurrent loads', async () => {
      const manager = new InfiniteScrollManager(10);
      const mockLoader = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: [{ id: 1 }], hasMore: true });
          }, 100);
        });
      });

      const promise1 = manager.loadMore(mockLoader);
      const promise2 = manager.loadMore(mockLoader);

      // Advance timers to resolve the promises
      vi.advanceTimersByTime(100);

      await Promise.all([promise1, promise2]);

      expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it('should reset to initial state', async () => {
      const manager = new InfiniteScrollManager(10);
      const mockLoader = vi.fn().mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }],
        hasMore: false,
      });

      await manager.loadMore(mockLoader);
      manager.reset();

      expect(manager.getData()).toEqual([]);
      expect(manager.isLoading()).toBe(false);
      expect(manager.canLoadMore()).toBe(true);
    });

    it('should handle loader errors', async () => {
      const manager = new InfiniteScrollManager(10);
      const mockLoader = vi.fn().mockRejectedValue(new Error('Load failed'));

      await expect(manager.loadMore(mockLoader)).rejects.toThrow('Load failed');
      expect(manager.isLoading()).toBe(false);
    });

    it('should set loading state correctly', async () => {
      const manager = new InfiniteScrollManager(10);
      let loadingDuringExecution = false;

      const mockLoader = vi.fn().mockImplementation(async () => {
        loadingDuringExecution = manager.isLoading();
        return { data: [{ id: 1 }], hasMore: true };
      });

      expect(manager.isLoading()).toBe(false);
      await manager.loadMore(mockLoader);
      expect(loadingDuringExecution).toBe(true);
      expect(manager.isLoading()).toBe(false);
    });

    it('should handle empty data pages', async () => {
      const manager = new InfiniteScrollManager(10);
      const mockLoader = vi.fn().mockResolvedValue({
        data: [],
        hasMore: false,
      });

      await manager.loadMore(mockLoader);

      expect(manager.getData()).toEqual([]);
      expect(manager.canLoadMore()).toBe(false);
    });

    it('should preserve all loaded data across multiple loads', async () => {
      const manager = new InfiniteScrollManager(2);
      const mockLoader = vi
        .fn()
        .mockResolvedValueOnce({ data: [1, 2], hasMore: true })
        .mockResolvedValueOnce({ data: [3, 4], hasMore: true })
        .mockResolvedValueOnce({ data: [5], hasMore: false });

      await manager.loadMore(mockLoader);
      await manager.loadMore(mockLoader);
      await manager.loadMore(mockLoader);

      expect(manager.getData()).toEqual([1, 2, 3, 4, 5]);
    });
  });

  // ============================================
  // ProgressiveImageLoader Tests
  // ============================================
  describe('ProgressiveImageLoader', () => {
    let originalWindow: typeof globalThis.window;
    let originalIntersectionObserver: typeof IntersectionObserver;
    let originalDocument: typeof globalThis.document;

    beforeEach(() => {
      originalWindow = globalThis.window;
      originalIntersectionObserver = globalThis.IntersectionObserver;
      originalDocument = globalThis.document;

      // Setup minimal DOM if not available
      if (typeof document === 'undefined') {
        (globalThis as Record<string, unknown>).document = {
          createElement: (tag: string) => ({
            tagName: tag.toUpperCase(),
            dataset: {},
            src: '',
          }),
        };
      }

      // Setup minimal window if not available
      if (typeof window === 'undefined') {
        // @ts-expect-error - Mocking window for tests
        globalThis.window = {};
      }
    });

    afterEach(() => {
      // Restore original window
      if (!originalWindow) {
        delete (globalThis as Record<string, unknown>).window;
      }
      // Restore original document
      if (!originalDocument) {
        delete (globalThis as Record<string, unknown>).document;
      }
      // Restore original IntersectionObserver
      if (originalIntersectionObserver) {
        globalThis.IntersectionObserver = originalIntersectionObserver;
      } else if (globalThis.IntersectionObserver) {
        delete (globalThis as Record<string, unknown>).IntersectionObserver;
      }
    });

    it('should create instance in browser environment', () => {
      const mockObserve = vi.fn();
      const mockUnobserve = vi.fn();
      const mockDisconnect = vi.fn();

      // @ts-expect-error - Mocking IntersectionObserver
      globalThis.IntersectionObserver = vi.fn(() => ({
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
      }));

      const loader = new ProgressiveImageLoader();
      expect(loader).toBeInstanceOf(ProgressiveImageLoader);
    });

    it('should create instance in non-browser environment', () => {
      delete (globalThis as Record<string, unknown>).window;

      const loader = new ProgressiveImageLoader();
      expect(loader).toBeInstanceOf(ProgressiveImageLoader);
    });

    it('should observe image in browser environment', () => {
      const mockObserve = vi.fn();

      const mockObserverConstructor = vi.fn(() => ({
        observe: mockObserve,
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }));

      // @ts-expect-error - Mocking IntersectionObserver
      globalThis.IntersectionObserver = mockObserverConstructor;
      // Also add to window object so the check passes
      // @ts-expect-error - Mocking IntersectionObserver in window
      globalThis.window.IntersectionObserver = mockObserverConstructor;

      const loader = new ProgressiveImageLoader();
      const img = document.createElement('img');
      img.dataset.src = 'test.jpg';

      loader.observe(img);

      expect(mockObserve).toHaveBeenCalledWith(img);
    });

    it('should load image immediately when IntersectionObserver is not available', () => {
      delete (globalThis as Record<string, unknown>).IntersectionObserver;

      const loader = new ProgressiveImageLoader();
      const img = document.createElement('img');
      img.dataset.src = 'fallback.jpg';

      loader.observe(img);

      expect(img.src).toContain('fallback.jpg');
    });

    it('should load image when intersecting', () => {
      let observerCallback: IntersectionObserverCallback | null = null;

      // @ts-expect-error - Mocking IntersectionObserver
      globalThis.IntersectionObserver = vi.fn((callback) => {
        observerCallback = callback;
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        };
      });

      const loader = new ProgressiveImageLoader();
      const img = document.createElement('img');
      img.dataset.src = 'intersecting.jpg';

      loader.observe(img);

      // Simulate intersection
      if (observerCallback) {
        // @ts-expect-error strictNullChecks migration
        observerCallback(
          [
            {
              target: img,
              isIntersecting: true,
            } as unknown as IntersectionObserverEntry,
          ],
          {} as IntersectionObserver
        );
      }

      expect(img.src).toContain('intersecting.jpg');
    });

    it('should not load image when not intersecting', () => {
      let observerCallback: IntersectionObserverCallback | null = null;

      const mockObserverConstructor = vi.fn((callback) => {
        observerCallback = callback;
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        };
      });

      // @ts-expect-error - Mocking IntersectionObserver
      globalThis.IntersectionObserver = mockObserverConstructor;
      // @ts-expect-error - Mocking IntersectionObserver in window
      globalThis.window.IntersectionObserver = mockObserverConstructor;

      const loader = new ProgressiveImageLoader();
      const img = document.createElement('img');
      img.dataset.src = 'not-intersecting.jpg';

      loader.observe(img);

      // Simulate no intersection
      if (observerCallback) {
        // @ts-expect-error strictNullChecks migration
        observerCallback(
          [
            {
              target: img,
              isIntersecting: false,
            } as unknown as IntersectionObserverEntry,
          ],
          {} as IntersectionObserver
        );
      }

      expect(img.src).toBe('');
    });

    it('should not reload already loaded images', () => {
      let observerCallback: IntersectionObserverCallback | null = null;

      // @ts-expect-error - Mocking IntersectionObserver
      globalThis.IntersectionObserver = vi.fn((callback) => {
        observerCallback = callback;
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        };
      });

      const loader = new ProgressiveImageLoader();
      const img = document.createElement('img');
      img.dataset.src = 'same.jpg';

      loader.observe(img);

      // First intersection
      if (observerCallback) {
        // @ts-expect-error strictNullChecks migration
        observerCallback(
          [{ target: img, isIntersecting: true } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }

      const firstSrc = img.src;

      // Second intersection (should not reload)
      if (observerCallback) {
        // @ts-expect-error strictNullChecks migration
        observerCallback(
          [{ target: img, isIntersecting: true } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }

      expect(img.src).toBe(firstSrc);
    });

    it('should unobserve image after loading', () => {
      let observerCallback: IntersectionObserverCallback | null = null;
      const mockUnobserve = vi.fn();

      const mockObserverConstructor = vi.fn((callback) => {
        observerCallback = callback;
        return {
          observe: vi.fn(),
          unobserve: mockUnobserve,
          disconnect: vi.fn(),
        };
      });

      // @ts-expect-error - Mocking IntersectionObserver
      globalThis.IntersectionObserver = mockObserverConstructor;
      // @ts-expect-error - Mocking IntersectionObserver in window
      globalThis.window.IntersectionObserver = mockObserverConstructor;

      const loader = new ProgressiveImageLoader();
      const img = document.createElement('img');
      img.dataset.src = 'unobserve.jpg';

      loader.observe(img);

      if (observerCallback) {
        // @ts-expect-error strictNullChecks migration
        observerCallback(
          [{ target: img, isIntersecting: true } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }

      expect(mockUnobserve).toHaveBeenCalledWith(img);
    });

    it('should disconnect observer', () => {
      const mockDisconnect = vi.fn();
      const mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: mockDisconnect,
      };

      const mockObserverConstructor = vi.fn(() => mockObserver);

      // @ts-expect-error - Mocking IntersectionObserver
      globalThis.IntersectionObserver = mockObserverConstructor;
      // @ts-expect-error - Mocking IntersectionObserver in window
      globalThis.window.IntersectionObserver = mockObserverConstructor;

      const loader = new ProgressiveImageLoader();

      // The observer is created in the constructor, so mockDisconnect is now available
      loader.disconnect();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should handle disconnect without observer', () => {
      delete (globalThis as Record<string, unknown>).IntersectionObserver;

      const loader = new ProgressiveImageLoader();
      expect(() => loader.disconnect()).not.toThrow();
    });

    it('should handle image without data-src attribute', () => {
      let observerCallback: IntersectionObserverCallback | null = null;

      // @ts-expect-error - Mocking IntersectionObserver
      globalThis.IntersectionObserver = vi.fn((callback) => {
        observerCallback = callback;
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        };
      });

      const loader = new ProgressiveImageLoader();
      const img = document.createElement('img');

      loader.observe(img);

      if (observerCallback) {
        // @ts-expect-error strictNullChecks migration
        observerCallback(
          [{ target: img, isIntersecting: true } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }

      expect(img.src).toBe('');
    });
  });

  // ============================================
  // debounce Tests
  // ============================================
  describe('debounce', () => {
    it('should debounce function calls', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 100);

      debounced('arg1');
      debounced('arg2');
      debounced('arg3');

      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });

    it('should reset timer on subsequent calls', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 100);

      debounced('arg1');
      vi.advanceTimersByTime(50);

      debounced('arg2');
      vi.advanceTimersByTime(50);

      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg2');
    });

    it('should handle multiple separate debounce periods', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 100);

      debounced('arg1');
      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');

      debounced('arg2');
      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('arg2');
    });

    it('should handle function with no arguments', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 50);

      debounced();
      vi.advanceTimersByTime(50);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith();
    });

    it('should handle function with multiple arguments', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 100);

      debounced('arg1', 'arg2', 'arg3');
      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should work with zero wait time', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 0);

      debounced('arg1');
      vi.advanceTimersByTime(0);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should preserve function return type', () => {
      const mockFn = vi.fn((x: number) => x * 2);
      const debounced = debounce(mockFn, 100);

      debounced(5);
      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith(5);
    });

    it('should handle rapid successive calls', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 100);

      for (let i = 0; i < 10; i++) {
        debounced(i);
        vi.advanceTimersByTime(10);
      }

      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(9);
    });
  });

  // ============================================
  // throttle Tests
  // ============================================
  describe('throttle', () => {
    it('should throttle function calls', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, 100);

      throttled('arg1');
      throttled('arg2');
      throttled('arg3');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');
    });

    it('should allow call after throttle period', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, 100);

      throttled('arg1');
      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      throttled('arg2');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenNthCalledWith(2, 'arg2');
    });

    it('should ignore calls during throttle period', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, 100);

      throttled('arg1');
      vi.advanceTimersByTime(50);
      throttled('arg2');
      vi.advanceTimersByTime(30);
      throttled('arg3');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');
    });

    it('should handle multiple throttle cycles', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, 100);

      throttled('arg1');
      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttled('arg2');
      expect(mockFn).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(100);
      throttled('arg3');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should handle function with no arguments', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, 50);

      throttled();

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith();
    });

    it('should handle function with multiple arguments', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, 100);

      throttled('arg1', 'arg2', 'arg3');

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should work with zero limit time', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, 0);

      throttled('arg1');
      vi.advanceTimersByTime(0);
      throttled('arg2');

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should preserve function return type', () => {
      const mockFn = vi.fn((x: number) => x * 2);
      const throttled = throttle(mockFn, 100);

      throttled(5);

      expect(mockFn).toHaveBeenCalledWith(5);
    });

    it('should handle rapid successive calls correctly', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, 100);

      for (let i = 0; i < 10; i++) {
        throttled(i);
      }

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(0);

      vi.advanceTimersByTime(100);

      for (let i = 10; i < 20; i++) {
        throttled(i);
      }

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith(10);
    });

    it('should not execute if called only during throttle period', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, 100);

      throttled('first');
      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      throttled('second');
      vi.advanceTimersByTime(40);
      throttled('third');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');
    });
  });
});
