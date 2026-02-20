/**
 * Symbol & Abbreviation Integration Layer
 * 
 * Connects the symbol library with the abbreviation cache
 * for comprehensive construction document understanding.
 */

import { 
  ALL_STANDARD_SYMBOLS, 
  findSymbolByCode, 
  searchSymbols,
  type StandardSymbol,
  type Trade
} from './symbol-libraries';

import {
  ALL_CONSTRUCTION_ABBREVIATIONS,
  expandAbbreviation,
  searchAbbreviations,
  type ConstructionAbbreviation
} from './construction-abbreviations';

export interface IntegratedLookupResult {
  input: string;
  type: 'symbol' | 'abbreviation' | 'both' | 'unknown';
  symbol?: StandardSymbol;
  abbreviation?: ConstructionAbbreviation;
  expansion?: string;
  confidence: number;
  alternateMatches?: Array<StandardSymbol | ConstructionAbbreviation>;
}

/**
 * Unified lookup: searches both symbol library AND abbreviation cache
 */
export function unifiedLookup(code: string): IntegratedLookupResult {
  const normalized = code.trim().toUpperCase();
  
  // Try symbol first
  const symbol = findSymbolByCode(normalized);
  
  // Try abbreviation
  const abbreviation = ALL_CONSTRUCTION_ABBREVIATIONS.find(
    a => a.abbreviation.toUpperCase() === normalized
  );
  const expansion = expandAbbreviation(normalized);
  
  // Both found
  if (symbol && abbreviation) {
    return {
      input: code,
      type: 'both',
      symbol,
      abbreviation,
      expansion: expansion || undefined,
      confidence: 0.95
    };
  }
  
  // Symbol only
  if (symbol) {
    return {
      input: code,
      type: 'symbol',
      symbol,
      confidence: 0.9
    };
  }
  
  // Abbreviation only
  if (abbreviation && expansion) {
    return {
      input: code,
      type: 'abbreviation',
      abbreviation,
      expansion,
      confidence: 0.9
    };
  }
  
  // Try fuzzy search
  const symbolMatches = searchSymbols(normalized);
  const abbrMatches = searchAbbreviations(normalized);
  
  if (symbolMatches.length > 0 || abbrMatches.length > 0) {
    return {
      input: code,
      type: 'unknown',
      confidence: 0.5,
      alternateMatches: [...symbolMatches, ...abbrMatches]
    };
  }
  
  // Unknown
  return {
    input: code,
    type: 'unknown',
    confidence: 0
  };
}

/**
 * Generate comprehensive context for LLM prompts
 * Includes both symbols and abbreviations found in document
 */
export function generateComprehensiveContext(documentText: string): string {
  const foundSymbols: string[] = [];
  const foundAbbreviations: string[] = [];
  
  // Extract potential codes (2-4 letter uppercase words or patterns like E-1)
  const patterns = documentText.match(/\b[A-Z]{2,4}\b|\b[A-Z]-\d+\b/g) || [];
  const uniquePatterns = [...new Set(patterns)];
  
  uniquePatterns.forEach(pattern => {
    const result = unifiedLookup(pattern);
    
    if (result.type === 'symbol' && result.symbol) {
      foundSymbols.push(`${pattern} = ${result.symbol.description} (${result.symbol.trade})`);
    } else if (result.type === 'abbreviation' && result.expansion) {
      foundAbbreviations.push(`${pattern} = ${result.expansion}`);
    } else if (result.type === 'both' && result.symbol && result.expansion) {
      foundSymbols.push(`${pattern} = ${result.symbol.description} (Symbol)`);
      foundAbbreviations.push(`${pattern} = ${result.expansion} (Term)`);
    }
  });
  
  let context = '';
  
  if (foundSymbols.length > 0) {
    context += `\n\n📦 **CONSTRUCTION SYMBOLS** (Found in document):\n${foundSymbols.join('\n')}`;
  }
  
  if (foundAbbreviations.length > 0) {
    context += `\n\n📋 **ABBREVIATIONS** (Found in document):\n${foundAbbreviations.join('\n')}`;
  }
  
  if (context) {
    context += `\n\n💡 **USAGE GUIDELINES:**\n- Symbols indicate equipment, fixtures, or drawing annotations\n- Abbreviations expand technical terms for clarity\n- Some codes may have both symbol and abbreviation meanings - use context to determine which applies`;
  }
  
  return context;
}

/**
 * Get trade-specific symbols and abbreviations
 */
export function getTradeSpecificContext(trade: Trade): {
  symbols: StandardSymbol[];
  abbreviations: ConstructionAbbreviation[];
} {
  const symbols = ALL_STANDARD_SYMBOLS.filter(s => s.trade === trade);
  
  // Map trade to abbreviation categories
  const categoryMap: Record<Trade, string[]> = {
    electrical: ['mep'],
    mechanical: ['mep', 'schedule_task'],
    plumbing: ['mep'],
    fire_protection: ['mep'],
    architectural: ['architectural', 'room_type'],
    structural: ['structural'],
    civil: ['schedule_task'],
    landscape: ['schedule_task']
  };
  
  const categories = categoryMap[trade] || [];
  const abbreviations = ALL_CONSTRUCTION_ABBREVIATIONS.filter(
    a => categories.includes(a.category)
  );
  
  return { symbols, abbreviations };
}

/**
 * Check if a code is ambiguous (exists in both libraries)
 */
export function isAmbiguousCode(code: string): boolean {
  const result = unifiedLookup(code);
  return result.type === 'both';
}

/**
 * Get all possible interpretations of a code
 */
export function getAllInterpretations(code: string): string[] {
  const result = unifiedLookup(code);
  const interpretations: string[] = [];
  
  if (result.symbol) {
    interpretations.push(`Symbol: ${result.symbol.description}`);
  }
  
  if (result.expansion) {
    interpretations.push(`Abbreviation: ${result.expansion}`);
  }
  
  if (result.alternateMatches && result.alternateMatches.length > 0) {
    result.alternateMatches.slice(0, 3).forEach(match => {
      if ('description' in match && 'trade' in match) {
        // It's a symbol
        interpretations.push(`Possible Symbol: ${match.description}`);
      } else if ('fullName' in match) {
        // It's an abbreviation
        interpretations.push(`Possible Abbreviation: ${match.fullName}`);
      }
    });
  }
  
  return interpretations;
}

/**
 * Generate a legend for all symbols and abbreviations in a document
 */
export function generateDocumentLegend(documentText: string): {
  symbols: Array<{ code: string; description: string; trade: string }>;
  abbreviations: Array<{ abbr: string; fullName: string }>;
  ambiguous: Array<{ code: string; interpretations: string[] }>;
} {
  const symbols: Array<{ code: string; description: string; trade: string }> = [];
  const abbreviations: Array<{ abbr: string; fullName: string }> = [];
  const ambiguous: Array<{ code: string; interpretations: string[] }> = [];
  
  const patterns = documentText.match(/\b[A-Z]{2,4}\b|\b[A-Z]-\d+\b/g) || [];
  const uniquePatterns = [...new Set(patterns)];
  
  uniquePatterns.forEach(pattern => {
    const result = unifiedLookup(pattern);
    
    if (result.type === 'both') {
      ambiguous.push({
        code: pattern,
        interpretations: getAllInterpretations(pattern)
      });
    } else if (result.type === 'symbol' && result.symbol) {
      symbols.push({
        code: pattern,
        description: result.symbol.description,
        trade: result.symbol.trade
      });
    } else if (result.type === 'abbreviation' && result.expansion) {
      abbreviations.push({
        abbr: pattern,
        fullName: result.expansion
      });
    }
  });
  
  return { symbols, abbreviations, ambiguous };
}

/**
 * Get statistics about coverage
 */
export function getCoverageStats() {
  return {
    totalSymbols: ALL_STANDARD_SYMBOLS.length,
    totalAbbreviations: ALL_CONSTRUCTION_ABBREVIATIONS.length,
    byTrade: {
      electrical: ALL_STANDARD_SYMBOLS.filter(s => s.trade === 'electrical').length,
      mechanical: ALL_STANDARD_SYMBOLS.filter(s => s.trade === 'mechanical').length,
      plumbing: ALL_STANDARD_SYMBOLS.filter(s => s.trade === 'plumbing').length,
      fire_protection: ALL_STANDARD_SYMBOLS.filter(s => s.trade === 'fire_protection').length,
      architectural: ALL_STANDARD_SYMBOLS.filter(s => s.trade === 'architectural').length,
    },
    byCategory: {
      room_type: ALL_CONSTRUCTION_ABBREVIATIONS.filter(a => a.category === 'room_type').length,
      material: ALL_CONSTRUCTION_ABBREVIATIONS.filter(a => a.category === 'material').length,
      mep: ALL_CONSTRUCTION_ABBREVIATIONS.filter(a => a.category === 'mep').length,
      schedule_task: ALL_CONSTRUCTION_ABBREVIATIONS.filter(a => a.category === 'schedule_task').length,
    }
  };
}
