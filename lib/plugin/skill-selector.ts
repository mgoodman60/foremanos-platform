import { logger } from '@/lib/logger';
import { loadAllSkillMeta, loadSkillBody, type SkillMeta } from './skill-loader';

// ─── Types ────────────────────────────────────────────────────────

export interface SelectedSkill {
  slug: string;
  name: string;
  /** Why this skill was selected */
  reason: 'trigger_match' | 'keyword_match' | 'category_match';
  /** Match confidence 0-1 */
  confidence: number;
}

export interface SkillSelectionResult {
  /** Skills selected for this query, ordered by relevance */
  skills: SelectedSkill[];
  /** Combined instruction text to inject into system prompt */
  instructions: string;
  /** Token estimate for the injected instructions */
  estimatedTokens: number;
}

// ─── Skill Category Mapping ───────────────────────────────────────

/**
 * Maps query intent keywords to skill slugs.
 * This is the routing table that connects user questions to plugin skills.
 */
const CATEGORY_MAP: Record<string, string[]> = {
  // Field operations
  daily_report: ['intake-chatbot', 'daily-report-format', 'project-data'],
  field_log: ['intake-chatbot', 'project-data'],

  // Safety
  safety: ['safety-management', 'project-data'],
  incident: ['safety-management'],
  osha: ['safety-management'],

  // Schedule & planning
  schedule: ['look-ahead-planner', 'last-planner', 'project-data'],
  delay: ['delay-tracker', 'project-data'],
  look_ahead: ['look-ahead-planner', 'project-data'],

  // Documents & drawings
  document: ['document-intelligence', 'drawing-control', 'project-data'],
  drawing: ['drawing-control', 'document-intelligence', 'project-data'],
  rfi: ['rfi-preparer', 'project-data'],
  submittal: ['submittal-intelligence', 'project-data'],

  // Budget & cost
  budget: ['cost-tracking', 'earned-value-management', 'project-data'],
  cost: ['cost-tracking', 'change-order-tracker', 'project-data'],
  change_order: ['change-order-tracker', 'project-data'],

  // Quality & inspections
  quality: ['quality-management', 'project-data'],
  inspection: ['inspection-tracker', 'project-data'],
  punch_list: ['punch-list', 'project-data'],

  // Subcontractor management
  subcontractor: ['sub-performance', 'project-data'],
  sub: ['sub-performance', 'project-data'],
  labor: ['labor-tracking', 'project-data'],

  // Reports & analysis
  report: ['weekly-owner-report', 'report-qa', 'project-data'],
  dashboard: ['dashboard', 'project-data'],
  meeting: ['meeting-minutes', 'project-data'],

  // Closeout
  closeout: ['closeout-commissioning', 'project-data'],
  warranty: ['closeout-commissioning', 'project-data'],
  commissioning: ['closeout-commissioning', 'project-data'],

  // Risk & compliance
  risk: ['risk-management', 'project-data'],
  environmental: ['environmental-compliance', 'project-data'],
  claims: ['claims-documentation', 'delay-tracker', 'project-data'],

  // Procurement
  procurement: ['material-procurement', 'project-data'],
  material: ['material-procurement', 'project-data'],

  // Estimating
  takeoff: ['estimating-intelligence', 'project-data'],
  estimate: ['estimating-intelligence', 'project-data'],
  quantity: ['estimating-intelligence', 'project-data'],
};

/**
 * Keywords that map to categories above.
 * Pattern → category key.
 */
const KEYWORD_PATTERNS: [RegExp, string][] = [
  // Field operations
  [/\b(log|field\s*(?:observation|note|report)|daily\s*report|what\s*happened|site\s*conditions?)\b/i, 'daily_report'],
  [/\b(crew|headcount|manpower|who\s*was|how\s*many\s*(?:workers|people))\b/i, 'field_log'],

  // Safety
  [/\b(safety|incident|near\s*miss|toolbox\s*talk|jsa|jha|ppe|hazard)\b/i, 'safety'],
  [/\b(osha|recordable|trir|dart|emr|first\s*aid)\b/i, 'osha'],

  // Schedule & planning
  [/\b(schedule|milestone|critical\s*path|float|behind|ahead\s*of|on\s*time)\b/i, 'schedule'],
  [/\b(delay|rain\s*day|weather\s*delay|impact|liquidated\s*damage)\b/i, 'delay'],
  [/\b(look\s*ahead|lookahead|next\s*(?:week|two\s*weeks|three\s*weeks))\b/i, 'look_ahead'],

  // Documents
  [/\b(rfi|request\s*for\s*information)\b/i, 'rfi'],
  [/\b(submittal|shop\s*drawing|product\s*data)\b/i, 'submittal'],
  [/\b(drawing|plan|sheet|detail|elevation|section)\b/i, 'drawing'],

  // Budget & cost
  [/\b(budget|cost|expense|billing|payment\s*app|invoice)\b/i, 'budget'],
  [/\b(change\s*order|co\s*#?\d|modification|claim)\b/i, 'change_order'],
  [/\b(earned\s*value|ev|cpi|spi|bac|eac|etc)\b/i, 'budget'],

  // Quality
  [/\b(quality|deficiency|non-?conformance|ncr)\b/i, 'quality'],
  [/\b(inspection|hold\s*point|test|verify)\b/i, 'inspection'],
  [/\b(punch\s*list|punchlist|deficiency\s*list|snag)\b/i, 'punch_list'],

  // Subs
  [/\b(sub(?:contractor)?s?|trade\s*(?:partner|contractor))\b/i, 'subcontractor'],
  [/\b(labor|productivity|man\s*hours|overtime)\b/i, 'labor'],

  // Reports
  [/\b(weekly\s*(?:report|update|owner)|owner\s*report)\b/i, 'report'],
  [/\b(meeting\s*minutes?|minutes|action\s*items?)\b/i, 'meeting'],

  // Closeout
  [/\b(closeout|close\s*out|turnover|substantial\s*completion|final\s*completion)\b/i, 'closeout'],
  [/\b(warranty|commissioning|start\s*up|functional\s*test)\b/i, 'commissioning'],

  // Risk
  [/\b(risk|contingency|mitigation|exposure)\b/i, 'risk'],
  [/\b(environmental|swppp|bmp|erosion|stormwater)\b/i, 'environmental'],
  [/\b(claim|dispute|notice|time\s*extension)\b/i, 'claims'],

  // Procurement
  [/\b(procurement|lead\s*time|delivery|order|material\s*(?:status|tracking))\b/i, 'procurement'],
  [/\b(material|concrete|rebar|steel|lumber|aggregate)\b/i, 'material'],

  // Estimating
  [/\b(takeoff|take\s*off|quantity|estimate|cubic\s*yard|square\s*(?:foot|feet)|linear\s*(?:foot|feet))\b/i, 'takeoff'],
];

// ─── Token Budget ─────────────────────────────────────────────────

/** Maximum skills to inject per query */
const MAX_SKILLS_PER_QUERY = 3;

/** Approximate tokens per character (conservative estimate) */
const TOKENS_PER_CHAR = 0.3;

/** Maximum total tokens for plugin skill instructions */
const MAX_SKILL_TOKENS = 4000;

// ─── Public API ───────────────────────────────────────────────────

/**
 * Select relevant plugin skills for a user query.
 *
 * Selection strategy:
 * 1. Check for trigger phrase matches (highest confidence)
 * 2. Check for keyword/pattern matches (medium confidence)
 * 3. Deduplicate and rank by confidence
 * 4. Load skill bodies within token budget
 */
export function selectSkillsForQuery(message: string | null): SkillSelectionResult {
  const emptyResult: SkillSelectionResult = { skills: [], instructions: '', estimatedTokens: 0 };

  if (!message || message.trim().length === 0) {
    return emptyResult;
  }

  const allSkills = loadAllSkillMeta();
  if (allSkills.length === 0) {
    return emptyResult;
  }

  const messageLower = message.toLowerCase();
  const candidates: Map<string, SelectedSkill> = new Map();

  // ── Pass 1: Trigger phrase matching ────────────────────────────

  for (const skill of allSkills) {
    for (const trigger of skill.triggers) {
      if (messageLower.includes(trigger)) {
        const existing = candidates.get(skill.slug);
        if (!existing || existing.confidence < 0.9) {
          candidates.set(skill.slug, {
            slug: skill.slug,
            name: skill.name,
            reason: 'trigger_match',
            confidence: 0.9,
          });
        }
      }
    }
  }

  // ── Pass 2: Keyword pattern matching ───────────────────────────

  const matchedCategories: string[] = [];
  for (const [pattern, category] of KEYWORD_PATTERNS) {
    if (pattern.test(message) && matchedCategories.indexOf(category) === -1) {
      matchedCategories.push(category);
    }
  }

  for (const category of matchedCategories) {
    const skillSlugs = CATEGORY_MAP[category] || [];
    for (const slug of skillSlugs) {
      if (!candidates.has(slug)) {
        const meta = allSkills.find(s => s.slug === slug);
        if (meta) {
          candidates.set(slug, {
            slug,
            name: meta.name,
            reason: 'keyword_match',
            confidence: 0.7,
          });
        }
      }
    }
  }

  // ── Rank and limit ─────────────────────────────────────────────

  const ranked = Array.from(candidates.values())
    .sort((a, b) => {
      // Higher confidence first
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      // Prefer non-project-data skills (project-data is a common base)
      if (a.slug === 'project-data') return 1;
      if (b.slug === 'project-data') return -1;
      return 0;
    })
    .slice(0, MAX_SKILLS_PER_QUERY);

  if (ranked.length === 0) {
    return emptyResult;
  }

  // ── Load skill bodies within token budget ──────────────────────

  let totalTokens = 0;
  const instructions: string[] = [];

  for (const skill of ranked) {
    const body = loadSkillBody(skill.slug);
    if (!body) continue;

    const estimatedTokens = Math.ceil(body.length * TOKENS_PER_CHAR);

    if (totalTokens + estimatedTokens > MAX_SKILL_TOKENS) {
      // Over budget — include a summary instead of full body
      const summary = body.slice(0, 500) + '\n\n[...truncated for token budget]';
      instructions.push(`\n=== SKILL: ${skill.name} (${skill.slug}) ===\n${summary}`);
      totalTokens += Math.ceil(summary.length * TOKENS_PER_CHAR);
      break;
    }

    instructions.push(`\n=== SKILL: ${skill.name} (${skill.slug}) ===\n${body}`);
    totalTokens += estimatedTokens;
  }

  logger.info('PLUGIN_SELECTOR', `Selected ${ranked.length} skills for query`, {
    skills: ranked.map(s => s.slug),
    estimatedTokens: totalTokens,
  });

  return {
    skills: ranked,
    instructions: instructions.join('\n'),
    estimatedTokens: totalTokens,
  };
}
