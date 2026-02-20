/**
 * RAG Measurement Extraction and Validation
 *
 * Extracted from lib/rag-enhancements.ts — measurement extraction
 * with hierarchy (explicit > scaled > unavailable), OCR validation,
 * and pre-response validation.
 */

import type { EnhancedChunk, MeasurementInfo, ValidationResult } from './types';
import { classifyQueryIntent } from './query-classification';

/**
 * Extract measurement information with hierarchy: explicit > scaled > unavailable
 */
export function extractMeasurement(chunk: EnhancedChunk, _query: string): MeasurementInfo | null {
  const content = chunk.content;

  // Priority 1: Explicit written dimensions
  const dimensionPatterns = [
    // Standard formats: 12'-6", 3'-0", 18"
    /\b\d+'-\d+"\b/g,
    /\b\d+"\b/g,
    /\b\d+'-\d+\b/g,
    // Decimal formats: 12.5 ft, 3.75 inches
    /\b\d+\.\d+\s*(ft|feet|in|inch|inches)\b/gi,
    // Spacing: #4 @ 12" O.C.
    /#\d+\s*@\s*\d+"\s*O\.?C\.?/gi,
    // Clearances: min. 36" clear
    /min\.?\s*\d+"\s*clear/gi,
  ];

  for (const pattern of dimensionPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      return {
        value: matches[0],
        unit: extractUnit(matches[0]),
        method: 'explicit',
        source: `${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}`,
        isLegible: true,
        confidence: 'high',
      };
    }
  }

  // Priority 2: Scaled measurements (only if scale is available)
  const hasScale = chunk.metadata?.scale && !chunk.metadata?.scale.includes('NTS');
  if (hasScale) {
    // Check if chunk mentions scaled elements
    if (/\b(measured|scaled|calculated)\b/i.test(content)) {
      return {
        value: 'Available via scale measurement',
        unit: 'varies',
        method: 'scaled',
        source: `${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}, Scale: ${chunk.metadata?.scale}`,
        isLegible: true,
        confidence: 'medium',
      };
    }
  }

  // Priority 3: Not available
  return {
    value: 'Not specified in provided documents',
    unit: 'N/A',
    method: 'unavailable',
    source: `Searched ${chunk.metadata?.documentName || 'Unknown'}`,
    isLegible: false,
    confidence: 'low',
  };
}

/**
 * Extract unit from a measurement string
 */
function extractUnit(measurement: string): string {
  if (measurement.includes("'") || /ft|feet/i.test(measurement)) return 'feet';
  if (measurement.includes('"') || /in|inch/i.test(measurement)) return 'inches';
  if (/o\.?c/i.test(measurement)) return 'on center';
  return 'unknown';
}

/**
 * Validate OCR content for legibility and completeness
 */
export function validateOCR(chunk: EnhancedChunk): {
  isLegible: boolean;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
} {
  const content = chunk.content;
  const issues: string[] = [];

  // Check for common OCR errors
  const suspiciousPatterns = [
    // Excessive special characters
    /[^a-zA-Z0-9\s,.;:'"-/()]{5,}/,
    // Garbled text (alternating case with no spaces)
    /[a-z][A-Z][a-z][A-Z][a-z]{5,}/,
    // Excessive whitespace
    /\s{10,}/,
    // Nonsense words
    /\b[bcdfghjklmnpqrstvwxyz]{7,}\b/i,
  ];

  let suspiciousCount = 0;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      suspiciousCount++;
    }
  }

  if (suspiciousCount >= 2) {
    issues.push('Content contains multiple OCR error patterns');
  }

  // Check for truncated content
  if (content.length < 50 && chunk.pageNumber) {
    issues.push('Content appears truncated or incomplete');
  }

  // Check for missing critical sections
  const metadata = chunk.metadata || {};
  if (metadata.chunkType === 'page_overview' && content.length < 200) {
    issues.push('Page overview unusually short, may be incomplete');
  }

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (issues.length === 1) confidence = 'medium';
  if (issues.length >= 2) confidence = 'low';

  const isLegible = confidence !== 'low';

  return { isLegible, confidence, issues };
}

/**
 * Self-check validation before generating response
 */
export function validateBeforeResponse(
  query: string,
  chunks: EnhancedChunk[],
  proposedAnswer: string
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check 1: Do we have any chunks?
  if (chunks.length === 0) {
    issues.push('No document chunks retrieved for this query');
  }

  // Check 2: Are chunks legible?
  const illegibleChunks = chunks.filter(c => {
    const validation = validateOCR(c);
    return !validation.isLegible;
  });

  if (illegibleChunks.length > 0) {
    warnings.push(`${illegibleChunks.length} chunks have low OCR confidence`);
  }

  // Check 3: Does answer contain unreadable text claims?
  if (/not legible|illegible|unclear|unreadable/i.test(proposedAnswer)) {
    // This is OK if we genuinely can't read it
    if (illegibleChunks.length === 0) {
      warnings.push('Answer claims text is illegible, but OCR validation passed');
    }
  }

  // Check 4: Does answer make assumptions?
  const assumptionIndicators = [
    'typically',
    'usually',
    'generally',
    'assumed',
    'likely',
    'probably',
    'may be',
    'could be',
    'standard practice',
  ];

  const hasAssumptions = assumptionIndicators.some(ind =>
    proposedAnswer.toLowerCase().includes(ind)
  );

  if (hasAssumptions && chunks.length < 3) {
    warnings.push('Answer contains assumptions with limited document evidence');
  }

  // Check 5: Are sources traceable?
  const hasSources = /\[(.*?)\]|Source:|Page \d+|Sheet [A-Z]-\d+/i.test(proposedAnswer);
  if (!hasSources && chunks.length > 0) {
    warnings.push('Answer lacks source citations despite available chunks');
  }

  // Check 6: Measurement queries should include sourcing
  const intent = classifyQueryIntent(query);
  if (intent.type === 'measurement') {
    const hasMeasurementSource = /explicit|scaled|measured|Source:/i.test(proposedAnswer);
    if (!hasMeasurementSource) {
      warnings.push('Measurement query answer lacks measurement sourcing information');
    }
  }

  const passed = issues.length === 0;

  return { passed, issues, warnings };
}
