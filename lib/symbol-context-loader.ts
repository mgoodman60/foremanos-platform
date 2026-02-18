/**
 * Symbol Context Loader
 *
 * Loads discipline-relevant symbol vision hints from the construction
 * symbols library JSON. Provides formatted context strings to inject
 * into discipline-specific extraction prompts.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

/** Maximum number of symbol hints to include per discipline */
const MAX_SYMBOLS = 20;

/**
 * Maps discipline names to CSI division numbers and special categories.
 * Each discipline gets symbols from its relevant divisions plus General (01).
 */
const DISCIPLINE_DIVISIONS: Record<string, (string | number)[]> = {
  Architectural: [1, 2, 8, 9, 10, 12, 14, 'Hatch', 'Lines'],
  Structural: [1, 3, 4, 5, 6, 'Hatch', 'Lines'],
  Mechanical: [1, 23, 'Hatch'],
  Electrical: [1, 26, 27, 28],
  Plumbing: [1, 22, 'Hatch'],
  Civil: [1, 31, 32, 33, 'Lines'],
  'Fire Protection': [1, 21],
  Schedule: [1],
  General: [1],
};

/** Special category key mappings for non-division sections */
const SPECIAL_CATEGORY_KEYS: Record<string, string> = {
  Hatch: 'Common Hatch Patterns (Section Fills)',
  Lines: 'Common Line Types',
};

/** Cached symbols library */
let cachedSymbols: Record<string, Array<{ symbol_name: string; vision_hints: string }>> | null =
  null;

/**
 * Load and cache the symbols library JSON from disk.
 * Returns null if the file doesn't exist (e.g., in production Docker).
 */
function loadSymbolsLibrary(): Record<
  string,
  Array<{ symbol_name: string; vision_hints: string }>
> | null {
  if (cachedSymbols !== null) {
    return cachedSymbols;
  }

  try {
    const filePath = path.join(
      process.cwd(),
      '.claude',
      'skills',
      'construction-plan-intelligence',
      'assets',
      'construction_symbols_library.json'
    );
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Remove metadata key
    const { metadata, ...divisions } = parsed;
    cachedSymbols = divisions;
    logger.info('SYMBOL_CONTEXT', 'Symbols library loaded', {
      divisions: Object.keys(divisions).length,
    });
    return cachedSymbols;
  } catch {
    logger.debug('SYMBOL_CONTEXT', 'Symbols library not available, returning empty context');
    cachedSymbols = {};
    return cachedSymbols;
  }
}

/**
 * Parse the division number from a JSON key like "Division 01 - General Requirements".
 * Returns the numeric division, or null for special categories.
 */
function parseDivisionNumber(key: string): number | null {
  const match = key.match(/^Division (\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Load symbol context hints for a given discipline.
 * Returns a formatted string of symbol references suitable for
 * appending to a vision extraction prompt.
 *
 * @param discipline - The classified discipline name
 * @returns Formatted symbol hints string, or empty string if none
 */
export function loadSymbolContext(discipline: string): string {
  const library = loadSymbolsLibrary();
  if (!library || Object.keys(library).length === 0) {
    return '';
  }

  const divisionSpec = DISCIPLINE_DIVISIONS[discipline] || DISCIPLINE_DIVISIONS['General'];
  const hints: string[] = [];

  for (const [key, symbols] of Object.entries(library)) {
    if (!Array.isArray(symbols)) continue;

    // Check if this division key matches the discipline's spec
    const divNum = parseDivisionNumber(key);
    let matches = false;

    if (divNum !== null) {
      matches = divisionSpec.includes(divNum);
    } else {
      // Check special categories (Hatch, Lines, Accessibility, Life Safety)
      for (const [alias, fullKey] of Object.entries(SPECIAL_CATEGORY_KEYS)) {
        if (key === fullKey && divisionSpec.includes(alias)) {
          matches = true;
          break;
        }
      }
    }

    if (!matches) continue;

    for (const symbol of symbols) {
      if (symbol.vision_hints && symbol.symbol_name) {
        hints.push(`- ${symbol.symbol_name}: ${symbol.vision_hints}`);
      }
      if (hints.length >= MAX_SYMBOLS) break;
    }

    if (hints.length >= MAX_SYMBOLS) break;
  }

  if (hints.length === 0) {
    return '';
  }

  return `\nSYMBOL REFERENCE:\n${hints.join('\n')}`;
}

/**
 * Reset the cached symbols (for testing purposes).
 */
export function _resetCache(): void {
  cachedSymbols = null;
}
