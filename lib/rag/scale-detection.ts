/**
 * Scale Detection Module (Phase 3A)
 *
 * Multi-scale detection, inference from known dimensions,
 * scale bar auto-detection, and scale bar calculations.
 *
 * Extracted from lib/rag-enhancements.ts
 */

import type { EnhancedChunk, ScaleInfo, MultiScaleDocument, ScaleBar } from './types';

/**
 * Extract and parse all scales from a document chunk
 */
export function detectMultipleScales(chunk: EnhancedChunk): MultiScaleDocument {
  const metadata = chunk.metadata || {};
  const content = chunk.content.toLowerCase();
  const scales: ScaleInfo[] = [];
  const warnings: string[] = [];

  // Common scale patterns
  const patterns = {
    architectural: /(\d+\/\d+)"\s*=\s*(\d+)'?-?(\d+)"?|scale:\s*(\d+\/\d+)"/gi,
    engineering: /1"\s*=\s*(\d+)'|scale:\s*1\s*=\s*(\d+)/gi,
    metric: /1:(\d+)|scale\s*1:(\d+)/gi,
    detail: /detail[:\s]+.*?(\d+\/\d+)"/gi,
    graphic: /graphic\s*scale|bar\s*scale/gi,
  };

  // Extract architectural scales (e.g., 1/4" = 1'-0")
  let match;
  while ((match = patterns.architectural.exec(content)) !== null) {
    const numerator = match[1] ? parseInt(match[1].split('/')[0]) : 1;
    const denominator = match[1] ? parseInt(match[1].split('/')[1]) : 4;
    const feet = match[2] ? parseInt(match[2]) : 1;
    const inches = match[3] ? parseInt(match[3]) : 0;

    const scaleFactor = (feet * 12 + inches) / (numerator / denominator);

    scales.push({
      scale: match[0],
      scaleType: 'architectural',
      scaleFactor,
      source: content.includes('detail') ? 'detail_callout' : 'title_block',
      confidence: 'high',
    });
  }

  // Extract engineering scales (e.g., 1" = 40')
  patterns.engineering.lastIndex = 0;
  while ((match = patterns.engineering.exec(content)) !== null) {
    const feet = match[1] ? parseInt(match[1]) : parseInt(match[2] || '1');
    const scaleFactor = feet * 12;

    scales.push({
      scale: match[0],
      scaleType: 'engineering',
      scaleFactor,
      source: 'title_block',
      confidence: 'high',
    });
  }

  // Extract metric scales (e.g., 1:100)
  patterns.metric.lastIndex = 0;
  while ((match = patterns.metric.exec(content)) !== null) {
    const ratio = parseInt(match[1] || match[2] || '100');

    scales.push({
      scale: match[0],
      scaleType: 'metric',
      scaleFactor: ratio,
      source: 'title_block',
      confidence: 'high',
    });
  }

  // Check for graphic scale bars in metadata
  if (metadata.scale_bars || patterns.graphic.test(content)) {
    scales.push({
      scale: 'Graphic Scale Bar',
      scaleType: 'graphic',
      scaleFactor: 0, // Will be calculated from visual analysis
      source: 'scale_bar',
      confidence: 'medium',
    });
  }

  // Validate and warn about inconsistencies
  if (scales.length > 1) {
    const uniqueFactors = new Set(scales.map(s => s.scaleFactor));
    if (uniqueFactors.size > 1) {
      warnings.push(`Multiple different scales detected (${scales.length} scales). Verify which applies to your query area.`);
    }
  }

  // Default scale fallback
  const defaultScale: ScaleInfo = scales.length > 0
    ? scales[0]
    : {
        scale: 'Not specified',
        scaleType: 'unknown',
        scaleFactor: 1,
        source: 'title_block',
        confidence: 'low',
      };

  // Extract additional scales (excluding default)
  const additionalScales = scales.slice(1);

  return {
    documentId: chunk.documentId || '',
    sheetNumber: (metadata.sheet_number as string) || 'Unknown',
    defaultScale,
    additionalScales,
    scaleWarnings: warnings,
  };
}

/**
 * Infer scale from known dimensions (e.g., door widths, room sizes)
 */
export function inferScaleFromDimensions(chunk: EnhancedChunk): ScaleInfo | null {
  const content = chunk.content.toLowerCase();

  // Known standard dimensions
  const standardDimensions = [
    { pattern: /door.*?(\d+)\s*x\s*(\d+)/i, expected: [36, 80], type: 'door' }, // 3'x6'8" door
    { pattern: /(\d+)\s*x\s*(\d+).*?door/i, expected: [36, 80], type: 'door' },
    { pattern: /parking\s*space.*?(\d+)\s*x\s*(\d+)/i, expected: [108, 216], type: 'parking' }, // 9'x18' parking
    { pattern: /corridor.*?(\d+)['"]?/i, expected: [48], type: 'corridor' }, // 4' corridor
  ];

  for (const std of standardDimensions) {
    const match = std.pattern.exec(content);
    if (match) {
      // Extract measured value from drawing
      const measuredValue = parseInt(match[1]);

      // Calculate scale factor
      const expectedValue = std.expected[0];
      const inferredFactor = expectedValue / measuredValue;

      if (inferredFactor > 0.1 && inferredFactor < 1000) { // Sanity check
        return {
          scale: `Inferred from ${std.type}: ~1:${Math.round(inferredFactor)}`,
          scaleType: 'architectural',
          scaleFactor: inferredFactor,
          source: 'inferred',
          confidence: 'medium',
        };
      }
    }
  }

  return null;
}

/**
 * Detect and extract scale bars from document visuals
 */
export function detectScaleBar(chunk: EnhancedChunk): ScaleBar {
  const content = chunk.content.toLowerCase();
  const metadata = chunk.metadata || {};

  // Check for scale bar indicators
  const scaleBarPatterns = [
    /scale[:\s]+0\s+(\d+)\s+(\d+)\s+(\d+)/i,
    /graphic\s*scale.*?(\d+)\s*ft/i,
    /(\d+)\s*'?\s*0\s*'?\s*(\d+)\s*'?\s*(\d+)\s*'?/i,
    /bar\s*scale.*?(\d+)/i,
  ];

  const units: string[] = [];
  let realWorldDistance = 0;
  let detected = false;

  for (const pattern of scaleBarPatterns) {
    const match = pattern.exec(content);
    if (match) {
      detected = true;

      // Extract units from match
      if (match[1]) units.push('0');
      if (match[1]) units.push(match[1]);
      if (match[2]) units.push(match[2]);
      if (match[3]) units.push(match[3]);

      // Calculate max distance
      const values = [match[1], match[2], match[3]].filter(Boolean).map(v => parseInt(v!));
      realWorldDistance = Math.max(...values, realWorldDistance);

      break;
    }
  }

  // Check metadata for scale bar information
  if (metadata.scale_bar || metadata.graphic_scale) {
    detected = true;
    units.push('Detected in visual analysis');
  }

  // Determine location (usually bottom right or bottom center)
  const location = content.includes('title block')
    ? 'bottom right'
    : content.includes('north arrow')
      ? 'bottom center'
      : 'unknown';

  return {
    detected,
    units,
    realWorldDistance: realWorldDistance > 0 ? realWorldDistance : undefined,
    scaleFactor: realWorldDistance > 0 ? realWorldDistance / 100 : undefined, // Estimate
    location,
    confidence: detected && realWorldDistance > 0 ? 'high' : detected ? 'medium' : 'low',
  };
}

/**
 * Calculate dimensions using scale bar calibration
 */
export function calculateWithScaleBar(
  scaleBar: ScaleBar,
  visualMeasurement: number
): { value: number; unit: string; confidence: 'high' | 'medium' | 'low' } {
  if (!scaleBar.detected || !scaleBar.scaleFactor) {
    return {
      value: visualMeasurement,
      unit: 'unknown',
      confidence: 'low',
    };
  }

  const realValue = visualMeasurement * scaleBar.scaleFactor;

  return {
    value: realValue,
    unit: 'feet',
    confidence: scaleBar.confidence,
  };
}
