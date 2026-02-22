/**
 * Discipline Classifier
 *
 * Lightweight page classification using Claude Haiku to determine
 * discipline, drawing type, sheet number, and confidence for each
 * construction document page before full extraction.
 */

import { logger } from '@/lib/logger';

/** Cost per page for Haiku classification (~$0.0002) */
export const HAIKU_CLASSIFICATION_COST = 0.0002;

/** Model used for lightweight classification */
const CLASSIFICATION_MODEL = 'claude-haiku-4-5-20251001';

/** Valid discipline values */
export type Discipline =
  | 'Architectural'
  | 'Structural'
  | 'Mechanical'
  | 'Electrical'
  | 'Plumbing'
  | 'Civil'
  | 'Fire Protection'
  | 'General'
  | 'Specification'
  | 'Schedule'
  | 'Cover';

/** Valid drawing type values */
export type DrawingType =
  | 'floor_plan'
  | 'elevation'
  | 'section'
  | 'detail'
  | 'schedule'
  | 'specification'
  | 'cover'
  | 'site_plan'
  | 'reflected_ceiling'
  | 'roof_plan'
  | 'diagram'
  | 'general_notes'
  | 'unknown';

/** Classification result from Haiku */
export interface ClassificationResult {
  discipline: Discipline;
  drawingType: DrawingType;
  sheetNumber: string;
  confidence: number;
}

const DEFAULT_RESULT: ClassificationResult = {
  discipline: 'General',
  drawingType: 'unknown',
  sheetNumber: '',
  confidence: 0,
};

const CLASSIFICATION_PROMPT = `Classify this construction document page.
Return ONLY this JSON — no other text:
{
  "sheetNumber": "from title block or header",
  "discipline": "Architectural|Structural|Mechanical|Electrical|Plumbing|Civil|Fire Protection|General|Specification|Schedule|Cover",
  "drawingType": "floor_plan|elevation|section|detail|schedule|specification|cover|site_plan|reflected_ceiling|roof_plan|diagram|general_notes",
  "confidence": 0.0-1.0
}`;

/**
 * Classify a construction document page using Claude Haiku.
 * Returns discipline, drawing type, sheet number, and confidence.
 * Falls back to safe defaults on any error.
 */
export async function classifyPage(
  base64Image: string
): Promise<ClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn('DISCIPLINE_CLASSIFIER', 'ANTHROPIC_API_KEY not set, returning default');
    return DEFAULT_RESULT;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLASSIFICATION_MODEL,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: CLASSIFICATION_PROMPT,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      logger.error('DISCIPLINE_CLASSIFIER', 'API request failed', undefined, {
        status: response.status,
        error: errorText,
      });
      return DEFAULT_RESULT;
    }

    const data = await response.json();
    const text =
      data?.content?.[0]?.type === 'text' ? data.content[0].text : '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('DISCIPLINE_CLASSIFIER', 'No JSON found in response', {
        text: text.slice(0, 200),
      });
      return DEFAULT_RESULT;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const result: ClassificationResult = {
      discipline: parsed.discipline || 'General',
      drawingType: parsed.drawingType || 'unknown',
      sheetNumber: parsed.sheetNumber || '',
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0,
    };

    logger.info('DISCIPLINE_CLASSIFIER', 'Page classified', {
      discipline: result.discipline,
      drawingType: result.drawingType,
      sheetNumber: result.sheetNumber,
      confidence: result.confidence,
    });

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('DISCIPLINE_CLASSIFIER', 'Classification timed out (30s)', error);
    } else {
      logger.error('DISCIPLINE_CLASSIFIER', 'Classification failed', error);
    }
    return DEFAULT_RESULT;
  }
}
