import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────

export interface SkillMeta {
  /** Skill directory name (e.g., "intake-chatbot") */
  slug: string;
  /** Human-readable name from YAML frontmatter */
  name: string;
  /** Description from YAML frontmatter */
  description: string;
  /** Version from YAML frontmatter */
  version: string;
  /** Trigger phrases extracted from description */
  triggers: string[];
}

export interface LoadedSkill extends SkillMeta {
  /** Full SKILL.md content (frontmatter stripped) */
  body: string;
}

// ─── Configuration ────────────────────────────────────────────────

/**
 * Root path to the plugin submodule.
 * Resolved relative to the project root (where package.json lives).
 */
const AI_INTELLIGENCE_ROOT = path.resolve(process.cwd(), 'ai-intelligence');
const SKILLS_DIR = path.join(AI_INTELLIGENCE_ROOT, 'skills');
const AGENTS_DIR = path.join(AI_INTELLIGENCE_ROOT, 'agents');

// ─── In-memory cache ──────────────────────────────────────────────

let skillMetaCache: SkillMeta[] | null = null;
let skillBodyCache: Map<string, string> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── YAML Frontmatter Parser ──────────────────────────────────────

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns the parsed key-value pairs and the body (everything after the closing ---).
 */
function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: content };
  }

  const rawYaml = match[1];
  const body = match[2].trim();
  const meta: Record<string, string> = {};

  // Simple YAML parser for flat key-value pairs (handles multi-line >)
  let currentKey = '';
  let currentValue = '';
  let isMultiLine = false;

  for (const line of rawYaml.split('\n')) {
    if (!isMultiLine) {
      const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
      if (kvMatch) {
        // Save previous key if any
        if (currentKey) {
          meta[currentKey] = currentValue.trim();
        }
        currentKey = kvMatch[1];
        const val = kvMatch[2].trim();
        if (val === '>' || val === '|') {
          isMultiLine = true;
          currentValue = '';
        } else {
          currentValue = val;
          isMultiLine = false;
        }
      }
    } else {
      // Multi-line value: indented lines belong to current key
      if (line.startsWith('  ') || line.startsWith('\t')) {
        currentValue += ' ' + line.trim();
      } else {
        // End of multi-line block
        meta[currentKey] = currentValue.trim();
        isMultiLine = false;
        // Re-parse this line as a new key
        const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
        if (kvMatch) {
          currentKey = kvMatch[1];
          const val = kvMatch[2].trim();
          if (val === '>' || val === '|') {
            isMultiLine = true;
            currentValue = '';
          } else {
            currentValue = val;
          }
        }
      }
    }
  }

  // Save last key
  if (currentKey) {
    meta[currentKey] = currentValue.trim();
  }

  return { meta, body };
}

/**
 * Extract trigger phrases from a skill description.
 * Looks for quoted strings and common trigger-word patterns.
 */
function extractTriggers(description: string): string[] {
  const triggers: string[] = [];

  // Extract quoted trigger phrases
  const quoteMatches = description.match(/"([^"]+)"/g);
  if (quoteMatches) {
    triggers.push(...quoteMatches.map(m => m.replace(/"/g, '').toLowerCase()));
  }

  // Extract "Trigger phrases:" or "Triggers:" content
  const triggerSection = description.match(/[Tt]rigger(?:s| phrases?):\s*(.+?)(?:\.|$)/);
  if (triggerSection) {
    const phrases = triggerSection[1].split(/,\s*/).map(p => p.replace(/"/g, '').trim().toLowerCase());
    triggers.push(...phrases.filter(p => p.length > 2));
  }

  return Array.from(new Set(triggers));
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Load metadata for all plugin skills.
 * Reads YAML frontmatter from each SKILL.md file.
 * Results are cached for CACHE_TTL_MS.
 */
export function loadAllSkillMeta(): SkillMeta[] {
  const now = Date.now();
  if (skillMetaCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return skillMetaCache;
  }

  if (!fs.existsSync(SKILLS_DIR)) {
    logger.warn('PLUGIN', 'ai-intelligence/skills directory not found. Run: git submodule update --init');
    return [];
  }

  const skills: SkillMeta[] = [];
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillMdPath = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const { meta } = parseFrontmatter(content);

      skills.push({
        slug: entry.name,
        name: meta.name || entry.name,
        description: meta.description || '',
        version: meta.version || '1.0.0',
        triggers: extractTriggers(meta.description || ''),
      });
    } catch (err) {
      logger.warn('PLUGIN', `Failed to parse skill: ${entry.name}`, { error: String(err) });
    }
  }

  skillMetaCache = skills;
  cacheTimestamp = now;
  logger.info('PLUGIN', `Loaded ${skills.length} skill definitions from ai-intelligence`);
  return skills;
}

/**
 * Load the full body of a specific skill.
 * Returns the SKILL.md content with frontmatter stripped.
 */
export function loadSkillBody(slug: string): string | null {
  if (skillBodyCache.has(slug)) {
    return skillBodyCache.get(slug)!;
  }

  const skillMdPath = path.join(SKILLS_DIR, slug, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    logger.warn('PLUGIN', `Skill not found: ${slug}`);
    return null;
  }

  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const { body } = parseFrontmatter(content);
    skillBodyCache.set(slug, body);
    return body;
  } catch (err) {
    logger.warn('PLUGIN', `Failed to read skill body: ${slug}`, { error: String(err) });
    return null;
  }
}

/**
 * Load an agent definition by filename (without .md extension).
 * Returns the full markdown content.
 */
export function loadAgentDefinition(agentName: string): string | null {
  const agentPath = path.join(AGENTS_DIR, `${agentName}.md`);
  if (!fs.existsSync(agentPath)) {
    logger.warn('PLUGIN', `Agent not found: ${agentName}`);
    return null;
  }

  try {
    return fs.readFileSync(agentPath, 'utf-8');
  } catch (err) {
    logger.warn('PLUGIN', `Failed to read agent: ${agentName}`, { error: String(err) });
    return null;
  }
}

/**
 * Load a reference document from a skill's references/ directory.
 */
export function loadReference(skillSlug: string, refName: string): string | null {
  const refPath = path.join(SKILLS_DIR, skillSlug, 'references', refName);
  if (!fs.existsSync(refPath)) {
    return null;
  }

  try {
    return fs.readFileSync(refPath, 'utf-8');
  } catch (err) {
    logger.warn('PLUGIN', `Failed to read reference: ${skillSlug}/${refName}`, { error: String(err) });
    return null;
  }
}

/**
 * Invalidate all caches. Call when submodule is updated.
 */
export function invalidateCache(): void {
  skillMetaCache = null;
  skillBodyCache = new Map();
  cacheTimestamp = 0;
  logger.info('PLUGIN', 'Skill cache invalidated');
}

/**
 * Check if the ai-intelligence submodule is available.
 */
export function isPluginAvailable(): boolean {
  return fs.existsSync(SKILLS_DIR);
}
