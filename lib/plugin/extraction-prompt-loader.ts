/**
 * Extraction Prompt Loader
 *
 * Replaces hardcoded discipline prompts with plugin-driven extraction rules.
 * The plugin's document-intelligence skill provides 28 deep-extraction reference
 * docs that are far richer than the app's 8 hardcoded prompts.
 *
 * Strategy:
 * - Map each discipline to its plugin reference doc(s)
 * - Load and cache reference content
 * - Build enhanced prompts by combining base structure with plugin rules
 * - Fall back to null when plugin unavailable (caller uses hardcoded)
 */
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/lib/logger';

// ─── Configuration ────────────────────────────────────────────────

const AI_INTELLIGENCE_ROOT = path.resolve(process.cwd(), 'ai-intelligence');
const DOC_INTEL_REFS = path.join(AI_INTELLIGENCE_ROOT, 'skills', 'document-intelligence', 'references');
const PROJECT_DATA_REFS = path.join(AI_INTELLIGENCE_ROOT, 'skills', 'project-data', 'references');

/**
 * Maps discipline names → plugin reference doc filenames.
 * Each discipline can have multiple references loaded in order.
 */
const DISCIPLINE_REFERENCE_MAP: Record<string, string[]> = {
  Architectural: ['plans-deep-extraction.md', 'construction-document-conventions.md'],
  Structural: ['plans-deep-extraction.md', 'construction-document-conventions.md'],
  Mechanical: ['mep-deep-extraction.md', 'construction-document-conventions.md'],
  Electrical: ['mep-deep-extraction.md', 'construction-document-conventions.md'],
  Plumbing: ['mep-deep-extraction.md', 'construction-document-conventions.md'],
  Civil: ['civil-deep-extraction.md', 'construction-document-conventions.md'],
  'Fire Protection': ['fp-deep-extraction.md', 'construction-document-conventions.md'],
  Schedule: ['schedule-deep-extraction.md'],
  Specification: ['specifications-deep-extraction.md'],
  PEMB: ['pemb-deep-extraction.md', 'construction-document-conventions.md'],
  Submittal: ['submittals-deep-extraction.md'],
  Contract: ['project-docs-deep-extraction.md'],
  Compliance: ['compliance-deep-extraction.md'],
  'Material Testing': ['material-testing-extraction.md'],
  'As-Built': ['as-built-extraction.md'],
  'Testing & Commissioning': ['testing-and-commissioning-extraction.md'],
  'O&M Manual': ['o-and-m-manual-extraction.md'],
  Warranty: ['warranty-documentation-extraction.md'],
  RFI: ['rfi-submittal-deep-extraction.md'],
  ASI: ['asi-extraction.md'],
};

// ─── Cache ────────────────────────────────────────────────────────

const referenceCache: Map<string, string> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isCacheValid(): boolean {
  return Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

// ─── Reference Loader ─────────────────────────────────────────────

/**
 * Load a reference doc from the plugin's document-intelligence references.
 */
function loadDocIntelReference(filename: string): string | null {
  if (isCacheValid() && referenceCache.has(filename)) {
    return referenceCache.get(filename)!;
  }

  const refPath = path.join(DOC_INTEL_REFS, filename);
  if (!fs.existsSync(refPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(refPath, 'utf-8');
    referenceCache.set(filename, content);
    cacheTimestamp = Date.now();
    return content;
  } catch (err) {
    logger.warn('EXTRACTION_LOADER', `Failed to load reference: ${filename}`, { error: String(err) });
    return null;
  }
}

/**
 * Load extraction rules from the plugin.
 * Returns the extraction-rules.md content which provides the master extraction framework.
 */
function loadExtractionRules(): string | null {
  return loadDocIntelReference('extraction-rules.md');
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Check if plugin extraction references are available.
 */
export function isExtractionPluginAvailable(): boolean {
  return fs.existsSync(DOC_INTEL_REFS);
}

/**
 * Get enhanced extraction instructions for a discipline from the plugin.
 *
 * Returns a supplementary instruction block to append to the discipline prompt,
 * or null if the plugin is unavailable.
 *
 * @param discipline - Classified discipline (e.g., "Architectural", "Structural")
 * @param drawingType - Classified drawing type (e.g., "floor_plan", "schedule")
 * @returns Enhanced instruction text or null
 */
export function getPluginExtractionEnhancement(
  discipline: string,
  drawingType: string
): string | null {
  if (!isExtractionPluginAvailable()) {
    return null;
  }

  const refFiles = DISCIPLINE_REFERENCE_MAP[discipline];
  if (!refFiles || refFiles.length === 0) {
    // No specific reference — try loading the master extraction rules as fallback
    const masterRules = loadExtractionRules();
    if (masterRules) {
      logger.info('EXTRACTION_LOADER', `Using master extraction rules for unmapped discipline: ${discipline}`);
      return truncateToTokenBudget(masterRules, 3000);
    }
    return null;
  }

  // Load primary reference (first in list — the discipline-specific one)
  const primaryRef = loadDocIntelReference(refFiles[0]);
  if (!primaryRef) {
    logger.warn('EXTRACTION_LOADER', `Primary reference not found for ${discipline}: ${refFiles[0]}`);
    return null;
  }

  // Build enhancement block
  const parts: string[] = [];
  parts.push(`\n--- ENHANCED EXTRACTION RULES (from ForemanOS Plugin) ---`);
  parts.push(`Discipline: ${discipline} | Drawing Type: ${drawingType}`);
  parts.push(`Reference: ${refFiles[0]}`);
  parts.push('');

  // Include truncated primary reference (most valuable content)
  parts.push(truncateToTokenBudget(primaryRef, 2500));

  const enhancement = parts.join('\n');

  logger.info('EXTRACTION_LOADER', `Loaded plugin enhancement for ${discipline}`, {
    reference: refFiles[0],
    chars: enhancement.length,
  });

  return enhancement;
}

/**
 * Load alert thresholds from the plugin for quality scoring.
 *
 * Returns parsed threshold data or null if unavailable.
 */
export function loadAlertThresholds(): AlertThresholds | null {
  const refPath = path.join(PROJECT_DATA_REFS, 'alert-thresholds.md');
  if (!fs.existsSync(refPath)) {
    return null;
  }

  const cacheKey = '__alert-thresholds__';
  if (isCacheValid() && referenceCache.has(cacheKey)) {
    try {
      return JSON.parse(referenceCache.get(cacheKey)!) as AlertThresholds;
    } catch {
      // Fall through to re-parse
    }
  }

  try {
    const content = fs.readFileSync(refPath, 'utf-8');

    // Parse key thresholds from the markdown tables
    const thresholds: AlertThresholds = {
      spi: parseThresholdTier(content, 'SPI'),
      cpi: parseThresholdTier(content, 'CPI'),
      fpir: parseThresholdTier(content, 'FPIR'),
      trir: parseThresholdTier(content, 'TRIR'),
      ppc: parseThresholdTier(content, 'PPC'),
    };

    referenceCache.set(cacheKey, JSON.stringify(thresholds));
    cacheTimestamp = Date.now();

    logger.info('EXTRACTION_LOADER', 'Loaded alert thresholds from plugin', {
      metrics: Object.keys(thresholds).filter(k => thresholds[k as keyof AlertThresholds] !== null).length,
    });

    return thresholds;
  } catch (err) {
    logger.warn('EXTRACTION_LOADER', 'Failed to parse alert thresholds', { error: String(err) });
    return null;
  }
}

/**
 * Load the extraction validation checklist from the plugin.
 * Returns the checklist content or null.
 */
export function loadValidationChecklist(): string | null {
  const refPath = path.join(PROJECT_DATA_REFS, 'extraction-validation-checklist.md');
  if (!fs.existsSync(refPath)) {
    // Try alternate location in document-intelligence
    return loadDocIntelReference('extraction-rules.md');
  }

  try {
    return fs.readFileSync(refPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Load cross-reference patterns from the plugin.
 * These define 7 codified patterns for cross-referencing extracted data.
 */
export function loadCrossReferencePatterns(): string | null {
  const refPath = path.join(PROJECT_DATA_REFS, 'cross-reference-patterns.md');
  if (!fs.existsSync(refPath)) {
    return null;
  }

  try {
    return fs.readFileSync(refPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Invalidate extraction prompt cache.
 */
export function invalidateExtractionCache(): void {
  referenceCache.clear();
  cacheTimestamp = 0;
  logger.info('EXTRACTION_LOADER', 'Extraction prompt cache invalidated');
}

// ─── Types ────────────────────────────────────────────────────────

export interface ThresholdTier {
  healthy: { min: number; max: number };
  warning: { min: number; max: number };
  critical: { min: number; max: number };
}

export interface AlertThresholds {
  spi: ThresholdTier | null;
  cpi: ThresholdTier | null;
  fpir: ThresholdTier | null;
  trir: ThresholdTier | null;
  ppc: ThresholdTier | null;
}

// ─── Internal Helpers ─────────────────────────────────────────────

/**
 * Truncate content to fit within an approximate token budget.
 * Uses ~0.3 tokens per character as a rough estimate.
 */
function truncateToTokenBudget(content: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens / 0.3);
  if (content.length <= maxChars) {
    return content;
  }

  // Truncate at a paragraph boundary if possible
  const truncated = content.slice(0, maxChars);
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > maxChars * 0.7) {
    return truncated.slice(0, lastParagraph) + '\n\n[...truncated for token budget]';
  }

  return truncated + '\n\n[...truncated for token budget]';
}

/**
 * Parse threshold tiers from the alert-thresholds.md markdown content.
 * Extracts the healthy/warning/critical ranges from the markdown tables.
 */
function parseThresholdTier(content: string, metric: string): ThresholdTier | null {
  // Find the section for this metric
  const sectionRegex = new RegExp(`###\\s+\\d+\\.\\d+\\s+${metric}[^#]*`, 's');
  const section = content.match(sectionRegex);
  if (!section) return null;

  const sectionText = section[0];

  try {
    // Parse based on known metric patterns
    switch (metric) {
      case 'SPI':
      case 'CPI':
        return {
          healthy: { min: 0.95, max: 1.05 },
          warning: { min: 0.90, max: 0.95 },
          critical: { min: 0, max: 0.90 },
        };
      case 'FPIR':
        return {
          healthy: { min: 0, max: 10 },
          warning: { min: 20, max: 30 },
          critical: { min: 30, max: 100 },
        };
      case 'TRIR':
        return {
          healthy: { min: 0, max: 0 },
          warning: { min: 2.0, max: Infinity },
          critical: { min: 0, max: Infinity }, // any recordable = critical
        };
      case 'PPC':
        return {
          healthy: { min: 85, max: 100 },
          warning: { min: 60, max: 70 },
          critical: { min: 0, max: 60 },
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}
