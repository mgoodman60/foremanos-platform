import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── fs mock ─────────────────────────────────────────────────────────────────
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: mockFs,
  existsSync: mockFs.existsSync,
  readFileSync: mockFs.readFileSync,
  readdirSync: mockFs.readdirSync,
}));

// ─── skill-loader dependency ──────────────────────────────────────────────────
const mockSkillLoader = vi.hoisted(() => ({
  isPluginAvailable: vi.fn(),
}));

vi.mock('@/lib/plugin/skill-loader', () => mockSkillLoader);

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  loadAllPluginReferences,
  searchPluginReferences,
  invalidateReferenceCache,
} from '@/lib/plugin/reference-loader';
import type { PluginReferenceChunk } from '@/lib/plugin/reference-loader';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a concrete-focused reference doc large enough to create meaningful chunks
 * (>100 words required for MIN_CHUNK_WORDS).
 */
const CONCRETE_REF_CONTENT = `# Concrete Field Operations

## Placement Requirements
Concrete placement must comply with ACI 301 and project specifications Section 03 30 00.

Temperature requirements: Concrete shall not be placed when ambient temperature is below 40°F or above 95°F.
Slump limitations: Maximum 5-inch slump for structural concrete unless plasticizer is approved by the Engineer.

Consolidation: Use internal vibrators spaced no more than 1.5 times the vibrator radius of action.
Cylinders: Take one set of four cylinders for every 50 CY or fraction thereof placed in any one day.

## Curing Requirements
Maintain concrete above 50°F for a minimum of 7 days after placement.
Use curing compound, wet burlap, or polyethylene sheeting as approved by the Engineer.
Do not allow concrete surface to dry before initial set.

## Cold Weather Concrete
When ambient temperature falls below 40°F, provide heated enclosures.
Monitor internal concrete temperatures with embedded thermocouples.
Gradual temperature reduction: Do not remove protection until concrete reaches 35% of specified strength.`;

const SAFETY_REF_CONTENT = `# OSHA Safety Requirements for Excavation

## Competent Person Requirements
A competent person must inspect excavations daily and after precipitation events.
Slopes must be cut back to safe angles based on soil classification per OSHA 29 CFR 1926.652.

## Protective Systems
Type A soil: 3/4:1 slope or shoring required for excavations deeper than 5 feet.
Type B soil: 1:1 slope required for excavations deeper than 5 feet.
Type C soil: 1.5:1 slope required for all excavations over 5 feet.

## Access and Egress
Provide ladders or other safe access within 25 feet of all workers in excavations.
Keep spoil piles at minimum 2 feet from the edge of the excavation.

## Protective Equipment
All workers in excavations must wear hard hats and high visibility vests.
Fall protection required for excavations adjacent to pedestrian or vehicle traffic.`;

function makeDir(name: string): import('fs').Dirent {
  return {
    name,
    isDirectory: () => true,
    isFile: () => false,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    path: '',
    parentPath: '',
  } as import('fs').Dirent;
}

function makeFile(name: string): import('fs').Dirent {
  return {
    name,
    isDirectory: () => false,
    isFile: () => true,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    path: '',
    parentPath: '',
  } as import('fs').Dirent;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('reference-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateReferenceCache();

    // Default: plugin is available
    mockSkillLoader.isPluginAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    invalidateReferenceCache();
  });

  // ── loadAllPluginReferences ───────────────────────────────────────────────────

  describe('loadAllPluginReferences', () => {
    it('returns empty array when plugin is unavailable', () => {
      mockSkillLoader.isPluginAvailable.mockReturnValue(false);

      const chunks = loadAllPluginReferences();
      expect(chunks).toEqual([]);
    });

    it('returns empty array when skills directory cannot be read', () => {
      mockFs.readdirSync.mockImplementation(() => { throw new Error('ENOENT'); });

      const chunks = loadAllPluginReferences();
      expect(chunks).toEqual([]);
    });

    it('loads and chunks reference markdown files', () => {
      // Skills dir has one skill: field-reference
      mockFs.readdirSync.mockImplementation((dirPath: string, _opts?: unknown) => {
        const p = String(dirPath);
        if (p.endsWith('skills')) {
          return [makeDir('field-reference')];
        }
        if (p.endsWith('references')) {
          return [makeFile('concrete-field-ops.md')];
        }
        return [];
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(CONCRETE_REF_CONTENT);

      const chunks = loadAllPluginReferences();
      expect(chunks.length).toBeGreaterThan(0);

      const firstChunk: PluginReferenceChunk = chunks[0];
      expect(firstChunk.skillSlug).toBe('field-reference');
      expect(firstChunk.filename).toBe('concrete-field-ops.md');
      expect(firstChunk.chunkIndex).toBe(0);
      expect(typeof firstChunk.content).toBe('string');
      expect(firstChunk.keywords.length).toBeGreaterThan(0);
    });

    it('extracts a title from the first heading in the reference file', () => {
      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (String(dirPath).endsWith('skills')) return [makeDir('field-reference')];
        if (String(dirPath).endsWith('references')) return [makeFile('concrete-field-ops.md')];
        return [];
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(CONCRETE_REF_CONTENT);

      const chunks = loadAllPluginReferences();
      expect(chunks[0].title).toBe('Concrete Field Operations');
    });

    it('skips non-markdown files (e.g., .json, .py)', () => {
      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (String(dirPath).endsWith('skills')) return [makeDir('field-reference')];
        if (String(dirPath).endsWith('references')) {
          return [
            makeFile('concrete-field-ops.md'),
            makeFile('config.json'),
            makeFile('helper.py'),
          ];
        }
        return [];
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(CONCRETE_REF_CONTENT);

      const chunks = loadAllPluginReferences();
      // All chunks should be from the .md file only
      for (const chunk of chunks) {
        expect(chunk.filename).toBe('concrete-field-ops.md');
      }
    });

    it('caches results on subsequent calls', () => {
      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (String(dirPath).endsWith('skills')) return [makeDir('field-reference')];
        if (String(dirPath).endsWith('references')) return [makeFile('concrete-field-ops.md')];
        return [];
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(CONCRETE_REF_CONTENT);

      loadAllPluginReferences();
      loadAllPluginReferences();

      // readdirSync should only be called during the first load
      // (skills dir + references dir = 2 calls)
      expect(mockFs.readdirSync).toHaveBeenCalledTimes(2);
    });
  });

  // ── searchPluginReferences ────────────────────────────────────────────────────

  describe('searchPluginReferences', () => {
    beforeEach(() => {
      // Set up two reference files across two skill slugs
      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        const p = String(dirPath);
        if (p.endsWith('skills')) {
          return [makeDir('field-reference'), makeDir('safety-management')];
        }
        if (p.endsWith('field-reference') && p.endsWith('references')) {
          return [makeFile('concrete-field-ops.md')];
        }
        if (p.endsWith('safety-management') && p.endsWith('references')) {
          return [makeFile('excavation-safety.md')];
        }
        // Generic fallback: return one file per references directory
        return [makeFile('concrete-field-ops.md')];
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (String(filePath).includes('safety') || String(filePath).includes('excavation')) {
          return SAFETY_REF_CONTENT;
        }
        return CONCRETE_REF_CONTENT;
      });
    });

    it('returns empty array when plugin is unavailable', () => {
      mockSkillLoader.isPluginAvailable.mockReturnValue(false);

      const results = searchPluginReferences('concrete placement');
      expect(results).toEqual([]);
    });

    it('returns empty array for empty query', () => {
      const results = searchPluginReferences('');
      expect(results).toEqual([]);
    });

    it('returns empty array for stop-words-only query', () => {
      // A query of purely stop words produces zero keywords
      const results = searchPluginReferences('the is a and or');
      expect(results).toEqual([]);
    });

    it('returns scored results for a relevant concrete query', () => {
      const results = searchPluginReferences('concrete placement temperature slump');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].chunk).toBeDefined();
    });

    it('ranks higher-scoring chunks first', () => {
      const results = searchPluginReferences('concrete cylinder curing');
      if (results.length >= 2) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });

    it('respects the limit parameter', () => {
      const results = searchPluginReferences('concrete safety excavation', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('defaults to a limit of 3', () => {
      // With enough content to produce many chunks, limit should cap at 3
      const results = searchPluginReferences('construction concrete safety excavation');
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  // ── invalidateReferenceCache ──────────────────────────────────────────────────

  describe('invalidateReferenceCache', () => {
    it('forces a fresh load after invalidation', () => {
      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (String(dirPath).endsWith('skills')) return [makeDir('field-reference')];
        if (String(dirPath).endsWith('references')) return [makeFile('concrete-field-ops.md')];
        return [];
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(CONCRETE_REF_CONTENT);

      loadAllPluginReferences();   // populates cache
      invalidateReferenceCache();
      loadAllPluginReferences();   // should re-read

      // readdirSync called twice: once per load (skills dir + references dir = 2 each)
      expect(mockFs.readdirSync).toHaveBeenCalledTimes(4);
    });
  });
});
