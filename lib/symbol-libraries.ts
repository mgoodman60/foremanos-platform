/**
 * Industry Standard Symbol Libraries (Phase B.4)
 * Pre-loaded symbol libraries for construction drawings
 * 
 * Capabilities:
 * - Standard symbol lookup (CSI, AIA, ANSI)
 * - Symbol matching and identification
 * - Symbol documentation and references
 * - Trade-specific symbol sets
 * - Custom symbol library management
 */

import { SymbolCategory } from './legend-extractor';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface StandardSymbol {
  code: string;                  // "E-1", "FA-PS", "M-EXH"
  description: string;           // "Duplex Receptacle"
  category: SymbolCategory;
  trade: Trade;
  standard: Standard;            // CSI, AIA, ANSI
  alternativeCodes: string[];    // Other common codes
  specification?: string;        // Associated spec section
  notes?: string;
  imageUrl?: string;             // Symbol illustration
}

export enum Trade {
  ELECTRICAL = 'electrical',
  MECHANICAL = 'mechanical',
  PLUMBING = 'plumbing',
  FIRE_PROTECTION = 'fire_protection',
  ARCHITECTURAL = 'architectural',
  STRUCTURAL = 'structural',
  CIVIL = 'civil',
  LANDSCAPE = 'landscape'
}

export enum Standard {
  CSI = 'CSI',           // Construction Specifications Institute
  AIA = 'AIA',           // American Institute of Architects
  ANSI = 'ANSI',         // American National Standards Institute
  NFPA = 'NFPA',         // National Fire Protection Association
  ASME = 'ASME',         // American Society of Mechanical Engineers
  CUSTOM = 'CUSTOM'      // Project-specific
}

// ============================================================================
// STANDARD SYMBOL LIBRARIES
// ============================================================================

/**
 * ELECTRICAL SYMBOLS (CSI Division 26)
 */
export const ELECTRICAL_SYMBOLS: StandardSymbol[] = [
  {
    code: 'E-1',
    description: 'Duplex Receptacle',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['⊗', '⊕', 'RECEP', 'OUTLET'],
    specification: '26 27 26'
  },
  {
    code: 'E-2',
    description: 'GFCI Receptacle',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['GFI', 'GFCI', 'GROUND FAULT'],
    specification: '26 27 26'
  },
  {
    code: 'E-3',
    description: 'Light Switch, Single Pole',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['S', 'SW', '$'],
    specification: '26 27 13'
  },
  {
    code: 'E-4',
    description: 'Light Switch, 3-Way',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['S3', '3W', '$3'],
    specification: '26 27 13'
  },
  {
    code: 'E-5',
    description: 'Light Switch, 4-Way',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['S4', '4W', '$4'],
    specification: '26 27 13'
  },
  {
    code: 'E-6',
    description: 'Dimmer Switch',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['SD', 'DIM'],
    specification: '26 27 13'
  },
  {
    code: 'E-7',
    description: 'Ceiling Light Fixture',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['⊙', 'CLF', 'CEILING LT'],
    specification: '26 51 00'
  },
  {
    code: 'E-8',
    description: 'Wall-Mounted Light Fixture',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['WLF', 'WALL LT'],
    specification: '26 51 00'
  },
  {
    code: 'E-9',
    description: 'Recessed Light Fixture',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['RLF', 'CAN', 'RECESSED'],
    specification: '26 51 00'
  },
  {
    code: 'E-10',
    description: 'Exit Light',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['EXIT', 'EMERGENCY EXIT'],
    specification: '26 53 00'
  },
  {
    code: 'E-11',
    description: 'Emergency Light',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['EL', 'EMER', 'EMERGENCY'],
    specification: '26 53 00'
  },
  {
    code: 'E-12',
    description: 'Panel Board',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['PB', 'PANEL', 'PANELBOARD'],
    specification: '26 24 16'
  },
  {
    code: 'E-13',
    description: 'Distribution Panel',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['DP', 'DIST PANEL'],
    specification: '26 24 16'
  },
  {
    code: 'E-14',
    description: 'Motor Control Center',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['MCC'],
    specification: '26 29 13'
  },
  {
    code: 'E-15',
    description: 'Transformer',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['XFMR', 'TRANS', 'T'],
    specification: '26 22 13'
  },
  {
    code: 'E-16',
    description: 'Generator',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['GEN', 'GENERATOR'],
    specification: '26 32 13'
  },
  {
    code: 'E-17',
    description: 'Disconnect Switch',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['DISC', 'DS'],
    specification: '26 24 16'
  },
  {
    code: 'E-18',
    description: 'Smoke Detector',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['SD', 'SMOKE'],
    specification: '28 31 11'
  },
  {
    code: 'E-19',
    description: 'Fire Alarm Device',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['FA', 'FIRE ALARM'],
    specification: '28 31 00'
  },
  {
    code: 'E-20',
    description: 'Pull Station',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['PS', 'FIRE PULL'],
    specification: '28 31 23'
  },
  {
    code: 'E-21',
    description: 'Telephone Outlet',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['TEL', 'PHONE'],
    specification: '27 15 00'
  },
  {
    code: 'E-22',
    description: 'Data Outlet',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['DATA', 'D', 'RJ45'],
    specification: '27 13 00'
  },
  {
    code: 'E-23',
    description: 'Cable TV Outlet',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['CATV', 'TV'],
    specification: '27 41 13'
  },
  {
    code: 'E-24',
    description: 'Security Camera',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['CAM', 'CCTV'],
    specification: '28 23 00'
  },
  {
    code: 'E-25',
    description: 'Clock Outlet',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['CLK', 'CLOCK'],
    specification: '27 51 16'
  },
  {
    code: 'E-26',
    description: 'Junction Box',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['JB', 'J-BOX'],
    specification: '26 05 33'
  },
  {
    code: 'E-27',
    description: 'Pull Box',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['PB', 'PULL'],
    specification: '26 05 33'
  },
  {
    code: 'E-28',
    description: 'Fan',
    category: SymbolCategory.ELECTRICAL,
    trade: Trade.ELECTRICAL,
    standard: Standard.CSI,
    alternativeCodes: ['F', 'FAN'],
    specification: '23 34 23'
  }
];

/**
 * MECHANICAL SYMBOLS (CSI Division 23)
 */
export const MECHANICAL_SYMBOLS: StandardSymbol[] = [
  {
    code: 'M-1',
    description: 'Supply Air Diffuser',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['SA', 'SUP', 'DIFF'],
    specification: '23 37 13'
  },
  {
    code: 'M-2',
    description: 'Return Air Grille',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['RA', 'RET'],
    specification: '23 37 13'
  },
  {
    code: 'M-3',
    description: 'Exhaust Fan',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['EF', 'EXH'],
    specification: '23 34 23'
  },
  {
    code: 'M-4',
    description: 'Thermostat',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['T', 'TSTAT'],
    specification: '23 09 23'
  },
  {
    code: 'M-5',
    description: 'VAV Box',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['VAV'],
    specification: '23 36 13'
  },
  {
    code: 'M-6',
    description: 'Air Handling Unit',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['AHU', 'AIR HANDLER'],
    specification: '23 73 00'
  },
  {
    code: 'M-7',
    description: 'Rooftop Unit',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['RTU', 'ROOF TOP UNIT'],
    specification: '23 74 33'
  },
  {
    code: 'M-8',
    description: 'Fan Coil Unit',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['FCU', 'FAN COIL'],
    specification: '23 82 33'
  },
  {
    code: 'M-9',
    description: 'Ductwork',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['DUCT', 'DUCTING'],
    specification: '23 31 00'
  },
  {
    code: 'M-10',
    description: 'Fire Damper',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['FD', 'FIRE DAMP'],
    specification: '23 33 13'
  },
  {
    code: 'M-11',
    description: 'Smoke Damper',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['SD', 'SMOKE DAMP'],
    specification: '23 33 16'
  },
  {
    code: 'M-12',
    description: 'Volume Damper',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['VD', 'VOL DAMP'],
    specification: '23 33 00'
  },
  {
    code: 'M-13',
    description: 'Chiller',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['CH', 'CHILLER'],
    specification: '23 64 13'
  },
  {
    code: 'M-14',
    description: 'Boiler',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['B', 'BOILER'],
    specification: '23 52 33'
  },
  {
    code: 'M-15',
    description: 'Cooling Tower',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['CT', 'COOL TOWER'],
    specification: '23 65 13'
  },
  {
    code: 'M-16',
    description: 'Heat Exchanger',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['HX', 'HEAT EXCH'],
    specification: '23 57 00'
  },
  {
    code: 'M-17',
    description: 'Pump',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['P', 'PUMP'],
    specification: '23 21 00'
  },
  {
    code: 'M-18',
    description: 'Access Door',
    category: SymbolCategory.MECHANICAL,
    trade: Trade.MECHANICAL,
    standard: Standard.CSI,
    alternativeCodes: ['AD', 'ACCESS'],
    specification: '23 05 41'
  }
];

/**
 * PLUMBING SYMBOLS (CSI Division 22)
 */
export const PLUMBING_SYMBOLS: StandardSymbol[] = [
  {
    code: 'P-1',
    description: 'Water Closet',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['WC', 'TOILET'],
    specification: '22 41 13'
  },
  {
    code: 'P-2',
    description: 'Lavatory',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['LAV', 'SINK'],
    specification: '22 41 16'
  },
  {
    code: 'P-3',
    description: 'Floor Drain',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['FD'],
    specification: '22 13 16'
  },
  {
    code: 'P-4',
    description: 'Cleanout',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['CO'],
    specification: '22 05 23'
  },
  {
    code: 'P-5',
    description: 'Hose Bibb',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['HB'],
    specification: '22 11 16'
  },
  {
    code: 'P-6',
    description: 'Urinal',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['UR', 'URINAL'],
    specification: '22 41 13'
  },
  {
    code: 'P-7',
    description: 'Shower',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['SH', 'SHOWER'],
    specification: '22 41 39'
  },
  {
    code: 'P-8',
    description: 'Bathtub',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['TUB', 'BATHTUB'],
    specification: '22 41 39'
  },
  {
    code: 'P-9',
    description: 'Drinking Fountain',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['DF', 'FOUNTAIN', 'WF'],
    specification: '22 41 13'
  },
  {
    code: 'P-10',
    description: 'Water Heater',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['WH', 'HWH'],
    specification: '22 34 00'
  },
  {
    code: 'P-11',
    description: 'Roof Drain',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['RD', 'ROOF DRAIN'],
    specification: '22 13 16'
  },
  {
    code: 'P-12',
    description: 'Vent Through Roof',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['VTR', 'VENT'],
    specification: '22 13 16'
  },
  {
    code: 'P-13',
    description: 'Gas Valve',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['GV', 'GAS'],
    specification: '22 11 16'
  },
  {
    code: 'P-14',
    description: 'Water Shutoff Valve',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['WSV', 'VALVE'],
    specification: '22 05 23'
  },
  {
    code: 'P-15',
    description: 'Backflow Preventer',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['BFP', 'BACKFLOW'],
    specification: '22 05 53'
  },
  {
    code: 'P-16',
    description: 'Grease Trap',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['GT', 'GREASE'],
    specification: '22 13 16'
  },
  {
    code: 'P-17',
    description: 'Sump Pump',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['SP', 'SUMP'],
    specification: '22 14 29'
  },
  {
    code: 'P-18',
    description: 'Eyewash Station',
    category: SymbolCategory.PLUMBING,
    trade: Trade.PLUMBING,
    standard: Standard.CSI,
    alternativeCodes: ['EW', 'EYEWASH'],
    specification: '22 41 13'
  }
];

/**
 * FIRE PROTECTION SYMBOLS (CSI Division 21)
 */
export const FIRE_PROTECTION_SYMBOLS: StandardSymbol[] = [
  {
    code: 'FP-1',
    description: 'Fire Alarm Pull Station',
    category: SymbolCategory.FIRE_PROTECTION,
    trade: Trade.FIRE_PROTECTION,
    standard: Standard.NFPA,
    alternativeCodes: ['FA-PS', 'PULL'],
    specification: '28 31 23'
  },
  {
    code: 'FP-2',
    description: 'Smoke Detector',
    category: SymbolCategory.FIRE_PROTECTION,
    trade: Trade.FIRE_PROTECTION,
    standard: Standard.NFPA,
    alternativeCodes: ['SD', 'SMOKE'],
    specification: '28 31 11'
  },
  {
    code: 'FP-3',
    description: 'Sprinkler Head',
    category: SymbolCategory.FIRE_PROTECTION,
    trade: Trade.FIRE_PROTECTION,
    standard: Standard.NFPA,
    alternativeCodes: ['SPR'],
    specification: '21 13 13'
  },
  {
    code: 'FP-4',
    description: 'Fire Extinguisher Cabinet',
    category: SymbolCategory.FIRE_PROTECTION,
    trade: Trade.FIRE_PROTECTION,
    standard: Standard.NFPA,
    alternativeCodes: ['FE', 'EXT'],
    specification: '10 44 13'
  },
  {
    code: 'FP-5',
    description: 'Fire Alarm Horn/Strobe',
    category: SymbolCategory.FIRE_PROTECTION,
    trade: Trade.FIRE_PROTECTION,
    standard: Standard.NFPA,
    alternativeCodes: ['H/S', 'HORN'],
    specification: '28 31 23'
  },
  {
    code: 'FP-6',
    description: 'Fire Alarm Control Panel',
    category: SymbolCategory.FIRE_PROTECTION,
    trade: Trade.FIRE_PROTECTION,
    standard: Standard.NFPA,
    alternativeCodes: ['FACP', 'FA PANEL'],
    specification: '28 31 11'
  },
  {
    code: 'FP-7',
    description: 'Fire Pump',
    category: SymbolCategory.FIRE_PROTECTION,
    trade: Trade.FIRE_PROTECTION,
    standard: Standard.NFPA,
    alternativeCodes: ['FP', 'FIRE PUMP'],
    specification: '21 13 19'
  },
  {
    code: 'FP-8',
    description: 'Standpipe',
    category: SymbolCategory.FIRE_PROTECTION,
    trade: Trade.FIRE_PROTECTION,
    standard: Standard.NFPA,
    alternativeCodes: ['SP', 'STANDPIPE'],
    specification: '21 12 13'
  },
  {
    code: 'FP-9',
    description: 'Fire Hose Cabinet',
    category: SymbolCategory.FIRE_PROTECTION,
    trade: Trade.FIRE_PROTECTION,
    standard: Standard.NFPA,
    alternativeCodes: ['FH', 'HOSE CAB'],
    specification: '21 13 16'
  },
  {
    code: 'FP-10',
    description: 'Fire Department Connection',
    category: SymbolCategory.FIRE_PROTECTION,
    trade: Trade.FIRE_PROTECTION,
    standard: Standard.NFPA,
    alternativeCodes: ['FDC', 'SIAMESE'],
    specification: '21 13 16'
  }
];

/**
 * ARCHITECTURAL SYMBOLS
 */
export const ARCHITECTURAL_SYMBOLS: StandardSymbol[] = [
  {
    code: 'A-1',
    description: 'Door, Single Swing',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['DR'],
    specification: '08 11 13'
  },
  {
    code: 'A-2',
    description: 'Window',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['WD'],
    specification: '08 51 13'
  },
  {
    code: 'A-3',
    description: 'Partition Wall',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['WALL', 'PART'],
    specification: '09 21 16'
  },
  {
    code: 'A-4',
    description: 'Door, Double Swing',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['DDR', 'DOUBLE DOOR'],
    specification: '08 11 13'
  },
  {
    code: 'A-5',
    description: 'Door, Sliding',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['SDR', 'SLIDE DOOR'],
    specification: '08 13 13'
  },
  {
    code: 'A-6',
    description: 'Door, Pocket',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['PDR', 'POCKET DOOR'],
    specification: '08 13 13'
  },
  {
    code: 'A-7',
    description: 'Door, Bi-Fold',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['BDR', 'BIFOLD'],
    specification: '08 13 13'
  },
  {
    code: 'A-8',
    description: 'Window, Fixed',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['FW', 'FIXED WIN'],
    specification: '08 51 13'
  },
  {
    code: 'A-9',
    description: 'Window, Casement',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['CW', 'CASEMENT'],
    specification: '08 52 13'
  },
  {
    code: 'A-10',
    description: 'Window, Double Hung',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['DHW', 'DOUBLE HUNG'],
    specification: '08 53 13'
  },
  {
    code: 'A-11',
    description: 'Skylight',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['SL', 'SKYLIGHT'],
    specification: '08 62 00'
  },
  {
    code: 'A-12',
    description: 'Stair',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['ST', 'STAIRS'],
    specification: '03 30 00'
  },
  {
    code: 'A-13',
    description: 'Stair, Up Direction Arrow',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['UP', 'STAIR UP'],
    specification: '03 30 00'
  },
  {
    code: 'A-14',
    description: 'Stair, Down Direction Arrow',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['DN', 'STAIR DOWN'],
    specification: '03 30 00'
  },
  {
    code: 'A-15',
    description: 'Elevator',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['ELEV', 'ELEVATOR'],
    specification: '14 21 00'
  },
  {
    code: 'A-16',
    description: 'Column',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['COL', 'COLUMN'],
    specification: '05 12 00'
  },
  {
    code: 'A-17',
    description: 'Beam',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['BM', 'BEAM'],
    specification: '05 12 23'
  },
  {
    code: 'A-18',
    description: 'Ramp',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['RAMP'],
    specification: '03 30 00'
  },
  {
    code: 'A-19',
    description: 'Section Cut Line',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['SECTION'],
    specification: 'Drawing Annotation'
  },
  {
    code: 'A-20',
    description: 'Detail Reference',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['DETAIL', 'DET'],
    specification: 'Drawing Annotation'
  },
  {
    code: 'A-21',
    description: 'Centerline',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['CL', 'CENTER'],
    specification: 'Drawing Annotation'
  },
  {
    code: 'A-22',
    description: 'North Arrow',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['N', 'NORTH'],
    specification: 'Drawing Annotation'
  },
  {
    code: 'A-23',
    description: 'Scale Bar',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['SCALE'],
    specification: 'Drawing Annotation'
  },
  {
    code: 'A-24',
    description: 'Property Line',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['PL', 'PROPERTY'],
    specification: 'Site Work'
  },
  {
    code: 'A-25',
    description: 'Existing to Remain',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['EXIST', 'E'],
    specification: 'Drawing Annotation'
  },
  {
    code: 'A-26',
    description: 'New Construction',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['NEW', 'N'],
    specification: 'Drawing Annotation'
  },
  {
    code: 'A-27',
    description: 'To Be Demolished',
    category: SymbolCategory.ARCHITECTURAL,
    trade: Trade.ARCHITECTURAL,
    standard: Standard.AIA,
    alternativeCodes: ['DEMO', 'D'],
    specification: 'Drawing Annotation'
  }
];

// ============================================================================
// COMBINED LIBRARY
// ============================================================================

export const ALL_STANDARD_SYMBOLS: StandardSymbol[] = [
  ...ELECTRICAL_SYMBOLS,
  ...MECHANICAL_SYMBOLS,
  ...PLUMBING_SYMBOLS,
  ...FIRE_PROTECTION_SYMBOLS,
  ...ARCHITECTURAL_SYMBOLS
];

// ============================================================================
// SYMBOL LOOKUP FUNCTIONS
// ============================================================================

/**
 * Finds a standard symbol by code
 */
export function findSymbolByCode(code: string): StandardSymbol | null {
  const normalized = code.trim().toUpperCase();
  
  return ALL_STANDARD_SYMBOLS.find(s => 
    s.code.toUpperCase() === normalized ||
    s.alternativeCodes.some(alt => alt.toUpperCase() === normalized)
  ) || null;
}

/**
 * Searches symbols by description
 */
export function searchSymbols(query: string): StandardSymbol[] {
  const lower = query.toLowerCase();
  
  return ALL_STANDARD_SYMBOLS.filter(s =>
    s.description.toLowerCase().includes(lower) ||
    s.code.toLowerCase().includes(lower) ||
    s.alternativeCodes.some(alt => alt.toLowerCase().includes(lower))
  );
}

/**
 * Gets all symbols for a specific trade
 */
export function getSymbolsByTrade(trade: Trade): StandardSymbol[] {
  return ALL_STANDARD_SYMBOLS.filter(s => s.trade === trade);
}

/**
 * Gets all symbols for a specific category
 */
export function getSymbolsByCategory(category: SymbolCategory): StandardSymbol[] {
  return ALL_STANDARD_SYMBOLS.filter(s => s.category === category);
}

/**
 * Matches a detected symbol to standard library
 */
export function matchSymbol(
  code: string,
  description?: string,
  category?: SymbolCategory
): { match: StandardSymbol | null; confidence: number } {
  // Try exact code match first
  let match = findSymbolByCode(code);
  if (match) {
    return { match, confidence: 0.95 };
  }

  // Try description match if provided
  if (description) {
    const matches = searchSymbols(description);
    if (matches.length > 0) {
      // Filter by category if provided
      const filtered = category
        ? matches.filter(m => m.category === category)
        : matches;
      
      if (filtered.length > 0) {
        return { match: filtered[0], confidence: 0.85 };
      }
    }
  }

  return { match: null, confidence: 0 };
}

/**
 * Gets library statistics
 */
export function getLibraryStats() {
  const byTrade: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byStandard: Record<string, number> = {};

  for (const symbol of ALL_STANDARD_SYMBOLS) {
    byTrade[symbol.trade] = (byTrade[symbol.trade] || 0) + 1;
    byCategory[symbol.category] = (byCategory[symbol.category] || 0) + 1;
    byStandard[symbol.standard] = (byStandard[symbol.standard] || 0) + 1;
  }

  return {
    total: ALL_STANDARD_SYMBOLS.length,
    byTrade,
    byCategory,
    byStandard
  };
}
