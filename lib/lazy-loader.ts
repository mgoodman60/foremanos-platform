/**
 * Lazy Loading System
 * Implements pagination, virtual scrolling, and progressive data loading
 * for large datasets (documents, rooms, materials, MEP equipment)
 */

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface InfiniteScrollOptions {
  initialLoad: number;
  incrementalLoad: number;
  threshold: number; // Pixels from bottom to trigger load
}

/**
 * Create pagination parameters from options
 */
export function createPaginationParams(
  options: PaginationOptions
): { skip: number; take: number; orderBy?: any } {
  const skip = (options.page - 1) * options.pageSize;
  const take = options.pageSize;

  const orderBy = options.sortBy
    ? { [options.sortBy]: options.sortOrder || 'asc' }
    : undefined;

  return { skip, take, orderBy };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  options: PaginationOptions
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / options.pageSize);
  const hasMore = options.page < totalPages;

  return {
    data,
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages,
      hasMore
    }
  };
}

/**
 * Batch loader for efficient data fetching
 */
export class BatchLoader<T> {
  private batchSize: number;
  private cache: Map<string, T>;
  private pending: Map<string, Promise<T>>;

  constructor(batchSize: number = 50) {
    this.batchSize = batchSize;
    this.cache = new Map();
    this.pending = new Map();
  }

  /**
   * Load a single item (with batching)
   */
  async load(
    id: string,
    loader: (ids: string[]) => Promise<Map<string, T>>
  ): Promise<T | null> {
    // Check cache
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // Check if already pending
    if (this.pending.has(id)) {
      return this.pending.get(id)!;
    }

    // Create batched load
    const promise = this.batchLoad([id], loader);
    this.pending.set(id, promise);

    try {
      const result = await promise;
      this.pending.delete(id);
      return result;
    } catch (error) {
      this.pending.delete(id);
      throw error;
    }
  }

  /**
   * Load multiple items in batch
   */
  private async batchLoad(
    ids: string[],
    loader: (ids: string[]) => Promise<Map<string, T>>
  ): Promise<T> {
    const results = await loader(ids);

    // Cache all results
    for (const [id, value] of results.entries()) {
      this.cache.set(id, value);
    }

    return results.get(ids[0])!;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }
}

/**
 * Virtual scroll helper for large lists
 */
export class VirtualScrollManager {
  private containerHeight: number;
  private itemHeight: number;
  private buffer: number;

  constructor(containerHeight: number, itemHeight: number, buffer: number = 5) {
    this.containerHeight = containerHeight;
    this.itemHeight = itemHeight;
    this.buffer = buffer;
  }

  /**
   * Calculate visible range based on scroll position
   */
  getVisibleRange(
    scrollTop: number,
    totalItems: number
  ): { start: number; end: number; offset: number } {
    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
    const visibleItems = Math.ceil(this.containerHeight / this.itemHeight);
    const end = Math.min(totalItems, start + visibleItems + this.buffer * 2);
    const offset = start * this.itemHeight;

    return { start, end, offset };
  }

  /**
   * Calculate total scroll height
   */
  getTotalHeight(totalItems: number): number {
    return totalItems * this.itemHeight;
  }
}

/**
 * Infinite scroll hook data manager
 */
export class InfiniteScrollManager<T> {
  private data: T[];
  private currentPage: number;
  private pageSize: number;
  private hasMore: boolean;
  private loading: boolean;

  constructor(pageSize: number = 20) {
    this.data = [];
    this.currentPage = 1;
    this.pageSize = pageSize;
    this.hasMore = true;
    this.loading = false;
  }

  /**
   * Load next page
   */
  async loadMore(
    loader: (page: number, pageSize: number) => Promise<{ data: T[]; hasMore: boolean }>
  ): Promise<void> {
    if (this.loading || !this.hasMore) {
      return;
    }

    this.loading = true;

    try {
      const result = await loader(this.currentPage, this.pageSize);
      this.data.push(...result.data);
      this.hasMore = result.hasMore;
      this.currentPage++;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.data = [];
    this.currentPage = 1;
    this.hasMore = true;
    this.loading = false;
  }

  /**
   * Get current data
   */
  getData(): T[] {
    return this.data;
  }

  /**
   * Check if loading
   */
  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Check if more data available
   */
  canLoadMore(): boolean {
    return this.hasMore && !this.loading;
  }
}

/**
 * Progressive image loader
 */
export class ProgressiveImageLoader {
  private observer: IntersectionObserver | null = null;
  private loadedImages: Set<string>;

  constructor() {
    this.loadedImages = new Set();

    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.loadImage(entry.target as HTMLImageElement);
            }
          });
        },
        {
          rootMargin: '50px'
        }
      );
    }
  }

  /**
   * Observe an image element
   */
  observe(img: HTMLImageElement): void {
    if (this.observer) {
      this.observer.observe(img);
    } else {
      // Fallback for browsers without IntersectionObserver
      this.loadImage(img);
    }
  }

  /**
   * Load an image
   */
  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    if (src && !this.loadedImages.has(src)) {
      img.src = src;
      this.loadedImages.add(src);
      if (this.observer) {
        this.observer.unobserve(img);
      }
    }
  }

  /**
   * Disconnect observer
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

/**
 * Debounce helper for search/filter inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle helper for scroll events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
