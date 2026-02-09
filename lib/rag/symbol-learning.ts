/**
 * Adaptive Symbol Learning Module (Phase 3C)
 *
 * Learns project-specific symbols from document usage patterns,
 * applies learned symbols to improve chunk understanding, and
 * generates symbol recognition reports.
 *
 * Extracted from lib/rag-enhancements.ts
 */

import { prisma } from '@/lib/db';
import type { EnhancedChunk, LearnedSymbol, SymbolLibrary } from './types';

/**
 * Learn project-specific symbols from document usage
 */
export async function learnProjectSymbols(
  projectSlug: string
): Promise<SymbolLibrary> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        include: {
          DocumentChunk: true,
        },
      },
    },
  });

  if (!project) {
    return {
      projectId: '',
      symbols: [],
      lastUpdated: new Date(),
      totalAppearances: 0,
    };
  }

  const symbolMap = new Map<string, LearnedSymbol>();
  let totalAppearances = 0;

  // Symbol patterns to detect
  const symbolPatterns = [
    // HVAC symbols
    { pattern: /\[AHU\]/gi, type: 'Air Handling Unit', category: 'hvac' as const },
    { pattern: /\[VAV\]/gi, type: 'Variable Air Volume', category: 'hvac' as const },
    { pattern: /⊗/g, type: 'Supply Diffuser', category: 'hvac' as const },
    { pattern: /⊕/g, type: 'Return Grille', category: 'hvac' as const },

    // Plumbing symbols
    { pattern: /\[WH\]/gi, type: 'Water Heater', category: 'plumbing' as const },
    { pattern: /\[P\]/gi, type: 'Pump', category: 'plumbing' as const },
    { pattern: /⌀/g, type: 'Pipe Diameter', category: 'plumbing' as const },

    // Electrical symbols
    { pattern: /⚡/g, type: 'Power', category: 'electrical' as const },
    { pattern: /\[P\]/gi, type: 'Panel', category: 'electrical' as const },
    { pattern: /○/g, type: 'Junction Box', category: 'electrical' as const },
  ];

  for (const doc of project.Document) {
    for (const chunk of doc.DocumentChunk) {
      const content = chunk.content;

      for (const symbolDef of symbolPatterns) {
        symbolDef.pattern.lastIndex = 0;
        let match;

        while ((match = symbolDef.pattern.exec(content)) !== null) {
          const symbolId = `${symbolDef.category}-${symbolDef.type}`.toLowerCase().replace(/\s+/g, '-');

          let symbol = symbolMap.get(symbolId);
          if (!symbol) {
            symbol = {
              symbolId,
              symbolType: symbolDef.type,
              category: symbolDef.category,
              appearances: [],
              variations: [],
              learningConfidence: 0,
            };
            symbolMap.set(symbolId, symbol);
          }

          // Add appearance
          symbol.appearances.push({
            documentId: doc.id,
            pageNumber: chunk.pageNumber || 0,
            context: content.substring(Math.max(0, match.index - 50), match.index + 50),
            confidence: 0.8,
          });

          // Track variations
          if (!symbol.variations.includes(match[0])) {
            symbol.variations.push(match[0]);
          }

          totalAppearances++;
        }
      }
    }
  }

  // Calculate learning confidence based on appearances
  symbolMap.forEach(symbol => {
    const appearanceCount = symbol.appearances.length;
    symbol.learningConfidence = Math.min(1.0, appearanceCount / 10); // Max confidence at 10+ appearances
  });

  return {
    projectId: project.id,
    symbols: Array.from(symbolMap.values()),
    lastUpdated: new Date(),
    totalAppearances,
  };
}

/**
 * Apply learned symbols to improve chunk understanding
 */
export function applyLearnedSymbols(
  chunk: EnhancedChunk,
  symbolLibrary: SymbolLibrary
): EnhancedChunk {
  let enhancedContent = chunk.content;

  symbolLibrary.symbols.forEach(symbol => {
    symbol.variations.forEach(variation => {
      // Replace symbol with expanded description
      const replacement = `${variation} [${symbol.symbolType}]`;
      enhancedContent = enhancedContent.replace(
        new RegExp(variation, 'g'),
        replacement
      );
    });
  });

  return {
    ...chunk,
    content: enhancedContent,
    metadata: {
      ...chunk.metadata,
      symbol_library_applied: true,
      symbols_recognized: symbolLibrary.symbols.filter(s =>
        chunk.content.includes(s.variations[0])
      ).map(s => s.symbolType),
    },
  };
}

/**
 * Generate symbol recognition report
 */
export function generateSymbolReport(library: SymbolLibrary): {
  summary: string;
  byCategory: Map<string, number>;
  topSymbols: LearnedSymbol[];
  coverage: number;
} {
  const byCategory = new Map<string, number>();

  library.symbols.forEach(symbol => {
    const count = byCategory.get(symbol.category) || 0;
    byCategory.set(symbol.category, count + symbol.appearances.length);
  });

  const topSymbols = library.symbols
    .sort((a, b) => b.appearances.length - a.appearances.length)
    .slice(0, 10);

  const coverage = library.symbols.filter(s => s.learningConfidence > 0.7).length /
                   Math.max(1, library.symbols.length);

  const summary = `
Learned ${library.symbols.length} unique symbols from ${library.totalAppearances} appearances.
Symbol Coverage: ${(coverage * 100).toFixed(1)}%
High Confidence Symbols: ${library.symbols.filter(s => s.learningConfidence > 0.7).length}
  `.trim();

  return {
    summary,
    byCategory,
    topSymbols,
    coverage,
  };
}
