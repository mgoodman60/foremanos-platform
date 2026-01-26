/**
 * PHASE B.4: INDUSTRY STANDARD SYMBOL LIBRARIES
 */

export interface SymbolDefinition {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  library: string;
  variations?: string[];
  related?: string[];
}

export interface SymbolLibrary {
  library: string;
  category: string;
  version: string;
  symbols: SymbolDefinition[];
}

// Standard Symbol Libraries
const ELECTRICAL_ANSI = {
  library: 'ANSI/IEEE 315',
  category: 'electrical',
  version: '2019',
  symbols: [
    { id: 'switch-single-pole', name: 'Single Pole Switch', code: 'S', description: 'Controls one circuit from one location', category: 'electrical', library: 'ANSI/IEEE 315', variations: ['S', 'S1', '$'] },
    { id: 'switch-3-way', name: '3-Way Switch', code: 'S3', description: 'Controls one circuit from two locations', category: 'electrical', library: 'ANSI/IEEE 315', variations: ['S3', 'S-3'] },
    { id: 'outlet-duplex', name: 'Duplex Receptacle', code: 'R', description: 'Standard 120V duplex outlet', category: 'electrical', library: 'ANSI/IEEE 315', variations: ['R', 'REC'] },
    { id: 'outlet-gfci', name: 'GFCI Receptacle', code: 'GFCI', description: 'Ground fault circuit interrupter outlet', category: 'electrical', library: 'ANSI/IEEE 315', variations: ['GFCI', 'GFI'] },
    { id: 'light-ceiling', name: 'Ceiling Light', code: 'L', description: 'Ceiling mounted light fixture', category: 'electrical', library: 'ANSI/IEEE 315', variations: ['L', 'LT'] },
    { id: 'light-recessed', name: 'Recessed Light', code: 'RL', description: 'Recessed can light fixture', category: 'electrical', library: 'ANSI/IEEE 315', variations: ['RL', 'CAN'] }
  ]
};

const HVAC_ASHRAE = {
  library: 'ASHRAE',
  category: 'hvac',
  version: '2020',
  symbols: [
    { id: 'diffuser-supply', name: 'Supply Air Diffuser', code: 'SD', description: 'Supply air diffuser', category: 'hvac', library: 'ASHRAE', variations: ['SD', 'SAG'] },
    { id: 'diffuser-return', name: 'Return Air Grille', code: 'RA', description: 'Return air grille', category: 'hvac', library: 'ASHRAE', variations: ['RA', 'RAG'] },
    { id: 'damper-fire', name: 'Fire Damper', code: 'FD', description: 'Fire rated damper', category: 'hvac', library: 'ASHRAE', variations: ['FD', 'F/D'] },
    { id: 'damper-volume', name: 'Volume Damper', code: 'VD', description: 'Manual volume control damper', category: 'hvac', library: 'ASHRAE', variations: ['VD', 'V/D'] },
    { id: 'vav-box', name: 'VAV Terminal Box', code: 'VAV', description: 'Variable air volume box', category: 'hvac', library: 'ASHRAE', variations: ['VAV', 'VB'] }
  ]
};

const PLUMBING_ASME = {
  library: 'ASME Y14.38',
  category: 'plumbing',
  version: '2007',
  symbols: [
    { id: 'sink-lavatory', name: 'Lavatory', code: 'LAV', description: 'Bathroom sink', category: 'plumbing', library: 'ASME Y14.38', variations: ['LAV', 'L'] },
    { id: 'toilet-wc', name: 'Water Closet', code: 'WC', description: 'Toilet', category: 'plumbing', library: 'ASME Y14.38', variations: ['WC', 'T'] },
    { id: 'urinal', name: 'Urinal', code: 'U', description: 'Wall hung urinal', category: 'plumbing', library: 'ASME Y14.38', variations: ['U', 'UR'] },
    { id: 'shower', name: 'Shower', code: 'SH', description: 'Shower stall', category: 'plumbing', library: 'ASME Y14.38', variations: ['SH', 'S'] },
    { id: 'drain-floor', name: 'Floor Drain', code: 'FD', description: 'Floor drain', category: 'plumbing', library: 'ASME Y14.38', variations: ['FD', 'F.D.'] }
  ]
};

const FIRE_PROTECTION = {
  library: 'NFPA',
  category: 'fire_protection',
  version: '2021',
  symbols: [
    { id: 'sprinkler-head', name: 'Sprinkler Head', code: 'SPR', description: 'Fire sprinkler head', category: 'fire_protection', library: 'NFPA', variations: ['SPR', 'FH'] },
    { id: 'pull-station', name: 'Pull Station', code: 'PS', description: 'Manual fire alarm pull station', category: 'fire_protection', library: 'NFPA', variations: ['PS', 'MPS'] },
    { id: 'smoke-detector', name: 'Smoke Detector', code: 'SD', description: 'Smoke detector', category: 'fire_protection', library: 'NFPA', variations: ['SD', 'S'] },
    { id: 'fire-extinguisher', name: 'Fire Extinguisher', code: 'FE', description: 'Portable fire extinguisher', category: 'fire_protection', library: 'NFPA', variations: ['FE', 'EXT'] }
  ]
};

const ALL_LIBRARIES: SymbolLibrary[] = [
  ELECTRICAL_ANSI,
  HVAC_ASHRAE,
  PLUMBING_ASME,
  FIRE_PROTECTION
];

export function getAllSymbolLibraries(): SymbolLibrary[] {
  return ALL_LIBRARIES;
}

export function getSymbolLibrary(libraryName: string): SymbolLibrary | undefined {
  return ALL_LIBRARIES.find(lib => lib.library === libraryName);
}

export function getSymbolsByCategory(category: string): SymbolDefinition[] {
  const library = ALL_LIBRARIES.find(lib => lib.category === category);
  return library ? library.symbols : [];
}

export function searchSymbols(query: string): SymbolDefinition[] {
  const lower = query.toLowerCase();
  const results: SymbolDefinition[] = [];
  
  for (const library of ALL_LIBRARIES) {
    for (const symbol of library.symbols) {
      if (symbol.name.toLowerCase().includes(lower) ||
          symbol.code.toLowerCase().includes(lower) ||
          symbol.description.toLowerCase().includes(lower) ||
          symbol.variations?.some(v => v.toLowerCase().includes(lower))) {
        results.push(symbol);
      }
    }
  }
  
  return results;
}

export function matchSymbol(code: string): SymbolDefinition | undefined {
  const upper = code.toUpperCase().trim();
  
  for (const library of ALL_LIBRARIES) {
    for (const symbol of library.symbols) {
      if (symbol.code.toUpperCase() === upper ||
          symbol.variations?.some(v => v.toUpperCase() === upper)) {
        return symbol;
      }
    }
  }
  
  return undefined;
}

export function getSymbolContext(codes: string[]): string {
  let context = '=== STANDARD SYMBOL LIBRARY ===\n\n';
  
  for (const code of codes) {
    const symbol = matchSymbol(code);
    if (symbol) {
      context += `${symbol.code} - ${symbol.name}\n`;
      context += `  Library: ${symbol.library}\n`;
      context += `  Description: ${symbol.description}\n`;
      context += `  Category: ${symbol.category}\n`;
      if (symbol.variations && symbol.variations.length > 1) {
        context += `  Variations: ${symbol.variations.join(', ')}\n`;
      }
      context += '\n';
    }
  }
  
  context += '💡 SYMBOL USAGE GUIDELINES:\n';
  context += '  • Standard symbols follow industry conventions\n';
  context += '  • Variations are trade-specific or regional\n';
  context += '  • Always check project-specific legend for overrides\n';
  context += '  • Code requirements vary by jurisdiction\n';
  
  return context;
}

export function getTotalSymbolCount(): number {
  return ALL_LIBRARIES.reduce((sum, lib) => sum + lib.symbols.length, 0);
}

export function getLibraryStats() {
  return {
    totalLibraries: ALL_LIBRARIES.length,
    totalSymbols: getTotalSymbolCount(),
    byCategory: ALL_LIBRARIES.map(lib => ({
      category: lib.category,
      library: lib.library,
      count: lib.symbols.length
    }))
  };
}
