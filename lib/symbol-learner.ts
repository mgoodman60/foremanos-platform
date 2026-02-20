/**
 * Symbol Learning System
 * Pattern recognition and classification for construction symbols
 * Learns from document analysis to identify and categorize symbols
 */

import { prisma } from './db';

// Types
export interface Symbol {
  id: string;
  type: string;
  category: string;
  pattern: string;
  confidence: number;
  occurrences: number;
  variations: string[];
  context: string[];
}

export interface SymbolPattern {
  pattern: string;
  regex: RegExp;
  category: string;
  examples: string[];
}

export interface SymbolMatch {
  symbol: Symbol;
  matches: string[];
  locations: { documentId: string; page: number; text: string }[];
}

export interface LearningResult {
  newSymbols: Symbol[];
  updatedSymbols: Symbol[];
  totalAnalyzed: number;
  confidence: number;
}

// Symbol pattern definitions
const SYMBOL_PATTERNS: SymbolPattern[] = [
  // Electrical symbols
  {
    pattern: 'panel',
    regex: /\b(P|LP|DP|MDP|MCC)[-\s]?([A-Z0-9]+)\b/gi,
    category: 'electrical',
    examples: ['P-1', 'LP1', 'DP-2A', 'MDP', 'MCC-3']
  },
  {
    pattern: 'circuit',
    regex: /\b([A-Z]{1,2})-?(\d{1,3}[A-Z]?)\b/g,
    category: 'electrical',
    examples: ['A-12', 'LP1', 'C-24A']
  },
  // HVAC symbols
  {
    pattern: 'air_handler',
    regex: /\b(AHU|RTU|MAU|ERU)[-\s]?(\d{1,2}[A-Z]?)\b/gi,
    category: 'hvac',
    examples: ['AHU-1', 'RTU2', 'MAU-3A']
  },
  {
    pattern: 'terminal_unit',
    regex: /\b(VAV|CAV|FCU|FPB)[-\s]?(\d{1,3}[A-Z]?)\b/gi,
    category: 'hvac',
    examples: ['VAV-101', 'FCU2', 'FPB-3A']
  },
  {
    pattern: 'diffuser',
    regex: /\b(SD|RD|LD|GD)[-\s]?(\d{1,3})\b/gi,
    category: 'hvac',
    examples: ['SD-1', 'RD12', 'LD-24']
  },
  // Plumbing symbols
  {
    pattern: 'fixture',
    regex: /\b(WC|LAV|UR|DF|FD|SHW|WH)[-\s]?(\d{1,2}[A-Z]?)\b/gi,
    category: 'plumbing',
    examples: ['WC-1', 'LAV2', 'UR-3A', 'WH-1']
  },
  {
    pattern: 'piping',
    regex: /\b([A-Z]{1,3})(W|S|V|G|D)[-\s]?(\d{1,2})\b/gi,
    category: 'plumbing',
    examples: ['CW-1', 'HWS-2', 'SV-3', 'GD-4']
  },
  // Fire protection symbols
  {
    pattern: 'sprinkler',
    regex: /\b(SPK|SP|UPR|PEND|SW)[-\s]?(\d{1,3}[A-Z]?)\b/gi,
    category: 'fire_protection',
    examples: ['SPK-1', 'UPR-12', 'PEND-3A']
  },
  {
    pattern: 'fire_alarm',
    regex: /\b(FA|SD|HD|PS|NAC)[-\s]?(\d{1,3}[A-Z]?)\b/gi,
    category: 'fire_protection',
    examples: ['FA-1', 'SD-12', 'HD-3A']
  },
  // Room/Door symbols
  {
    pattern: 'door',
    regex: /\b(D|DR)[-\s]?(\d{3,4}[A-Z]?)\b/gi,
    category: 'architectural',
    examples: ['D-101', 'DR1234', 'D-102A']
  },
  {
    pattern: 'room',
    regex: /\b(RM|R)[-\s]?(\d{3,4}[A-Z]?)\b/gi,
    category: 'architectural',
    examples: ['RM-101', 'R1234', 'RM-102A']
  },
  // Grid lines
  {
    pattern: 'grid',
    regex: /\b([A-Z])[-\/]?(\d{1,2})\b/g,
    category: 'structural',
    examples: ['A-1', 'B/2', 'C-12']
  },
  // Structural symbols
  {
    pattern: 'column',
    regex: /\b(COL|C)[-\s]?(\d{1,3}[A-Z]?)\b/gi,
    category: 'structural',
    examples: ['COL-1', 'C12', 'COL-3A']
  },
  {
    pattern: 'beam',
    regex: /\b(BM|B)[-\s]?(\d{1,3}[A-Z]?)\b/gi,
    category: 'structural',
    examples: ['BM-1', 'B12', 'BM-3A']
  }
];

/**
 * Extract symbols from text using pattern matching
 */
function extractSymbols(text: string): { pattern: string; matches: string[]; category: string }[] {
  const results: { pattern: string; matches: string[]; category: string }[] = [];

  for (const symbolPattern of SYMBOL_PATTERNS) {
    const matches = text.match(symbolPattern.regex);
    if (matches && matches.length > 0) {
      results.push({
        pattern: symbolPattern.pattern,
        matches: [...new Set(matches)], // Remove duplicates
        category: symbolPattern.category
      });
    }
  }

  return results;
}

/**
 * Calculate confidence score for a symbol based on context
 */
function calculateConfidence(
  matches: string[],
  context: string[],
  existingOccurrences: number = 0
): number {
  let confidence = 50; // Base confidence

  // More matches = higher confidence
  confidence += Math.min(matches.length * 5, 30);

  // Rich context = higher confidence
  confidence += Math.min(context.length * 3, 15);

  // Historical occurrences = higher confidence
  confidence += Math.min(existingOccurrences * 2, 20);

  return Math.min(confidence, 100);
}

/**
 * Learn symbols from a document's chunks
 */
export async function learnFromDocument(
  documentId: string
): Promise<LearningResult> {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId }
  });

  const symbolMap = new Map<string, Symbol>();
  const newSymbols: Symbol[] = [];
  const updatedSymbols: Symbol[] = [];

  // Extract symbols from all chunks
  for (const chunk of chunks) {
    const extracted = extractSymbols(chunk.content);

    for (const { pattern, matches, category } of extracted) {
      for (const match of matches) {
        const key = `${category}:${pattern}:${match.toUpperCase()}`;

        if (!symbolMap.has(key)) {
          symbolMap.set(key, {
            id: key,
            type: pattern,
            category,
            pattern: match.toUpperCase(),
            confidence: 0,
            occurrences: 1,
            variations: [match],
            context: [chunk.content.substring(0, 100)]
          });
        } else {
          const symbol = symbolMap.get(key)!;
          symbol.occurrences++;
          if (!symbol.variations.includes(match)) {
            symbol.variations.push(match);
          }
          if (symbol.context.length < 5) {
            symbol.context.push(chunk.content.substring(0, 100));
          }
        }
      }
    }
  }

  // Calculate confidence scores
  for (const symbol of symbolMap.values()) {
    symbol.confidence = calculateConfidence(
      symbol.variations,
      symbol.context,
      symbol.occurrences
    );

    if (symbol.confidence >= 60) {
      newSymbols.push(symbol);
    }
  }

  return {
    newSymbols,
    updatedSymbols,
    totalAnalyzed: chunks.length,
    confidence: newSymbols.length > 0
      ? newSymbols.reduce((sum, s) => sum + s.confidence, 0) / newSymbols.length
      : 0
  };
}

/**
 * Learn symbols from all documents in a project
 */
export async function learnFromProject(
  projectSlug: string
): Promise<LearningResult> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        where: {
          processed: true
        }
      }
    }
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const allSymbols = new Map<string, Symbol>();
  let totalAnalyzed = 0;

  // Learn from each document
  for (const doc of project.Document) {
    const result = await learnFromDocument(doc.id);
    totalAnalyzed += result.totalAnalyzed;

    // Merge symbols
    for (const symbol of result.newSymbols) {
      if (allSymbols.has(symbol.id)) {
        const existing = allSymbols.get(symbol.id)!;
        existing.occurrences += symbol.occurrences;
        existing.variations = [...new Set([...existing.variations, ...symbol.variations])];
        existing.context = [...existing.context, ...symbol.context].slice(0, 10);
        existing.confidence = calculateConfidence(
          existing.variations,
          existing.context,
          existing.occurrences
        );
      } else {
        allSymbols.set(symbol.id, symbol);
      }
    }
  }

  const newSymbols = Array.from(allSymbols.values());

  return {
    newSymbols,
    updatedSymbols: [],
    totalAnalyzed,
    confidence: newSymbols.length > 0
      ? newSymbols.reduce((sum, s) => sum + s.confidence, 0) / newSymbols.length
      : 0
  };
}

/**
 * Find symbols in project by category
 */
export async function findSymbolsByCategory(
  projectSlug: string,
  category: string
): Promise<Symbol[]> {
  const result = await learnFromProject(projectSlug);
  return result.newSymbols.filter(s => s.category === category);
}

/**
 * Search for specific symbol pattern
 */
export async function searchSymbol(
  projectSlug: string,
  searchPattern: string
): Promise<SymbolMatch[]> {
  const result = await learnFromProject(projectSlug);
  const matches: SymbolMatch[] = [];

  const searchRegex = new RegExp(searchPattern, 'i');

  for (const symbol of result.newSymbols) {
    if (searchRegex.test(symbol.pattern) || searchRegex.test(symbol.type)) {
      // Find locations in documents
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
        include: {
          Document: {
            where: { processed: true },
            include: { DocumentChunk: true }
          }
        }
      });

      const locations: { documentId: string; page: number; text: string }[] = [];

      if (project) {
        for (const doc of project.Document) {
          for (const chunk of doc.DocumentChunk) {
            if (chunk.content.includes(symbol.pattern)) {
              locations.push({
                documentId: doc.id,
                page: chunk.pageNumber || 0,
                text: chunk.content.substring(0, 200)
              });
            }
          }
        }
      }

      matches.push({
        symbol,
        matches: symbol.variations,
        locations
      });
    }
  }

  return matches;
}

/**
 * Get symbol statistics for a project
 */
export async function getSymbolStatistics(
  projectSlug: string
): Promise<{
  totalSymbols: number;
  byCategory: Record<string, number>;
  highConfidence: number;
  topSymbols: Symbol[];
}> {
  const result = await learnFromProject(projectSlug);

  const byCategory = result.newSymbols.reduce((acc, symbol) => {
    acc[symbol.category] = (acc[symbol.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const highConfidence = result.newSymbols.filter(s => s.confidence >= 80).length;

  const topSymbols = result.newSymbols
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 20);

  return {
    totalSymbols: result.newSymbols.length,
    byCategory,
    highConfidence,
    topSymbols
  };
}
