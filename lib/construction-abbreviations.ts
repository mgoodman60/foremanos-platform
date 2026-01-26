/**
 * Construction Industry Standard Abbreviations
 * 
 * Comprehensive cache of common construction abbreviations used in:
 * - Room schedules
 * - Construction schedules
 * - Drawing annotations
 * - Specifications
 * - Material takeoffs
 * 
 * Sources:
 * - CSI MasterFormat
 * - AIA CAD Layer Guidelines
 * - National CAD Standard (NCS)
 * - Common trade practice
 */

export interface ConstructionAbbreviation {
  abbreviation: string;      // Short form (e.g., "CONF")
  fullName: string;          // Full name (e.g., "Conference Room")
  category: AbbreviationCategory;
  alternates?: string[];     // Alternate abbreviations
  csiDivision?: number;      // Related CSI division (if applicable)
  context?: string;          // Usage context/notes
}

export type AbbreviationCategory =
  | 'room_type'
  | 'material'
  | 'trade'
  | 'schedule_task'
  | 'dimension'
  | 'architectural'
  | 'structural'
  | 'mep'
  | 'finish'
  | 'equipment'
  | 'general';

/**
 * Room Type Abbreviations
 */
export const ROOM_TYPE_ABBREVIATIONS: ConstructionAbbreviation[] = [
  { abbreviation: 'CONF', fullName: 'Conference Room', category: 'room_type', alternates: ['CONF RM', 'MEETING'] },
  { abbreviation: 'OFF', fullName: 'Office', category: 'room_type', alternates: ['OFFICE'] },
  { abbreviation: 'STOR', fullName: 'Storage', category: 'room_type', alternates: ['STORAGE', 'STRG', 'STG'] },
  { abbreviation: 'ELEC', fullName: 'Electrical Room', category: 'room_type', alternates: ['ELEC RM', 'ELECTRICAL'] },
  { abbreviation: 'MECH', fullName: 'Mechanical Room', category: 'room_type', alternates: ['MECH RM', 'MECHANICAL'] },
  { abbreviation: 'REST', fullName: 'Restroom', category: 'room_type', alternates: ['RESTROOM', 'WC', 'TOILET'] },
  { abbreviation: 'JAN', fullName: 'Janitor Closet', category: 'room_type', alternates: ['JANITOR', 'JC', 'CUSTODIAL'] },
  { abbreviation: 'BREAK', fullName: 'Break Room', category: 'room_type', alternates: ['BREAK RM', 'BREAKROOM'] },
  { abbreviation: 'LOBBY', fullName: 'Lobby', category: 'room_type', alternates: ['ENTRY', 'RECEPTION'] },
  { abbreviation: 'CORR', fullName: 'Corridor', category: 'room_type', alternates: ['CORRIDOR', 'HALLWAY', 'HALL'] },
  { abbreviation: 'VEST', fullName: 'Vestibule', category: 'room_type', alternates: ['VESTIBULE', 'ENTRY VEST'] },
  { abbreviation: 'STAIR', fullName: 'Stairwell', category: 'room_type', alternates: ['STAIRWELL', 'STAIRS'] },
  { abbreviation: 'ELEV', fullName: 'Elevator', category: 'room_type', alternates: ['ELEVATOR', 'LIFT'] },
  { abbreviation: 'MDF', fullName: 'Main Distribution Frame', category: 'room_type', alternates: ['TELECOM', 'DATA'] },
  { abbreviation: 'IDF', fullName: 'Intermediate Distribution Frame', category: 'room_type', alternates: ['TELECOM CLOSET'] },
  { abbreviation: 'SERV', fullName: 'Service Room', category: 'room_type', alternates: ['SERVICE'] },
  { abbreviation: 'UTIL', fullName: 'Utility Room', category: 'room_type', alternates: ['UTILITIES'] },
  { abbreviation: 'LAB', fullName: 'Laboratory', category: 'room_type', alternates: ['LABORATORY'] },
  { abbreviation: 'CLASS', fullName: 'Classroom', category: 'room_type', alternates: ['CLASSROOM', 'TRAINING'] },
  { abbreviation: 'CAFE', fullName: 'Cafeteria', category: 'room_type', alternates: ['CAFETERIA', 'DINING'] },
  { abbreviation: 'KITCH', fullName: 'Kitchen', category: 'room_type', alternates: ['KITCHEN', 'GALLEY'] },
  { abbreviation: 'COPY', fullName: 'Copy Room', category: 'room_type', alternates: ['COPY RM', 'COPIER'] },
  { abbreviation: 'IT', fullName: 'IT Room', category: 'room_type', alternates: ['SERVER', 'COMPUTER'] },
  { abbreviation: 'RCPT', fullName: 'Reception', category: 'room_type', alternates: ['RECEPTION', 'FRONT DESK'] },
  { abbreviation: 'EXAM', fullName: 'Examination Room', category: 'room_type', alternates: ['EXAMINATION', 'PATIENT'] },
  { abbreviation: 'LAB', fullName: 'Laboratory', category: 'room_type', alternates: ['LABORATORY', 'LAB RM'] },
  { abbreviation: 'WAIT', fullName: 'Waiting Room', category: 'room_type', alternates: ['WAITING', 'RECEPTION'] },
];

/**
 * Construction Schedule Task Abbreviations
 */
export const SCHEDULE_TASK_ABBREVIATIONS: ConstructionAbbreviation[] = [
  { abbreviation: 'EXCAV', fullName: 'Excavation', category: 'schedule_task', csiDivision: 31, alternates: ['EXCAVATE', 'DIG'] },
  { abbreviation: 'DEMO', fullName: 'Demolition', category: 'schedule_task', csiDivision: 2, alternates: ['DEMOLISH', 'REMOVE'] },
  { abbreviation: 'CONC', fullName: 'Concrete', category: 'schedule_task', csiDivision: 3, alternates: ['CONCRETE', 'POUR'] },
  { abbreviation: 'FDN', fullName: 'Foundation', category: 'schedule_task', csiDivision: 3, alternates: ['FOUNDATION', 'FOOTING'] },
  { abbreviation: 'FRM', fullName: 'Framing', category: 'schedule_task', csiDivision: 6, alternates: ['FRAME', 'ROUGH CARP'] },
  { abbreviation: 'ROOF', fullName: 'Roofing', category: 'schedule_task', csiDivision: 7, alternates: ['ROOFING', 'ROOF INSTALL'] },
  { abbreviation: 'DRY', fullName: 'Drywall', category: 'schedule_task', csiDivision: 9, alternates: ['DRYWALL', 'GWB'] },
  { abbreviation: 'PAINT', fullName: 'Painting', category: 'schedule_task', csiDivision: 9, alternates: ['PAINT', 'FINISH'] },
  { abbreviation: 'ELEC', fullName: 'Electrical', category: 'schedule_task', csiDivision: 26, alternates: ['ELECTRICAL', 'POWER'] },
  { abbreviation: 'PLUMB', fullName: 'Plumbing', category: 'schedule_task', csiDivision: 22, alternates: ['PLUMBING', 'PIPES'] },
  { abbreviation: 'HVAC', fullName: 'Heating, Ventilation, and Air Conditioning', category: 'schedule_task', csiDivision: 23, alternates: ['MECHANICAL', 'MECH'] },
  { abbreviation: 'SITE', fullName: 'Site Work', category: 'schedule_task', csiDivision: 31, alternates: ['SITEWORK', 'CIVIL'] },
  { abbreviation: 'PAVE', fullName: 'Paving', category: 'schedule_task', csiDivision: 32, alternates: ['PAVING', 'ASPHALT'] },
  { abbreviation: 'LAND', fullName: 'Landscaping', category: 'schedule_task', csiDivision: 32, alternates: ['LANDSCAPE', 'PLANTING'] },
  { abbreviation: 'MOBIL', fullName: 'Mobilization', category: 'schedule_task', csiDivision: 1, alternates: ['MOBILIZE', 'MOVE IN'] },
  { abbreviation: 'INSP', fullName: 'Inspection', category: 'schedule_task', csiDivision: 1, alternates: ['INSPECT', 'REVIEW'] },
  { abbreviation: 'INSTALL', fullName: 'Installation', category: 'schedule_task', alternates: ['INST', 'INSTAL'] },
  { abbreviation: 'ROUGH-IN', fullName: 'Rough-In', category: 'schedule_task', alternates: ['ROUGH IN', 'R/I'] },
  { abbreviation: 'FINISH', fullName: 'Finish Work', category: 'schedule_task', alternates: ['FIN', 'FINISHES'] },
  { abbreviation: 'TEST', fullName: 'Testing', category: 'schedule_task', alternates: ['TESTING', 'COMMISSION'] },
  { abbreviation: 'SUBMIT', fullName: 'Submittal', category: 'schedule_task', alternates: ['SUBMITTALS', 'SHOP DWG'] },
  { abbreviation: 'PROC', fullName: 'Procurement', category: 'schedule_task', alternates: ['PROCURE', 'ORDER'] },
  { abbreviation: 'DELIV', fullName: 'Delivery', category: 'schedule_task', alternates: ['DELIVER', 'SHIP'] },
  { abbreviation: 'CLN', fullName: 'Cleanup', category: 'schedule_task', alternates: ['CLEANUP', 'CLEAN'] },
  { abbreviation: 'PUNCH', fullName: 'Punch List', category: 'schedule_task', alternates: ['PUNCHLIST', 'P/L'] },
  { abbreviation: 'CO', fullName: 'Certificate of Occupancy', category: 'schedule_task', alternates: ['C/O', 'OCCUPANCY'] },
  { abbreviation: 'TURN', fullName: 'Turnover', category: 'schedule_task', alternates: ['TURNOVER', 'HANDOVER'] },
];

/**
 * Material Abbreviations
 */
export const MATERIAL_ABBREVIATIONS: ConstructionAbbreviation[] = [
  { abbreviation: 'VCT', fullName: 'Vinyl Composition Tile', category: 'material', csiDivision: 9, alternates: ['VINYL TILE'] },
  { abbreviation: 'LVT', fullName: 'Luxury Vinyl Tile', category: 'material', csiDivision: 9, alternates: ['LUXURY VINYL'] },
  { abbreviation: 'CPT', fullName: 'Carpet', category: 'material', csiDivision: 9, alternates: ['CARPET', 'CARPETING'] },
  { abbreviation: 'CER', fullName: 'Ceramic Tile', category: 'material', csiDivision: 9, alternates: ['CERAMIC', 'TILE'] },
  { abbreviation: 'PORC', fullName: 'Porcelain Tile', category: 'material', csiDivision: 9, alternates: ['PORCELAIN'] },
  { abbreviation: 'GWB', fullName: 'Gypsum Wall Board', category: 'material', csiDivision: 9, alternates: ['DRYWALL', 'SHEETROCK'] },
  { abbreviation: 'ACT', fullName: 'Acoustic Ceiling Tile', category: 'material', csiDivision: 9, alternates: ['ACOUSTIC TILE', 'CEILING TILE'] },
  { abbreviation: 'CONC', fullName: 'Concrete', category: 'material', csiDivision: 3, alternates: ['CONCRETE', 'CIP'] },
  { abbreviation: 'CMU', fullName: 'Concrete Masonry Unit', category: 'material', csiDivision: 4, alternates: ['BLOCK', 'CONCRETE BLOCK'] },
  { abbreviation: 'PT', fullName: 'Pressure Treated', category: 'material', csiDivision: 6, alternates: ['PRESSURE TREATED', 'P/T'] },
  { abbreviation: 'CLG', fullName: 'Ceiling', category: 'architectural', csiDivision: 9, alternates: ['CEILING', 'CEIL'] },
  { abbreviation: 'FLR', fullName: 'Floor', category: 'architectural', csiDivision: 9, alternates: ['FLOOR', 'FLOORING'] },
  { abbreviation: 'BASE', fullName: 'Base/Baseboard', category: 'finish', csiDivision: 9, alternates: ['BASEBOARD', 'WALL BASE'] },
  { abbreviation: 'RBR', fullName: 'Rubber Base', category: 'finish', csiDivision: 9, alternates: ['RUBBER BASEBOARD'] },
  { abbreviation: 'VB', fullName: 'Vinyl Base', category: 'finish', csiDivision: 9, alternates: ['VINYL BASEBOARD'] },
  { abbreviation: 'WD', fullName: 'Wood Base', category: 'finish', csiDivision: 9, alternates: ['WOOD BASEBOARD'] },
  { abbreviation: 'LAMI', fullName: 'Laminate', category: 'material', csiDivision: 9, alternates: ['LAMINATE', 'LAM'] },
  { abbreviation: 'SS', fullName: 'Stainless Steel', category: 'material', csiDivision: 5, alternates: ['STAINLESS'] },
  { abbreviation: 'AL', fullName: 'Aluminum', category: 'material', csiDivision: 5, alternates: ['ALUMINUM', 'ALUMINIUM'] },
  { abbreviation: 'GL', fullName: 'Glass', category: 'material', csiDivision: 8, alternates: ['GLASS', 'GLAZING'] },
  { abbreviation: 'GYPS', fullName: 'Gypsum', category: 'material', csiDivision: 9, alternates: ['GYPSUM'] },
  { abbreviation: 'EPOXY', fullName: 'Epoxy', category: 'material', csiDivision: 9, alternates: ['EPOXY COATING'] },
  { abbreviation: 'PVC', fullName: 'Polyvinyl Chloride', category: 'material', csiDivision: 22, alternates: ['VINYL'] },
];

/**
 * Dimension & Measurement Abbreviations
 */
export const DIMENSION_ABBREVIATIONS: ConstructionAbbreviation[] = [
  { abbreviation: 'SF', fullName: 'Square Feet', category: 'dimension', alternates: ['SQ FT', 'SQ.FT.'] },
  { abbreviation: 'SY', fullName: 'Square Yards', category: 'dimension', alternates: ['SQ YD', 'SQ.YD.'] },
  { abbreviation: 'LF', fullName: 'Linear Feet', category: 'dimension', alternates: ['LIN FT', 'L.F.'] },
  { abbreviation: 'CF', fullName: 'Cubic Feet', category: 'dimension', alternates: ['CU FT', 'CU.FT.'] },
  { abbreviation: 'CY', fullName: 'Cubic Yards', category: 'dimension', alternates: ['CU YD', 'CU.YD.'] },
  { abbreviation: 'EA', fullName: 'Each', category: 'dimension', alternates: ['EACH'] },
  { abbreviation: 'LS', fullName: 'Lump Sum', category: 'dimension', alternates: ['LUMP SUM', 'L.S.'] },
  { abbreviation: 'NTS', fullName: 'Not To Scale', category: 'dimension', alternates: ['NOT TO SCALE'] },
  { abbreviation: 'TYP', fullName: 'Typical', category: 'general', alternates: ['TYPICAL'] },
  { abbreviation: 'SIM', fullName: 'Similar', category: 'general', alternates: ['SIMILAR'] },
  { abbreviation: 'MAX', fullName: 'Maximum', category: 'dimension', alternates: ['MAXIMUM'] },
  { abbreviation: 'MIN', fullName: 'Minimum', category: 'dimension', alternates: ['MINIMUM'] },
  { abbreviation: 'CLR', fullName: 'Clear', category: 'dimension', alternates: ['CLEAR'] },
  { abbreviation: 'O.C.', fullName: 'On Center', category: 'dimension', alternates: ['ON CENTER', 'OC'] },
  { abbreviation: 'C.T.C.', fullName: 'Center To Center', category: 'dimension', alternates: ['CENTER TO CENTER', 'CTC'] },
];

/**
 * Architectural Abbreviations
 */
export const ARCHITECTURAL_ABBREVIATIONS: ConstructionAbbreviation[] = [
  { abbreviation: 'BLDG', fullName: 'Building', category: 'architectural', alternates: ['BUILDING', 'BLD'] },
  { abbreviation: 'FLR', fullName: 'Floor', category: 'architectural', alternates: ['FLOOR'] },
  { abbreviation: 'RM', fullName: 'Room', category: 'architectural', alternates: ['ROOM'] },
  { abbreviation: 'DR', fullName: 'Door', category: 'architectural', csiDivision: 8, alternates: ['DOOR'] },
  { abbreviation: 'WDW', fullName: 'Window', category: 'architectural', csiDivision: 8, alternates: ['WINDOW', 'WIN'] },
  { abbreviation: 'CLG', fullName: 'Ceiling', category: 'architectural', alternates: ['CEILING', 'CEIL'] },
  { abbreviation: 'ROOF', fullName: 'Roof', category: 'architectural', csiDivision: 7, alternates: ['ROOFING'] },
  { abbreviation: 'WALL', fullName: 'Wall', category: 'architectural', alternates: ['WL'] },
  { abbreviation: 'PART', fullName: 'Partition', category: 'architectural', alternates: ['PARTITION'] },
  { abbreviation: 'COL', fullName: 'Column', category: 'structural', csiDivision: 5, alternates: ['COLUMN'] },
  { abbreviation: 'BM', fullName: 'Beam', category: 'structural', csiDivision: 5, alternates: ['BEAM'] },
  { abbreviation: 'JOIST', fullName: 'Joist', category: 'structural', csiDivision: 5, alternates: ['JST'] },
  { abbreviation: 'DECK', fullName: 'Decking', category: 'structural', csiDivision: 5, alternates: ['DECKING', 'DK'] },
  { abbreviation: 'FTG', fullName: 'Footing', category: 'structural', csiDivision: 3, alternates: ['FOOTING', 'FDN'] },
  { abbreviation: 'SLAB', fullName: 'Slab', category: 'structural', csiDivision: 3, alternates: ['SL'] },
  { abbreviation: 'FFE', fullName: 'Furniture, Fixtures, and Equipment', category: 'architectural', csiDivision: 12, alternates: ['FF&E'] },
  { abbreviation: 'AFF', fullName: 'Above Finished Floor', category: 'architectural', alternates: ['ABOVE FF'] },
  { abbreviation: 'ADA', fullName: 'Americans with Disabilities Act', category: 'architectural', alternates: ['ACCESSIBILITY'] },
  { abbreviation: 'EXT', fullName: 'Exterior', category: 'architectural', alternates: ['EXTERIOR', 'OUTSIDE'] },
  { abbreviation: 'INT', fullName: 'Interior', category: 'architectural', alternates: ['INTERIOR', 'INSIDE'] },
  { abbreviation: 'ALT', fullName: 'Alternate', category: 'general', alternates: ['ALTERNATE', 'OPTION'] },
];

/**
 * MEP Abbreviations
 */
export const MEP_ABBREVIATIONS: ConstructionAbbreviation[] = [
  { abbreviation: 'HVAC', fullName: 'Heating, Ventilation, and Air Conditioning', category: 'mep', csiDivision: 23 },
  { abbreviation: 'VAV', fullName: 'Variable Air Volume', category: 'mep', csiDivision: 23, alternates: ['VAV BOX'] },
  { abbreviation: 'AHU', fullName: 'Air Handling Unit', category: 'mep', csiDivision: 23, alternates: ['AIR HANDLER'] },
  { abbreviation: 'RTU', fullName: 'Rooftop Unit', category: 'mep', csiDivision: 23, alternates: ['ROOF TOP UNIT'] },
  { abbreviation: 'FCU', fullName: 'Fan Coil Unit', category: 'mep', csiDivision: 23, alternates: ['FAN COIL'] },
  { abbreviation: 'ERV', fullName: 'Energy Recovery Ventilator', category: 'mep', csiDivision: 23 },
  { abbreviation: 'HRV', fullName: 'Heat Recovery Ventilator', category: 'mep', csiDivision: 23 },
  { abbreviation: 'DUCT', fullName: 'Ductwork', category: 'mep', csiDivision: 23, alternates: ['DUCTING'] },
  { abbreviation: 'DIFF', fullName: 'Diffuser', category: 'mep', csiDivision: 23, alternates: ['SUPPLY DIFF'] },
  { abbreviation: 'GRILL', fullName: 'Grille', category: 'mep', csiDivision: 23, alternates: ['GRILLE', 'RETURN GRILL'] },
  { abbreviation: 'SPRNK', fullName: 'Sprinkler', category: 'mep', csiDivision: 21, alternates: ['FIRE SPRINKLER'] },
  { abbreviation: 'FP', fullName: 'Fire Protection', category: 'mep', csiDivision: 21, alternates: ['FIRE PROT'] },
  { abbreviation: 'STBY', fullName: 'Standby', category: 'mep', csiDivision: 21, alternates: ['STANDBY', 'STAND BY'] },
  { abbreviation: 'WH', fullName: 'Water Heater', category: 'mep', csiDivision: 22, alternates: ['HOT WATER HEATER'] },
  { abbreviation: 'WC', fullName: 'Water Closet', category: 'mep', csiDivision: 22, alternates: ['TOILET'] },
  { abbreviation: 'LAV', fullName: 'Lavatory', category: 'mep', csiDivision: 22, alternates: ['SINK', 'WASHBASIN'] },
  { abbreviation: 'UR', fullName: 'Urinal', category: 'mep', csiDivision: 22, alternates: ['URINAL'] },
  { abbreviation: 'FD', fullName: 'Floor Drain', category: 'mep', csiDivision: 22, alternates: ['FLOOR DRAIN', 'DRAIN'] },
  { abbreviation: 'CO', fullName: 'Cleanout', category: 'mep', csiDivision: 22, alternates: ['CLEAN OUT', 'C/O'] },
  { abbreviation: 'VTR', fullName: 'Vent Through Roof', category: 'mep', csiDivision: 22, alternates: ['VENT'] },
  { abbreviation: 'ELEC', fullName: 'Electrical', category: 'mep', csiDivision: 26, alternates: ['ELECTRICAL'] },
  { abbreviation: 'PWR', fullName: 'Power', category: 'mep', csiDivision: 26, alternates: ['POWER'] },
  { abbreviation: 'LTG', fullName: 'Lighting', category: 'mep', csiDivision: 26, alternates: ['LIGHTING', 'LIGHTS'] },
  { abbreviation: 'RECEP', fullName: 'Receptacle', category: 'mep', csiDivision: 26, alternates: ['OUTLET', 'PLUG'] },
  { abbreviation: 'SW', fullName: 'Switch', category: 'mep', csiDivision: 26, alternates: ['SWITCH'] },
  { abbreviation: 'PANEL', fullName: 'Electrical Panel', category: 'mep', csiDivision: 26, alternates: ['PANELBOARD', 'ELEC PANEL'] },
  { abbreviation: 'MCC', fullName: 'Motor Control Center', category: 'mep', csiDivision: 26, alternates: ['MOTOR CONTROL'] },
  { abbreviation: 'XFMR', fullName: 'Transformer', category: 'mep', csiDivision: 26, alternates: ['TRANSFORMER', 'TRANS'] },
  { abbreviation: 'GEN', fullName: 'Generator', category: 'mep', csiDivision: 26, alternates: ['GENERATOR', 'EMERGENCY GEN'] },
  { abbreviation: 'UPS', fullName: 'Uninterruptible Power Supply', category: 'mep', csiDivision: 26, alternates: ['BATTERY BACKUP'] },
  { abbreviation: 'FA', fullName: 'Fire Alarm', category: 'mep', csiDivision: 28, alternates: ['FIRE ALARM SYSTEM'] },
  { abbreviation: 'SEC', fullName: 'Security', category: 'mep', csiDivision: 28, alternates: ['SECURITY SYSTEM'] },
  { abbreviation: 'CCTV', fullName: 'Closed Circuit Television', category: 'mep', csiDivision: 27, alternates: ['CAMERA', 'SECURITY CAM'] },
  { abbreviation: 'TEL', fullName: 'Telephone', category: 'mep', csiDivision: 27, alternates: ['PHONE', 'TELECOM'] },
  { abbreviation: 'DATA', fullName: 'Data', category: 'mep', csiDivision: 27, alternates: ['NETWORK', 'ETHERNET'] },
  { abbreviation: 'AV', fullName: 'Audio Visual', category: 'mep', csiDivision: 27, alternates: ['AUDIO/VISUAL', 'A/V'] },
];

/**
 * Combine all abbreviations into one searchable array
 */
export const ALL_CONSTRUCTION_ABBREVIATIONS: ConstructionAbbreviation[] = [
  ...ROOM_TYPE_ABBREVIATIONS,
  ...SCHEDULE_TASK_ABBREVIATIONS,
  ...MATERIAL_ABBREVIATIONS,
  ...DIMENSION_ABBREVIATIONS,
  ...ARCHITECTURAL_ABBREVIATIONS,
  ...MEP_ABBREVIATIONS,
];

/**
 * Quick lookup map for O(1) access
 */
const abbreviationMap = new Map<string, ConstructionAbbreviation>();
ALL_CONSTRUCTION_ABBREVIATIONS.forEach(abbr => {
  abbreviationMap.set(abbr.abbreviation.toUpperCase(), abbr);
  abbr.alternates?.forEach(alt => {
    if (!abbreviationMap.has(alt.toUpperCase())) {
      abbreviationMap.set(alt.toUpperCase(), abbr);
    }
  });
});

/**
 * Expand an abbreviation to its full name
 */
export function expandAbbreviation(abbr: string): string | null {
  const found = abbreviationMap.get(abbr.toUpperCase().trim());
  return found ? found.fullName : null;
}

/**
 * Check if a string is a known abbreviation
 */
export function isKnownAbbreviation(str: string): boolean {
  return abbreviationMap.has(str.toUpperCase().trim());
}

/**
 * Expand all abbreviations in a text string
 */
export function expandAbbreviationsInText(text: string): string {
  return text.replace(/\b([A-Z][A-Z0-9\/\.]+)\b/g, (match) => {
    const expanded = expandAbbreviation(match);
    return expanded ? `${match} (${expanded})` : match;
  });
}

/**
 * Get abbreviations by category
 */
export function getAbbreviationsByCategory(category: AbbreviationCategory): ConstructionAbbreviation[] {
  return ALL_CONSTRUCTION_ABBREVIATIONS.filter(abbr => abbr.category === category);
}

/**
 * Search abbreviations by keyword (name or abbreviation)
 */
export function searchAbbreviations(query: string): ConstructionAbbreviation[] {
  const lowerQuery = query.toLowerCase();
  return ALL_CONSTRUCTION_ABBREVIATIONS.filter(abbr =>
    abbr.abbreviation.toLowerCase().includes(lowerQuery) ||
    abbr.fullName.toLowerCase().includes(lowerQuery) ||
    abbr.alternates?.some(alt => alt.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get related CSI division for an abbreviation
 */
export function getCSIDivisionForAbbreviation(abbr: string): number | null {
  const found = abbreviationMap.get(abbr.toUpperCase().trim());
  return found?.csiDivision || null;
}

/**
 * Generate context string for LLM prompts
 */
export function generateAbbreviationContext(text: string): string {
  const foundAbbreviations: string[] = [];
  
  // Find abbreviations in text
  const words = text.match(/\b[A-Z][A-Z0-9\/\.]{1,10}\b/g) || [];
  const uniqueWords = [...new Set(words)];
  
  uniqueWords.forEach(word => {
    const expansion = expandAbbreviation(word);
    if (expansion && expansion !== word) {
      foundAbbreviations.push(`${word} = ${expansion}`);
    }
  });
  
  if (foundAbbreviations.length === 0) {
    return '';
  }
  
  return `\n\n📋 **ABBREVIATION GLOSSARY** (Found in document):\n${foundAbbreviations.join('\n')}`;
}

/**
 * Get statistics about the abbreviation library
 */
export function getAbbreviationStats() {
  return {
    total: ALL_CONSTRUCTION_ABBREVIATIONS.length,
    byCategory: {
      room_type: ROOM_TYPE_ABBREVIATIONS.length,
      schedule_task: SCHEDULE_TASK_ABBREVIATIONS.length,
      material: MATERIAL_ABBREVIATIONS.length,
      dimension: DIMENSION_ABBREVIATIONS.length,
      architectural: ARCHITECTURAL_ABBREVIATIONS.length,
      mep: MEP_ABBREVIATIONS.length,
    },
    uniqueAbbreviations: abbreviationMap.size,
  };
}
