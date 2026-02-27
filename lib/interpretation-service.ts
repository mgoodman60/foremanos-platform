/**
 * Interpretation Service
 *
 * Public module for text-only interpretation of raw extraction JSON.
 * Extracted from document-processor-batch.ts for reuse in E->V->C correction loop.
 *
 * Chain: Opus interpretation -> GPT-5.2 fallback -> raw passthrough
 */

import { logger } from '@/lib/logger';
import { PREMIUM_MODEL } from '@/lib/model-config';
import type { VisionProvider } from './vision-api-multi-provider';

export interface InterpretationResult {
  content: string;
  interpretationProvider: VisionProvider | null;
  processingTier: string;
  durationMs: number;
  estimatedCost: number;
}

export interface InterpretationOptions {
  tierPrefix?: string;
  additionalContext?: string;
  includeValidationChecklist?: boolean;
  timeoutMs?: number;
}

/**
 * Strip JSON from LLM response (markdown wrappers, text before first {, etc.)
 * Mirrors the private stripToJson in document-processor-batch.ts.
 */
function stripToJson(raw: string): string {
  let content = raw;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    content = jsonMatch[1].trim();
  }
  const firstBrace = content.indexOf('{');
  if (firstBrace > 0) {
    content = content.substring(firstBrace);
  }
  const lastBrace = content.lastIndexOf('}');
  if (lastBrace >= 0 && lastBrace < content.length - 1) {
    content = content.substring(0, lastBrace + 1);
  }
  return content;
}

/**
 * Call Opus for text-only interpretation of raw extraction JSON.
 * Validates, corrects, enriches, and adds confidence scores.
 * Mirrors the private callOpusInterpretation in document-processor-batch.ts,
 * with an optional additionalContext parameter for the correction loop.
 */
export async function callOpusInterpretation(
  extractedJson: string,
  pageNumber: number,
  additionalContext?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured for interpretation');
  }

  const contextSection = additionalContext
    ? `\nADDITIONAL CONTEXT:\n${additionalContext}\n`
    : '';

  const prompt = `You are a construction document intelligence expert. You've been given raw extraction data from a construction drawing page. Your job is to VALIDATE, CORRECT, ENRICH, and add CONFIDENCE scores.

INPUT: Raw JSON extraction from Page ${pageNumber}
${extractedJson}
${contextSection}
TASKS:
1. VALIDATE - Check internal consistency:
   - Sheet number format matches discipline (M-101 = Mechanical, A-101 = Architectural, etc.)
   - Room numbers referenced in fixtures/equipment exist in rooms array
   - Dimensions are physically reasonable for construction
   - CSI codes are correctly formatted (XX XX XX pattern)

2. CORRECT - Fix common extraction errors:
   - OCR errors in sheet numbers (0 vs O, 1 vs I/l)
   - Standardize dimension formats (mix of feet/inches notation)
   - Fix misspelled trade/discipline names
   - Normalize room names/numbers

3. ENRICH - Add derived intelligence:
   - Infer discipline from sheet number if not already set
   - Calculate approximate room areas from bounds if dimensions available
   - Identify potential coordination conflicts between trades
   - Map fixtures to CSI divisions where possible

4. CONFIDENCE - Score each populated category (0.0-1.0):
   - Add _confidence object with per-category scores
   - Add _overallConfidence (0.0-1.0) as weighted average
   - Add _corrections array listing what was changed
   - Add _enrichments array listing what was added
   - Add _validationIssues array listing problems found

Respond with the complete JSON (original data + your additions). Preserve ALL original fields.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 120s — large JSON prompts can be slow

  try {
    logger.info('OPUS_INTERPRETATION', `Starting interpretation for page ${pageNumber}`);

    const requestBody = JSON.stringify({
      model: PREMIUM_MODEL,
      max_tokens: 8000,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const fetchStart = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`);
    }

    const data = JSON.parse(responseText);
    const content = data.content?.[0]?.text || '';

    if (!content) {
      throw new Error('Empty response from Opus interpretation');
    }

    const elapsedMs = Date.now() - fetchStart;
    logger.info('OPUS_INTERPRETATION', `Interpretation complete for page ${pageNumber}`, { elapsedMs, contentLength: content.length });

    return content;
  } catch (error: unknown) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('OPUS_INTERPRETATION', `Timeout after 120s for page ${pageNumber}`);
      throw new Error('Opus interpretation timed out');
    }

    logger.error('OPUS_INTERPRETATION', `Failed for page ${pageNumber}`, error);
    throw error;
  }
}

/**
 * Call GPT-5.2 for text-only interpretation of raw extraction JSON.
 * Fallback when Opus interpretation fails.
 * Mirrors the private callGPT52Interpretation in document-processor-batch.ts,
 * with an optional additionalContext parameter for the correction loop.
 */
export async function callGPT52Interpretation(
  extractedJson: string,
  pageNumber: number,
  additionalContext?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured for interpretation');
  }

  const contextSection = additionalContext
    ? `\nADDITIONAL CONTEXT:\n${additionalContext}\n`
    : '';

  const prompt = `You are a construction document intelligence expert. You've been given raw extraction data from a construction drawing page. Your job is to VALIDATE, CORRECT, ENRICH, and add CONFIDENCE scores.

INPUT: Raw JSON extraction from Page ${pageNumber}
${extractedJson}
${contextSection}
TASKS:
1. VALIDATE - Check internal consistency:
   - Sheet number format matches discipline (M-101 = Mechanical, A-101 = Architectural, etc.)
   - Room numbers referenced in fixtures/equipment exist in rooms array
   - Dimensions are physically reasonable for construction
   - CSI codes are correctly formatted (XX XX XX pattern)

2. CORRECT - Fix common extraction errors:
   - OCR errors in sheet numbers (0 vs O, 1 vs I/l)
   - Standardize dimension formats (mix of feet/inches notation)
   - Fix misspelled trade/discipline names
   - Normalize room names/numbers

3. ENRICH - Add derived intelligence:
   - Infer discipline from sheet number if not already set
   - Calculate approximate room areas from bounds if dimensions available
   - Identify potential coordination conflicts between trades
   - Map fixtures to CSI divisions where possible

4. CONFIDENCE - Score each populated category (0.0-1.0):
   - Add _confidence object with per-category scores
   - Add _overallConfidence (0.0-1.0) as weighted average
   - Add _corrections array listing what was changed
   - Add _enrichments array listing what was added
   - Add _validationIssues array listing problems found

Respond with the complete JSON (original data + your additions). Preserve ALL original fields.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 120s

  try {
    logger.info('GPT52_INTERPRETATION', `Starting interpretation for page ${pageNumber}`);

    const requestBody = JSON.stringify({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_completion_tokens: 8000,
      temperature: 0.1,
    });

    const fetchStart = Date.now();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`);
    }

    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new Error('Empty response from GPT-5.2 interpretation');
    }

    const elapsedMs = Date.now() - fetchStart;
    logger.info('GPT52_INTERPRETATION', `Interpretation complete for page ${pageNumber}`, { elapsedMs, contentLength: content.length });

    return content;
  } catch (error: unknown) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('GPT52_INTERPRETATION', `Timeout after 120s for page ${pageNumber}`);
      throw new Error('GPT-5.2 interpretation timed out');
    }

    logger.error('GPT52_INTERPRETATION', `Failed for page ${pageNumber}`, error);
    throw error;
  }
}

/**
 * Interpret extracted JSON with Opus, falling back to GPT-5.2, then raw passthrough.
 * Public version of the private interpretWithFallback closure in document-processor-batch.ts.
 * Used by the E->V->C correction loop (Phase 2+).
 */
export async function interpretWithFallback(
  jsonContent: string,
  pageNumber: number,
  options: InterpretationOptions = {}
): Promise<InterpretationResult> {
  const { tierPrefix = 'correction', additionalContext } = options;
  const startTime = Date.now();

  // Try Opus first
  try {
    const enrichedContent = await callOpusInterpretation(jsonContent, pageNumber, additionalContext);
    const enrichedJson = stripToJson(enrichedContent);
    JSON.parse(enrichedJson); // Validate
    return {
      content: enrichedJson,
      interpretationProvider: 'claude-opus-4-6' as VisionProvider,
      processingTier: tierPrefix,
      durationMs: Date.now() - startTime,
      estimatedCost: 0.08, // ~$0.08 per Opus interpretation
    };
  } catch (opusError: unknown) {
    const errMsg = opusError instanceof Error ? opusError.message : String(opusError);
    logger.warn('INTERPRETATION_SERVICE', `Opus interpretation failed, trying GPT-5.2`, { error: errMsg, pageNumber });
  }

  // GPT-5.2 fallback
  try {
    const gptContent = await callGPT52Interpretation(jsonContent, pageNumber, additionalContext);
    const gptJson = stripToJson(gptContent);
    JSON.parse(gptJson); // Validate
    return {
      content: gptJson,
      interpretationProvider: 'gpt-5.2' as VisionProvider,
      processingTier: `${tierPrefix}-gpt-fallback`,
      durationMs: Date.now() - startTime,
      estimatedCost: 0.03, // ~$0.03 per GPT-5.2 interpretation
    };
  } catch (gptError: unknown) {
    const errMsg = gptError instanceof Error ? gptError.message : String(gptError);
    logger.warn('INTERPRETATION_SERVICE', `GPT-5.2 interpretation also failed, returning raw`, { error: errMsg, pageNumber });
  }

  // Both failed — return raw JSON as passthrough
  return {
    content: jsonContent,
    interpretationProvider: null,
    processingTier: `${tierPrefix}-raw-passthrough`,
    durationMs: Date.now() - startTime,
    estimatedCost: 0,
  };
}
