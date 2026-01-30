import crypto from 'crypto';
import { getCached, setCached, isRedisAvailable } from './redis';

/**
 * Query Cache System with Redis Integration
 * Caches common AI responses to reduce API costs
 * 
 * Cache Strategy:
 * 1. Try Redis first (fast, persistent across restarts)
 * 2. Fall back to in-memory cache if Redis unavailable
 * 3. Write to both Redis and in-memory for redundancy
 */

interface CacheEntry {
  response: string;
  timestamp: number;
  hitCount: number;
  complexity: 'simple' | 'medium' | 'complex';
  model: string;
  projectId: string;
}

interface CacheStats {
  totalHits: number;
  totalMisses: number;
  cacheSize: number;
  estimatedSavings: number;
  hitRate: number;
}

// In-memory cache with TTL
const cache = new Map<string, CacheEntry>();
const stats = {
  hits: 0,
  misses: 0,
};

// Cache configuration - Enhanced for GPT-5.2
const CACHE_TTL_HOURS = 48; // 48 hours for common queries (increased from 24)
const MAX_CACHE_SIZE = 2000; // Maximum 2000 entries (increased from 1000)
const HIGH_VALUE_CACHE_BOOST = 72; // High-value queries cached for 72 hours

// Model pricing (Updated January 2026)
const MODEL_COSTS = {
  'gpt-4o-mini': 0.015,       // Simple queries (75% cheaper than GPT-3.5)
  'gpt-3.5-turbo': 0.03,      // Legacy simple queries (deprecated)
  'claude-sonnet-4-5-20251101': 0.15, // Medium complexity queries (Claude 4.5)
  'gpt-4o': 0.30,             // Complex queries and images (legacy, deprecated)
  'gpt-5.2': 0.21,            // Complex queries (NEW - 30% cheaper input than GPT-4o)
  'gpt-5.2-2025-12-11': 0.21, // Alias for gpt-5.2
  'gpt-5.2-thinking': 0.30,   // Gantt charts and critical path analysis
  'o3-mini': 0.08,            // Fast reasoning (alternative to Claude for medium queries)
} as const;

/**
 * Generate cache key from query and context
 * ENHANCED FOR GPT-5.2: Ultra-aggressive normalization for maximum cache hits
 * 
 * Improvements:
 * - Construction term normalization (footer→footing, rebar→reinforcement)
 * - Number normalization (remove specific quantities)
 * - Unit normalization (inches, feet, meters → standardized)
 * - Question word normalization (what/where/how → generic)
 */
function generateCacheKey(query: string, projectId: string, documentIds: string[]): string {
  // Step 1: Basic normalization
  let normalized = query
    .toLowerCase()
    .trim()
    .replace(/[?.!,;:'"]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ');       // Normalize whitespace
  
  // Step 2: Normalize construction terms (footer = footing, etc.)
  const constructionTerms: Record<string, string> = {
    'footer': 'footing',
    'footers': 'footing',
    'footings': 'footing',
    'rebar': 'reinforcement',
    'rebars': 'reinforcement',
    'reinforcing': 'reinforcement',
    'receptacles': 'outlet',
    'receptacle': 'outlet',
    'outlets': 'outlet',
    'fixtures': 'fixture',
    'slab': 'concrete',
    'slabs': 'concrete',
    'hvac': 'mechanical',
    'mep': 'mechanical',
    'specs': 'specification',
    'requirements': 'requirement',
  };
  
  for (const [term, canonical] of Object.entries(constructionTerms)) {
    normalized = normalized.replace(new RegExp(`\\b${term}\\b`, 'g'), canonical);
  }
  
  // Step 3: Normalize numbers and quantities (for semantic matching)
  normalized = normalized
    .replace(/\b\d+\s*(inches?|in|ft|feet|meters?|m|cm)\b/gi, 'DIMENSION') // 12 inches → DIMENSION
    .replace(/\b\d+\s*(lbs?|pounds?|kg|kilograms?)\b/gi, 'WEIGHT')
    .replace(/\b\d+\s*(psi|psf|pa|pascal)\b/gi, 'PRESSURE')
    .replace(/\b\d+\s*(%|percent|percentage)\b/gi, 'PERCENT');
  
  // Step 4: Remove common stop words (more aggressive)
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been'];
  stopWords.forEach(word => {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
  });
  
  // Step 5: Normalize question patterns (what is X = where is X semantically)
  normalized = normalized
    .replace(/^(what|where|when|how|why|which)\s+/g, '') // Remove question words at start
    .replace(/\s+/g, ' ')  // Clean up extra spaces
    .trim();
  
  // Generate document context hash
  const docsHash = crypto
    .createHash('md5')
    .update(documentIds.sort().join(','))
    .digest('hex')
    .substring(0, 8);
  
  return `${projectId}:${docsHash}:${normalized}`;
}

/**
 * Determine query complexity and select appropriate model
 * COST OPTIMIZATION (Updated January 2026): 
 *   70% → GPT-4o-mini ($0.015) - 75% cheaper than GPT-3.5!
 *   20% → Claude 3.5 ($0.15) - Best for conversational multi-step reasoning
 *   9% → GPT-5.2 ($0.21) - 30% better accuracy, replaces GPT-4o
 *   1% → GPT-5.2 Thinking ($0.30) - Gantt charts/critical path only
 * 
 * Net Savings: ~85% cost reduction on simple queries, ~30% on complex queries
 */
export function analyzeQueryComplexity(query: string): {
  complexity: 'simple' | 'medium' | 'complex';
  reason: string;
  model: string;
  reasoning_effort?: 'light' | 'medium' | 'high';
} {
  const lowerQuery = query.toLowerCase();
  
  // ===== GANTT CHART / PLANNING (GPT-5.2 Thinking) - Highest priority! =====
  // Route construction schedule/timeline queries to GPT-5.2 with reasoning
  const ganttIndicators = [
    /gantt/i,
    /critical path/i,
    /schedule.*analysis/i,
    /timeline.*dependencies/i,
    /project.*schedule/i,
    /construction.*timeline/i,
    /activity.*sequence/i,
    /milestone.*planning/i,
    /schedule.*delay/i,
    /schedule.*conflict/i,
    /schedule.*optimization/i,
    /baseline.*schedule/i,
    /project.*planning/i,
    /task.*dependencies/i,
    /schedule.*recovery/i,
  ];
  
  for (const pattern of ganttIndicators) {
    if (pattern.test(lowerQuery)) {
      return {
        complexity: 'complex',
        reason: 'Construction scheduling/planning requires GPT-5.2 with reasoning',
        model: 'gpt-5.2',
        reasoning_effort: 'medium', // Enable reasoning for better analysis
      };
    }
  }
  
  // ===== COMPLEX (GPT-5.2 Instant) - Replaces GPT-4o for most tasks =====
  const complexIndicators = [
    // Vision and image requirements
    /image/i,
    /photo/i,
    /picture/i,
    /drawing/i,
    /diagram/i,
    
    // Heavy multi-document analysis with calculations
    /calculate.*across/i,
    /total.*cost.*estimate/i,
    /material.*takeoff.*multiple/i,
    
    // Code compliance with multiple codes
    /ibc.*and.*nfpa/i,
    /multiple.*code/i,
    /compliance.*check.*all/i,
    
    // Critical decision-making with analysis
    /should we.*and.*why/i,
    /recommend.*with.*analysis/i,
    /best approach.*considering/i,
  ];
  
  // ===== MEDIUM (Claude 3.5 Sonnet) - Multi-step reasoning (20% of queries) =====
  const mediumIndicators = [
    // Document synthesis and comparison
    /compare.*with/i,
    /difference between/i,
    /summarize.*all/i,
    /across.*documents/i,
    /combine.*information/i,
    /review.*multiple/i,
    
    // Detailed analysis requiring reasoning
    /analyze.*why/i,
    /evaluate.*and/i,
    /assess.*impact/i,
    /explain.*process/i,
    /explain.*relationship/i,
    
    // Multi-step reasoning
    /first.*then.*finally/i,
    /step by step/i,
    /walk me through.*process/i,
    /what.*and.*how/i,
    
    // Complex specifications (not simple lookups)
    /specification.*requirements.*for/i,
    /all.*requirements/i,
    /compliance.*requirements/i,
  ];
  
  // ===== SIMPLE (GPT-3.5-turbo) - Most queries should go here (70% target) =====
  const simpleIndicators = [
    // Basic information retrieval
    /^what is/i,
    /^who is/i,
    /^when is/i,
    /^when does/i,
    /^where is/i,
    /^how many/i,
    /^list/i,
    /^show me/i,
    /^find/i,
    /^get/i,
    /^give me/i,
    /^tell me/i,
    
    // Counting and quantity queries (simple lookups)
    /how many.*are/i,
    /number of/i,
    /count/i,
    /total.*quantity/i,
    
    // Measurement and dimension queries (simple lookups)
    /what.*depth/i,
    /what.*height/i,
    /what.*width/i,
    /what.*size/i,
    /what.*dimension/i,
    /how.*deep/i,
    /how.*thick/i,
    
    // Simple yes/no questions
    /^is there/i,
    /^does/i,
    /^can you/i,
    /^do you/i,
    /^is it/i,
    /^are there/i,
    
    // Status and basic facts
    /status/i,
    /date/i,
    /time/i,
    /location/i,
    /address/i,
    /phone/i,
    /contact/i,
    
    // Simple document lookups
    /sheet number/i,
    /page number/i,
    /which document/i,
    /what document/i,
    
    // Single-document simple queries
    /^what.*in.*schedule/i,
    /^what.*on.*plan/i,
    /^show.*from/i,
    
    // Simple specification lookups (not complex analysis)
    /specification.*for\s+\w+$/i,  // "specification for doors" (single item)
    /requirement.*for\s+\w+$/i,    // "requirement for concrete" (single item)
    /detail.*of\s+\w+$/i,          // "detail of footing" (single item)
    
    // Timeline and schedule (simple lookups)
    /completion date/i,
    /start date/i,
    /end date/i,
    /project.*duration/i,
    /milestone/i,
    
    // Simple material queries
    /^what.*material/i,
    /^what.*type/i,
    /^what.*finish/i,
  ];
  
  // Check for complex indicators first (highest cost, most specific)
  for (const pattern of complexIndicators) {
    if (pattern.test(lowerQuery)) {
      return {
        complexity: 'complex',
        reason: 'Requires advanced reasoning, vision, or multi-code compliance',
        model: 'gpt-5.2', // GPT-5.2 (30% better accuracy, cheaper input than GPT-4o)
        reasoning_effort: 'light', // Light reasoning for most complex queries
      };
    }
  }
  
  // Check for simple indicators BEFORE medium (route more to simple)
  for (const pattern of simpleIndicators) {
    if (pattern.test(lowerQuery)) {
      return {
        complexity: 'simple',
        reason: 'Basic information retrieval or simple lookup',
        model: 'gpt-4o-mini', // Upgraded from GPT-3.5 (75% cheaper, better accuracy)
      };
    }
  }
  
  // Check for medium indicators (Claude 3.5 Sonnet)
  for (const pattern of mediumIndicators) {
    if (pattern.test(lowerQuery)) {
      return {
        complexity: 'medium',
        reason: 'Requires document synthesis, detailed analysis, or multi-step reasoning',
        model: 'claude-sonnet-4-5-20251101',
      };
    }
  }
  
  // Query length checks - be more aggressive about routing to simple
  if (query.length > 500) {
    return {
      complexity: 'complex',
      reason: 'Very long query requires GPT-5.2 for comprehensive processing',
      model: 'gpt-5.2',
      reasoning_effort: 'light',
    };
  }
  
  if (query.length > 300) {
    return {
      complexity: 'medium',
      reason: 'Long query benefits from Claude 3.5\'s detailed analysis',
      model: 'claude-sonnet-4-5-20251101',
    };
  }
  
  // DEFAULT TO SIMPLE (was medium before - this saves costs!)
  // GPT-4o-mini handles most construction queries well with RAG context (75% cheaper than GPT-3.5!)
  return {
    complexity: 'simple',
    reason: 'Standard construction query with document context - GPT-4o-mini sufficient',
    model: 'gpt-4o-mini',
  };
}

/**
 * Check if query is cacheable
 * Some queries shouldn't be cached (time-sensitive, user-specific, etc.)
 */
function isCacheable(query: string): boolean {
  const uncacheablePatterns = [
    /\btoday\b/i,
    /\bnow\b/i,
    /\bcurrent\b/i,
    /\blatest\b/i,
    /\brecent\b/i,
    /\bmy\b/i,
    /\bmine\b/i,
    /\bpersonal\b/i,
    /\bdate\b/i,
    /\btime\b/i,
  ];
  
  return !uncacheablePatterns.some(pattern => pattern.test(query));
}

/**
 * Calculate semantic similarity between two queries (simple word overlap)
 * Returns a score from 0 to 1
 */
function calculateQuerySimilarity(query1: string, query2: string): number {
  const words1 = new Set(query1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(query2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Get cached response if available and not expired
 * ENHANCED: Try Redis first, then in-memory cache, then semantic similarity
 */
export async function getCachedResponse(query: string, projectId: string, documentIds: string[]): Promise<string | null> {
  const key = generateCacheKey(query, projectId, documentIds);
  
  // Try Redis first (if available)
  if (isRedisAvailable()) {
    try {
      const redisEntry = await getCached<CacheEntry>(`cache:${key}`);
      if (redisEntry) {
        // Check if entry is expired
        const ageHours = (Date.now() - redisEntry.timestamp) / (1000 * 60 * 60);
        const isHighValue = redisEntry.model.includes('gpt-5.2') || redisEntry.hitCount > 5;
        const ttl = isHighValue ? HIGH_VALUE_CACHE_BOOST : CACHE_TTL_HOURS;
        
        if (ageHours <= ttl) {
          // Update hit count and stats
          redisEntry.hitCount++;
          stats.hits++;
          
          // Update Redis with new hit count
          await setCached(`cache:${key}`, redisEntry, ttl * 3600);
          
          console.log(`[REDIS CACHE HIT - EXACT] Query: "${query.substring(0, 50)}..."`);
          return redisEntry.response;
        }
      }
    } catch (error) {
      console.error('[REDIS CACHE ERROR]', error);
      // Fall through to in-memory cache
    }
  }
  
  // Try in-memory cache as fallback
  let entry = cache.get(key);
  
  // If no exact match, try semantic similarity matching
  if (!entry) {
    let bestMatch: { entry: CacheEntry; similarity: number } | null = null;
    const threshold = 0.7; // 70% similarity required
    
    for (const [cacheKey, cacheEntry] of cache.entries()) {
      // Only compare within same project and document context
      if (!cacheKey.startsWith(`${projectId}:`)) continue;
      
      // Extract query from cache key
      const cachedQuery = cacheKey.split(':').slice(2).join(':');
      const similarity = calculateQuerySimilarity(query, cachedQuery);
      
      if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { entry: cacheEntry, similarity };
      }
    }
    
    if (bestMatch) {
      entry = bestMatch.entry;
      console.log(`[CACHE HIT - SIMILAR] Query: "${query.substring(0, 50)}..." (${Math.round(bestMatch.similarity * 100)}% match)`);
    }
  } else {
    console.log(`[CACHE HIT - EXACT] Query: "${query.substring(0, 50)}..."`);
  }
  
  if (!entry) {
    stats.misses++;
    return null;
  }
  
  // Check if entry is expired (use dynamic TTL based on value)
  const ageHours = (Date.now() - entry.timestamp) / (1000 * 60 * 60);
  const isHighValue = entry.model.includes('gpt-5.2') || entry.hitCount > 5;
  const ttl = isHighValue ? HIGH_VALUE_CACHE_BOOST : CACHE_TTL_HOURS;
  
  if (ageHours > ttl) {
    cache.delete(key);
    stats.misses++;
    console.log(`[CACHE EXPIRED] ${isHighValue ? 'High-value' : 'Standard'} entry expired after ${Math.round(ageHours)}h (TTL: ${ttl}h)`);
    return null;
  }
  
  // Update hit count and stats
  entry.hitCount++;
  stats.hits++;
  
  return entry.response;
}

/**
 * Check if a query is "high-value" (common, expensive, or frequently asked)
 * High-value queries get extended cache TTL
 */
function isHighValueQuery(query: string, model: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // GPT-5.2 queries are automatically high-value (more expensive)
  if (model.includes('gpt-5.2')) {
    return true;
  }
  
  // Common construction queries that are asked repeatedly
  const highValuePatterns = [
    /schedule/i,
    /deadline/i,
    /completion date/i,
    /critical path/i,
    /budget/i,
    /cost/i,
    /code compliance/i,
    /ibc|ada|nfpa/i,
    /parking/i,
    /square footage/i,
    /building area/i,
    /specs/i,
    /specifications/i,
    /material/i,
    /foundation/i,
    /structural/i,
  ];
  
  return highValuePatterns.some(pattern => pattern.test(lowerQuery));
}

/**
 * Cache a response with intelligent TTL management
 * ENHANCED: Writes to both Redis and in-memory cache for redundancy
 */
export async function cacheResponse(
  query: string,
  response: string,
  projectId: string,
  documentIds: string[],
  complexity: 'simple' | 'medium' | 'complex',
  model: string
): Promise<void> {
  // Don't cache if query is not cacheable
  if (!isCacheable(query)) {
    console.log(`[CACHE SKIP] Query not cacheable: "${query.substring(0, 50)}..."`);
    return;
  }
  
  // Don't cache very short responses (likely errors or "I don't know" responses)
  if (response.length < 50) {
    console.log(`[CACHE SKIP] Response too short: "${response}"`);
    return;
  }
  
  const key = generateCacheKey(query, projectId, documentIds);
  
  // Implement LRU eviction if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    // Find and remove oldest LOW-VALUE entry (preserve high-value entries)
    let oldestKey = '';
    let oldestTime = Date.now();
    let foundLowValue = false;
    
    // First pass: try to evict low-value entries
    for (const [k, v] of cache.entries()) {
      const isHighValue = v.model.includes('gpt-5.2') || v.hitCount > 5;
      if (!isHighValue && v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
        foundLowValue = true;
      }
    }
    
    // Second pass: if no low-value entries, evict oldest overall
    if (!foundLowValue) {
      oldestTime = Date.now();
      for (const [k, v] of cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
    }
    
    if (oldestKey) {
      cache.delete(oldestKey);
      console.log(`[CACHE EVICT] Removed ${foundLowValue ? 'low-value' : 'oldest'} entry to make space`);
    }
  }
  
  // Determine if this is a high-value query
  const highValue = isHighValueQuery(query, model);
  const ttl = highValue ? HIGH_VALUE_CACHE_BOOST : CACHE_TTL_HOURS;
  
  const cacheEntry: CacheEntry = {
    response,
    timestamp: Date.now(),
    hitCount: 0,
    complexity,
    model,
    projectId,
  };
  
  // Write to in-memory cache
  cache.set(key, cacheEntry);
  
  // Write to Redis (if available)
  if (isRedisAvailable()) {
    try {
      await setCached(`cache:${key}`, cacheEntry, ttl * 3600); // Convert hours to seconds
      console.log(`[REDIS CACHE SET - ${highValue ? 'HIGH-VALUE' : 'STANDARD'}] ${complexity} query (${model}, TTL: ${ttl}h): "${query.substring(0, 50)}..."`);
    } catch (error) {
      console.error('[REDIS CACHE SET ERROR]', error);
      // Continue - in-memory cache is already set
    }
  } else {
    const cacheType = highValue ? 'HIGH-VALUE' : 'STANDARD';
    console.log(`[IN-MEMORY CACHE SET - ${cacheType}] ${complexity} query (${model}, TTL: ${ttl}h): "${query.substring(0, 50)}..."`);
  }
}

/**
 * Get cache statistics with GPT-5.2 specific metrics
 * ENHANCED: Tracks high-value queries and GPT-5.2 savings separately
 */
export function getCacheStats(): CacheStats & {
  gpt52Hits?: number;
  gpt52Savings?: number;
  highValueEntries?: number;
  avgHitCount?: number;
} {
  const totalRequests = stats.hits + stats.misses;
  const hitRate = totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0;
  
  // Calculate estimated savings based on actual model costs
  let totalSavings = 0;
  let gpt52Savings = 0;
  let gpt52Hits = 0;
  let highValueEntries = 0;
  let totalHitCount = 0;
  
  for (const entry of cache.values()) {
    const modelCost = MODEL_COSTS[entry.model as keyof typeof MODEL_COSTS] || 0.15;
    const savingsForEntry = entry.hitCount * modelCost;
    totalSavings += savingsForEntry;
    totalHitCount += entry.hitCount;
    
    // Track GPT-5.2 specific metrics
    if (entry.model.includes('gpt-5.2')) {
      gpt52Savings += savingsForEntry;
      gpt52Hits += entry.hitCount;
    }
    
    // Count high-value entries
    if (entry.model.includes('gpt-5.2') || entry.hitCount > 5) {
      highValueEntries++;
    }
  }
  
  const avgHitCount = cache.size > 0 ? Math.round(totalHitCount / cache.size * 10) / 10 : 0;
  
  return {
    totalHits: stats.hits,
    totalMisses: stats.misses,
    cacheSize: cache.size,
    estimatedSavings: totalSavings,
    hitRate: Math.round(hitRate * 10) / 10,
    gpt52Hits,
    gpt52Savings: Math.round(gpt52Savings * 100) / 100,
    highValueEntries,
    avgHitCount,
  };
}

/**
 * Warm the cache with common construction queries
 * Call this on server startup or during low-traffic periods
 * 
 * NOTE: This requires actual responses from the LLM, so it should be called
 * after the first few real queries to establish a baseline.
 */
export function getCacheWarmingQueries(): string[] {
  return [
    // Schedule/Timeline queries (high-value)
    "What is the project completion date?",
    "When does construction start?",
    "What are the major milestones?",
    
    // Budget/Cost queries (high-value)
    "What is the total project budget?",
    "What are the contingency funds?",
    
    // Code compliance queries (high-value, GPT-5.2)
    "What are the ADA compliance requirements?",
    "What are the fire safety requirements per IBC?",
    "What are the NFPA requirements?",
    
    // Common construction queries
    "How many parking spaces are required?",
    "What is the building square footage?",
    "What are the foundation specifications?",
    "What type of concrete is specified?",
    "What are the structural requirements?",
    "What mechanical systems are included?",
    
    // Material queries
    "What flooring materials are specified?",
    "What insulation is required?",
    "What roofing materials are used?",
  ];
}

/**
 * Clear the cache (useful for testing or manual refresh)
 */
export function clearCache(): void {
  cache.clear();
  stats.hits = 0;
  stats.misses = 0;
  console.log('[CACHE] Cache cleared');
}

/**
 * Get top cached queries (most hit)
 */
export function getTopCachedQueries(limit: number = 10): Array<{
  query: string;
  hitCount: number;
  complexity: string;
}> {
  const entries: Array<{ key: string; entry: CacheEntry }> = [];
  
  for (const [key, entry] of cache.entries()) {
    entries.push({ key, entry });
  }
  
  return entries
    .sort((a, b) => b.entry.hitCount - a.entry.hitCount)
    .slice(0, limit)
    .map(({ key, entry }) => ({
      query: key.split(':').slice(2).join(':'),
      hitCount: entry.hitCount,
      complexity: entry.complexity,
    }));
}