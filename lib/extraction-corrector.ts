/**
 * Extraction Corrector — E->V->C correction loop
 *
 * When quality check fails, builds a targeted correction prompt from:
 * - Original extracted JSON + specific issues/suggestions
 * - Plugin validation checklist + extraction rules
 * - Discipline-specific reference
 * Then calls interpretWithFallback() (Opus -> GPT-5.2)
 */
import { interpretWithFallback } from './interpretation-service';
import { performQualityCheck, type QualityCheckResult, type ExtractedData } from './vision-api-quality';
import { loadValidationChecklist, getPluginExtractionEnhancement } from '@/lib/plugin';
import { normalizeExtractedData } from './data-normalizer';
import { logger } from '@/lib/logger';

export interface CorrectionResult {
  correctedData: ExtractedData;
  qualityBefore: number;
  qualityAfter: number;
  improved: boolean;
  correctionProvider: string;
  correctionDuration: number;
  estimatedCost: number;
  normalizationsApplied: string[];
}

export async function correctExtraction(
  originalData: ExtractedData,
  qualityResult: QualityCheckResult,
  pageNumber: number,
  discipline: string,
  options?: { timeout?: number }
): Promise<CorrectionResult> {
  const startTime = Date.now();
  const timeout = options?.timeout || 30000;

  // Build correction prompt with issues, suggestions, plugin validation checklist, and discipline reference
  const correctionPrompt = buildCorrectionPrompt(originalData, qualityResult, pageNumber, discipline);

  // Call interpretWithFallback with timeout wrapper
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const interpResult = await interpretWithFallback(
      JSON.stringify(originalData),
      pageNumber,
      {
        tierPrefix: 'correction',
        additionalContext: correctionPrompt,
      }
    );
    clearTimeout(timeoutId);

    // Parse corrected data
    let correctedData: ExtractedData;
    try {
      correctedData = JSON.parse(interpResult.content);
    } catch {
      // If parse fails, return original with no improvement
      return {
        correctedData: originalData,
        qualityBefore: qualityResult.score,
        qualityAfter: qualityResult.score,
        improved: false,
        correctionProvider: interpResult.interpretationProvider || 'none',
        correctionDuration: Date.now() - startTime,
        estimatedCost: interpResult.estimatedCost,
        normalizationsApplied: [],
      };
    }

    // Normalize corrected data
    const normalized = normalizeExtractedData(correctedData, discipline);
    const finalData = normalized.normalizedData;

    // Re-score quality
    const newQuality = performQualityCheck(finalData, pageNumber);

    return {
      correctedData: finalData,
      qualityBefore: qualityResult.score,
      qualityAfter: newQuality.score,
      improved: newQuality.score > qualityResult.score,
      correctionProvider: interpResult.interpretationProvider || 'none',
      correctionDuration: Date.now() - startTime,
      estimatedCost: interpResult.estimatedCost,
      normalizationsApplied: normalized.changesApplied,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('abort') || errMsg.includes('Abort')) {
      throw new Error('timeout');
    }
    throw error;
  }
}

function buildCorrectionPrompt(
  data: ExtractedData,
  qualityResult: QualityCheckResult,
  pageNumber: number,
  discipline: string,
): string {
  const parts: string[] = [];

  parts.push(`CORRECTION TASK for Page ${pageNumber} (${discipline} discipline):`);
  parts.push('');

  if (qualityResult.issues.length > 0) {
    parts.push('ISSUES FOUND:');
    qualityResult.issues.forEach((issue, i) => parts.push(`  ${i + 1}. ${issue}`));
    parts.push('');
  }

  if (qualityResult.suggestions.length > 0) {
    parts.push('SUGGESTIONS:');
    qualityResult.suggestions.forEach((sug, i) => parts.push(`  ${i + 1}. ${sug}`));
    parts.push('');
  }

  // Load plugin validation checklist
  const checklist = loadValidationChecklist();
  if (checklist) {
    parts.push('VALIDATION CHECKLIST:');
    // Truncate to first 2000 chars
    parts.push(checklist.substring(0, 2000));
    parts.push('');
  }

  // Load discipline-specific reference
  const pluginRef = getPluginExtractionEnhancement(discipline, data.drawingType || 'unknown');
  if (pluginRef) {
    parts.push('DISCIPLINE-SPECIFIC EXTRACTION RULES:');
    parts.push(pluginRef.substring(0, 2000));
    parts.push('');
  }

  parts.push('Fix the issues above. Return the complete corrected JSON. Preserve all correctly extracted fields.');

  return parts.join('\n');
}

// Also export the prompt builder for use in generateCorrectionPrompt in vision-api-quality.ts
export { buildCorrectionPrompt as generateCorrectionPrompt };
