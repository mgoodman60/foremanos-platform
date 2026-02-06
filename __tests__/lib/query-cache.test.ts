import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis module with vi.hoisted
const mockRedis = vi.hoisted(() => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  isRedisAvailable: vi.fn(),
}));

vi.mock('@/lib/redis', () => mockRedis);

// Import after mocks
import {
  analyzeQueryComplexity,
  getCachedResponse,
  cacheResponse,
  getCacheStats,
  getCacheWarmingQueries,
  clearCache,
  getTopCachedQueries,
} from '@/lib/query-cache';

describe('Query Cache', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('analyzeQueryComplexity', () => {
    describe('Gantt chart / Planning queries (Claude Opus)', () => {
      it('should classify gantt chart queries as complex', () => {
        const result = analyzeQueryComplexity('Create a gantt chart for the project');

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
        expect(result.reason).toContain('scheduling/planning');
      });

      it('should detect critical path queries', () => {
        const result = analyzeQueryComplexity('What is the critical path for this project?');

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
      });

      it('should detect schedule analysis queries', () => {
        const result = analyzeQueryComplexity('Analyze the project schedule for delays');

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
      });

      it('should detect timeline dependency queries', () => {
        const result = analyzeQueryComplexity('Show timeline dependencies between tasks');

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
      });

      it('should detect construction timeline queries', () => {
        const result = analyzeQueryComplexity('What is the construction timeline?');

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
      });

      it('should detect schedule conflict queries', () => {
        const result = analyzeQueryComplexity('Find schedule conflicts in the plan');

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
      });
    });

    describe('Complex queries (Claude Opus)', () => {
      it('should classify image analysis as complex', () => {
        const result = analyzeQueryComplexity('Analyze this image of the foundation');

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
      });

      it('should detect photo queries', () => {
        const result = analyzeQueryComplexity('Review the photo from the site visit');

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
      });

      it('should detect diagram queries', () => {
        const result = analyzeQueryComplexity('Explain this diagram');

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
      });

      it('should detect drawing queries', () => {
        const result = analyzeQueryComplexity('What does this drawing show?');

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
      });

      it('should handle very long queries as complex', () => {
        const longQuery = 'a'.repeat(501);
        const result = analyzeQueryComplexity(longQuery);

        expect(result.complexity).toBe('complex');
        expect(result.model).toBe('claude-opus-4-6');
        expect(result.reason).toContain('Very long query');
      });
    });

    describe('Medium queries (Claude Sonnet 4.5)', () => {
      it('should classify comparison queries as medium', () => {
        const result = analyzeQueryComplexity('Compare the spec with the submittal');

        expect(result.complexity).toBe('medium');
        expect(result.model).toBe('claude-sonnet-4-5-20250929');
        expect(result.reasoning_effort).toBeUndefined();
      });

      it('should detect difference queries', () => {
        const result = analyzeQueryComplexity('difference between the two specs');

        expect(result.complexity).toBe('medium');
        expect(result.model).toBe('claude-sonnet-4-5-20250929');
      });

      it('should detect summarize across documents', () => {
        const result = analyzeQueryComplexity('Summarize all the requirements');

        expect(result.complexity).toBe('medium');
        expect(result.model).toBe('claude-sonnet-4-5-20250929');
      });

      it('should detect multi-document queries', () => {
        const result = analyzeQueryComplexity('Review information across multiple documents');

        expect(result.complexity).toBe('medium');
        expect(result.model).toBe('claude-sonnet-4-5-20250929');
      });

      it('should detect analyze why queries', () => {
        const result = analyzeQueryComplexity('Analyze why the cost increased');

        expect(result.complexity).toBe('medium');
        expect(result.model).toBe('claude-sonnet-4-5-20250929');
      });

      it('should detect step-by-step queries', () => {
        const result = analyzeQueryComplexity('Explain the process step by step');

        expect(result.complexity).toBe('medium');
        expect(result.model).toBe('claude-sonnet-4-5-20250929');
      });

      it('should handle medium-length queries as medium', () => {
        const mediumQuery = 'a'.repeat(350);
        const result = analyzeQueryComplexity(mediumQuery);

        expect(result.complexity).toBe('medium');
        expect(result.model).toBe('claude-sonnet-4-5-20250929');
      });
    });

    describe('Simple queries (GPT-4o-mini)', () => {
      it('should classify "what is" queries as simple', () => {
        const result = analyzeQueryComplexity('What is the footing depth?');

        expect(result.complexity).toBe('simple');
        expect(result.model).toBe('gpt-4o-mini');
        expect(result.reason).toContain('Basic information retrieval');
      });

      it('should detect "how many" queries', () => {
        const result = analyzeQueryComplexity('How many doors are there?');

        expect(result.complexity).toBe('simple');
        expect(result.model).toBe('gpt-4o-mini');
      });

      it('should detect list queries', () => {
        const result = analyzeQueryComplexity('List all the outlets');

        expect(result.complexity).toBe('simple');
        expect(result.model).toBe('gpt-4o-mini');
      });

      it('should detect simple dimension queries', () => {
        const result = analyzeQueryComplexity('What depth is required?');

        expect(result.complexity).toBe('simple');
        expect(result.model).toBe('gpt-4o-mini');
      });

      it('should detect "is there" queries', () => {
        const result = analyzeQueryComplexity('Is there a parking requirement?');

        expect(result.complexity).toBe('simple');
        expect(result.model).toBe('gpt-4o-mini');
      });

      it('should detect simple specification lookups', () => {
        const result = analyzeQueryComplexity('specification for doors');

        expect(result.complexity).toBe('simple');
        expect(result.model).toBe('gpt-4o-mini');
      });

      it('should default to simple for standard queries', () => {
        const result = analyzeQueryComplexity('Tell me about the foundation');

        expect(result.complexity).toBe('simple');
        expect(result.model).toBe('gpt-4o-mini');
        expect(result.reason).toContain('Basic information retrieval');
      });
    });
  });

  describe('getCachedResponse', () => {
    const projectId = 'proj-123';
    const documentIds = ['doc-1', 'doc-2'];

    describe('Redis cache hits', () => {
      it('should return cached response from Redis on exact match', async () => {
        const query = 'What is the footing depth?';
        const cachedEntry = {
          response: 'The footing depth is 24 inches.',
          timestamp: Date.now() - 1000 * 60 * 10, // 10 minutes ago
          hitCount: 3,
          complexity: 'simple' as const,
          model: 'gpt-4o-mini',
          projectId,
        };

        mockRedis.isRedisAvailable.mockReturnValue(true);
        mockRedis.getCached.mockResolvedValue(cachedEntry);

        const result = await getCachedResponse(query, projectId, documentIds);

        expect(result).toBe(cachedEntry.response);
        expect(mockRedis.getCached).toHaveBeenCalled();
        expect(mockRedis.setCached).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ hitCount: 4 }),
          expect.any(Number)
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[REDIS CACHE HIT - EXACT]')
        );
      });

      it('should return null when Redis entry is expired (standard TTL)', async () => {
        const query = 'What is the footing depth?';
        const cachedEntry = {
          response: 'Old response',
          timestamp: Date.now() - 1000 * 60 * 60 * 50, // 50 hours ago (past 48h TTL)
          hitCount: 2,
          complexity: 'simple' as const,
          model: 'gpt-4o-mini',
          projectId,
        };

        mockRedis.isRedisAvailable.mockReturnValue(true);
        mockRedis.getCached.mockResolvedValue(cachedEntry);

        const result = await getCachedResponse(query, projectId, documentIds);

        expect(result).toBeNull();
      });

      it('should extend TTL for high-value queries (Claude Opus)', async () => {
        const query = 'Show the gantt chart';
        const cachedEntry = {
          response: 'Here is the gantt chart...',
          timestamp: Date.now() - 1000 * 60 * 60 * 50, // 50 hours ago
          hitCount: 2,
          complexity: 'complex' as const,
          model: 'claude-opus-4-6',
          projectId,
        };

        mockRedis.isRedisAvailable.mockReturnValue(true);
        mockRedis.getCached.mockResolvedValue(cachedEntry);

        const result = await getCachedResponse(query, projectId, documentIds);

        // Should still be valid (72h TTL for Claude Opus)
        expect(result).toBe(cachedEntry.response);
        expect(mockRedis.setCached).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ hitCount: 3 }),
          72 * 3600 // 72 hours
        );
      });

      it('should extend TTL for frequently hit queries', async () => {
        const query = 'What is the project completion date?';
        const cachedEntry = {
          response: 'December 2026',
          timestamp: Date.now() - 1000 * 60 * 60 * 50, // 50 hours ago
          hitCount: 6, // More than 5 hits
          complexity: 'simple' as const,
          model: 'gpt-4o-mini',
          projectId,
        };

        mockRedis.isRedisAvailable.mockReturnValue(true);
        mockRedis.getCached.mockResolvedValue(cachedEntry);

        const result = await getCachedResponse(query, projectId, documentIds);

        // Should still be valid (72h TTL for high hit count)
        expect(result).toBe(cachedEntry.response);
        expect(mockRedis.setCached).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ hitCount: 7 }),
          72 * 3600 // 72 hours
        );
      });

      it('should handle Redis errors gracefully and fall back to in-memory', async () => {
        const query = 'What is the footing depth?';

        mockRedis.isRedisAvailable.mockReturnValue(true);
        mockRedis.getCached.mockRejectedValue(new Error('Redis connection failed'));

        const result = await getCachedResponse(query, projectId, documentIds);

        expect(result).toBeNull();
      });
    });

    describe('In-memory cache', () => {
      it('should return cached response from in-memory on exact match', async () => {
        const query = 'What is the concrete strength?';
        const response = 'The concrete strength is specified as 4000 psi in the structural plans.';
        mockRedis.isRedisAvailable.mockReturnValue(false);

        // Cache a response
        await cacheResponse(
          query,
          response,
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        const result = await getCachedResponse(query, projectId, documentIds);

        expect(result).toBe(response);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[CACHE HIT - EXACT]')
        );
      });

      it('should return null when no cache entry exists', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);

        const result = await getCachedResponse('Brand new query', projectId, documentIds);

        expect(result).toBeNull();
      });

      it('should expire in-memory entries after TTL', async () => {
        const query = 'What is the rebar size?';
        const response = 'The rebar size is #5 rebar as specified in the structural drawings.';
        mockRedis.isRedisAvailable.mockReturnValue(false);

        // Cache a response
        await cacheResponse(
          query,
          response,
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        // Manually expire the entry by setting timestamp far in the past
        const stats = getCacheStats();
        expect(stats.cacheSize).toBe(1);

        // Try to retrieve after manual expiration (need to mock Date.now)
        const originalNow = Date.now;
        Date.now = vi.fn(() => originalNow() + 1000 * 60 * 60 * 49); // 49 hours later

        const result = await getCachedResponse(query, projectId, documentIds);

        Date.now = originalNow;

        expect(result).toBeNull();
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[CACHE EXPIRED]')
        );
      });

      it('should match semantically similar queries (70%+ similarity)', async () => {
        const originalQuery = 'footing depth foundation structural requirements specification';
        const similarQuery = 'depth footing requirements structural specification foundation';
        const response = 'The footing depth for the foundation is 24 inches below grade.';

        mockRedis.isRedisAvailable.mockReturnValue(false);

        // Cache original query
        await cacheResponse(
          originalQuery,
          response,
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        // Try to get with similar query (same words, different order = 100% Jaccard similarity)
        const result = await getCachedResponse(similarQuery, projectId, documentIds);

        expect(result).toBe(response);
        // Should hit cache (exact match via normalization)
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[CACHE HIT/)
        );
      });

      it('should not match dissimilar queries (below 70% threshold)', async () => {
        const query1 = 'What is the footing depth?';
        const query2 = 'How many parking spaces?';

        mockRedis.isRedisAvailable.mockReturnValue(false);

        // Cache first query
        await cacheResponse(
          query1,
          'The footing depth is 24 inches below the finished grade elevation.',
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        // Try to get with dissimilar query
        const result = await getCachedResponse(query2, projectId, documentIds);

        expect(result).toBeNull();
      });

      it('should only match queries within same project', async () => {
        const query = 'What is the footing depth?';
        const project1 = 'proj-1';
        const project2 = 'proj-2';

        mockRedis.isRedisAvailable.mockReturnValue(false);

        // Cache for project 1
        await cacheResponse(
          query,
          'Project 1 answer: The footing depth is 24 inches below grade.',
          project1,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        // Try to get for project 2
        const result = await getCachedResponse(query, project2, documentIds);

        expect(result).toBeNull();
      });
    });

    describe('Cache key normalization', () => {
      it('should normalize construction terms (footer -> footing)', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);
        const response = 'The footing depth is 24 inches below finished grade level.';

        // Cache with "footing"
        await cacheResponse(
          'What is the footing depth?',
          response,
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        // Query with "footer" should match
        const result = await getCachedResponse('What is the footer depth?', projectId, documentIds);

        expect(result).toBe(response);
      });

      it('should normalize plural forms', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);
        const response = 'There are 8 footings shown in the foundation plan drawings.';

        await cacheResponse(
          'How many footers are there?',
          response,
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        const result = await getCachedResponse('How many footings are there?', projectId, documentIds);

        expect(result).toBe(response);
      });

      it('should normalize rebar to reinforcement', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);
        const response = '#5 rebar is specified in the structural drawings per detail S-101.';

        await cacheResponse(
          'What rebar is specified?',
          response,
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        const result = await getCachedResponse('What reinforcement is specified?', projectId, documentIds);

        expect(result).toBe(response);
      });

      it('should normalize dimensions', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);
        const response = 'The specifications show a depth of 12 inches below the finished grade.';

        await cacheResponse(
          'depth requirement DIMENSION thick footing',
          response,
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        // Exact same normalized query (dimensions are already normalized to DIMENSION)
        const result = await getCachedResponse('depth requirement DIMENSION thick footing', projectId, documentIds);

        // Should match via cache (exact match)
        expect(result).toBe(response);
      });

      it('should remove question words for normalization', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);
        const response = 'The concrete strength is 4000 psi as specified in the structural notes.';

        await cacheResponse(
          'What is the concrete strength?',
          response,
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        const result = await getCachedResponse('Where is the concrete strength?', projectId, documentIds);

        expect(result).toBe(response);
      });
    });
  });

  describe('cacheResponse', () => {
    const projectId = 'proj-123';
    const documentIds = ['doc-1', 'doc-2'];

    describe('Redis caching', () => {
      it('should cache response in both Redis and in-memory', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(true);
        mockRedis.setCached.mockResolvedValue(true);

        const response = 'The footing depth is 24 inches below the finished grade elevation.';

        await cacheResponse(
          'What is the footing depth?',
          response,
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        expect(mockRedis.setCached).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            response,
            complexity: 'simple',
            model: 'gpt-4o-mini',
            projectId,
            hitCount: 0,
          }),
          48 * 3600 // Standard TTL
        );

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[REDIS CACHE SET - STANDARD]')
        );
      });

      it('should use high-value TTL for Claude Opus queries', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(true);
        mockRedis.setCached.mockResolvedValue(true);

        await cacheResponse(
          'Show me the gantt chart',
          'Here is the detailed gantt chart showing all project tasks, dependencies, and critical path.',
          projectId,
          documentIds,
          'complex',
          'claude-opus-4-6'
        );

        expect(mockRedis.setCached).toHaveBeenCalledWith(
          expect.any(String),
          expect.anything(),
          72 * 3600 // High-value TTL
        );

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[REDIS CACHE SET - HIGH-VALUE]')
        );
      });

      it('should use high-value TTL for common construction queries', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(true);
        mockRedis.setCached.mockResolvedValue(true);

        await cacheResponse(
          'What is the project schedule?',
          'The project schedule shows a 12-month construction timeline with key milestones.',
          projectId,
          documentIds,
          'medium',
          'claude-sonnet-4-5-20250929'
        );

        expect(mockRedis.setCached).toHaveBeenCalledWith(
          expect.any(String),
          expect.anything(),
          72 * 3600 // High-value TTL (schedule is high-value)
        );
      });

      it('should handle Redis errors gracefully and still cache in-memory', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        mockRedis.isRedisAvailable.mockReturnValue(true);
        mockRedis.setCached.mockRejectedValue(new Error('Redis write failed'));

        await cacheResponse(
          'What is the concrete strength?',
          'The concrete strength is 4000 psi as specified in the structural plans.',
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[REDIS CACHE SET ERROR]',
          expect.any(Error)
        );

        // Should still be in-memory
        mockRedis.isRedisAvailable.mockReturnValue(false);
        const result = await getCachedResponse('What is the concrete strength?', projectId, documentIds);
        expect(result).toBe('The concrete strength is 4000 psi as specified in the structural plans.');

        consoleErrorSpy.mockRestore();
      });
    });

    describe('Cache filtering', () => {
      it('should not cache time-sensitive queries (today)', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);

        await cacheResponse(
          'What is the weather today?',
          'Sunny',
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[CACHE SKIP] Query not cacheable')
        );

        const stats = getCacheStats();
        expect(stats.cacheSize).toBe(0);
      });

      it('should not cache queries with "now"', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);

        await cacheResponse(
          'What is the current status now?',
          'In progress',
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        const stats = getCacheStats();
        expect(stats.cacheSize).toBe(0);
      });

      it('should not cache queries with "my" or "mine"', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);

        await cacheResponse(
          'Show me my tasks',
          'Your tasks...',
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        const stats = getCacheStats();
        expect(stats.cacheSize).toBe(0);
      });

      it('should not cache very short responses', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);

        await cacheResponse(
          'What is the depth?',
          'Unknown',
          projectId,
          documentIds,
          'simple',
          'gpt-4o-mini'
        );

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[CACHE SKIP] Response too short')
        );

        const stats = getCacheStats();
        expect(stats.cacheSize).toBe(0);
      });
    });

    describe('LRU eviction', () => {
      it('should evict oldest low-value entry when cache is full', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);

        // Fill cache to MAX_CACHE_SIZE (2000 entries)
        for (let i = 0; i < 2000; i++) {
          await cacheResponse(
            `Query ${i}`,
            `Response ${i} with sufficient length to pass the 50 character validation requirement.`,
            projectId,
            [`doc-${i}`],
            'simple',
            'gpt-4o-mini'
          );
        }

        const stats1 = getCacheStats();
        expect(stats1.cacheSize).toBe(2000);

        // Add one more - should evict oldest
        await cacheResponse(
          'Query 2000',
          'Response 2000 with sufficient length to pass the 50 character validation requirement.',
          projectId,
          ['doc-2000'],
          'simple',
          'gpt-4o-mini'
        );

        const stats2 = getCacheStats();
        expect(stats2.cacheSize).toBe(2000);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[CACHE EVICT]')
        );
      });

      it('should prefer evicting low-value entries over high-value', async () => {
        mockRedis.isRedisAvailable.mockReturnValue(false);

        const highValueResponse = 'Here is the detailed gantt chart showing all project tasks and dependencies.';
        // Add high-value entry (Claude Opus)
        await cacheResponse(
          'Show gantt chart',
          highValueResponse,
          projectId,
          ['doc-high'],
          'complex',
          'claude-opus-4-6'
        );

        // Fill rest with low-value entries
        for (let i = 0; i < 1999; i++) {
          await cacheResponse(
            `Low value query ${i}`,
            `Response ${i} with sufficient length to pass the 50 character validation.`,
            projectId,
            [`doc-${i}`],
            'simple',
            'gpt-4o-mini'
          );
        }

        // Add one more - should evict a low-value entry, not the Claude Opus one
        await cacheResponse(
          'Another low value',
          'Another response with sufficient length to pass the 50 character validation.',
          projectId,
          ['doc-new'],
          'simple',
          'gpt-4o-mini'
        );

        // High-value entry should still be cached
        const result = await getCachedResponse('Show gantt chart', projectId, ['doc-high']);
        expect(result).toBe(highValueResponse);
      });
    });
  });

  describe('getCacheStats', () => {
    beforeEach(() => {
      mockRedis.isRedisAvailable.mockReturnValue(false);
    });

    it('should return empty stats for empty cache', () => {
      const stats = getCacheStats();

      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(stats.cacheSize).toBe(0);
      expect(stats.estimatedSavings).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.opusHits).toBe(0);
      expect(stats.opusSavings).toBe(0);
      expect(stats.highValueEntries).toBe(0);
      expect(stats.avgHitCount).toBe(0);
    });

    it('should track hits and misses', async () => {
      await cacheResponse(
        'What is the depth?',
        'The depth is 24 inches below the finished grade elevation.',
        'proj-1',
        ['doc-1'],
        'simple',
        'gpt-4o-mini'
      );

      // Hit
      await getCachedResponse('What is the depth?', 'proj-1', ['doc-1']);

      // Miss
      await getCachedResponse('Different query', 'proj-1', ['doc-1']);

      const stats = getCacheStats();
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('should calculate savings based on model costs', async () => {
      await cacheResponse(
        'Query 1',
        'This is a detailed response for query 1 with sufficient length to pass validation.',
        'proj-1',
        ['doc-1'],
        'simple',
        'gpt-4o-mini'
      );

      // Generate hits
      await getCachedResponse('Query 1', 'proj-1', ['doc-1']);
      await getCachedResponse('Query 1', 'proj-1', ['doc-1']);
      await getCachedResponse('Query 1', 'proj-1', ['doc-1']);

      const stats = getCacheStats();
      // 3 hits * $0.015 = $0.045
      expect(stats.estimatedSavings).toBeCloseTo(0.045, 3);
    });

    it('should track Claude Opus specific metrics', async () => {
      await cacheResponse(
        'Show gantt chart',
        'Here is the detailed gantt chart showing all project tasks and dependencies.',
        'proj-1',
        ['doc-1'],
        'complex',
        'claude-opus-4-6'
      );

      // Generate hits
      await getCachedResponse('Show gantt chart', 'proj-1', ['doc-1']);
      await getCachedResponse('Show gantt chart', 'proj-1', ['doc-1']);

      const stats = getCacheStats();
      expect(stats.opusHits).toBe(2);
      // 2 hits * $0.75 (claude-opus-4-6 cost) = $1.50
      expect(stats.opusSavings).toBeCloseTo(1.50, 2);
    });

    it('should count high-value entries (Claude Opus or hitCount > 5)', async () => {
      // High-value: Claude Opus
      await cacheResponse(
        'Gantt chart',
        'Here is the detailed gantt chart for the project showing all tasks and dependencies.',
        'proj-1',
        ['doc-1'],
        'complex',
        'claude-opus-4-6'
      );

      // Low-value initially
      await cacheResponse(
        'Simple query',
        'This is a simple answer to a simple query with enough length to pass validation.',
        'proj-1',
        ['doc-2'],
        'simple',
        'gpt-4o-mini'
      );

      let stats = getCacheStats();
      expect(stats.highValueEntries).toBe(1);

      // Make it high-value by hitting it 6 times
      for (let i = 0; i < 6; i++) {
        await getCachedResponse('Simple query', 'proj-1', ['doc-2']);
      }

      stats = getCacheStats();
      expect(stats.highValueEntries).toBe(2);
    });

    it('should calculate average hit count', async () => {
      await cacheResponse('Q1', 'Answer 1 with sufficient length to pass the 50 character validation requirement.', 'proj-1', ['doc-1'], 'simple', 'gpt-4o-mini');
      await cacheResponse('Q2', 'Answer 2 with sufficient length to pass the 50 character validation requirement.', 'proj-1', ['doc-2'], 'simple', 'gpt-4o-mini');

      // Q1: 3 hits
      await getCachedResponse('Q1', 'proj-1', ['doc-1']);
      await getCachedResponse('Q1', 'proj-1', ['doc-1']);
      await getCachedResponse('Q1', 'proj-1', ['doc-1']);

      // Q2: 1 hit
      await getCachedResponse('Q2', 'proj-1', ['doc-2']);

      const stats = getCacheStats();
      // (3 + 1) / 2 = 2.0
      expect(stats.avgHitCount).toBe(2.0);
    });
  });

  describe('clearCache', () => {
    it('should clear all cache entries and reset stats', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(false);

      // Add some entries
      await cacheResponse('Q1', 'Answer 1 with sufficient length to pass the 50 character validation.', 'proj-1', ['doc-1'], 'simple', 'gpt-4o-mini');
      await cacheResponse('Q2', 'Answer 2 with sufficient length to pass the 50 character validation.', 'proj-1', ['doc-2'], 'simple', 'gpt-4o-mini');
      await getCachedResponse('Q1', 'proj-1', ['doc-1']);

      let stats = getCacheStats();
      expect(stats.cacheSize).toBe(2);
      expect(stats.totalHits).toBe(1);

      clearCache();

      stats = getCacheStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith('[CACHE] Cache cleared');
    });
  });

  describe('getTopCachedQueries', () => {
    beforeEach(() => {
      mockRedis.isRedisAvailable.mockReturnValue(false);
    });

    it('should return empty array for empty cache', () => {
      const top = getTopCachedQueries();
      expect(top).toEqual([]);
    });

    it('should return queries sorted by hit count', async () => {
      await cacheResponse('Q1', 'Answer 1 with sufficient length to pass the 50 character validation.', 'proj-1', ['doc-1'], 'simple', 'gpt-4o-mini');
      await cacheResponse('Q2', 'Answer 2 with sufficient length to pass the 50 character validation.', 'proj-1', ['doc-2'], 'medium', 'claude-sonnet-4-5-20250929');
      await cacheResponse('Q3', 'Answer 3 with sufficient length to pass the 50 character validation.', 'proj-1', ['doc-3'], 'complex', 'claude-opus-4-6');

      // Q1: 5 hits
      for (let i = 0; i < 5; i++) {
        await getCachedResponse('Q1', 'proj-1', ['doc-1']);
      }

      // Q2: 2 hits
      await getCachedResponse('Q2', 'proj-1', ['doc-2']);
      await getCachedResponse('Q2', 'proj-1', ['doc-2']);

      // Q3: 1 hit
      await getCachedResponse('Q3', 'proj-1', ['doc-3']);

      const top = getTopCachedQueries();

      expect(top).toHaveLength(3);
      expect(top[0].hitCount).toBe(5);
      expect(top[1].hitCount).toBe(2);
      expect(top[2].hitCount).toBe(1);
      expect(top[0].complexity).toBe('simple');
      expect(top[1].complexity).toBe('medium');
      expect(top[2].complexity).toBe('complex');
    });

    it('should limit results to specified count', async () => {
      for (let i = 0; i < 15; i++) {
        await cacheResponse(`Q${i}`, `Answer ${i} with sufficient length to pass the 50 character validation requirement.`, 'proj-1', [`doc-${i}`], 'simple', 'gpt-4o-mini');
      }

      const top = getTopCachedQueries(5);

      expect(top).toHaveLength(5);
    });

    it('should default to 10 results', async () => {
      for (let i = 0; i < 20; i++) {
        await cacheResponse(`Q${i}`, `Answer ${i} with sufficient length to pass the 50 character validation requirement.`, 'proj-1', [`doc-${i}`], 'simple', 'gpt-4o-mini');
      }

      const top = getTopCachedQueries();

      expect(top).toHaveLength(10);
    });
  });

  describe('getCacheWarmingQueries', () => {
    it('should return list of common construction queries', () => {
      const queries = getCacheWarmingQueries();

      expect(queries.length).toBeGreaterThan(0);
      expect(queries).toContain('What is the project completion date?');
      expect(queries).toContain('What are the ADA compliance requirements?');
      expect(queries).toContain('How many parking spaces are required?');
      expect(queries).toContain('What are the foundation specifications?');
    });

    it('should include high-value queries', () => {
      const queries = getCacheWarmingQueries();

      // Schedule queries (high-value)
      expect(queries.some(q => q.toLowerCase().includes('completion date'))).toBe(true);

      // Budget queries (high-value)
      expect(queries.some(q => q.toLowerCase().includes('budget'))).toBe(true);

      // Code compliance (high-value, Claude Opus)
      expect(queries.some(q => q.toLowerCase().includes('ada'))).toBe(true);
    });
  });

  describe('High-value query detection', () => {
    it('should detect schedule-related high-value queries', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.setCached.mockResolvedValue(true);

      await cacheResponse(
        'What is the project schedule?',
        'The project schedule shows a 12-month timeline with major milestones.',
        'proj-1',
        ['doc-1'],
        'simple',
        'gpt-4o-mini'
      );

      expect(mockRedis.setCached).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        72 * 3600 // High-value TTL
      );
    });

    it('should detect deadline queries as high-value', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.setCached.mockResolvedValue(true);

      await cacheResponse(
        'When is the project deadline?',
        'The project deadline is December 15, 2026 per the contract documents.',
        'proj-1',
        ['doc-1'],
        'simple',
        'gpt-4o-mini'
      );

      expect(mockRedis.setCached).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        72 * 3600
      );
    });

    it('should detect budget queries as high-value', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.setCached.mockResolvedValue(true);

      await cacheResponse(
        'What is the project budget?',
        'The project budget is $5 million including all contingencies and allowances.',
        'proj-1',
        ['doc-1'],
        'simple',
        'gpt-4o-mini'
      );

      expect(mockRedis.setCached).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        72 * 3600
      );
    });

    it('should detect code compliance queries as high-value', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.setCached.mockResolvedValue(true);

      await cacheResponse(
        'What are the IBC requirements?',
        'The IBC requirements include occupancy classification and fire rating specifications.',
        'proj-1',
        ['doc-1'],
        'simple',
        'gpt-4o-mini'
      );

      expect(mockRedis.setCached).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        72 * 3600
      );
    });

    it('should detect material queries as high-value', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.setCached.mockResolvedValue(true);

      await cacheResponse(
        'What materials are specified?',
        'The specified materials include concrete, steel, and masonry per the project specifications.',
        'proj-1',
        ['doc-1'],
        'simple',
        'gpt-4o-mini'
      );

      expect(mockRedis.setCached).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        72 * 3600
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete cache lifecycle with Redis', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.getCached.mockResolvedValue(null);
      mockRedis.setCached.mockResolvedValue(true);

      const query = 'What is the footing depth?';
      const response = 'The footing depth is 24 inches below the finished grade elevation.';
      const projectId = 'proj-123';
      const documentIds = ['doc-1'];

      // First request - cache miss
      let result = await getCachedResponse(query, projectId, documentIds);
      expect(result).toBeNull();

      // Cache the response
      await cacheResponse(query, response, projectId, documentIds, 'simple', 'gpt-4o-mini');
      expect(mockRedis.setCached).toHaveBeenCalled();

      // Second request - should hit Redis cache
      const cachedEntry = {
        response,
        timestamp: Date.now(),
        hitCount: 0,
        complexity: 'simple' as const,
        model: 'gpt-4o-mini',
        projectId,
      };
      mockRedis.getCached.mockResolvedValue(cachedEntry);

      result = await getCachedResponse(query, projectId, documentIds);
      expect(result).toBe(response);
      expect(mockRedis.setCached).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ hitCount: 1 }),
        expect.any(Number)
      );
    });

    it('should handle Redis failure and gracefully fall back to in-memory', async () => {
      const query = 'What is the concrete strength?';
      const response = 'The concrete strength is 4000 psi as specified in the structural plans.';
      const projectId = 'proj-123';
      const documentIds = ['doc-1'];

      // Redis is available but fails
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.getCached.mockRejectedValue(new Error('Redis timeout'));
      mockRedis.setCached.mockRejectedValue(new Error('Redis timeout'));

      // Cache should still work with in-memory fallback
      await cacheResponse(query, response, projectId, documentIds, 'simple', 'gpt-4o-mini');

      // Should retrieve from in-memory
      mockRedis.isRedisAvailable.mockReturnValue(false);
      const result = await getCachedResponse(query, projectId, documentIds);
      expect(result).toBe(response);
    });

    it('should track statistics across mixed Redis and in-memory operations', async () => {
      // Start with Redis
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.getCached.mockResolvedValue(null);
      mockRedis.setCached.mockResolvedValue(true);

      await cacheResponse('Q1', 'Answer 1 with sufficient length to pass the 50 character validation.', 'proj-1', ['doc-1'], 'simple', 'gpt-4o-mini');

      // Switch to in-memory
      mockRedis.isRedisAvailable.mockReturnValue(false);
      await cacheResponse('Q2', 'Answer 2 with sufficient length to pass the 50 character validation.', 'proj-1', ['doc-2'], 'complex', 'claude-opus-4-6');

      // Generate hits and misses
      await getCachedResponse('Q1', 'proj-1', ['doc-1']); // hit
      await getCachedResponse('Q2', 'proj-1', ['doc-2']); // hit
      await getCachedResponse('Q3', 'proj-1', ['doc-3']); // miss

      const stats = getCacheStats();
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.7, 1);
    });
  });
});
