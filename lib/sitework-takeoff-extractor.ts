/**
 * Sitework/Exterior Takeoff Extractor
 * 
 * Comprehensive extraction system for CSI Divisions 31 (Earthwork), 32 (Exterior), and 33 (Utilities)
 * 
 * PHASES:
 * 1. Enhanced Pattern Recognition - earthwork, paving, utilities
 * 2. Unit Normalization - SF/SY/AC, LF, CY, EA conversions
 * 3. Drawing-Type-Specific Extraction - grading, utility, landscape plans
 * 4. Quantity Derivation - cut/fill, paving areas, trench volumes
 * 5. Geotech/Specification Cross-Reference
 * 6. DWG/CAD File Integration
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';

// ============================================================================
// PHASE 1: ENHANCED PATTERN RECOGNITION
// ============================================================================

export interface SiteworkPattern {
  pattern: RegExp;
  category: 'earthwork' | 'paving' | 'utilities' | 'landscape' | 'stormwater';
  division: 31 | 32 | 33;
  itemKey: string;
  unitExtractor?: (match: RegExpMatchArray) => { quantity: number; unit: string };
  description?: string;
}

// Division 31 - Earthwork Patterns
export const EARTHWORK_PATTERNS: SiteworkPattern[] = [
  // Cut/Fill Volumes
  {
    pattern: /(?:cut|excavat(?:e|ion))\s*[:\-]?\s*([\d,]+\.?\d*)\s*(CY|cy|cubic\s*(?:yards?|yds?))/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'excavation-bulk',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'CY' }),
    description: 'Bulk excavation/cut volume'
  },
  {
    pattern: /(?:fill|import)\s*[:\-]?\s*([\d,]+\.?\d*)\s*(CY|cy|cubic\s*(?:yards?|yds?))/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'import-fill',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'CY' }),
    description: 'Fill/import volume'
  },
  // Compaction Specifications
  {
    pattern: /(\d{2,3})%\s*(?:proctor|compaction|std\.?\s*proctor|mod(?:ified)?\s*proctor)/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'compaction',
    description: 'Compaction requirement'
  },
  {
    pattern: /compacted?\s*to\s*(\d{2,3})%/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'compaction',
    description: 'Compaction specification'
  },
  // Soil Classifications
  {
    pattern: /(?:soil\s*)?type\s*([ABC])(?:\s*soil)?/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'excavation-bulk',
    description: 'OSHA soil classification'
  },
  {
    pattern: /(?:cohesive|granular|rock|clay|sandy?|silt)\s*(?:soil|material)/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'excavation-bulk',
    description: 'Soil type identification'
  },
  // Excavation Depth
  {
    pattern: /excavat(?:e|ion)\s*(?:to\s*)?(?:depth\s*(?:of\s*)?)?(\d+\.?\d*)['"]?(?:\s*(?:ft|feet|deep))?/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'excavation-bulk',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1]), unit: 'FT' }),
    description: 'Excavation depth'
  },
  // Subgrade Preparation
  {
    pattern: /subgrade\s*(?:prep(?:aration)?)?\s*[:\-]?\s*([\d,]+\.?\d*)\s*(SF|SY|sf|sy)/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'grading-fine',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: m[2].toUpperCase() })
  },
  // Aggregate Base
  {
    pattern: /(\d+)["']?\s*(?:DGA|ABC|aggregate\s*base|crushed?\s*stone|crusher\s*run)/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'aggregate-base-6in',
    description: 'Aggregate base course'
  },
  // Geotextile/Geogrid
  {
    pattern: /(?:geo(?:textile|fabric|grid))\s*[:\-]?\s*([\d,]+\.?\d*)\s*(SF|SY|sf|sy)/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'geotextile',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'SF' })
  },
  // Erosion Control
  {
    pattern: /silt\s*fence\s*[:\-]?\s*([\d,]+\.?\d*)\s*(LF|lf|linear\s*(?:feet|ft))/i,
    category: 'earthwork',
    division: 31,
    itemKey: 'silt-fence',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'LF' })
  },
];

// Division 32 - Paving & Exterior Patterns
export const PAVING_PATTERNS: SiteworkPattern[] = [
  // Asphalt Thickness
  {
    pattern: /(\d+\.?\d*)["']?\s*(?:thick)?\s*(?:asphalt|AC|HMA|bit(?:uminous)?)/i,
    category: 'paving',
    division: 32,
    itemKey: 'asphalt-paving-4in',
    description: 'Asphalt pavement thickness'
  },
  {
    pattern: /asphalt\s*(?:paving)?\s*[:\-]?\s*([\d,]+\.?\d*)\s*(SF|SY|sf|sy)/i,
    category: 'paving',
    division: 32,
    itemKey: 'asphalt-paving-4in',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: m[2].toUpperCase() })
  },
  // Concrete Thickness
  {
    pattern: /(\d+)["']?\s*(?:thick)?\s*(?:concrete|conc\.?|PCC)\s*(?:paving|sidewalk|driveway)?/i,
    category: 'paving',
    division: 32,
    itemKey: 'concrete-sidewalk-4in',
    description: 'Concrete pavement thickness'
  },
  // Striping Patterns
  {
    pattern: /(\d+)["']?\s*(?:white|yellow)\s*(?:stripe?|line|marking)/i,
    category: 'paving',
    division: 32,
    itemKey: 'pavement-marking-4in',
    description: 'Pavement marking width'
  },
  {
    pattern: /(?:striping|marking)\s*[:\-]?\s*([\d,]+\.?\d*)\s*(LF|lf)/i,
    category: 'paving',
    division: 32,
    itemKey: 'pavement-marking',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'LF' })
  },
  // Handicap/ADA
  {
    pattern: /(?:handicap|ADA|accessible)\s*(?:symbol|sign|space|parking)/i,
    category: 'paving',
    division: 32,
    itemKey: 'handicap-symbol',
    description: 'ADA marking'
  },
  {
    pattern: /(?:truncated\s*dome|detectable\s*warning)/i,
    category: 'paving',
    division: 32,
    itemKey: 'detectable-warning-surface',
    description: 'ADA detectable warning'
  },
  {
    pattern: /(?:ADA|curb)\s*ramp\s*[:\-]?\s*(\d+)\s*(?:EA|ea)?/i,
    category: 'paving',
    division: 32,
    itemKey: 'ada-ramp',
    unitExtractor: (m) => ({ quantity: parseInt(m[1]), unit: 'EA' })
  },
  // Curb & Gutter
  {
    pattern: /(?:curb\s*(?:and|&)?\s*gutter|C&G)\s*[:\-]?\s*([\d,]+\.?\d*)\s*(LF|lf)/i,
    category: 'paving',
    division: 32,
    itemKey: 'concrete-curb-gutter',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'LF' })
  },
];

// Division 33 - Utilities Patterns
export const UTILITY_PATTERNS: SiteworkPattern[] = [
  // Pipe Schedules (diameter @ slope)
  {
    pattern: /(\d+)["']?\s*(?:DIA\.?|Ø|diameter)?\s*(PVC|RCP|HDPE|DIP|CIP|VCP|ABS|CPVC)\s*(?:@|at)?\s*([\d.]+)%?/i,
    category: 'utilities',
    division: 33,
    itemKey: 'sanitary-pipe-8',
    description: 'Pipe with slope specification'
  },
  {
    pattern: /(\d+)["']?\s*(PVC|RCP|HDPE|DIP|CIP|VCP)\s*(?:pipe|storm|sanitary|sewer)?/i,
    category: 'utilities',
    division: 33,
    itemKey: 'storm-pipe-12',
    description: 'Pipe diameter and material'
  },
  {
    pattern: /(?:storm|sanitary|sewer)\s*(?:pipe|line)\s*[:\-]?\s*([\d,]+\.?\d*)\s*(LF|lf)/i,
    category: 'utilities',
    division: 33,
    itemKey: 'storm-pipe-12',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'LF' })
  },
  // Manhole Specifications
  {
    pattern: /(?:MH|manhole)\s*(?:#|no\.?)?\s*(\d+)\s*(?:rim|ie|inv(?:ert)?)?\s*(?:elev(?:ation)?)?\s*[=:]?\s*([\d.]+)/i,
    category: 'utilities',
    division: 33,
    itemKey: 'manhole-sanitary',
    description: 'Manhole with invert elevation'
  },
  {
    pattern: /(?:rim|top)\s*(?:elev(?:ation)?)?\s*[=:]?\s*([\d.]+)\s*(?:ie|inv(?:ert)?)?\s*[=:]?\s*([\d.]+)/i,
    category: 'utilities',
    division: 33,
    itemKey: 'manhole-sanitary',
    description: 'Rim and invert elevations'
  },
  // Catch Basin Types
  {
    pattern: /(?:CB|catch\s*basin)\s*(?:type\s*)?([A-Z0-9]+)/i,
    category: 'utilities',
    division: 33,
    itemKey: 'catch-basin',
    description: 'Catch basin type'
  },
  {
    pattern: /(?:curb\s*inlet|CB|catch\s*basin)\s*[:\-]?\s*(\d+)\s*(?:EA|ea)?/i,
    category: 'utilities',
    division: 33,
    itemKey: 'catch-basin',
    unitExtractor: (m) => ({ quantity: parseInt(m[1]), unit: 'EA' })
  },
  // Fire Hydrant
  {
    pattern: /(?:fire\s*)?hydrant\s*[:\-]?\s*(\d+)\s*(?:EA|ea)?/i,
    category: 'utilities',
    division: 33,
    itemKey: 'fire-hydrant',
    unitExtractor: (m) => ({ quantity: parseInt(m[1]), unit: 'EA' })
  },
  // Water Main
  {
    pattern: /(\d+)["']?\s*(?:water\s*(?:main|line)|WM|DIP)/i,
    category: 'utilities',
    division: 33,
    itemKey: 'water-main-6',
    description: 'Water main diameter'
  },
];

// Combined patterns for sitework
export const ALL_SITEWORK_PATTERNS: SiteworkPattern[] = [
  ...EARTHWORK_PATTERNS,
  ...PAVING_PATTERNS,
  ...UTILITY_PATTERNS,
];

// ============================================================================
// PHASE 2: UNIT NORMALIZATION
// ============================================================================

export interface UnitConversion {
  from: string;
  to: string;
  factor: number;
}

export const SITEWORK_UNIT_CONVERSIONS: UnitConversion[] = [
  // Area conversions
  { from: 'SF', to: 'SY', factor: 1/9 },
  { from: 'SY', to: 'SF', factor: 9 },
  { from: 'SF', to: 'AC', factor: 1/43560 },
  { from: 'AC', to: 'SF', factor: 43560 },
  { from: 'SY', to: 'AC', factor: 1/4840 },
  { from: 'AC', to: 'SY', factor: 4840 },
  // Volume conversions
  { from: 'CF', to: 'CY', factor: 1/27 },
  { from: 'CY', to: 'CF', factor: 27 },
  // Weight conversions (approximate for soil ~2700 lbs/CY)
  { from: 'CY', to: 'TON', factor: 1.35 },
  { from: 'TON', to: 'CY', factor: 0.74 },
];

/**
 * Normalize unit abbreviations to standard format
 */
export function normalizeUnit(unit: string): string {
  const normalized: Record<string, string> = {
    // Area
    'square feet': 'SF', 'sq ft': 'SF', 'sqft': 'SF', 's.f.': 'SF', 'sq. ft.': 'SF',
    'square yards': 'SY', 'sq yd': 'SY', 'sqyd': 'SY', 's.y.': 'SY',
    'acres': 'AC', 'acre': 'AC', 'ac': 'AC',
    // Linear
    'linear feet': 'LF', 'lin ft': 'LF', 'l.f.': 'LF', 'lin. ft.': 'LF', 'feet': 'LF',
    // Volume
    'cubic yards': 'CY', 'cu yd': 'CY', 'cuyd': 'CY', 'c.y.': 'CY', 'cu. yd.': 'CY',
    'cubic feet': 'CF', 'cu ft': 'CF', 'cuft': 'CF', 'c.f.': 'CF',
    // Count
    'each': 'EA', 'ea': 'EA', 'no.': 'EA', 'qty': 'EA',
    // Weight
    'tons': 'TON', 'ton': 'TON', 't': 'TON',
    'pounds': 'LBS', 'lbs': 'LBS', 'lb': 'LBS',
    // Gallons
    'gallons': 'GAL', 'gal': 'GAL', 'g': 'GAL',
  };
  
  const lower = unit.toLowerCase().trim();
  return normalized[lower] || unit.toUpperCase();
}

/**
 * Convert quantity between units
 */
export function convertUnits(
  quantity: number,
  fromUnit: string,
  toUnit: string
): { quantity: number; unit: string } | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  
  if (from === to) return { quantity, unit: to };
  
  const conversion = SITEWORK_UNIT_CONVERSIONS.find(
    c => c.from === from && c.to === to
  );
  
  if (!conversion) return null;
  
  return {
    quantity: Math.round(quantity * conversion.factor * 100) / 100,
    unit: to
  };
}

/**
 * Get standard unit for pricing database lookup based on item type
 */
export function getStandardUnit(itemKey: string): string {
  // Earthwork items
  if (itemKey.includes('excavation') || itemKey.includes('fill') || itemKey.includes('backfill')) {
    return 'CY';
  }
  if (itemKey.includes('grading') || itemKey.includes('compaction') || itemKey.includes('geotextile')) {
    return 'SF';
  }
  // Paving items
  if (itemKey.includes('asphalt') || itemKey.includes('concrete-sidewalk') || itemKey.includes('concrete-parking')) {
    return 'SF';
  }
  if (itemKey.includes('curb') || itemKey.includes('striping') || itemKey.includes('marking')) {
    return 'LF';
  }
  // Utility items (pipes by LF, structures by EA)
  if (itemKey.includes('pipe') || itemKey.includes('main') || itemKey.includes('conduit')) {
    return 'LF';
  }
  if (itemKey.includes('manhole') || itemKey.includes('hydrant') || itemKey.includes('catch-basin') || itemKey.includes('valve')) {
    return 'EA';
  }
  
  return 'EA'; // Default
}

// ============================================================================
// PHASE 3: DRAWING-TYPE-SPECIFIC EXTRACTION
// ============================================================================

export type DrawingType = 
  | 'grading'
  | 'utility'
  | 'landscape'
  | 'paving'
  | 'erosion_control'
  | 'stormwater'
  | 'civil_general'
  | 'unknown';

/**
 * Classify drawing type based on sheet number and content
 */
export function classifyDrawingType(sheetNumber: string, content: string): DrawingType {
  const sheet = sheetNumber?.toUpperCase() || '';
  const text = content?.toLowerCase() || '';

  // Sheet number patterns (e.g., C1.0, C-100, GR-1, etc.)
  if (/^(GR|GRAD)/.test(sheet) || text.includes('grading plan')) {
    return 'grading';
  }
  if (/^(UT|UTIL)/.test(sheet) || text.includes('utility plan') || text.includes('storm plan') || text.includes('sewer plan')) {
    return 'utility';
  }
  if (/^(L|LA|LP)[-\d]/.test(sheet) || text.includes('landscape plan') || text.includes('planting plan')) {
    return 'landscape';
  }
  if (/^(PV|PAV)/.test(sheet) || text.includes('paving plan') || text.includes('parking plan')) {
    return 'paving';
  }
  // Check stormwater before erosion control (SW can match both)
  if (text.includes('detention') || text.includes('retention') || text.includes('stormwater')) {
    return 'stormwater';
  }
  if (/^(EC|ESCP)/.test(sheet) || text.includes('erosion') || text.includes('sediment')) {
    return 'erosion_control';
  }
  // SW prefix for stormwater (after text checks)
  if (/^SW/.test(sheet)) {
    return 'stormwater';
  }
  if (/^C[-\d]/.test(sheet)) {
    return 'civil_general';
  }

  return 'unknown';
}

/**
 * Extract data based on drawing type using specialized patterns
 */
export async function extractByDrawingType(
  drawingType: DrawingType,
  content: string,
  metadata: any
): Promise<SiteworkExtractionResult[]> {
  const results: SiteworkExtractionResult[] = [];
  
  switch (drawingType) {
    case 'grading':
      results.push(...extractGradingData(content, metadata));
      break;
    case 'utility':
      results.push(...extractUtilityData(content, metadata));
      break;
    case 'landscape':
      results.push(...extractLandscapeData(content, metadata));
      break;
    case 'paving':
      results.push(...extractPavingData(content, metadata));
      break;
    case 'erosion_control':
      results.push(...extractErosionControlData(content, metadata));
      break;
    case 'stormwater':
      results.push(...extractStormwaterData(content, metadata));
      break;
    default:
      // Use general extraction for unknown types
      results.push(...extractGeneralSiteworkData(content, metadata));
  }
  
  return results;
}

export interface SiteworkExtractionResult {
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  division: number;
  category: string;
  itemKey: string;
  confidence: number;
  source: string;
  derivedFrom?: string;
  calculationMethod?: string;
}

/**
 * Extract grading-specific data (spot elevations, contours, cut/fill)
 */
function extractGradingData(content: string, metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];
  
  // Spot elevation patterns
  const spotElevPattern = /(?:spot\s*elev(?:ation)?|SE)\s*[=:]?\s*([\d.]+)/gi;
  let elevMatch;
  const elevations: number[] = [];
  while ((elevMatch = spotElevPattern.exec(content)) !== null) {
    elevations.push(parseFloat(elevMatch[1]));
  }
  
  // Calculate cut/fill if we have existing and proposed elevations
  if (metadata?.existingElevations && metadata?.proposedElevations) {
    const existing = metadata.existingElevations;
    const proposed = metadata.proposedElevations;
    
    // Rough cut/fill calculation
    const avgExisting = existing.reduce((a: number, b: number) => a + b, 0) / existing.length;
    const avgProposed = proposed.reduce((a: number, b: number) => a + b, 0) / proposed.length;
    const difference = avgProposed - avgExisting;
    
    if (Math.abs(difference) > 0.1) {
      results.push({
        itemName: difference > 0 ? 'Fill Required' : 'Cut Required',
        description: `Average elevation change: ${Math.abs(difference).toFixed(2)} ft`,
        quantity: 0, // Will need area for volume calculation
        unit: 'CY',
        division: 31,
        category: 'earthwork',
        itemKey: difference > 0 ? 'import-fill' : 'excavation-bulk',
        confidence: 60,
        source: 'grading_analysis',
        calculationMethod: 'average_method'
      });
    }
  }
  
  // Contour patterns (for slope analysis)
  const contourPattern = /(?:contour|elev)\s*([\d.]+)/gi;
  const contours: number[] = [];
  let contourMatch;
  while ((contourMatch = contourPattern.exec(content)) !== null) {
    contours.push(parseFloat(contourMatch[1]));
  }
  
  // Fine grading area
  const gradingAreaPattern = /(?:fine\s*)?grading\s*(?:area)?\s*[=:]?\s*([\d,]+\.?\d*)\s*(SF|SY|AC)/gi;
  let gradingMatch;
  while ((gradingMatch = gradingAreaPattern.exec(content)) !== null) {
    results.push({
      itemName: 'Fine Grading',
      description: 'Fine grading and subgrade preparation',
      quantity: parseFloat(gradingMatch[1].replace(/,/g, '')),
      unit: normalizeUnit(gradingMatch[2]),
      division: 31,
      category: 'earthwork',
      itemKey: 'grading-fine',
      confidence: 85,
      source: 'pattern_match'
    });
  }
  
  return results;
}

/**
 * Extract utility plan data (pipe schedules, structures)
 */
function extractUtilityData(content: string, metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];
  
  // Pipe schedule pattern: "8" PVC @ 0.5%" or "12" RCP SDR35"
  const pipePattern = /(\d+)["']?\s*(PVC|RCP|HDPE|DIP|CIP|VCP|PE|PP|ABS)\s*(?:SDR\d+|C900|C905)?\s*(?:@\s*([\d.]+)%)?/gi;
  let pipeMatch;
  while ((pipeMatch = pipePattern.exec(content)) !== null) {
    const diameter = parseInt(pipeMatch[1]);
    const material = pipeMatch[2].toUpperCase();
    const slope = pipeMatch[3] ? parseFloat(pipeMatch[3]) : null;
    
    // Determine pipe type and item key based on context
    const isStorm = content.toLowerCase().includes('storm') || content.toLowerCase().includes('rcp');
    const isSanitary = content.toLowerCase().includes('sanitary') || content.toLowerCase().includes('sewer');
    const isWater = content.toLowerCase().includes('water') || material === 'DIP';
    
    let itemKey = 'storm-pipe-12';
    let category = 'utilities';
    
    if (diameter <= 8) itemKey = isStorm ? 'storm-pipe-12' : 'sanitary-pipe-8';
    else if (diameter <= 12) itemKey = isStorm ? 'storm-pipe-12' : 'sanitary-pipe-12';
    else if (diameter <= 18) itemKey = 'storm-pipe-18';
    else if (diameter <= 24) itemKey = 'storm-pipe-24';
    else itemKey = 'storm-pipe-36';
    
    if (isWater) {
      if (diameter <= 4) itemKey = 'water-main-4';
      else if (diameter <= 6) itemKey = 'water-main-6';
      else if (diameter <= 8) itemKey = 'water-main-8';
      else itemKey = 'water-main-12';
    }
    
    results.push({
      itemName: `${diameter}" ${material} Pipe`,
      description: slope ? `${diameter}" ${material} pipe @ ${slope}% slope` : `${diameter}" ${material} pipe`,
      quantity: 0, // Will need to calculate from routing
      unit: 'LF',
      division: 33,
      category,
      itemKey,
      confidence: 80,
      source: 'pattern_match'
    });
  }
  
  // Manhole pattern with rim/invert
  const manholePattern = /(?:MH|manhole)\s*(?:#|no\.?)?\s*(\d+)\s*.*?(?:rim|top)\s*[=:]?\s*([\d.]+).*?(?:ie|inv(?:ert)?)\s*[=:]?\s*([\d.]+)/gi;
  let mhMatch;
  while ((mhMatch = manholePattern.exec(content)) !== null) {
    const mhNum = mhMatch[1];
    const rim = parseFloat(mhMatch[2]);
    const invert = parseFloat(mhMatch[3]);
    const depth = rim - invert;
    
    results.push({
      itemName: `Manhole #${mhNum}`,
      description: `MH #${mhNum} - Rim: ${rim}', Invert: ${invert}', Depth: ${depth.toFixed(1)}'`,
      quantity: 1,
      unit: 'EA',
      division: 33,
      category: 'utilities',
      itemKey: depth > 10 ? 'manhole-sanitary-drop' : 'manhole-sanitary',
      confidence: 90,
      source: 'pattern_match'
    });
  }
  
  return results;
}

/**
 * Extract landscape plan data (plant schedules)
 */
function extractLandscapeData(content: string, metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];
  
  // Plant schedule patterns
  // Trees: "Red Maple 2" CAL" or "Quercus rubra 3" B&B"
  const treePattern = /(\d+)\s*(?:each|ea|\/)?\s*(?:[A-Za-z]+\s+[A-Za-z]+)\s*(\d+)["']?\s*(?:CAL|caliper|B&B)/gi;
  let treeMatch;
  while ((treeMatch = treePattern.exec(content)) !== null) {
    const qty = parseInt(treeMatch[1]);
    const caliper = parseInt(treeMatch[2]);
    
    let itemKey = 'tree-2in-cal';
    if (caliper >= 4) itemKey = 'tree-4in-cal';
    else if (caliper >= 3) itemKey = 'tree-3in-cal';
    
    results.push({
      itemName: `${caliper}" Caliper Tree`,
      description: `${caliper}" caliper deciduous tree`,
      quantity: qty,
      unit: 'EA',
      division: 32,
      category: 'landscape',
      itemKey,
      confidence: 75,
      source: 'pattern_match'
    });
  }
  
  // Shrub patterns: "(25) 3 gal shrub"
  const shrubPattern = /\(?\s*(\d+)\s*\)?\s*(\d+)\s*(?:gal(?:lon)?|#)\s*(?:shrub|plant)/gi;
  let shrubMatch;
  while ((shrubMatch = shrubPattern.exec(content)) !== null) {
    const qty = parseInt(shrubMatch[1]);
    const size = parseInt(shrubMatch[2]);
    
    let itemKey = 'shrub-1gal';
    if (size >= 5) itemKey = 'shrub-5gal';
    else if (size >= 3) itemKey = 'shrub-3gal';
    
    results.push({
      itemName: `${size} Gallon Shrub`,
      description: `${size} gallon container shrub`,
      quantity: qty,
      unit: 'EA',
      division: 32,
      category: 'landscape',
      itemKey,
      confidence: 75,
      source: 'pattern_match'
    });
  }
  
  // Mulch/Sod areas
  const mulchPattern = /(?:mulch|bark)\s*[:\-]?\s*([\d,]+\.?\d*)\s*(SF|SY|CY)/gi;
  let mulchMatch;
  while ((mulchMatch = mulchPattern.exec(content)) !== null) {
    results.push({
      itemName: 'Mulch',
      description: 'Shredded bark mulch, 3" depth',
      quantity: parseFloat(mulchMatch[1].replace(/,/g, '')),
      unit: normalizeUnit(mulchMatch[2]),
      division: 32,
      category: 'landscape',
      itemKey: 'mulch-3in',
      confidence: 80,
      source: 'pattern_match'
    });
  }
  
  const sodPattern = /sod\s*[:\-]?\s*([\d,]+\.?\d*)\s*(SF|SY)/gi;
  let sodMatch;
  while ((sodMatch = sodPattern.exec(content)) !== null) {
    results.push({
      itemName: 'Sod',
      description: 'Sod installation',
      quantity: parseFloat(sodMatch[1].replace(/,/g, '')),
      unit: normalizeUnit(sodMatch[2]),
      division: 32,
      category: 'landscape',
      itemKey: 'sod',
      confidence: 80,
      source: 'pattern_match'
    });
  }
  
  return results;
}

/**
 * Extract paving plan data
 */
function extractPavingData(content: string, metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];
  
  // Asphalt areas with thickness
  const asphaltPattern = /(\d+)["']?\s*(?:thick)?\s*(?:asphalt|HMA|AC).*?([\d,]+\.?\d*)\s*(SF|SY)/gi;
  let asphaltMatch;
  while ((asphaltMatch = asphaltPattern.exec(content)) !== null) {
    const thickness = parseInt(asphaltMatch[1]);
    const area = parseFloat(asphaltMatch[2].replace(/,/g, ''));
    const unit = normalizeUnit(asphaltMatch[3]);
    
    let itemKey = 'asphalt-paving-2in';
    if (thickness >= 6) itemKey = 'asphalt-paving-6in';
    else if (thickness >= 4) itemKey = 'asphalt-paving-4in';
    else if (thickness >= 3) itemKey = 'asphalt-paving-3in';
    
    results.push({
      itemName: `${thickness}" Asphalt Paving`,
      description: `${thickness}" thick asphalt pavement`,
      quantity: area,
      unit,
      division: 32,
      category: 'paving',
      itemKey,
      confidence: 85,
      source: 'pattern_match'
    });
  }
  
  // Parking counts
  const parkingPattern = /(\d+)\s*(?:parking\s*)?(?:stalls?|spaces?)/i;
  const parkingMatch = content.match(parkingPattern);
  if (parkingMatch) {
    const spaces = parseInt(parkingMatch[1]);
    results.push({
      itemName: 'Parking Stall Striping',
      description: `${spaces} parking stall striping`,
      quantity: spaces,
      unit: 'EA',
      division: 32,
      category: 'paving',
      itemKey: 'parking-stall-striping',
      confidence: 80,
      source: 'pattern_match'
    });
  }
  
  // ADA spaces
  const adaPattern = /(\d+)\s*(?:ADA|handicap|accessible)\s*(?:parking\s*)?(?:stalls?|spaces?)/i;
  const adaMatch = content.match(adaPattern);
  if (adaMatch) {
    const adaSpaces = parseInt(adaMatch[1]);
    results.push({
      itemName: 'ADA Parking Signs',
      description: `${adaSpaces} ADA parking signs`,
      quantity: adaSpaces,
      unit: 'EA',
      division: 32,
      category: 'paving',
      itemKey: 'ada-parking-sign',
      confidence: 85,
      source: 'pattern_match'
    });
    results.push({
      itemName: 'Handicap Symbols',
      description: `${adaSpaces} handicap pavement symbols`,
      quantity: adaSpaces,
      unit: 'EA',
      division: 32,
      category: 'paving',
      itemKey: 'handicap-symbol',
      confidence: 85,
      source: 'pattern_match'
    });
  }
  
  return results;
}

/**
 * Extract erosion control data
 */
function extractErosionControlData(content: string, metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];
  
  // Silt fence
  const siltPattern = /silt\s*fence\s*[:\-]?\s*([\d,]+\.?\d*)\s*(LF|lf)/gi;
  let siltMatch;
  while ((siltMatch = siltPattern.exec(content)) !== null) {
    results.push({
      itemName: 'Silt Fence',
      description: 'Silt fence erosion control',
      quantity: parseFloat(siltMatch[1].replace(/,/g, '')),
      unit: 'LF',
      division: 31,
      category: 'earthwork',
      itemKey: 'silt-fence',
      confidence: 90,
      source: 'pattern_match'
    });
  }
  
  // Construction entrance
  const entrancePattern = /(\d+)\s*(?:construction\s*)?(?:entrance|exit)/gi;
  let entranceMatch;
  while ((entranceMatch = entrancePattern.exec(content)) !== null) {
    results.push({
      itemName: 'Construction Entrance',
      description: 'Stabilized construction entrance',
      quantity: parseInt(entranceMatch[1]),
      unit: 'EA',
      division: 31,
      category: 'earthwork',
      itemKey: 'construction-entrance',
      confidence: 85,
      source: 'pattern_match'
    });
  }
  
  return results;
}

/**
 * Extract stormwater management data
 */
function extractStormwaterData(content: string, metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];
  
  // Detention/retention volumes
  const detentionPattern = /(?:detention|retention)\s*(?:pond|basin)?\s*(?:volume)?\s*[:\-]?\s*([\d,]+\.?\d*)\s*(CF|CY|AC-FT)/gi;
  let detMatch;
  while ((detMatch = detentionPattern.exec(content)) !== null) {
    results.push({
      itemName: 'Detention Storage',
      description: 'Detention pond storage volume',
      quantity: parseFloat(detMatch[1].replace(/,/g, '')),
      unit: normalizeUnit(detMatch[2]),
      division: 33,
      category: 'stormwater',
      itemKey: 'detention-pond-excavation',
      confidence: 80,
      source: 'pattern_match'
    });
  }
  
  // Underground detention
  const ugDetPattern = /(?:underground|subsurface)\s*(?:detention|storage)\s*[:\-]?\s*([\d,]+\.?\d*)\s*(CF|CY)/gi;
  let ugMatch;
  while ((ugMatch = ugDetPattern.exec(content)) !== null) {
    results.push({
      itemName: 'Underground Detention',
      description: 'Underground detention chamber system',
      quantity: parseFloat(ugMatch[1].replace(/,/g, '')),
      unit: 'CF',
      division: 33,
      category: 'stormwater',
      itemKey: 'underground-detention-chamber',
      confidence: 80,
      source: 'pattern_match'
    });
  }
  
  return results;
}

/**
 * General sitework extraction for unclassified drawings
 */
function extractGeneralSiteworkData(content: string, metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];
  
  // Apply all patterns
  for (const pattern of ALL_SITEWORK_PATTERNS) {
    const matches = content.matchAll(new RegExp(pattern.pattern.source, 'gi'));
    for (const match of matches) {
      const extraction = pattern.unitExtractor ? pattern.unitExtractor(match) : { quantity: 1, unit: 'EA' };
      results.push({
        itemName: match[0].trim(),
        description: pattern.description || match[0].trim(),
        quantity: extraction.quantity,
        unit: extraction.unit,
        division: pattern.division,
        category: pattern.category,
        itemKey: pattern.itemKey,
        confidence: 70,
        source: 'pattern_match'
      });
    }
  }
  
  return results;
}

// ============================================================================
// PHASE 4: QUANTITY DERIVATION/CALCULATION ENGINE
// ============================================================================

export interface DerivedQuantity {
  itemKey: string;
  quantity: number;
  unit: string;
  calculationMethod: string;
  sourceData: Record<string, number>;
}

/**
 * Calculate cut/fill volumes from grading differential
 */
export function calculateCutFill(
  existingGrade: number,
  proposedGrade: number,
  area: number,
  areaUnit: string = 'SF'
): DerivedQuantity {
  // Convert area to SF if needed
  let areaSF = area;
  if (areaUnit === 'SY') areaSF = area * 9;
  if (areaUnit === 'AC') areaSF = area * 43560;
  
  const gradeDiff = proposedGrade - existingGrade;
  const volumeCF = areaSF * Math.abs(gradeDiff);
  const volumeCY = volumeCF / 27;
  
  return {
    itemKey: gradeDiff > 0 ? 'import-fill' : 'excavation-bulk',
    quantity: Math.round(volumeCY * 10) / 10,
    unit: 'CY',
    calculationMethod: 'area_x_depth',
    sourceData: {
      existingGrade,
      proposedGrade,
      areaSF,
      gradeDiff: Math.abs(gradeDiff)
    }
  };
}

/**
 * Calculate trench volume for utilities
 */
export function calculateTrenchVolume(
  lengthLF: number,
  widthFT: number,
  depthFT: number
): DerivedQuantity {
  const volumeCF = lengthLF * widthFT * depthFT;
  const volumeCY = volumeCF / 27;
  
  return {
    itemKey: 'excavation-trench',
    quantity: Math.round(volumeCY * 10) / 10,
    unit: 'CY',
    calculationMethod: 'length_x_width_x_depth',
    sourceData: {
      lengthLF,
      widthFT,
      depthFT
    }
  };
}

/**
 * Calculate asphalt tonnage from area and thickness
 */
export function calculateAsphaltTonnage(
  areaSF: number,
  thicknessInches: number
): DerivedQuantity {
  // Asphalt weight: ~145 lbs/CF (hot mix)
  const volumeCF = (areaSF * thicknessInches) / 12;
  const tonnage = (volumeCF * 145) / 2000;
  
  return {
    itemKey: `asphalt-paving-${thicknessInches}in`,
    quantity: Math.round(tonnage * 10) / 10,
    unit: 'TON',
    calculationMethod: 'area_x_thickness_x_density',
    sourceData: {
      areaSF,
      thicknessInches,
      densityLbsPerCF: 145
    }
  };
}

/**
 * Calculate aggregate base volume
 */
export function calculateAggregateVolume(
  areaSF: number,
  thicknessInches: number
): DerivedQuantity {
  const volumeCF = (areaSF * thicknessInches) / 12;
  const volumeCY = volumeCF / 27;
  
  return {
    itemKey: `aggregate-base-${thicknessInches}in`,
    quantity: Math.round(volumeCY * 10) / 10,
    unit: 'CY',
    calculationMethod: 'area_x_thickness',
    sourceData: {
      areaSF,
      thicknessInches
    }
  };
}

/**
 * Calculate pipe bedding/backfill volume
 */
export function calculatePipeBedding(
  pipeLengthLF: number,
  pipeDiameterInches: number,
  trenchWidthFT: number = 2,
  trenchDepthFT: number = 4
): DerivedQuantity {
  // Bedding typically 6" below and to springline
  const beddingDepthFT = (pipeDiameterInches / 2 + 6) / 12;
  const beddingVolumeCF = pipeLengthLF * trenchWidthFT * beddingDepthFT;
  const beddingCY = beddingVolumeCF / 27;
  
  return {
    itemKey: 'backfill-pipe-zone',
    quantity: Math.round(beddingCY * 10) / 10,
    unit: 'CY',
    calculationMethod: 'pipe_bedding_zone',
    sourceData: {
      pipeLengthLF,
      pipeDiameterInches,
      trenchWidthFT,
      beddingDepthFT
    }
  };
}

// ============================================================================
// PHASE 5: GEOTECH/SPECIFICATION CROSS-REFERENCE
// ============================================================================

export interface GeotechData {
  soilBearingCapacity?: number; // PSF
  soilType?: string;
  waterTableDepth?: number; // feet
  frostDepth?: number; // inches
  requiredSubbaseDepth?: number; // inches
  compactionRequirement?: number; // percent
  dewateringRequired?: boolean;
  rockEncountered?: boolean;
  rockDepth?: number; // feet
  recommendations?: string[];
}

/**
 * Extract geotech data from report content
 */
export function extractGeotechData(content: string): GeotechData {
  const data: GeotechData = {};
  
  // Bearing capacity
  const bearingMatch = content.match(/(?:bearing\s*capacity|allowable\s*bearing)\s*[:\-]?\s*([\d,]+)\s*(?:PSF|psf|pounds?\s*per\s*square\s*foot)/i);
  if (bearingMatch) {
    data.soilBearingCapacity = parseFloat(bearingMatch[1].replace(/,/g, ''));
  }
  
  // Soil type
  const soilMatch = content.match(/(?:soil\s*classification|USCS)\s*[:\-]?\s*(CL|CH|ML|MH|SC|SM|SP|SW|GP|GW|GM|GC)/i);
  if (soilMatch) {
    data.soilType = soilMatch[1].toUpperCase();
  }
  
  // Water table
  const waterMatch = content.match(/(?:water\s*table|groundwater)\s*(?:encountered\s*)?(?:at)?\s*([\d.]+)\s*(?:feet|ft|')/i);
  if (waterMatch) {
    data.waterTableDepth = parseFloat(waterMatch[1]);
    data.dewateringRequired = data.waterTableDepth < 8; // Typical threshold
  }
  
  // Frost depth
  const frostMatch = content.match(/frost\s*(?:depth|line)\s*[:\-]?\s*(\d+)\s*(?:inches?|in|"|')/i);
  if (frostMatch) {
    data.frostDepth = parseInt(frostMatch[1]);
  }
  
  // Compaction requirement
  const compactionMatch = content.match(/(\d{2,3})%\s*(?:of\s*)?(?:maximum\s*dry\s*density|proctor|compaction)/i);
  if (compactionMatch) {
    data.compactionRequirement = parseInt(compactionMatch[1]);
  }
  
  // Rock
  const rockMatch = content.match(/rock\s*(?:encountered|found)\s*(?:at)?\s*([\d.]+)\s*(?:feet|ft|')/i);
  if (rockMatch) {
    data.rockEncountered = true;
    data.rockDepth = parseFloat(rockMatch[1]);
  }
  
  // Subbase depth
  const subbaseMatch = content.match(/(?:subbase|base\s*course)\s*(?:thickness)?\s*[:\-]?\s*(\d+)\s*(?:inches?|in|")/i);
  if (subbaseMatch) {
    data.requiredSubbaseDepth = parseInt(subbaseMatch[1]);
  }
  
  return data;
}

/**
 * Adjust takeoff items based on geotech data
 */
export function adjustForGeotechConditions(
  items: SiteworkExtractionResult[],
  geotech: GeotechData
): SiteworkExtractionResult[] {
  const adjusted = [...items];
  
  // Add rock excavation if rock encountered
  if (geotech.rockEncountered && geotech.rockDepth) {
    const rockExcavation = items.find(i => i.itemKey.includes('excavation'));
    if (rockExcavation) {
      adjusted.push({
        itemName: 'Rock Excavation Allowance',
        description: `Rock encountered at ${geotech.rockDepth}' - mechanical removal`,
        quantity: Math.round(rockExcavation.quantity * 0.2), // Assume 20% is rock
        unit: 'CY',
        division: 31,
        category: 'earthwork',
        itemKey: 'excavation-rock-mechanical',
        confidence: 65,
        source: 'geotech_adjustment',
        derivedFrom: 'geotech_report'
      });
    }
  }
  
  // Add dewatering if needed
  if (geotech.dewateringRequired) {
    adjusted.push({
      itemName: 'Dewatering Allowance',
      description: `Water table at ${geotech.waterTableDepth}' - dewatering required`,
      quantity: 1,
      unit: 'LS',
      division: 31,
      category: 'earthwork',
      itemKey: 'temporary-dewatering',
      confidence: 60,
      source: 'geotech_adjustment'
    });
  }
  
  // Adjust subbase if specified
  if (geotech.requiredSubbaseDepth) {
    const pavingItems = items.filter(i => i.category === 'paving');
    for (const paving of pavingItems) {
      if (paving.unit === 'SF' || paving.unit === 'SY') {
        const subbaseQty = calculateAggregateVolume(
          paving.unit === 'SY' ? paving.quantity * 9 : paving.quantity,
          geotech.requiredSubbaseDepth
        );
        adjusted.push({
          itemName: `${geotech.requiredSubbaseDepth}" Aggregate Base`,
          description: `Required subbase per geotech: ${geotech.requiredSubbaseDepth}"`,
          quantity: subbaseQty.quantity,
          unit: subbaseQty.unit,
          division: 31,
          category: 'earthwork',
          itemKey: `aggregate-base-${geotech.requiredSubbaseDepth}in`,
          confidence: 75,
          source: 'geotech_adjustment',
          derivedFrom: 'geotech_report'
        });
      }
    }
  }
  
  return adjusted;
}

// ============================================================================
// PHASE 6: DWG/CAD FILE INTEGRATION
// ============================================================================

export interface CADEntity {
  type: 'LINE' | 'POLYLINE' | 'CIRCLE' | 'ARC' | 'TEXT' | 'MTEXT' | 'INSERT' | 'HATCH' | 'POINT';
  layer: string;
  length?: number;
  area?: number;
  text?: string;
  coordinates?: { x: number; y: number; z?: number }[];
  radius?: number;
  blockName?: string;
}

export interface CADLayerData {
  name: string;
  entityCount: number;
  totalLength?: number;
  totalArea?: number;
  entities: CADEntity[];
}

export interface CADExtractionResult {
  layers: CADLayerData[];
  blocks: { name: string; count: number }[];
  units: string;
  extents: { minX: number; minY: number; maxX: number; maxY: number };
}

// Common CAD layer name patterns for sitework
export const CAD_LAYER_PATTERNS: Record<string, { division: number; category: string; itemKey: string }> = {
  // Grading
  'C-GRAD': { division: 31, category: 'earthwork', itemKey: 'grading-fine' },
  'C-TOPO': { division: 31, category: 'earthwork', itemKey: 'grading-fine' },
  'C-CONT': { division: 31, category: 'earthwork', itemKey: 'grading-fine' },
  // Paving
  'C-PAVE': { division: 32, category: 'paving', itemKey: 'asphalt-paving-4in' },
  'C-CURB': { division: 32, category: 'paving', itemKey: 'concrete-curb-gutter' },
  'C-WALK': { division: 32, category: 'paving', itemKey: 'concrete-sidewalk-4in' },
  'C-PARK': { division: 32, category: 'paving', itemKey: 'parking-stall-striping' },
  'C-STRP': { division: 32, category: 'paving', itemKey: 'pavement-marking' },
  // Storm
  'C-STRM': { division: 33, category: 'utilities', itemKey: 'storm-pipe-12' },
  'C-STOR': { division: 33, category: 'utilities', itemKey: 'storm-pipe-12' },
  'C-DRAI': { division: 33, category: 'utilities', itemKey: 'storm-pipe-12' },
  // Sanitary
  'C-SSWR': { division: 33, category: 'utilities', itemKey: 'sanitary-pipe-8' },
  'C-SANI': { division: 33, category: 'utilities', itemKey: 'sanitary-pipe-8' },
  // Water
  'C-WATR': { division: 33, category: 'utilities', itemKey: 'water-main-6' },
  'C-FIRE': { division: 33, category: 'utilities', itemKey: 'fire-hydrant' },
  // Gas
  'C-GAS': { division: 33, category: 'utilities', itemKey: 'gas-pipe-2' },
  // Electric
  'C-ELEC': { division: 33, category: 'utilities', itemKey: 'conduit-underground-2in' },
  'C-POWR': { division: 33, category: 'utilities', itemKey: 'conduit-underground-2in' },
  // Landscape
  'L-PLNT': { division: 32, category: 'landscape', itemKey: 'tree-2in-cal' },
  'L-TREE': { division: 32, category: 'landscape', itemKey: 'tree-2in-cal' },
  'L-SHRB': { division: 32, category: 'landscape', itemKey: 'shrub-3gal' },
  'L-MULC': { division: 32, category: 'landscape', itemKey: 'mulch-3in' },
  'L-SOD': { division: 32, category: 'landscape', itemKey: 'sod' },
  'L-SEED': { division: 32, category: 'landscape', itemKey: 'seed-fertilize' },
  'L-IRRI': { division: 32, category: 'landscape', itemKey: 'irrigation-per-sf' },
  // Erosion Control
  'C-EROD': { division: 31, category: 'earthwork', itemKey: 'silt-fence' },
  'C-ESCP': { division: 31, category: 'earthwork', itemKey: 'silt-fence' },
};

/**
 * Parse CAD layer name to determine sitework category
 */
export function parseCADLayerName(layerName: string): { division: number; category: string; itemKey: string } | null {
  const upperLayer = layerName.toUpperCase();

  // Direct match first
  for (const [pattern, mapping] of Object.entries(CAD_LAYER_PATTERNS)) {
    if (upperLayer.startsWith(pattern) || upperLayer.includes(pattern)) {
      return mapping;
    }
  }

  // Keyword-based fallback - check for GRAD before GRADE to avoid false positives
  if (upperLayer.includes('GRAD') || upperLayer.includes('TOPO')) {
    return { division: 31, category: 'earthwork', itemKey: 'grading-fine' };
  }
  if (upperLayer.includes('PAVE') || upperLayer.includes('ASPH')) {
    return { division: 32, category: 'paving', itemKey: 'asphalt-paving-4in' };
  }
  if (upperLayer.includes('STORM') || upperLayer.includes('DRAIN')) {
    return { division: 33, category: 'utilities', itemKey: 'storm-pipe-12' };
  }
  if (upperLayer.includes('WATER') || upperLayer.includes('WTR')) {
    return { division: 33, category: 'utilities', itemKey: 'water-main-6' };
  }
  if (upperLayer.includes('SEWER') || upperLayer.includes('SAN')) {
    return { division: 33, category: 'utilities', itemKey: 'sanitary-pipe-8' };
  }
  if (upperLayer.includes('TREE') || upperLayer.includes('PLANT') || upperLayer.includes('LAND')) {
    return { division: 32, category: 'landscape', itemKey: 'tree-2in-cal' };
  }

  return null;
}

/**
 * Convert CAD entities to sitework takeoff items
 */
export function convertCADToTakeoff(
  cadData: CADExtractionResult,
  scaleFactor: number = 1
): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];
  
  for (const layer of cadData.layers) {
    const mapping = parseCADLayerName(layer.name);
    if (!mapping) continue;
    
    // Calculate quantities based on entity types
    let quantity = 0;
    let unit = 'EA';

    // Linear features (pipes, curbs, etc.)
    if (layer.totalLength && (mapping.itemKey.includes('pipe') || mapping.itemKey.includes('curb') || mapping.itemKey.includes('fence'))) {
      quantity = layer.totalLength * scaleFactor;
      unit = 'LF';
    }
    // Area features (paving, grading, etc.)
    else if (layer.totalArea && (mapping.category === 'paving' || mapping.category === 'earthwork')) {
      quantity = layer.totalArea * scaleFactor * scaleFactor; // Square the scale for area
      unit = 'SF';
    }
    // Count features (structures, trees, etc.)
    else {
      quantity = layer.entityCount;
      unit = 'EA';
    }
    
    if (quantity > 0) {
      results.push({
        itemName: `${layer.name} - CAD Extract`,
        description: `Extracted from CAD layer ${layer.name}`,
        quantity: Math.round(quantity * 100) / 100,
        unit,
        division: mapping.division,
        category: mapping.category,
        itemKey: mapping.itemKey,
        confidence: 85,
        source: 'cad_extraction',
        derivedFrom: `Layer: ${layer.name}, ${layer.entityCount} entities`
      });
    }
  }
  
  // Block counts (symbols like manholes, hydrants, trees)
  for (const block of cadData.blocks) {
    const blockUpper = block.name.toUpperCase();
    let mapping: { division: number; category: string; itemKey: string } | null = null;
    let itemName = block.name;
    
    if (blockUpper.includes('MH') || blockUpper.includes('MANHOLE')) {
      mapping = { division: 33, category: 'utilities', itemKey: 'manhole-sanitary' };
      itemName = 'Manhole';
    } else if (blockUpper.includes('CB') || blockUpper.includes('CATCH')) {
      mapping = { division: 33, category: 'utilities', itemKey: 'catch-basin' };
      itemName = 'Catch Basin';
    } else if (blockUpper.includes('FH') || blockUpper.includes('HYD')) {
      mapping = { division: 33, category: 'utilities', itemKey: 'fire-hydrant' };
      itemName = 'Fire Hydrant';
    } else if (blockUpper.includes('TREE') || blockUpper.includes('DEC') || blockUpper.includes('EVG')) {
      mapping = { division: 32, category: 'landscape', itemKey: 'tree-2in-cal' };
      itemName = 'Tree';
    } else if (blockUpper.includes('SHRUB')) {
      mapping = { division: 32, category: 'landscape', itemKey: 'shrub-3gal' };
      itemName = 'Shrub';
    } else if (blockUpper.includes('LIGHT') || blockUpper.includes('POLE')) {
      mapping = { division: 32, category: 'paving', itemKey: 'light-pole-25ft' };
      itemName = 'Light Pole';
    }
    
    if (mapping && block.count > 0) {
      results.push({
        itemName: `${itemName} (Block: ${block.name})`,
        description: `CAD block count: ${block.count}`,
        quantity: block.count,
        unit: 'EA',
        division: mapping.division,
        category: mapping.category,
        itemKey: mapping.itemKey,
        confidence: 90,
        source: 'cad_block_count'
      });
    }
  }
  
  return results;
}

/**
 * Request CAD data extraction via Autodesk API (if available)
 */
export async function extractFromDWG(
  documentId: string,
  projectId: string
): Promise<SiteworkExtractionResult[]> {
  try {
    // Check if document has CAD processing data
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });
    
    if (!document) {
      console.log('[CAD] Document not found');
      return [];
    }
    
    // Get document chunks separately
    const documentChunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' }
    });
    
    // Check for CAD metadata in document chunks
    const cadChunk = documentChunks.find((c: any) => {
      const meta = c.metadata as any;
      return meta?.cadData || meta?.dwgExtraction || meta?.autodeskData;
    });
    
    if (cadChunk) {
      const cadMeta = (cadChunk.metadata as any);
      const cadData = cadMeta.cadData || cadMeta.dwgExtraction || cadMeta.autodeskData;
      
      if (cadData) {
        console.log('[CAD] Found CAD metadata, extracting quantities');
        return convertCADToTakeoff(cadData);
      }
    }
    
    // If no CAD data, check for associated Autodesk model
    const autodeskModel = await prisma.autodeskModel.findFirst({
      where: {
        projectId,
        fileName: { contains: document.name.split('.')[0] }
      }
    }).catch(() => null);
    
    if (autodeskModel) {
      console.log('[CAD] Found associated Autodesk model, querying metadata');
      // Check if model has extracted metadata
      if (autodeskModel.extractedMetadata) {
        const extractedData = autodeskModel.extractedMetadata as any;
        if (extractedData.layers || extractedData.blocks) {
          console.log('[CAD] Found DWG extraction data');
          return convertCADToTakeoff({
            layers: extractedData.layers || [],
            blocks: extractedData.blocks || [],
            units: extractedData.units || 'feet',
            extents: extractedData.extents || { minX: 0, minY: 0, maxX: 0, maxY: 0 }
          });
        }
      }
    }
    
    console.log('[CAD] No CAD data available for extraction');
    return [];
    
  } catch (error) {
    console.error('[CAD] Error extracting from DWG:', error);
    return [];
  }
}

// ============================================================================
// MAIN EXTRACTION ORCHESTRATOR
// ============================================================================

/**
 * Main sitework takeoff extraction - orchestrates all phases
 */
export async function extractSiteworkTakeoff(
  documentId: string,
  projectId: string,
  options?: {
    includeCAD?: boolean;
    includeGeotech?: boolean;
    geotechDocumentId?: string;
  }
): Promise<SiteworkExtractionResult[]> {
  console.log(`[SITEWORK] Starting comprehensive extraction for document ${documentId}`);
  
  let results: SiteworkExtractionResult[] = [];
  
  try {
    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });
    
    if (!document) {
      throw new Error('Document not found');
    }
    
    // Get chunks separately
    const documentChunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' }
    });
    
    // Process each page/chunk
    for (const chunk of documentChunks) {
      const metadata = chunk.metadata as any;
      const sheetNumber = metadata?.sheet_number || '';
      
      // Phase 3: Classify drawing type
      const drawingType = classifyDrawingType(sheetNumber, chunk.content);
      console.log(`[SITEWORK] Page ${chunk.pageNumber}: Classified as ${drawingType}`);
      
      // Phase 1 & 3: Extract based on drawing type with enhanced patterns
      const pageResults = await extractByDrawingType(drawingType, chunk.content, metadata);
      
      // Add sheet reference
      for (const result of pageResults) {
        result.source = `${result.source}:page${chunk.pageNumber}:${sheetNumber}`;
      }
      
      results.push(...pageResults);
    }
    
    // Phase 6: CAD extraction if available
    if (options?.includeCAD) {
      const cadResults = await extractFromDWG(documentId, projectId);
      results.push(...cadResults);
    }
    
    // Phase 5: Geotech cross-reference if available
    if (options?.includeGeotech && options.geotechDocumentId) {
      const geotechDoc = await prisma.document.findUnique({
        where: { id: options.geotechDocumentId }
      });
      
      if (geotechDoc) {
        const geotechChunks = await prisma.documentChunk.findMany({
          where: { documentId: options.geotechDocumentId }
        });
        const geotechContent = geotechChunks.map((c: any) => c.content).join('\n');
        const geotechData = extractGeotechData(geotechContent);
        results = adjustForGeotechConditions(results, geotechData);
        console.log('[SITEWORK] Applied geotech adjustments');
      }
    }
    
    // Deduplicate and consolidate
    results = consolidateResults(results);
    
    console.log(`[SITEWORK] Extraction complete: ${results.length} items`);
    return results;
    
  } catch (error) {
    console.error('[SITEWORK] Extraction error:', error);
    throw error;
  }
}

/**
 * Consolidate duplicate items
 */
function consolidateResults(items: SiteworkExtractionResult[]): SiteworkExtractionResult[] {
  const consolidated = new Map<string, SiteworkExtractionResult>();
  
  for (const item of items) {
    const key = `${item.itemKey}-${item.unit}`;
    
    if (consolidated.has(key)) {
      const existing = consolidated.get(key)!;
      // Sum quantities for same item/unit
      existing.quantity += item.quantity;
      // Average confidence
      existing.confidence = Math.round((existing.confidence + item.confidence) / 2);
      // Append sources
      if (!existing.source.includes(item.source)) {
        existing.source += `, ${item.source}`;
      }
    } else {
      consolidated.set(key, { ...item });
    }
  }
  
  return Array.from(consolidated.values());
}

/**
 * Extract sitework takeoffs from all DWG/CAD models in a project
 * This directly uses AutodeskModel.extractedMetadata for accurate BIM dimensions
 */
export async function extractSiteworkFromProjectModels(
  projectId: string
): Promise<SiteworkExtractionResult[]> {
  console.log(`[SITEWORK-BIM] Extracting from all project models: ${projectId}`);
  
  const results: SiteworkExtractionResult[] = [];
  
  try {
    // Get all DWG/DXF models with extraction data
    const dwgModels = await prisma.autodeskModel.findMany({
      where: {
        projectId,
        status: 'ready',
        OR: [
          { fileName: { endsWith: '.dwg' } },
          { fileName: { endsWith: '.dxf' } },
        ],
      },
    });
    
    console.log(`[SITEWORK-BIM] Found ${dwgModels.length} DWG models`);
    
    for (const model of dwgModels) {
      if (!model.extractedMetadata) continue;
      
      const metadata = model.extractedMetadata as any;
      const fileName = model.fileName.toLowerCase();
      
      // Determine if this is a sitework-related drawing
      const isSitework = 
        fileName.includes('grading') ||
        fileName.includes('site') ||
        fileName.includes('civil') ||
        fileName.includes('c-') ||
        fileName.includes('l-') ||
        fileName.includes('utility') ||
        fileName.includes('storm') ||
        fileName.includes('paving');
      
      if (!isSitework) continue;
      
      console.log(`[SITEWORK-BIM] Processing sitework drawing: ${model.fileName}`);
      
      // Extract from layers
      if (metadata.layers && Array.isArray(metadata.layers)) {
        for (const layer of metadata.layers) {
          const layerName = layer.name?.toUpperCase() || '';
          const objectCount = layer.objectCount || 0;
          
          // Civil/Site layer categorization
          if (layerName.includes('GRAD') || layerName.includes('CONTOUR')) {
            // Grading layers
            results.push({
              itemName: `Grading Elements (${layer.name})`,
              description: `${objectCount} objects from ${model.fileName}`,
              quantity: objectCount,
              unit: 'EA',
              division: 31,
              category: 'earthwork',
              itemKey: 'grading-fine',
              confidence: 75,
              source: `dwg:${model.fileName}:layer:${layer.name}`,
            });
          } else if (layerName.includes('PAVE') || layerName.includes('ASPH') || layerName.includes('CONC-PAVE')) {
            // Paving layers
            results.push({
              itemName: `Paving Elements (${layer.name})`,
              description: `${objectCount} objects from ${model.fileName}`,
              quantity: objectCount,
              unit: 'EA',
              division: 32,
              category: 'paving',
              itemKey: 'asphalt-parking',
              confidence: 75,
              source: `dwg:${model.fileName}:layer:${layer.name}`,
            });
          } else if (layerName.includes('CURB') || layerName.includes('GUTTER')) {
            results.push({
              itemName: `Curb & Gutter (${layer.name})`,
              description: `${objectCount} objects from ${model.fileName}`,
              quantity: objectCount,
              unit: 'LF',
              division: 32,
              category: 'paving',
              itemKey: 'curb-standard',
              confidence: 70,
              source: `dwg:${model.fileName}:layer:${layer.name}`,
            });
          } else if (layerName.includes('STORM') || layerName.includes('DRAIN')) {
            results.push({
              itemName: `Storm Drainage (${layer.name})`,
              description: `${objectCount} objects from ${model.fileName}`,
              quantity: objectCount,
              unit: 'EA',
              division: 33,
              category: 'stormwater',
              itemKey: 'storm-pipe-rcp',
              confidence: 70,
              source: `dwg:${model.fileName}:layer:${layer.name}`,
            });
          } else if (layerName.includes('SEWER') || layerName.includes('SANIT')) {
            results.push({
              itemName: `Sanitary Sewer (${layer.name})`,
              description: `${objectCount} objects from ${model.fileName}`,
              quantity: objectCount,
              unit: 'EA',
              division: 33,
              category: 'utilities',
              itemKey: 'sanitary-pipe',
              confidence: 70,
              source: `dwg:${model.fileName}:layer:${layer.name}`,
            });
          } else if (layerName.includes('WATER') || layerName.includes('WTR')) {
            results.push({
              itemName: `Water Line (${layer.name})`,
              description: `${objectCount} objects from ${model.fileName}`,
              quantity: objectCount,
              unit: 'EA',
              division: 33,
              category: 'utilities',
              itemKey: 'water-main',
              confidence: 70,
              source: `dwg:${model.fileName}:layer:${layer.name}`,
            });
          } else if (layerName.includes('ELEC') || layerName.includes('POWER')) {
            results.push({
              itemName: `Site Electrical (${layer.name})`,
              description: `${objectCount} objects from ${model.fileName}`,
              quantity: objectCount,
              unit: 'EA',
              division: 33,
              category: 'utilities',
              itemKey: 'electrical-conduit',
              confidence: 70,
              source: `dwg:${model.fileName}:layer:${layer.name}`,
            });
          } else if (layerName.includes('LAND') || layerName.includes('PLANT') || layerName.includes('TREE')) {
            results.push({
              itemName: `Landscaping (${layer.name})`,
              description: `${objectCount} objects from ${model.fileName}`,
              quantity: objectCount,
              unit: 'EA',
              division: 32,
              category: 'landscape',
              itemKey: 'landscape-general',
              confidence: 70,
              source: `dwg:${model.fileName}:layer:${layer.name}`,
            });
          } else if (layerName.includes('SV') || layerName.includes('SURVEY') || layerName.includes('PNTS')) {
            // Survey points - useful for earthwork scope
            results.push({
              itemName: `Survey Points (${layer.name})`,
              description: `${objectCount} survey points from ${model.fileName}`,
              quantity: objectCount,
              unit: 'EA',
              division: 31,
              category: 'earthwork',
              itemKey: 'survey-stake',
              confidence: 80,
              source: `dwg:${model.fileName}:layer:${layer.name}`,
            });
          }
        }
      }
      
      // Extract from blocks
      if (metadata.blocks && Array.isArray(metadata.blocks)) {
        for (const block of metadata.blocks) {
          const blockName = block.name?.toUpperCase() || '';
          const count = block.instanceCount || 0;
          
          if (count === 0) continue;
          
          if (blockName.includes('TREE')) {
            results.push({
              itemName: `Trees (${block.name})`,
              description: `${count} tree blocks from ${model.fileName}`,
              quantity: count,
              unit: 'EA',
              division: 32,
              category: 'landscape',
              itemKey: 'tree-deciduous',
              confidence: 85,
              source: `dwg:${model.fileName}:block:${block.name}`,
            });
          } else if (blockName.includes('SHRUB') || blockName.includes('PLANT')) {
            results.push({
              itemName: `Shrubs/Plants (${block.name})`,
              description: `${count} plant blocks from ${model.fileName}`,
              quantity: count,
              unit: 'EA',
              division: 32,
              category: 'landscape',
              itemKey: 'shrub-3gal',
              confidence: 85,
              source: `dwg:${model.fileName}:block:${block.name}`,
            });
          } else if (blockName.includes('MH') || blockName.includes('MANHOLE')) {
            results.push({
              itemName: `Manholes (${block.name})`,
              description: `${count} manhole blocks from ${model.fileName}`,
              quantity: count,
              unit: 'EA',
              division: 33,
              category: 'utilities',
              itemKey: 'manhole-48in',
              confidence: 90,
              source: `dwg:${model.fileName}:block:${block.name}`,
            });
          } else if (blockName.includes('CB') || blockName.includes('CATCH')) {
            results.push({
              itemName: `Catch Basins (${block.name})`,
              description: `${count} catch basin blocks from ${model.fileName}`,
              quantity: count,
              unit: 'EA',
              division: 33,
              category: 'stormwater',
              itemKey: 'catch-basin',
              confidence: 90,
              source: `dwg:${model.fileName}:block:${block.name}`,
            });
          } else if (blockName.includes('LIGHT') || blockName.includes('POLE')) {
            results.push({
              itemName: `Light Poles (${block.name})`,
              description: `${count} light pole blocks from ${model.fileName}`,
              quantity: count,
              unit: 'EA',
              division: 32,
              category: 'paving',
              itemKey: 'light-pole-25ft',
              confidence: 90,
              source: `dwg:${model.fileName}:block:${block.name}`,
            });
          } else if (blockName.includes('SIGN')) {
            results.push({
              itemName: `Signs (${block.name})`,
              description: `${count} sign blocks from ${model.fileName}`,
              quantity: count,
              unit: 'EA',
              division: 32,
              category: 'paving',
              itemKey: 'signage',
              confidence: 85,
              source: `dwg:${model.fileName}:block:${block.name}`,
            });
          } else if (blockName.includes('HYDRANT') || blockName.includes('FH')) {
            results.push({
              itemName: `Fire Hydrants (${block.name})`,
              description: `${count} hydrant blocks from ${model.fileName}`,
              quantity: count,
              unit: 'EA',
              division: 33,
              category: 'utilities',
              itemKey: 'fire-hydrant',
              confidence: 90,
              source: `dwg:${model.fileName}:block:${block.name}`,
            });
          } else if (blockName.includes('VALVE') || blockName.includes('GATE')) {
            results.push({
              itemName: `Valves (${block.name})`,
              description: `${count} valve blocks from ${model.fileName}`,
              quantity: count,
              unit: 'EA',
              division: 33,
              category: 'utilities',
              itemKey: 'gate-valve',
              confidence: 85,
              source: `dwg:${model.fileName}:block:${block.name}`,
            });
          }
        }
      }
    }
    
    // Consolidate results
    const consolidated = consolidateResults(results);
    console.log(`[SITEWORK-BIM] Extracted ${consolidated.length} sitework items from DWG models`);
    
    return consolidated;
  } catch (error) {
    console.error('[SITEWORK-BIM] Error extracting from project models:', error);
    return [];
  }
}

export default {
  extractSiteworkTakeoff,
  extractByDrawingType,
  extractFromDWG,
  extractSiteworkFromProjectModels,
  extractGeotechData,
  adjustForGeotechConditions,
  calculateCutFill,
  calculateTrenchVolume,
  calculateAsphaltTonnage,
  calculateAggregateVolume,
  calculatePipeBedding,
  convertUnits,
  normalizeUnit,
  classifyDrawingType,
  parseCADLayerName,
  convertCADToTakeoff,
};
