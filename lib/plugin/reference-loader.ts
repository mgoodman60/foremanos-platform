/**
 * Plugin Reference Document Loader
 *
 * Scans the ai-intelligence submodule for reference markdown documents,
 * breaks them into searchable chunks, and provides keyword-based search
 * that integrates with the app's RAG pipeline.
 *
 * Reference docs live in:
 *   ai-intelligence/skills/{skill}/references/{file}.md
 *
 * Gracefully returns empty results when the submodule is not present.
 */
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/lib/logger';
import { isPluginAvailable } from './skill-loader';

// ─── Types ────────────────────────────────────────────────────────

export interface PluginReferenceChunk {
  /** Skill slug the reference belongs to (e.g., "field-reference") */
  skillSlug: string;
  /** Reference filename (e.g., "concrete-field-ops.md") */
  filename: string;
  /** Human-readable title extracted from the markdown heading */
  title: string;
  /** The chunk text content */
  content: string;
  /** Chunk index within the document */
  chunkIndex: number;
  /** Keywords extracted from the content */
  keywords: string[];
}

export interface PluginReferenceSearchResult {
  chunk: PluginReferenceChunk;
  score: number;
}

// ─── Configuration ────────────────────────────────────────────────

const AI_INTELLIGENCE_ROOT = path.resolve(process.cwd(), 'ai-intelligence');
const SKILLS_DIR = path.join(AI_INTELLIGENCE_ROOT, 'skills');

/** Target chunk size in words (500-800 range) */
const TARGET_CHUNK_WORDS = 600;
const MIN_CHUNK_WORDS = 100;

/** Non-markdown files to skip when scanning references */
const SKIP_EXTENSIONS = new Set(['.py', '.json', '.html', '.sh', '.txt', '.js', '.ts', '.csv']);

// ─── Cache ────────────────────────────────────────────────────────

let referenceChunkCache: PluginReferenceChunk[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isCacheValid(): boolean {
  return referenceChunkCache !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

// ─── Construction Keywords ────────────────────────────────────────

/**
 * Construction-specific terms that get bonus scoring when matched.
 * Organized by domain for clarity.
 */
const CONSTRUCTION_TERMS = new Set([
  // Concrete & foundation
  'concrete', 'footing', 'footer', 'foundation', 'rebar', 'reinforcement', 'formwork',
  'slump', 'admixture', 'curing', 'placement', 'pour', 'slab', 'psi', 'cylinder',
  'consolidation', 'vibrator', 'finisher', 'float', 'trowel', 'bulkhead',
  // Structural steel
  'structural', 'steel', 'erection', 'bolting', 'welding', 'torque', 'plumb',
  'bracing', 'shear', 'moment', 'connection', 'beam', 'column', 'girder', 'joist',
  // Earthwork
  'excavation', 'backfill', 'compaction', 'proctor', 'subgrade', 'grading',
  'trench', 'dewatering', 'shoring', 'benching', 'spoils', 'embankment',
  // MEP
  'hvac', 'mechanical', 'electrical', 'plumbing', 'ductwork', 'conduit', 'piping',
  'fire protection', 'sprinkler', 'coordination', 'clash', 'penetration', 'sleeve',
  // Safety
  'osha', 'safety', 'fall protection', 'excavation safety', 'confined space',
  'lockout', 'tagout', 'ppe', 'hazard', 'scaffolding', 'guardrail',
  // General construction
  'masonry', 'waterproofing', 'envelope', 'roofing', 'flashing', 'insulation',
  'crane', 'rigging', 'lift', 'survey', 'layout', 'benchmark', 'elevation',
  'paving', 'flatwork', 'utilities', 'underground', 'logistics', 'staging',
  'formwork', 'shoring', 'falsework', 'scaffold', 'multi-story', 'sequence',
  // Quality & inspection
  'inspection', 'quality', 'tolerance', 'specification', 'submittal', 'rfi',
  'hold point', 'test', 'verification', 'compliance', 'deficiency',
  // Schedule & management
  'schedule', 'critical path', 'milestone', 'lookahead', 'delay', 'float',
  'procurement', 'lead time', 'mobilization', 'demobilization',
]);

// ─── Stop Words ───────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with',
  'to', 'for', 'of', 'as', 'by', 'from', 'what', 'how', 'when', 'where', 'who',
  'why', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'have', 'has',
  'had', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'me', 'my', 'this',
  'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them',
  'not', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'than', 'too', 'very', 'just', 'also', 'will', 'shall', 'may',
]);

// ─── Internal Helpers ─────────────────────────────────────────────

/**
 * Extract a human-readable title from the beginning of markdown content.
 * Looks for the first H1 or H2 heading, or falls back to filename.
 */
function extractTitle(content: string, filename: string): string {
  const headingMatch = content.match(/^#{1,2}\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // Fall back to cleaned filename
  return filename
    .replace(/\.md$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Extract keywords from a text block.
 * Filters stop words and short tokens, then deduplicates.
 */
function extractKeywordsFromText(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  return Array.from(new Set(words));
}

/**
 * Split a markdown document into chunks of approximately TARGET_CHUNK_WORDS.
 * Preserves paragraph boundaries to keep content coherent.
 */
function chunkDocument(content: string): string[] {
  // Split on double newlines (paragraph boundaries) and headings
  const paragraphs = content.split(/\n{2,}/);
  const chunks: string[] = [];
  let currentChunk = '';
  let currentWordCount = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const paragraphWords = trimmed.split(/\s+/).length;

    // If adding this paragraph would exceed the target significantly,
    // and we already have meaningful content, start a new chunk
    if (currentWordCount > 0 && currentWordCount + paragraphWords > TARGET_CHUNK_WORDS * 1.2) {
      if (currentWordCount >= MIN_CHUNK_WORDS) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmed;
      currentWordCount = paragraphWords;
    } else {
      if (currentChunk) {
        currentChunk += '\n\n' + trimmed;
      } else {
        currentChunk = trimmed;
      }
      currentWordCount += paragraphWords;
    }
  }

  // Push the last chunk if it has meaningful content
  if (currentChunk.trim() && currentWordCount >= MIN_CHUNK_WORDS) {
    chunks.push(currentChunk.trim());
  } else if (currentChunk.trim() && chunks.length > 0) {
    // Merge tiny trailing chunk into the previous one
    chunks[chunks.length - 1] += '\n\n' + currentChunk.trim();
  } else if (currentChunk.trim()) {
    // Only chunk and it's small — include it anyway
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Scan all reference directories across all skills and load .md files.
 */
function scanAllReferences(): PluginReferenceChunk[] {
  if (!isPluginAvailable()) {
    return [];
  }

  const allChunks: PluginReferenceChunk[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  } catch (err) {
    logger.warn('REFERENCE_LOADER', 'Failed to read skills directory', { error: String(err) });
    return [];
  }

  for (const skillEntry of entries) {
    if (!skillEntry.isDirectory()) continue;

    const refsDir = path.join(SKILLS_DIR, skillEntry.name, 'references');
    if (!fs.existsSync(refsDir)) continue;

    let refFiles: fs.Dirent[];
    try {
      refFiles = fs.readdirSync(refsDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const refFile of refFiles) {
      if (!refFile.isFile()) continue;

      const ext = path.extname(refFile.name).toLowerCase();
      if (ext !== '.md' || SKIP_EXTENSIONS.has(ext)) continue;

      const filePath = path.join(refsDir, refFile.name);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.trim()) continue;

        const title = extractTitle(content, refFile.name);
        const chunks = chunkDocument(content);

        for (let i = 0; i < chunks.length; i++) {
          allChunks.push({
            skillSlug: skillEntry.name,
            filename: refFile.name,
            title: title,
            content: chunks[i],
            chunkIndex: i,
            keywords: extractKeywordsFromText(chunks[i]),
          });
        }
      } catch (err) {
        logger.warn('REFERENCE_LOADER', `Failed to read reference: ${skillEntry.name}/${refFile.name}`, {
          error: String(err),
        });
      }
    }
  }

  return allChunks;
}

/**
 * Score a reference chunk against a search query using keyword matching.
 * Uses the same philosophy as document-retrieval.ts: keyword overlap + phrase matching + construction term bonuses.
 */
function scoreChunkAgainstQuery(chunk: PluginReferenceChunk, queryKeywords: string[], fullQuery: string): number {
  const contentLower = chunk.content.toLowerCase();
  let score = 0;

  // ── Exact phrase match (highest value) ─────────────────────────
  const queryLower = fullQuery.toLowerCase().trim();
  if (queryLower.length > 5 && contentLower.includes(queryLower)) {
    score += 100;
  }

  // ── Multi-word sub-phrase matching ─────────────────────────────
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  if (queryWords.length >= 2) {
    // Check pairs of adjacent query words
    for (let i = 0; i < queryWords.length - 1; i++) {
      const phrase = queryWords[i] + ' ' + queryWords[i + 1];
      if (contentLower.includes(phrase)) {
        score += 40;
      }
    }
  }

  // ── Individual keyword matches ─────────────────────────────────
  let keywordHits = 0;
  for (const keyword of queryKeywords) {
    if (chunk.keywords.indexOf(keyword) !== -1) {
      keywordHits++;
      score += 10;

      // Bonus for construction-specific terms
      if (CONSTRUCTION_TERMS.has(keyword)) {
        score += 8;
      }
    }
  }

  // ── Coverage bonus: more keywords matched = exponentially better ──
  if (queryKeywords.length > 0) {
    const coverage = keywordHits / queryKeywords.length;
    if (coverage >= 0.8) {
      score += 30;
    } else if (coverage >= 0.5) {
      score += 15;
    }
  }

  // ── Title relevance bonus ──────────────────────────────────────
  const titleLower = chunk.title.toLowerCase();
  for (const keyword of queryKeywords) {
    if (titleLower.includes(keyword)) {
      score += 12;
    }
  }

  // ── Skill slug relevance bonus ─────────────────────────────────
  const slugLower = chunk.skillSlug.toLowerCase().replace(/-/g, ' ');
  for (const keyword of queryKeywords) {
    if (slugLower.includes(keyword)) {
      score += 5;
    }
  }

  return score;
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Load and index all plugin reference documents.
 * Results are cached for 5 minutes.
 */
export function loadAllPluginReferences(): PluginReferenceChunk[] {
  if (isCacheValid()) {
    return referenceChunkCache!;
  }

  const chunks = scanAllReferences();
  referenceChunkCache = chunks;
  cacheTimestamp = Date.now();

  if (chunks.length > 0) {
    logger.info('REFERENCE_LOADER', `Indexed ${chunks.length} reference chunks from plugin`, {
      skillCount: Array.from(new Set(chunks.map(c => c.skillSlug))).length,
      fileCount: Array.from(new Set(chunks.map(c => c.skillSlug + '/' + c.filename))).length,
    });
  }

  return chunks;
}

/**
 * Search plugin references for relevant content.
 *
 * @param query - User's search query
 * @param limit - Maximum number of results to return (default: 3)
 * @returns Scored reference chunks, ordered by relevance
 */
export function searchPluginReferences(query: string, limit: number = 3): PluginReferenceSearchResult[] {
  if (!isPluginAvailable()) {
    return [];
  }

  const chunks = loadAllPluginReferences();
  if (chunks.length === 0) {
    return [];
  }

  // Extract keywords from the query
  const queryKeywords = extractKeywordsFromText(query);
  if (queryKeywords.length === 0) {
    return [];
  }

  // Score all chunks
  const scored: PluginReferenceSearchResult[] = [];

  for (const chunk of chunks) {
    const score = scoreChunkAgainstQuery(chunk, queryKeywords, query);
    if (score > 0) {
      scored.push({ chunk, score });
    }
  }

  // Sort by score descending and return top results
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Invalidate the reference cache.
 * Call when the ai-intelligence submodule is updated.
 */
export function invalidateReferenceCache(): void {
  referenceChunkCache = null;
  cacheTimestamp = 0;
  logger.info('REFERENCE_LOADER', 'Reference cache invalidated');
}
