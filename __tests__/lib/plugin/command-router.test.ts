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

// ─── Mocks for skill-loader helpers used inside command-router ────────────────
const mockSkillLoader = vi.hoisted(() => ({
  isPluginAvailable: vi.fn(),
  loadSkillBody: vi.fn(),
}));

vi.mock('@/lib/plugin/skill-loader', () => mockSkillLoader);

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  detectCommand,
  buildCommandContext,
  loadAllCommands,
  invalidateCommandCache,
} from '@/lib/plugin/command-router';
import type { PluginCommand } from '@/lib/plugin/command-router';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAILY_REPORT_MD = `---
description: Create a structured daily construction report from field observations
argument-hint: "[field observations text]"
allowed-tools: Mcp
---
## Daily Report Command

1. Read field observations from arguments.
2. Classify each entry per the intake-chatbot skill: skills/intake-chatbot/SKILL.md
3. Format the final report using skills/daily-report-format/SKILL.md

Output a professional daily report.`;

const PUNCH_LIST_MD = `---
description: Generate or update a punch list
argument-hint: "[location or trade]"
allowed-tools: Mcp, WebSearch
---
## Punch List Command

Review and classify deficiencies.`;

function makeCommandDir(): { commands: string[]; contents: Record<string, string> } {
  return {
    commands: ['daily-report.md', 'punch-list.md'],
    contents: {
      'daily-report.md': DAILY_REPORT_MD,
      'punch-list.md': PUNCH_LIST_MD,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('command-router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateCommandCache();

    // Default: plugin is available
    mockSkillLoader.isPluginAvailable.mockReturnValue(true);
    mockSkillLoader.loadSkillBody.mockReturnValue('Skill body content here.');

    // Mock commands directory with two command files
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(['daily-report.md', 'punch-list.md']);
    mockFs.readFileSync.mockImplementation((filePath: string) => {
      if (String(filePath).includes('daily-report.md')) return DAILY_REPORT_MD;
      if (String(filePath).includes('punch-list.md')) return PUNCH_LIST_MD;
      return '';
    });
  });

  afterEach(() => {
    invalidateCommandCache();
  });

  // ── loadAllCommands ──────────────────────────────────────────────────────────

  describe('loadAllCommands', () => {
    it('returns an array of PluginCommand objects', () => {
      const commands = loadAllCommands();
      expect(commands.length).toBeGreaterThan(0);
      const dr = commands.find(c => c.name === 'daily-report');
      expect(dr).toBeDefined();
      expect(dr?.description).toBe('Create a structured daily construction report from field observations');
      // The YAML frontmatter parser preserves surrounding quotes in values
      expect(dr?.argumentHint).toBe('"[field observations text]"');
    });

    it('parses allowed-tools into an array', () => {
      const commands = loadAllCommands();
      const punchList = commands.find(c => c.name === 'punch-list');
      expect(punchList?.allowedTools).toContain('Mcp');
      expect(punchList?.allowedTools).toContain('WebSearch');
    });

    it('extracts referenced skills from command body', () => {
      const commands = loadAllCommands();
      const dr = commands.find(c => c.name === 'daily-report');
      expect(dr?.referencedSkills).toContain('intake-chatbot');
      expect(dr?.referencedSkills).toContain('daily-report-format');
    });

    it('returns empty array when commands directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      invalidateCommandCache();

      const commands = loadAllCommands();
      expect(commands).toEqual([]);
    });

    it('caches results on subsequent calls', () => {
      loadAllCommands();
      loadAllCommands();

      expect(mockFs.readdirSync).toHaveBeenCalledTimes(1);
    });
  });

  // ── detectCommand ────────────────────────────────────────────────────────────

  describe('detectCommand', () => {
    it('detects a /daily-report command', () => {
      const result = detectCommand('/daily-report Crew worked on Level 2 framing.');
      expect(result.detected).toBe(true);
      expect(result.command?.name).toBe('daily-report');
      expect(result.arguments).toBe('Crew worked on Level 2 framing.');
    });

    it('detects a command with no arguments', () => {
      const result = detectCommand('/punch-list');
      expect(result.detected).toBe(true);
      expect(result.arguments).toBeUndefined();
    });

    it('resolves /dr alias to daily-report', () => {
      const result = detectCommand('/dr Concrete poured at grid A-B.');
      expect(result.detected).toBe(true);
      expect(result.command?.name).toBe('daily-report');
    });

    it('resolves /pl alias to punch-list', () => {
      const result = detectCommand('/pl');
      expect(result.detected).toBe(true);
      expect(result.command?.name).toBe('punch-list');
    });

    it('returns detected: false for a regular non-command message', () => {
      const result = detectCommand('What is the status of the project?');
      expect(result.detected).toBe(false);
      expect(result.command).toBeUndefined();
    });

    it('returns detected: false for an empty message', () => {
      const result = detectCommand('');
      expect(result.detected).toBe(false);
    });

    it('returns detected: false for a message starting with / but unknown command', () => {
      const result = detectCommand('/unknowncommand some args');
      expect(result.detected).toBe(false);
    });

    it('returns detected: false when plugin is unavailable', () => {
      mockSkillLoader.isPluginAvailable.mockReturnValue(false);

      const result = detectCommand('/daily-report some text');
      expect(result.detected).toBe(false);
    });

    it('preserves originalMessage in result', () => {
      const msg = '/daily-report some observations';
      const result = detectCommand(msg);
      expect(result.originalMessage).toBe(msg);
    });
  });

  // ── buildCommandContext ──────────────────────────────────────────────────────

  describe('buildCommandContext', () => {
    const sampleCommand: PluginCommand = {
      name: 'daily-report',
      description: 'Create a daily report',
      argumentHint: '[observations]',
      allowedTools: ['Mcp'],
      body: 'Step 1: Classify observations.\nStep 2: Format report.',
      referencedSkills: ['intake-chatbot'],
    };

    it('returns a non-empty string for a valid command', () => {
      const context = buildCommandContext(sampleCommand);
      expect(context).toBeTruthy();
      expect(typeof context).toBe('string');
    });

    it('includes the command name in the output', () => {
      const context = buildCommandContext(sampleCommand);
      expect(context).toContain('/daily-report');
    });

    it('includes command description', () => {
      const context = buildCommandContext(sampleCommand);
      expect(context).toContain('Create a daily report');
    });

    it('includes command body instructions', () => {
      const context = buildCommandContext(sampleCommand);
      expect(context).toContain('Classify observations');
    });

    it('includes referenced skill body when available', () => {
      mockSkillLoader.loadSkillBody.mockReturnValue('Skill guidance for intake.');

      const context = buildCommandContext(sampleCommand);
      expect(context).toContain('Skill guidance for intake');
    });

    it('gracefully handles missing referenced skill bodies', () => {
      mockSkillLoader.loadSkillBody.mockReturnValue(null);

      const context = buildCommandContext(sampleCommand);
      // Should still include the command header / body
      expect(context).toContain('/daily-report');
      expect(context).toContain('Classify observations');
    });
  });
});
