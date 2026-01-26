/**
 * Industry Standard Symbol Libraries
 * 
 * Comprehensive symbol definitions from:
 * - CSI MasterFormat categories
 * - ASHRAE HVAC standards
 * - IEEE electrical symbols
 * - IBC/IFC building codes
 * 
 * Phase B.4 - Document Intelligence Roadmap
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface StandardSymbol {
  id: string;
  name: string;
  description: string;
  standard: 'CSI' | 'ASHRAE' | 'IEEE' | 'IBC' | 'IFC';
  category: string;
  subCategory?: string;
  aliases: string[];           // Alternative names
  relatedCodes?: string[];     // Related code sections
  commonUses: string[];        // Where typically used
  searchTerms: string[];       // Keywords for matching
}

// ============================================================================
// CSI MASTERFORMAT CATEGORIES
// ============================================================================

export const CSI_MASTERFORMAT: StandardSymbol[] = [
  // Division 03 - Concrete
  {
    id: 'csi_03_concrete',
    name: 'Concrete',
    description: 'Cast-in-place concrete, includes foundation, slabs, walls',
    standard: 'CSI',
    category: 'Division 03',
    subCategory: 'Cast-In-Place Concrete',
    aliases: ['CIP', 'cast in place', 'poured concrete'],
    relatedCodes: ['03 30 00'],
    commonUses: ['foundations', 'slabs', 'walls', 'columns'],
    searchTerms: ['concrete', 'cip', 'foundation', 'slab', 'footing'],
  },
  {
    id: 'csi_03_rebar',
    name: 'Reinforcement',
    description: 'Reinforcing steel bars and welded wire fabric',
    standard: 'CSI',
    category: 'Division 03',
    subCategory: 'Concrete Reinforcing',
    aliases: ['rebar', 're-bar', 'reinforcing steel', 'WWF'],
    relatedCodes: ['03 20 00'],
    commonUses: ['concrete reinforcement', 'structural support'],
    searchTerms: ['rebar', 'reinforcement', 'steel', 'wwf', 'wire mesh'],
  },
  
  // Division 05 - Metals
  {
    id: 'csi_05_structural_steel',
    name: 'Structural Steel',
    description: 'Structural steel framing, beams, columns, joists',
    standard: 'CSI',
    category: 'Division 05',
    subCategory: 'Structural Metal Framing',
    aliases: ['steel framing', 'steel frame', 'wide flange', 'I-beam'],
    relatedCodes: ['05 12 00'],
    commonUses: ['building structure', 'framing', 'supports'],
    searchTerms: ['steel', 'beam', 'column', 'joist', 'wide flange', 'structural'],
  },
  
  // Division 08 - Openings
  {
    id: 'csi_08_doors',
    name: 'Doors and Frames',
    description: 'Door assemblies including frames, hardware',
    standard: 'CSI',
    category: 'Division 08',
    subCategory: 'Doors and Frames',
    aliases: ['door', 'door frame', 'door assembly'],
    relatedCodes: ['08 11 00', '08 71 00'],
    commonUses: ['building entrances', 'interior partitions'],
    searchTerms: ['door', 'frame', 'hardware', 'lock', 'hinge'],
  },
  {
    id: 'csi_08_windows',
    name: 'Windows',
    description: 'Window assemblies and glazing',
    standard: 'CSI',
    category: 'Division 08',
    subCategory: 'Windows',
    aliases: ['window', 'glazing', 'glass'],
    relatedCodes: ['08 50 00'],
    commonUses: ['building envelope', 'natural light'],
    searchTerms: ['window', 'glazing', 'glass', 'sash', 'frame'],
  },
];

// ============================================================================
// ASHRAE HVAC SYMBOLS
// ============================================================================

export const ASHRAE_SYMBOLS: StandardSymbol[] = [
  {
    id: 'ashrae_ahu',
    name: 'Air Handling Unit',
    description: 'Central air handling equipment for HVAC systems',
    standard: 'ASHRAE',
    category: 'HVAC Equipment',
    subCategory: 'Air Handling',
    aliases: ['AHU', 'air handler', 'fan coil'],
    relatedCodes: ['ASHRAE 90.1'],
    commonUses: ['mechanical rooms', 'roof', 'equipment rooms'],
    searchTerms: ['ahu', 'air handler', 'hvac', 'fan', 'coil'],
  },
  {
    id: 'ashrae_vav',
    name: 'Variable Air Volume Box',
    description: 'Terminal unit for variable air volume systems',
    standard: 'ASHRAE',
    category: 'HVAC Equipment',
    subCategory: 'Terminal Units',
    aliases: ['VAV', 'VAV box', 'terminal unit'],
    relatedCodes: ['ASHRAE 90.1'],
    commonUses: ['ceiling plenums', 'above ceilings'],
    searchTerms: ['vav', 'variable air', 'terminal', 'damper'],
  },
  {
    id: 'ashrae_exhaust_fan',
    name: 'Exhaust Fan',
    description: 'Mechanical exhaust ventilation',
    standard: 'ASHRAE',
    category: 'HVAC Equipment',
    subCategory: 'Ventilation',
    aliases: ['EF', 'exhaust', 'ventilation fan'],
    relatedCodes: ['ASHRAE 62.1'],
    commonUses: ['restrooms', 'kitchens', 'mechanical rooms'],
    searchTerms: ['exhaust', 'fan', 'ventilation', 'vent'],
  },
  {
    id: 'ashrae_supply_diffuser',
    name: 'Supply Air Diffuser',
    description: 'Air distribution outlet in ceiling or wall',
    standard: 'ASHRAE',
    category: 'HVAC Distribution',
    subCategory: 'Diffusers',
    aliases: ['diffuser', 'supply', 'grille', 'register'],
    relatedCodes: [],
    commonUses: ['ceilings', 'walls', 'occupied spaces'],
    searchTerms: ['diffuser', 'supply', 'air', 'grille', 'register'],
  },
  {
    id: 'ashrae_return_grille',
    name: 'Return Air Grille',
    description: 'Return air intake for HVAC systems',
    standard: 'ASHRAE',
    category: 'HVAC Distribution',
    subCategory: 'Grilles',
    aliases: ['return', 'RA', 'return grille'],
    relatedCodes: [],
    commonUses: ['walls', 'ceilings', 'corridors'],
    searchTerms: ['return', 'grille', 'air', 'intake'],
  },
  {
    id: 'ashrae_thermostat',
    name: 'Thermostat',
    description: 'Temperature control device',
    standard: 'ASHRAE',
    category: 'Controls',
    subCategory: 'Temperature Control',
    aliases: ['T-stat', 'temp control', 'temperature sensor'],
    relatedCodes: [],
    commonUses: ['walls', 'occupied spaces'],
    searchTerms: ['thermostat', 'temperature', 'control', 'tstat'],
  },
];

// ============================================================================
// IEEE ELECTRICAL SYMBOLS
// ============================================================================

export const IEEE_SYMBOLS: StandardSymbol[] = [
  {
    id: 'ieee_panel',
    name: 'Electrical Panel',
    description: 'Electrical distribution panel or panelboard',
    standard: 'IEEE',
    category: 'Power Distribution',
    subCategory: 'Panels',
    aliases: ['panel', 'panelboard', 'breaker panel', 'load center'],
    relatedCodes: ['NEC Article 408'],
    commonUses: ['electrical rooms', 'closets', 'walls'],
    searchTerms: ['panel', 'breaker', 'distribution', 'electrical'],
  },
  {
    id: 'ieee_receptacle',
    name: 'Duplex Receptacle',
    description: 'Standard electrical outlet',
    standard: 'IEEE',
    category: 'Devices',
    subCategory: 'Receptacles',
    aliases: ['outlet', 'plug', 'receptacle', 'duplex'],
    relatedCodes: ['NEC Article 406'],
    commonUses: ['walls', 'throughout building'],
    searchTerms: ['receptacle', 'outlet', 'plug', 'duplex'],
  },
  {
    id: 'ieee_switch',
    name: 'Light Switch',
    description: 'Single-pole light switch',
    standard: 'IEEE',
    category: 'Devices',
    subCategory: 'Switches',
    aliases: ['switch', 'light switch', 'toggle'],
    relatedCodes: ['NEC Article 404'],
    commonUses: ['walls', 'entry points'],
    searchTerms: ['switch', 'light', 'toggle'],
  },
  {
    id: 'ieee_junction_box',
    name: 'Junction Box',
    description: 'Electrical junction or pull box',
    standard: 'IEEE',
    category: 'Raceways',
    subCategory: 'Boxes',
    aliases: ['JB', 'j-box', 'pull box'],
    relatedCodes: ['NEC Article 314'],
    commonUses: ['ceilings', 'walls', 'above ceilings'],
    searchTerms: ['junction', 'box', 'pull box', 'jb'],
  },
  {
    id: 'ieee_fixture',
    name: 'Light Fixture',
    description: 'Lighting fixture',
    standard: 'IEEE',
    category: 'Lighting',
    subCategory: 'Fixtures',
    aliases: ['fixture', 'light', 'luminaire'],
    relatedCodes: ['NEC Article 410'],
    commonUses: ['ceilings', 'walls', 'throughout'],
    searchTerms: ['light', 'fixture', 'luminaire', 'lighting'],
  },
  {
    id: 'ieee_fire_alarm',
    name: 'Fire Alarm Device',
    description: 'Fire alarm notification or detection device',
    standard: 'IEEE',
    category: 'Fire Alarm',
    subCategory: 'Devices',
    aliases: ['FA', 'fire alarm', 'smoke detector', 'horn strobe'],
    relatedCodes: ['NFPA 72'],
    commonUses: ['ceilings', 'walls', 'throughout building'],
    searchTerms: ['fire alarm', 'smoke', 'detector', 'horn', 'strobe'],
  },
];

// ============================================================================
// IBC BUILDING CODE SYMBOLS
// ============================================================================

export const IBC_SYMBOLS: StandardSymbol[] = [
  {
    id: 'ibc_exit',
    name: 'Exit',
    description: 'Building exit for egress',
    standard: 'IBC',
    category: 'Life Safety',
    subCategory: 'Egress',
    aliases: ['exit', 'egress', 'way out'],
    relatedCodes: ['IBC Chapter 10'],
    commonUses: ['building exits', 'stairwells', 'doors'],
    searchTerms: ['exit', 'egress', 'escape', 'stair', 'door'],
  },
  {
    id: 'ibc_exit_sign',
    name: 'Exit Sign',
    description: 'Illuminated exit signage',
    standard: 'IBC',
    category: 'Life Safety',
    subCategory: 'Signage',
    aliases: ['exit sign', 'egress sign', 'lighted exit'],
    relatedCodes: ['IBC 1013'],
    commonUses: ['above exits', 'corridors'],
    searchTerms: ['exit sign', 'illuminated', 'emergency'],
  },
  {
    id: 'ibc_fire_extinguisher',
    name: 'Fire Extinguisher',
    description: 'Portable fire extinguisher cabinet',
    standard: 'IBC',
    category: 'Fire Protection',
    subCategory: 'Extinguishers',
    aliases: ['FE', 'extinguisher', 'fire ext'],
    relatedCodes: ['IBC 906'],
    commonUses: ['corridors', 'near exits', 'throughout'],
    searchTerms: ['fire extinguisher', 'extinguisher', 'fe'],
  },
  {
    id: 'ibc_fire_door',
    name: 'Fire-Rated Door',
    description: 'Fire-rated door assembly',
    standard: 'IBC',
    category: 'Fire Protection',
    subCategory: 'Fire Barriers',
    aliases: ['fire door', 'rated door', 'fire-rated'],
    relatedCodes: ['IBC 716'],
    commonUses: ['fire barriers', 'exit stairs', 'separations'],
    searchTerms: ['fire door', 'rated', 'fire rated', 'barrier'],
  },
  {
    id: 'ibc_accessible_symbol',
    name: 'Accessible Symbol',
    description: 'ADA accessibility symbol',
    standard: 'IBC',
    category: 'Accessibility',
    subCategory: 'Signage',
    aliases: ['ADA', 'accessible', 'handicap', 'ISA'],
    relatedCodes: ['IBC Chapter 11', 'ADA'],
    commonUses: ['accessible entrances', 'parking', 'restrooms'],
    searchTerms: ['accessible', 'ada', 'handicap', 'wheelchair'],
  },
  {
    id: 'ibc_fire_sprinkler',
    name: 'Fire Sprinkler Head',
    description: 'Automatic fire sprinkler',
    standard: 'IBC',
    category: 'Fire Protection',
    subCategory: 'Sprinklers',
    aliases: ['sprinkler', 'sprinkler head', 'fire suppression'],
    relatedCodes: ['IBC 903', 'NFPA 13'],
    commonUses: ['ceilings', 'throughout building'],
    searchTerms: ['sprinkler', 'fire protection', 'suppression'],
  },
];

// ============================================================================
// COMBINED LIBRARY
// ============================================================================

export const ALL_STANDARD_SYMBOLS: StandardSymbol[] = [
  ...CSI_MASTERFORMAT,
  ...ASHRAE_SYMBOLS,
  ...IEEE_SYMBOLS,
  ...IBC_SYMBOLS,
];

// ============================================================================
// SYMBOL LOOKUP & MATCHING
// ============================================================================

/**
 * Search symbols by text query
 */
export function searchStandardSymbols(
  query: string,
  options: {
    standard?: string;
    category?: string;
    limit?: number;
  } = {}
): StandardSymbol[] {
  const lowerQuery = query.toLowerCase();
  const { standard, category, limit = 20 } = options;

  let results = ALL_STANDARD_SYMBOLS.filter(symbol => {
    // Filter by standard if specified
    if (standard && symbol.standard !== standard) {
      return false;
    }

    // Filter by category if specified
    if (category && symbol.category !== category) {
      return false;
    }

    // Match against name, description, aliases, and search terms
    return (
      symbol.name.toLowerCase().includes(lowerQuery) ||
      symbol.description.toLowerCase().includes(lowerQuery) ||
      symbol.aliases.some(alias => alias.toLowerCase().includes(lowerQuery)) ||
      symbol.searchTerms.some(term => term.toLowerCase().includes(lowerQuery))
    );
  });

  // Sort by relevance (exact matches first)
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase() === lowerQuery ? 1 : 0;
    const bExact = b.name.toLowerCase() === lowerQuery ? 1 : 0;
    return bExact - aExact;
  });

  return results.slice(0, limit);
}

/**
 * Find symbol by ID
 */
export function getStandardSymbolById(id: string): StandardSymbol | null {
  return ALL_STANDARD_SYMBOLS.find(s => s.id === id) || null;
}

/**
 * Get all symbols for a specific standard
 */
export function getSymbolsByStandard(
  standard: 'CSI' | 'ASHRAE' | 'IEEE' | 'IBC' | 'IFC'
): StandardSymbol[] {
  return ALL_STANDARD_SYMBOLS.filter(s => s.standard === standard);
}

/**
 * Get all symbols in a category
 */
export function getSymbolsByCategory(category: string): StandardSymbol[] {
  return ALL_STANDARD_SYMBOLS.filter(s => s.category === category);
}

/**
 * Match extracted symbol text to standard symbols
 */
export function matchToStandardSymbol(
  extractedText: string,
  confidence: number = 0.7
): StandardSymbol | null {
  const lower = extractedText.toLowerCase();
  
  // Try exact name match first
  for (const symbol of ALL_STANDARD_SYMBOLS) {
    if (symbol.name.toLowerCase() === lower) {
      return symbol;
    }
  }

  // Try alias match
  for (const symbol of ALL_STANDARD_SYMBOLS) {
    if (symbol.aliases.some(alias => alias.toLowerCase() === lower)) {
      return symbol;
    }
  }

  // Try partial match on search terms
  const matches = ALL_STANDARD_SYMBOLS.filter(symbol =>
    symbol.searchTerms.some(term => lower.includes(term))
  );

  if (matches.length === 1) {
    return matches[0];
  }

  return null;
}

/**
 * Get symbol statistics
 */
export function getSymbolLibraryStats() {
  const byStandard: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const symbol of ALL_STANDARD_SYMBOLS) {
    byStandard[symbol.standard] = (byStandard[symbol.standard] || 0) + 1;
    byCategory[symbol.category] = (byCategory[symbol.category] || 0) + 1;
  }

  return {
    total: ALL_STANDARD_SYMBOLS.length,
    byStandard,
    byCategory,
    standards: ['CSI', 'ASHRAE', 'IEEE', 'IBC', 'IFC'],
  };
}
