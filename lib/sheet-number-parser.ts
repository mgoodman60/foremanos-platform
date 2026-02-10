/**
 * Sheet Number Parser
 *
 * Parses construction drawing sheet numbers to extract discipline, floor level, and sequence.
 * Supports variations: A-101, A101, A.101, FP-301, etc.
 */

import { logger } from '@/lib/logger';

export interface ParsedSheetNumber {
  discipline: string;        // 'A', 'M', 'E', 'P', 'FP', 'S', 'C', 'L'
  disciplineName: string;    // 'Architectural', 'Mechanical', etc.
  level: string;             // '1', '2', '3' (first digit after prefix)
  sequence: string;          // '01', '02' (remaining digits)
  raw: string;               // Original input
}

// Discipline code to name mapping (reused from title-block-extractor.ts logic)
const DISCIPLINE_NAMES: Record<string, string> = {
  'A': 'Architectural',
  'S': 'Structural',
  'M': 'Mechanical',
  'E': 'Electrical',
  'P': 'Plumbing',
  'FP': 'Fire Protection',
  'C': 'Civil',
  'L': 'Landscape',
  'G': 'General',
};

/**
 * Parse a sheet number into its components
 * @param sheetNumber - Sheet number like "A-101", "M-201", "FP-301", etc.
 * @returns Parsed components or null if format is invalid
 */
export function parseSheetNumber(sheetNumber: string): ParsedSheetNumber | null {
  if (!sheetNumber || typeof sheetNumber !== 'string') {
    return null;
  }

  const cleaned = sheetNumber.trim().toUpperCase();

  // Pattern: Optional discipline prefix + separator + digits
  // Matches: A-101, A101, A.101, FP-301, M201, etc.
  const pattern = /^([A-Z]{1,2})[-.\s]?(\d{2,3})$/;
  const match = cleaned.match(pattern);

  if (!match) {
    logger.warn('SHEET_PARSER', 'Invalid sheet number format', { sheetNumber });
    return null;
  }

  const disciplineCode = match[1]; // 'A', 'M', 'FP', etc.
  const numberPart = match[2];      // '101', '201', etc.

  // Extract level (first digit) and sequence (remaining digits)
  // A-101 → level '1', sequence '01'
  // M-201 → level '2', sequence '01'
  // FP-301 → level '3', sequence '01'
  let level = '1';
  let sequence = '01';

  if (numberPart.length === 2) {
    // 2-digit: treat first as level, second as sequence
    level = numberPart[0];
    sequence = '0' + numberPart[1];
  } else if (numberPart.length === 3) {
    // 3-digit: first digit is level, last two are sequence
    level = numberPart[0];
    sequence = numberPart.substring(1);
  }

  const disciplineName = DISCIPLINE_NAMES[disciplineCode] || 'Unknown';

  return {
    discipline: disciplineCode,
    disciplineName,
    level,
    sequence,
    raw: cleaned,
  };
}

/**
 * Check if two sheet numbers are on the same floor
 * @param sheetA - First sheet number
 * @param sheetB - Second sheet number
 * @returns True if both sheets are on the same floor level
 */
export function matchesFloor(sheetA: string, sheetB: string): boolean {
  const parsedA = parseSheetNumber(sheetA);
  const parsedB = parseSheetNumber(sheetB);

  if (!parsedA || !parsedB) {
    return false;
  }

  // Same floor if level matches
  return parsedA.level === parsedB.level;
}
