import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── fs mock (hoisted so it's available before imports) ───────────────────────
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

// Mock logger to silence output
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createScopedLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import {
  isPluginAvailable,
  loadAllSkillMeta,
  loadSkillBody,
  loadAgentDefinition,
  loadReference,
  invalidateCache,
} from '@/lib/plugin/skill-loader';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SKILL_MD_CONTENT = `---
name: Intake Chatbot
description: Handles "daily log" and "field observation" intake. Trigger phrases: "log", "field note".
version: 1.0.0
---
# Intake Chatbot Skill

Instructions for capturing field observations go here.`;

const SKILL_MD_NO_FRONTMATTER = `# A Skill Without Frontmatter

Some content without YAML front matter.`;

function makeSkillDir(name: string): import('fs').Dirent {
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

function makeFileDir(name: string): import('fs').Dirent {
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

describe('skill-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Always invalidate cache between tests so state doesn't bleed
    invalidateCache();
  });

  afterEach(() => {
    invalidateCache();
  });

  // ── isPluginAvailable ────────────────────────────────────────────────────────

  describe('isPluginAvailable', () => {
    it('returns true when the skills directory exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      expect(isPluginAvailable()).toBe(true);
    });

    it('returns false when the skills directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(isPluginAvailable()).toBe(false);
    });
  });

  // ── loadAllSkillMeta ─────────────────────────────────────────────────────────

  describe('loadAllSkillMeta', () => {
    it('returns empty array when skills directory is missing', () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = loadAllSkillMeta();
      expect(result).toEqual([]);
    });

    it('returns SkillMeta objects for each skill directory', () => {
      mockFs.existsSync.mockImplementation((p: string) => {
        // Allow the skills dir itself plus each SKILL.md
        return p.includes('skills') || p.includes('SKILL.md');
      });
      mockFs.readdirSync.mockReturnValue([makeSkillDir('intake-chatbot')]);
      mockFs.readFileSync.mockReturnValue(SKILL_MD_CONTENT);

      const result = loadAllSkillMeta();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('intake-chatbot');
      expect(result[0].name).toBe('Intake Chatbot');
      expect(result[0].version).toBe('1.0.0');
    });

    it('extracts trigger phrases from the description field', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([makeSkillDir('intake-chatbot')]);
      mockFs.readFileSync.mockReturnValue(SKILL_MD_CONTENT);

      const result = loadAllSkillMeta();
      expect(result[0].triggers).toContain('daily log');
      expect(result[0].triggers).toContain('field observation');
    });

    it('skips non-directory entries in the skills folder', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([makeFileDir('README.md')]);

      const result = loadAllSkillMeta();
      expect(result).toHaveLength(0);
    });

    it('uses slug as name fallback when frontmatter has no name field', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([makeSkillDir('my-skill')]);
      mockFs.readFileSync.mockReturnValue(SKILL_MD_NO_FRONTMATTER);

      const result = loadAllSkillMeta();
      expect(result[0].name).toBe('my-skill');
    });

    it('caches results and does not re-read filesystem on second call', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([makeSkillDir('intake-chatbot')]);
      mockFs.readFileSync.mockReturnValue(SKILL_MD_CONTENT);

      loadAllSkillMeta();
      loadAllSkillMeta(); // second call

      expect(mockFs.readdirSync).toHaveBeenCalledTimes(1);
    });
  });

  // ── loadSkillBody ────────────────────────────────────────────────────────────

  describe('loadSkillBody', () => {
    it('returns the body (frontmatter stripped) for a known skill', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(SKILL_MD_CONTENT);

      const body = loadSkillBody('intake-chatbot');
      expect(body).toBeTruthy();
      expect(body).toContain('Instructions for capturing');
      // Frontmatter should be stripped
      expect(body).not.toContain('name: Intake Chatbot');
    });

    it('returns null when the skill SKILL.md does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const body = loadSkillBody('nonexistent-skill');
      expect(body).toBeNull();
    });

    it('returns null and does not throw when readFileSync throws', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      const body = loadSkillBody('broken-skill');
      expect(body).toBeNull();
    });

    it('caches skill body on second call', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(SKILL_MD_CONTENT);

      loadSkillBody('intake-chatbot');
      loadSkillBody('intake-chatbot');

      // readFileSync should only be called once (second call uses cache)
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });
  });

  // ── loadAgentDefinition ──────────────────────────────────────────────────────

  describe('loadAgentDefinition', () => {
    it('returns agent markdown content when agent file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('# Project Health Monitor\n\nAgent instructions...');

      const def = loadAgentDefinition('project-health-monitor');
      expect(def).toContain('Project Health Monitor');
    });

    it('returns null when the agent file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const def = loadAgentDefinition('ghost-agent');
      expect(def).toBeNull();
    });
  });

  // ── loadReference ────────────────────────────────────────────────────────────

  describe('loadReference', () => {
    it('returns reference content when file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('# Reference Content\n\nSome guidance.');

      const ref = loadReference('field-reference', 'concrete-field-ops.md');
      expect(ref).toContain('Reference Content');
    });

    it('returns null when reference file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const ref = loadReference('field-reference', 'nonexistent.md');
      expect(ref).toBeNull();
    });
  });

  // ── invalidateCache ──────────────────────────────────────────────────────────

  describe('invalidateCache', () => {
    it('forces a fresh filesystem read on the next loadAllSkillMeta call', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([makeSkillDir('intake-chatbot')]);
      mockFs.readFileSync.mockReturnValue(SKILL_MD_CONTENT);

      loadAllSkillMeta(); // populates cache
      invalidateCache();
      loadAllSkillMeta(); // should re-read from disk

      expect(mockFs.readdirSync).toHaveBeenCalledTimes(2);
    });
  });
});
