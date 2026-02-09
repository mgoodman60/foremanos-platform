/**
 * Symbol Legend Parsing
 *
 * Extracted from lib/rag-enhancements.ts — automatically extracts and parses
 * symbol legends from MEP drawings.
 */

import type {
  SymbolLegend,
  SymbolLegendItem,
  EnhancedChunk,
} from './types';

/**
 * Parse symbol legend from document chunks
 */
export async function parseSymbolLegend(
  chunks: EnhancedChunk[],
  trade?: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm'
): Promise<SymbolLegend | null> {
  // Find legend chunks
  const legendChunks = chunks.filter(c =>
    c.chunkType === 'legend' ||
    c.content.toLowerCase().includes('legend') ||
    c.content.toLowerCase().includes('symbol') ||
    c.content.toLowerCase().includes('abbreviation')
  );

  if (legendChunks.length === 0) {
    return null;
  }

  const symbols: SymbolLegendItem[] = [];

  for (const chunk of legendChunks) {
    const lines = chunk.content.split('\n');
    let currentTrade = trade;

    // Detect trade from content if not specified
    if (!currentTrade) {
      if (chunk.content.match(/hvac|mechanical|air/i)) currentTrade = 'hvac';
      else if (chunk.content.match(/plumbing|water|drainage/i)) currentTrade = 'plumbing';
      else if (chunk.content.match(/electrical|power|lighting/i)) currentTrade = 'electrical';
      else if (chunk.content.match(/fire alarm|detection|notification/i)) currentTrade = 'fire_alarm';
    }

    for (const line of lines) {
      // Pattern: SYMBOL - DESCRIPTION or SYMBOL: DESCRIPTION
      const match = line.match(/^([A-Z0-9-]+)\s*[-:]\s*(.+)$/);
      if (match && currentTrade) {
        const [, symbol, description] = match;
        symbols.push({
          symbol: symbol.trim(),
          description: description.trim(),
          trade: currentTrade,
          category: categorizeSymbol(symbol, description),
          sourceSheet: `Sheet ${chunk.pageNumber || 'Unknown'}`,
        });
      }
    }
  }

  if (symbols.length === 0) {
    return null;
  }

  return {
    symbols,
    sheet: legendChunks[0].sourceReference || 'Unknown',
    trade: trade || 'multiple',
    lastUpdated: new Date(),
  };
}

function categorizeSymbol(symbol: string, description: string): string {
  const desc = description.toLowerCase();

  // HVAC categories
  if (desc.match(/supply|return|exhaust|fan/)) return 'ductwork';
  if (desc.match(/diffuser|grille|register/)) return 'air_distribution';
  if (desc.match(/unit|equipment|ahu|rtu/)) return 'equipment';

  // Plumbing categories
  if (desc.match(/water|domestic|cold|hot/)) return 'water_distribution';
  if (desc.match(/waste|drain|sanitary|vent/)) return 'drainage';
  if (desc.match(/fixture|toilet|sink|fountain/)) return 'fixtures';

  // Electrical categories
  if (desc.match(/panel|board|mcc/)) return 'distribution';
  if (desc.match(/receptacle|outlet/)) return 'devices';
  if (desc.match(/light|fixture|luminaire/)) return 'lighting';
  if (desc.match(/switch/)) return 'controls';

  // Fire Alarm categories
  if (desc.match(/detector|smoke|heat/)) return 'detection';
  if (desc.match(/horn|strobe|speaker/)) return 'notification';
  if (desc.match(/pull|manual/)) return 'manual_initiation';

  return 'other';
}
