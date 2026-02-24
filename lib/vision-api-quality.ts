/**
 * Quality Validation Layer for Vision API Responses
 *
 * Validates extracted data completeness and assigns confidence scores
 * to determine if response should be accepted or retried with different provider.
 *
 * PLUGIN INTEGRATION: When the ai-intelligence submodule is available,
 * alert thresholds for KPI scoring (SPI, CPI, FPIR, TRIR, PPC) are loaded
 * from the plugin's alert-thresholds.md reference doc. Base quality scoring
 * for document extraction remains hardcoded for stability.
 */
import { loadAlertThresholds, type AlertThresholds } from '@/lib/plugin';

// Plugin-loaded thresholds (lazy-loaded, cached)
let _pluginThresholds: AlertThresholds | null | undefined;
function getPluginThresholds(): AlertThresholds | null {
  if (_pluginThresholds === undefined) {
    _pluginThresholds = loadAlertThresholds();
  }
  return _pluginThresholds;
}

/** Reset plugin threshold cache (call when submodule is updated) */
export function resetPluginThresholdCache(): void {
  _pluginThresholds = undefined;
}

/**
 * Get project health alert thresholds.
 * Returns plugin-defined thresholds if available, otherwise returns hardcoded defaults.
 */
export function getAlertThresholds(): AlertThresholds {
  const plugin = getPluginThresholds();
  if (plugin) return plugin;

  // Hardcoded defaults (kept as fallback)
  return {
    spi: { healthy: { min: 0.95, max: 1.05 }, warning: { min: 0.90, max: 0.95 }, critical: { min: 0, max: 0.90 } },
    cpi: { healthy: { min: 0.95, max: 1.05 }, warning: { min: 0.90, max: 0.95 }, critical: { min: 0, max: 0.90 } },
    fpir: { healthy: { min: 0, max: 10 }, warning: { min: 20, max: 30 }, critical: { min: 30, max: 100 } },
    trir: { healthy: { min: 0, max: 0 }, warning: { min: 2.0, max: Infinity }, critical: { min: 0, max: Infinity } },
    ppc: { healthy: { min: 85, max: 100 }, warning: { min: 60, max: 70 }, critical: { min: 0, max: 60 } },
  };
}

export interface QualityCheckResult {
  passed: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

export interface ExtractedData {
  sheetNumber?: string;
  sheetTitle?: string;
  scale?: string;
  content?: string;
  _overallConfidence?: number;
  _corrections?: string[];
  _enrichments?: string[];
  _validationIssues?: string[];
  _confidence?: Record<string, number>;
  [key: string]: any;
}

/** Structural fields checked for page complexity and quality scoring */
export const STRUCTURAL_FIELDS = [
  'dimensions',
  'gridLines',
  'rooms',
  'doors',
  'windows',
  'equipment',
  'symbolData',
  'siteAndConcrete',
  'visualMaterials',
  'plumbingFixtures',
  'electricalDevices',
  'spatialData',
  'constructionIntel',
  'drawingScheduleTables',
  'hvacData',
  'fireProtection',
] as const;

/**
 * Perform comprehensive quality check on extracted construction document data
 */
export function performQualityCheck(
  data: ExtractedData,
  pageNumber: number,
  minScore: number = 50
): QualityCheckResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Critical fields check (60 points total)
  
  // Sheet number (20 points)
  if (data.sheetNumber && data.sheetNumber.trim() !== '' && data.sheetNumber !== 'N/A') {
    score += 20;
  } else {
    issues.push('Missing or invalid sheet number');
    suggestions.push('Look for sheet number in title block (usually bottom-right corner)');
  }

  // Sheet title (15 points)
  if (data.sheetTitle && data.sheetTitle.trim() !== '' && data.sheetTitle !== 'N/A') {
    score += 15;
  } else {
    issues.push('Missing or invalid sheet title');
    suggestions.push('Look for drawing title in title block');
  }

  // Scale (15 points)
  if (data.scale && data.scale.trim() !== '' && data.scale !== 'N/A') {
    score += 15;
  } else {
    issues.push('Missing or invalid scale information');
    suggestions.push('Look for scale notation (e.g., 1/4"=1\'-0", 1:100)');
  }

  // Content quality (10 points)
  if (data.content) {
    const contentLength = data.content.length;
    if (contentLength > 500) {
      score += 10;
    } else if (contentLength > 200) {
      score += 5;
    } else if (contentLength > 50) {
      score += 2;
    } else {
      issues.push('Insufficient content extracted');
      suggestions.push('Ensure OCR is reading all visible text and annotations');
    }
  }

  // Structural elements check (40 points)
  const structuralFields = STRUCTURAL_FIELDS;

  let structuralFieldsFound = 0;
  structuralFields.forEach(field => {
    if (data[field] && 
        (Array.isArray(data[field]) ? data[field].length > 0 : data[field] !== 'N/A')) {
      structuralFieldsFound++;
    }
  });

  // Award points based on how many structural fields were found
  const structuralScore = Math.min(40, (structuralFieldsFound / structuralFields.length) * 40);
  score += structuralScore;

  if (structuralFieldsFound === 0) {
    issues.push('No structural elements detected');
    suggestions.push('Ensure extraction includes dimensions, grid lines, room labels, etc.');
  } else if (structuralFieldsFound < 3) {
    suggestions.push('Consider extracting more structural elements for better context');
  }

  // Determine if check passed
  const passed = score >= minScore && issues.length <= 2;

  return {
    passed,
    score,
    issues,
    suggestions,
  };
}

/**
 * Check if response indicates a blank or empty page
 */
export function isBlankPage(data: ExtractedData): boolean {
  // Check for explicit blank page indicators
  const blankIndicators = [
    'blank page',
    'empty page',
    'no content',
    'not applicable',
  ];

  const contentLower = (data.content || '').toLowerCase();
  if (blankIndicators.some(indicator => contentLower.includes(indicator))) {
    return true;
  }

  // Check if all critical fields are missing or N/A
  const criticalFieldsMissing = 
    (!data.sheetNumber || data.sheetNumber === 'N/A') &&
    (!data.sheetTitle || data.sheetTitle === 'N/A') &&
    (!data.scale || data.scale === 'N/A') &&
    (!data.content || data.content.length < 50);

  return criticalFieldsMissing;
}

export type PageComplexity = 'blank' | 'simple' | 'complex';

/**
 * Assess page complexity to determine which pipeline passes to run.
 * - blank: No meaningful content → skip Pass 2 and Pass 3
 * - simple: Title block only, <3 structural fields → skip Pass 2 and Pass 3
 * - complex: 3+ structural fields → run full three-pass pipeline
 */
export function assessPageComplexity(data: ExtractedData): PageComplexity {
  if (isBlankPage(data)) return 'blank';

  let found = 0;
  for (const field of STRUCTURAL_FIELDS) {
    const value = data[field];
    if (value && (Array.isArray(value) ? value.length > 0 : value !== 'N/A')) {
      found++;
    }
  }

  return found < 3 ? 'simple' : 'complex';
}

/**
 * Format quality check result for logging
 */
export function formatQualityReport(result: QualityCheckResult, pageNumber: number): string {
  let report = `\n=== Quality Check: Page ${pageNumber} ===\n`;
  report += `Score: ${result.score}/100 (${result.passed ? 'PASSED' : 'FAILED'})\n`;
  
  if (result.issues.length > 0) {
    report += `\nIssues (${result.issues.length}):\n`;
    result.issues.forEach((issue, i) => {
      report += `  ${i + 1}. ${issue}\n`;
    });
  }
  
  if (result.suggestions.length > 0) {
    report += `\nSuggestions (${result.suggestions.length}):\n`;
    result.suggestions.forEach((suggestion, i) => {
      report += `  ${i + 1}. ${suggestion}\n`;
    });
  }
  
  report += `=================================\n`;
  return report;
}

export interface TwoTierQualityResult extends QualityCheckResult {
  twoTierBonus: number;
  overallConfidence: number | null;
  correctionsCount: number;
  enrichmentsCount: number;
  validationIssuesCount: number;
}

/**
 * Score a multi-pass extraction result (Gemini extraction + optional validation + Opus/GPT interpretation)
 * Builds on base performQualityCheck with multi-pass bonuses/penalties
 */
export function scoreMultiPassResult(
  data: ExtractedData,
  pageNumber: number,
  minScore: number = 50
): TwoTierQualityResult {
  const baseResult = performQualityCheck(data, pageNumber, minScore);

  let twoTierBonus = 0;
  const overallConfidence = data._overallConfidence ?? null;
  const correctionsCount = data._corrections?.length ?? 0;
  const enrichmentsCount = data._enrichments?.length ?? 0;
  const validationIssuesCount = data._validationIssues?.length ?? 0;

  // Bonus: high overall confidence from interpretation pass
  if (typeof overallConfidence === 'number' && overallConfidence >= 0.8) {
    twoTierBonus += 10;
  }

  // Bonus: corrections were made (interpretation pass added value)
  if (correctionsCount > 0) {
    twoTierBonus += 5;
  }

  // Bonus: enrichments were added
  if (enrichmentsCount > 0) {
    twoTierBonus += 5;
  }

  // Bonus: zero validation issues (clean extraction)
  if (validationIssuesCount === 0) {
    twoTierBonus += 5;
  }

  // Penalty: too many validation issues
  if (validationIssuesCount > 5) {
    twoTierBonus -= 10;
  }

  // Bonus: three-pass data (both corrections and enrichments present from validation pass)
  if (data._corrections && data._corrections.length > 0 &&
      data._enrichments && data._enrichments.length > 0) {
    twoTierBonus += 5;
  }

  const finalScore = Math.max(0, Math.min(100, baseResult.score + twoTierBonus));

  return {
    ...baseResult,
    score: finalScore,
    passed: finalScore >= minScore && baseResult.issues.length <= 2,
    twoTierBonus,
    overallConfidence,
    correctionsCount,
    enrichmentsCount,
    validationIssuesCount,
  };
}

/** Backward compatibility alias */
export const scoreTwoTierResult = scoreMultiPassResult;
