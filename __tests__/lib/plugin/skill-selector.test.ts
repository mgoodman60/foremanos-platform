import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock skill-loader ────────────────────────────────────────────────────────
const mockSkillLoader = vi.hoisted(() => ({
  loadAllSkillMeta: vi.fn(),
  loadSkillBody: vi.fn(),
  isPluginAvailable: vi.fn(),
}));

vi.mock('@/lib/plugin/skill-loader', () => mockSkillLoader);

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { selectSkillsForQuery } from '@/lib/plugin/skill-selector';
import type { SkillMeta } from '@/lib/plugin/skill-loader';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeSkill = (slug: string, name: string, triggers: string[] = []): SkillMeta => ({
  slug,
  name,
  description: `Description for ${name}`,
  version: '1.0.0',
  triggers,
});

const ALL_SKILLS: SkillMeta[] = [
  makeSkill('intake-chatbot', 'Intake Chatbot', ['daily log', 'field observation']),
  makeSkill('look-ahead-planner', 'Look Ahead Planner', ['look ahead', 'three week']),
  makeSkill('safety-management', 'Safety Management', ['toolbox talk', 'near miss']),
  makeSkill('cost-tracking', 'Cost Tracking', ['cost report', 'budget variance']),
  makeSkill('project-data', 'Project Data', []),
  makeSkill('delay-tracker', 'Delay Tracker', ['rain day', 'weather delay']),
  makeSkill('rfi-preparer', 'RFI Preparer', []),
];

const SHORT_BODY = 'Short skill body content.';
const LONG_BODY = 'word '.repeat(10000); // Very long body to test token budget

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('selectSkillsForQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSkillLoader.loadAllSkillMeta.mockReturnValue(ALL_SKILLS);
    mockSkillLoader.loadSkillBody.mockReturnValue(SHORT_BODY);
    mockSkillLoader.isPluginAvailable.mockReturnValue(true);
  });

  it('returns empty result for null query', () => {
    const result = selectSkillsForQuery(null);
    expect(result.skills).toHaveLength(0);
    expect(result.instructions).toBe('');
    expect(result.estimatedTokens).toBe(0);
  });

  it('returns empty result for empty string query', () => {
    const result = selectSkillsForQuery('');
    expect(result.skills).toHaveLength(0);
    expect(result.estimatedTokens).toBe(0);
  });

  it('returns empty result for whitespace-only query', () => {
    const result = selectSkillsForQuery('   ');
    expect(result.skills).toHaveLength(0);
  });

  it('returns empty result when no skills are loaded (plugin unavailable)', () => {
    mockSkillLoader.loadAllSkillMeta.mockReturnValue([]);

    const result = selectSkillsForQuery('daily log observation');
    expect(result.skills).toHaveLength(0);
  });

  it('matches skills via trigger phrase with confidence 0.9', () => {
    const result = selectSkillsForQuery('I need to log a daily log entry');
    const intakeSkill = result.skills.find(s => s.slug === 'intake-chatbot');
    expect(intakeSkill).toBeDefined();
    expect(intakeSkill?.confidence).toBe(0.9);
    expect(intakeSkill?.reason).toBe('trigger_match');
  });

  it('matches skills via keyword pattern with confidence 0.7', () => {
    const result = selectSkillsForQuery('What is the schedule milestone status?');
    // 'schedule' keyword maps to schedule category → look-ahead-planner and delay-tracker
    const scheduleSkill = result.skills.find(s => s.slug === 'look-ahead-planner');
    expect(scheduleSkill).toBeDefined();
    expect(scheduleSkill?.reason).toBe('keyword_match');
    expect(scheduleSkill?.confidence).toBe(0.7);
  });

  it('respects the maximum of 3 skills per query', () => {
    // Query that could match many skills
    const result = selectSkillsForQuery(
      'daily report schedule delay rfi budget safety quality closeout'
    );
    expect(result.skills.length).toBeLessThanOrEqual(3);
  });

  it('includes skill instruction text in the returned instructions field', () => {
    mockSkillLoader.loadSkillBody.mockReturnValue('Step 1: Do this. Step 2: Do that.');

    const result = selectSkillsForQuery('daily log entry today');
    expect(result.instructions).toContain('Step 1: Do this');
  });

  it('respects 4000-token budget by truncating long skill bodies', () => {
    // With a very long body, it should truncate
    mockSkillLoader.loadSkillBody.mockReturnValue(LONG_BODY);

    const result = selectSkillsForQuery('daily log');
    // Should still have skills selected
    expect(result.skills.length).toBeGreaterThan(0);
    // Token count should not massively exceed 4000
    expect(result.estimatedTokens).toBeLessThanOrEqual(4500);
  });

  it('returns estimated token count greater than zero when skills are selected', () => {
    const result = selectSkillsForQuery('daily log');
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it('does not return duplicate skills for overlapping keyword matches', () => {
    const result = selectSkillsForQuery('rfi request for information');
    const slugs = result.skills.map(s => s.slug);
    const uniqueSlugs = [...new Set(slugs)];
    expect(slugs.length).toBe(uniqueSlugs.length);
  });

  it('ranks trigger_match skills higher than keyword_match skills', () => {
    // 'daily log' is a trigger phrase for intake-chatbot (0.9)
    // 'schedule' is a keyword match (0.7)
    const result = selectSkillsForQuery('daily log schedule');
    if (result.skills.length >= 2) {
      const firstSkill = result.skills[0];
      expect(firstSkill.confidence).toBeGreaterThanOrEqual(result.skills[1].confidence);
    }
  });
});
