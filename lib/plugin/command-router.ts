import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/lib/logger';
import { isPluginAvailable, loadSkillBody } from './skill-loader';

// ─── Types ────────────────────────────────────────────────────────

export interface PluginCommand {
  /** Command name (filename without .md, e.g., "log", "daily-report") */
  name: string;
  /** Description from YAML frontmatter */
  description: string;
  /** Argument hint from YAML frontmatter (e.g., "[observation text]") */
  argumentHint: string;
  /** Allowed tools from YAML frontmatter */
  allowedTools: string[];
  /** Full command body (instructions for the AI) */
  body: string;
  /** Skills referenced in the command body */
  referencedSkills: string[];
}

export interface CommandDetectionResult {
  /** Whether a command was detected */
  detected: boolean;
  /** The matched command, if any */
  command?: PluginCommand;
  /** The arguments passed after the command name */
  arguments?: string;
  /** The original message */
  originalMessage: string;
}

// ─── Configuration ────────────────────────────────────────────────

const AI_INTELLIGENCE_ROOT = path.resolve(process.cwd(), 'ai-intelligence');
const COMMANDS_DIR = path.join(AI_INTELLIGENCE_ROOT, 'commands');

// ─── In-memory cache ──────────────────────────────────────────────

let commandCache: PluginCommand[] | null = null;
let commandCacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Command Aliases ──────────────────────────────────────────────

/**
 * Maps shorthand aliases to their canonical command names.
 * Keys are the alias (without leading slash), values are the canonical name.
 */
const COMMAND_ALIASES: Record<string, string> = {
  dr: 'daily-report',
  mb: 'morning-brief',
  pl: 'punch-list',
  la: 'look-ahead',
  rfi: 'prepare-rfi',
  co: 'change-order',
  evm: 'evm',
  sub: 'sub-scorecard',
  mt: 'material-tracker',
  docs: 'process-docs',
  dwg: 'process-dwg',
  env: 'environmental',
  wr: 'weekly-report',
};

// ─── YAML Frontmatter Parser ──────────────────────────────────────

/**
 * Parse YAML frontmatter from a command markdown file.
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

  let currentKey = '';
  let currentValue = '';
  let isMultiLine = false;

  for (const line of rawYaml.split('\n')) {
    if (!isMultiLine) {
      const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
      if (kvMatch) {
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
      if (line.startsWith('  ') || line.startsWith('\t')) {
        currentValue += ' ' + line.trim();
      } else {
        meta[currentKey] = currentValue.trim();
        isMultiLine = false;
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

  if (currentKey) {
    meta[currentKey] = currentValue.trim();
  }

  return { meta, body };
}

// ─── Skill Reference Extraction ───────────────────────────────────

/**
 * Extract skill slugs referenced in a command body.
 * Looks for patterns like `skills/<skill-name>/SKILL.md` and
 * `skills/<skill-name>/references/`.
 */
function extractReferencedSkills(body: string): string[] {
  const skillRefs: string[] = [];
  // Match patterns: skills/<name>/SKILL.md or skills/<name>/references/
  const regex = /skills\/([a-z0-9-]+)\/(?:SKILL\.md|references\/)/g;
  let match = regex.exec(body);
  while (match !== null) {
    if (skillRefs.indexOf(match[1]) === -1) {
      skillRefs.push(match[1]);
    }
    match = regex.exec(body);
  }
  return skillRefs;
}

// ─── Token Budget ─────────────────────────────────────────────────

/** Approximate tokens per character (conservative estimate) */
const TOKENS_PER_CHAR = 0.3;

/** Maximum total tokens for command context including skill bodies */
const MAX_COMMAND_TOKENS = 6000;

// ─── Public API ───────────────────────────────────────────────────

/**
 * Load metadata for all available commands.
 * Reads YAML frontmatter from each command .md file.
 * Results are cached for CACHE_TTL_MS.
 */
export function loadAllCommands(): PluginCommand[] {
  const now = Date.now();
  if (commandCache && now - commandCacheTimestamp < CACHE_TTL_MS) {
    return commandCache;
  }

  if (!fs.existsSync(COMMANDS_DIR)) {
    logger.warn('PLUGIN', 'ai-intelligence/commands directory not found. Plugin may not be initialized.');
    return [];
  }

  const commands: PluginCommand[] = [];
  let entries: string[];

  try {
    entries = fs.readdirSync(COMMANDS_DIR);
  } catch (err) {
    logger.warn('PLUGIN', 'Failed to read commands directory', { error: String(err) });
    return [];
  }

  for (const filename of entries) {
    if (!filename.endsWith('.md')) continue;

    const filePath = path.join(COMMANDS_DIR, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { meta, body } = parseFrontmatter(content);
      const name = filename.replace(/\.md$/, '');

      // Parse allowed-tools as comma-separated list
      const allowedToolsRaw = meta['allowed-tools'] || '';
      const allowedTools = allowedToolsRaw
        .split(',')
        .map(function (t: string) { return t.trim(); })
        .filter(function (t: string) { return t.length > 0; });

      commands.push({
        name,
        description: meta.description || '',
        argumentHint: meta['argument-hint'] || '',
        allowedTools,
        body,
        referencedSkills: extractReferencedSkills(body),
      });
    } catch (err) {
      logger.warn('PLUGIN', 'Failed to parse command: ' + filename, { error: String(err) });
    }
  }

  commandCache = commands;
  commandCacheTimestamp = now;
  logger.info('PLUGIN', 'Loaded ' + commands.length + ' command definitions from ai-intelligence');
  return commands;
}

/**
 * Detect if a user message contains a plugin command.
 *
 * Detection logic:
 * - Check if message starts with "/" followed by a known command name
 * - Handle aliases (e.g., "/dr" matches "/daily-report")
 * - Extract the argument text after the command name
 * - Return the full command definition if matched
 */
export function detectCommand(message: string): CommandDetectionResult {
  const noDetection: CommandDetectionResult = {
    detected: false,
    originalMessage: message,
  };

  if (!isPluginAvailable()) {
    return noDetection;
  }

  if (!message || !message.startsWith('/')) {
    return noDetection;
  }

  // Extract the command token (first word after /)
  const trimmed = message.trim();
  const spaceIndex = trimmed.indexOf(' ');
  const commandToken = spaceIndex === -1
    ? trimmed.slice(1)
    : trimmed.slice(1, spaceIndex);

  if (!commandToken || commandToken.length === 0) {
    return noDetection;
  }

  const commandTokenLower = commandToken.toLowerCase();

  // Resolve aliases to canonical names
  const canonicalName = COMMAND_ALIASES[commandTokenLower] || commandTokenLower;

  // Load commands and find match
  const allCommands = loadAllCommands();
  const matched = allCommands.find(function (cmd) {
    return cmd.name === canonicalName;
  });

  if (!matched) {
    return noDetection;
  }

  // Extract arguments (everything after the command token)
  const args = spaceIndex === -1 ? '' : trimmed.slice(spaceIndex + 1).trim();

  return {
    detected: true,
    command: matched,
    arguments: args || undefined,
    originalMessage: message,
  };
}

/**
 * Build a system prompt enhancement for a detected command.
 *
 * Loads the command body and referenced skill bodies, combining them
 * into a cohesive instruction block within a token budget.
 */
export function buildCommandContext(command: PluginCommand): string {
  const sections: string[] = [];
  let totalTokens = 0;

  // 1. Command header with description
  const header = '=== COMMAND: /' + command.name + ' ===\n'
    + 'Description: ' + command.description + '\n'
    + (command.argumentHint ? 'Arguments: ' + command.argumentHint + '\n' : '')
    + (command.allowedTools.length > 0 ? 'Allowed tools: ' + command.allowedTools.join(', ') + '\n' : '');

  const headerTokens = Math.ceil(header.length * TOKENS_PER_CHAR);
  sections.push(header);
  totalTokens += headerTokens;

  // 2. Command body (the step-by-step instructions)
  const bodyTokens = Math.ceil(command.body.length * TOKENS_PER_CHAR);
  if (totalTokens + bodyTokens <= MAX_COMMAND_TOKENS) {
    sections.push('\n--- Command Instructions ---\n' + command.body);
    totalTokens += bodyTokens;
  } else {
    // Truncate command body to fit budget
    const availableChars = Math.floor((MAX_COMMAND_TOKENS - totalTokens) / TOKENS_PER_CHAR);
    const truncatedBody = command.body.slice(0, availableChars) + '\n\n[...truncated for token budget]';
    sections.push('\n--- Command Instructions ---\n' + truncatedBody);
    totalTokens += Math.ceil(truncatedBody.length * TOKENS_PER_CHAR);
    // No room for skill bodies
    return sections.join('\n');
  }

  // 3. Load referenced skill bodies within remaining token budget
  if (command.referencedSkills.length > 0) {
    for (const skillSlug of command.referencedSkills) {
      if (totalTokens >= MAX_COMMAND_TOKENS) break;

      const skillBody = loadSkillBody(skillSlug);
      if (!skillBody) continue;

      const skillTokens = Math.ceil(skillBody.length * TOKENS_PER_CHAR);
      const remainingBudget = MAX_COMMAND_TOKENS - totalTokens;

      if (skillTokens <= remainingBudget) {
        sections.push('\n--- Referenced Skill: ' + skillSlug + ' ---\n' + skillBody);
        totalTokens += skillTokens;
      } else {
        // Include truncated skill body with remaining budget
        const availableChars = Math.floor(remainingBudget / TOKENS_PER_CHAR);
        if (availableChars > 200) {
          const truncated = skillBody.slice(0, availableChars) + '\n\n[...truncated for token budget]';
          sections.push('\n--- Referenced Skill: ' + skillSlug + ' ---\n' + truncated);
          totalTokens += Math.ceil(truncated.length * TOKENS_PER_CHAR);
        }
        break;
      }
    }
  }

  logger.info('PLUGIN', 'Built command context for /' + command.name, {
    referencedSkills: command.referencedSkills,
    estimatedTokens: totalTokens,
  });

  return sections.join('\n');
}

/**
 * Invalidate the command cache.
 * Call when the plugin submodule is updated.
 */
export function invalidateCommandCache(): void {
  commandCache = null;
  commandCacheTimestamp = 0;
  logger.info('PLUGIN', 'Command cache invalidated');
}
