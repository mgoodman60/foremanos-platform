/**
 * Scale Data Extractor
 * Extracts drawing scale information using Vision API
 * Part of Phase A - Foundation Intelligence
 */

import { callAbacusLLM } from './abacus-llm';
import { type DrawingScale, type SheetScaleData, extractScalesWithPatterns } from './scale-detector';

export interface ScaleData {
  found: boolean;
  primary?: DrawingScale;
  secondary?: DrawingScale[];
  hasMultipleScales: boolean;
  confidence: number;
}

/**
 * Extract scale data from a drawing page using Vision API
 */
export async function extractScaleData(
  imageBase64OrUrl: string,
  pageNumber: number
): Promise<ScaleData> {
  try {
    const isUrl = imageBase64OrUrl.startsWith('http');
    const prompt = getScaleExtractionPrompt();

    let response;
    if (isUrl) {
      // Fetch and convert URL to base64
      const imageResponse = await fetch(imageBase64OrUrl);
      const buffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      response = await callAbacusLLM(
        [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64}` },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        {
          response_format: { type: 'json_object' },
          max_tokens: 1000,
        }
      );
    } else {
      response = await callAbacusLLM(
        [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64OrUrl}` },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        {
          response_format: { type: 'json_object' },
          max_tokens: 1000,
        }
      );
    }

    // Strip markdown code blocks if present
    let contentToParse = response.content;
    const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      contentToParse = jsonMatch[1].trim();
    }

    const result = JSON.parse(contentToParse);

    if (!result.found || !result.primaryScale) {
      return {
        found: false,
        hasMultipleScales: false,
        confidence: 0,
      };
    }

    // Parse primary scale
    const primaryScale = parseScaleFromAI(result.primaryScale);
    const secondaryScales = result.secondaryScales
      ? result.secondaryScales.map(parseScaleFromAI)
      : [];

    return {
      found: true,
      primary: primaryScale,
      secondary: secondaryScales.length > 0 ? secondaryScales : undefined,
      hasMultipleScales: secondaryScales.length > 0,
      confidence: result.confidence || 0.8,
    };
  } catch (error) {
    console.error(`Error extracting scale from page ${pageNumber}:`, error);
    return {
      found: false,
      hasMultipleScales: false,
      confidence: 0,
    };
  }
}

/**
 * Parse AI response into DrawingScale object
 */
function parseScaleFromAI(scaleData: any): DrawingScale {
  const scaleString = scaleData.scaleString || scaleData.text || 'Unknown';
  const ratio = parseScaleRatio(scaleString);

  return {
    scaleString,
    scaleRatio: ratio,
    format: determineScaleFormat(scaleString),
    isMultiple: false,
    viewportName: scaleData.viewport || scaleData.viewportName,
    confidence: scaleData.confidence || 0.8,
  };
}

/**
 * Parse scale string into numerical ratio
 */
function parseScaleRatio(scaleString: string): number {
  // Architectural with fraction: 1/4"=1'-0" → 48
  const archFractionMatch = scaleString.match(/(\d+)\/(\d+)"\s*=\s*1'-?0?"/);
  if (archFractionMatch) {
    const numerator = parseInt(archFractionMatch[1]);
    const denominator = parseInt(archFractionMatch[2]);
    return 12 * (denominator / numerator); // 12 inches per foot
  }

  // Architectural with whole number: 3"=1'-0" → 32
  const archWholeMatch = scaleString.match(/(\d+)"\s*=\s*1'-?0?"/);
  if (archWholeMatch) {
    const inches = parseInt(archWholeMatch[1]);
    return 12 / inches; // 12 inches per foot divided by scale inches
  }

  // Metric: 1:100 → 100
  const metricMatch = scaleString.match(/1\s*:\s*(\d+)/);
  if (metricMatch) {
    return parseInt(metricMatch[1]);
  }

  // Engineering: 1"=10' → 120
  const engMatch = scaleString.match(/1"\s*=\s*(\d+)'/);
  if (engMatch) {
    return parseInt(engMatch[1]) * 12;
  }

  return 1; // Default to 1:1 if can't parse
}

/**
 * Determine scale format from scale string
 */
function determineScaleFormat(scaleString: string): 'architectural' | 'engineering' | 'metric' | 'custom' {
  if (scaleString.includes('"=') && scaleString.includes("'")) {
    // Has inch and foot marks
    if (scaleString.includes('/')) {
      return 'architectural'; // e.g., 1/4"=1'-0"
    }
    return 'engineering'; // e.g., 1"=10'
  }

  if (scaleString.includes(':')) {
    return 'metric'; // e.g., 1:100
  }

  return 'custom';
}

/**
 * Vision API prompt for scale extraction
 */
function getScaleExtractionPrompt(): string {
  return `You are analyzing a construction drawing. Extract ALL drawing scales you find on this page.

Look for scale information in:
1. Title block (most common location)
2. Viewport labels (for multiple scales)
3. Detail callouts
4. Notes or legends

Common scale formats:
- Architectural: "1/4\"=1'-0\"", "1/8\"=1'-0\""
- Engineering: "1\"=10'", "1\"=20'"
- Metric: "1:100", "1:50"
- Text: "NTS" (Not To Scale), "As Noted"

If you find multiple scales on the sheet, extract:
- Primary scale (main/overall sheet scale)
- Secondary scales (detail/viewport scales with their viewport names)

IMPORTANT: If the sheet says "NTS" or "NOT TO SCALE", set found=true but mark it clearly.

Return JSON in this format:
{
  "found": true/false,
  "primaryScale": {
    "scaleString": "1/4\"=1'-0\"",
    "location": "title block",
    "confidence": 0.95
  },
  "secondaryScales": [
    {
      "scaleString": "3\"=1'-0\"",
      "viewportName": "Detail A",
      "confidence": 0.9
    }
  ],
  "confidence": 0.95
}

If no scale is found, return: {"found": false, "confidence": 0}`;
}