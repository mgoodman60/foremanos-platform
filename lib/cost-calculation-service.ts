/**
 * Cost Calculation Service
 * 
 * Provides unit pricing, cost calculations, and waste factor adjustments
 * for material takeoffs.
 * 
 * Features:
 * - Comprehensive CSI MasterFormat pricing database
 * - Intelligent BIM category to CSI mapping
 * - Project-specific price overrides
 * - Regional cost adjustments
 * - Waste factor calculations
 * - Labor cost estimates
 */

import { prisma } from './db';
import { logger } from './logger';
import { TAKEOFF_CATEGORIES, TakeoffCategory, SubCategory } from './takeoff-categories';
import { 
  CSI_DIVISION_PRICING, 
  REGIONAL_MULTIPLIERS as CSI_REGIONAL_MULTIPLIERS,
  UnitPriceEntry,
  findPriceByCategory
} from './construction-pricing-database';

// Re-export regional multipliers from comprehensive database
export const REGIONAL_MULTIPLIERS = CSI_REGIONAL_MULTIPLIERS;

// Category aliases to map common category names to price database keys
export const CATEGORY_ALIASES: Record<string, { priceCategory: string; defaultSubCategory: string }> = {
  // Flooring variations
  'flooring': { priceCategory: 'flooring', defaultSubCategory: 'lvt' },
  'lvt': { priceCategory: 'flooring', defaultSubCategory: 'lvt' },
  'carpet': { priceCategory: 'flooring', defaultSubCategory: 'carpet' },
  'tile': { priceCategory: 'flooring', defaultSubCategory: 'ceramic-tile' },
  'ceramic': { priceCategory: 'flooring', defaultSubCategory: 'ceramic-tile' },
  'epoxy': { priceCategory: 'flooring', defaultSubCategory: 'epoxy' },
  
  // Ceiling variations
  'ceiling': { priceCategory: 'ceilings', defaultSubCategory: 'act-tile' },
  'ceilings': { priceCategory: 'ceilings', defaultSubCategory: 'act-tile' },
  'act': { priceCategory: 'ceilings', defaultSubCategory: 'act-tile' },
  'acoustic': { priceCategory: 'ceilings', defaultSubCategory: 'act-tile' },
  
  // Wall/drywall variations
  'walls': { priceCategory: 'drywall', defaultSubCategory: 'standard' },
  'wall': { priceCategory: 'drywall', defaultSubCategory: 'standard' },
  'drywall': { priceCategory: 'drywall', defaultSubCategory: 'standard' },
  'gwb': { priceCategory: 'drywall', defaultSubCategory: 'standard' },
  'gypsum': { priceCategory: 'drywall', defaultSubCategory: 'standard' },
  
  // Base/trim/finishes variations
  'base': { priceCategory: 'finishes', defaultSubCategory: 'rubber-base' },
  'rubber base': { priceCategory: 'finishes', defaultSubCategory: 'rubber-base' },
  'trim': { priceCategory: 'finishes', defaultSubCategory: 'trim' },
  'finishes': { priceCategory: 'finishes', defaultSubCategory: 'paint' },
  
  // Direct matches (for when category already matches)
  'concrete': { priceCategory: 'concrete', defaultSubCategory: 'slab-on-grade' },
  'rebar': { priceCategory: 'rebar', defaultSubCategory: 'rebar-light' },
  'masonry': { priceCategory: 'masonry', defaultSubCategory: 'cmu' },
  'steel': { priceCategory: 'steel', defaultSubCategory: 'wide-flange' },
  'lumber': { priceCategory: 'lumber', defaultSubCategory: 'studs' },
  'hvac': { priceCategory: 'hvac', defaultSubCategory: 'ductwork-rect' },
  'plumbing': { priceCategory: 'plumbing', defaultSubCategory: 'pvc-pipe' },
  'electrical': { priceCategory: 'electrical', defaultSubCategory: 'conduit' },
  'doors_windows': { priceCategory: 'doors_windows', defaultSubCategory: 'hollow-metal-door' },
  'roofing': { priceCategory: 'roofing', defaultSubCategory: 'tpo-membrane' },
  'sitework': { priceCategory: 'sitework', defaultSubCategory: 'excavation' },
  'specialties': { priceCategory: 'specialties', defaultSubCategory: 'toilet-accessories' },
};

// BIM/Revit Category to CSI Division + Item Key mapping
// Maps common Revit categories to specific CSI pricing items
export const BIM_TO_CSI_MAPPING: Record<string, { division: number; itemKey: string; fallbackUnit?: string }> = {
  // Structural (Division 3 - Concrete, Division 5 - Steel)
  'Walls': { division: 9, itemKey: 'drywall-5/8-type-x', fallbackUnit: 'SF' },
  'Structural Walls': { division: 3, itemKey: 'concrete-foundation-wall', fallbackUnit: 'CY' },
  'Basic Wall': { division: 9, itemKey: 'drywall-5/8-type-x', fallbackUnit: 'SF' },
  'Interior Walls': { division: 9, itemKey: 'drywall-5/8-type-x', fallbackUnit: 'SF' },
  'Exterior Walls': { division: 4, itemKey: 'cmu-8in-standard', fallbackUnit: 'SF' },
  'Curtain Walls': { division: 8, itemKey: 'curtain-wall', fallbackUnit: 'SF' },
  'Curtain Panels': { division: 8, itemKey: 'glazing-insulated', fallbackUnit: 'SF' },
  'Curtain Wall Mullions': { division: 8, itemKey: 'storefront-aluminum', fallbackUnit: 'LF' },
    'Structural Columns': { division: 5, itemKey: 'steel-wide-flange', fallbackUnit: 'LB' },
  'Columns': { division: 3, itemKey: 'concrete-columns', fallbackUnit: 'CY' },
  'Structural Framing': { division: 5, itemKey: 'structural-steel-erected', fallbackUnit: 'TON' },
  'Beams': { division: 5, itemKey: 'steel-wide-flange', fallbackUnit: 'LB' },
  'Structural Foundations': { division: 3, itemKey: 'concrete-footings', fallbackUnit: 'CY' },
  'Foundation': { division: 3, itemKey: 'concrete-footings', fallbackUnit: 'CY' },
    'Floors': { division: 3, itemKey: 'concrete-slab-on-grade-4in', fallbackUnit: 'SF' },
  'Floor': { division: 9, itemKey: 'lvt-commercial', fallbackUnit: 'SF' },
  'Flooring': { division: 9, itemKey: 'lvt-commercial', fallbackUnit: 'SF' },
  'Structural Floor': { division: 3, itemKey: 'concrete-elevated-slab', fallbackUnit: 'SF' },
    // Roofing (Division 7)
  'Roofs': { division: 7, itemKey: 'tpo-membrane-60mil', fallbackUnit: 'SF' },
  'Roof': { division: 7, itemKey: 'tpo-membrane-60mil', fallbackUnit: 'SF' },
  'Metal Roof': { division: 7, itemKey: 'metal-roofing-standing-seam', fallbackUnit: 'SF' },
    // Openings (Division 8)
  'Doors': { division: 8, itemKey: 'door-hollow-metal-3070', fallbackUnit: 'EA' },
  'Door': { division: 8, itemKey: 'door-hollow-metal-3070', fallbackUnit: 'EA' },
  'Windows': { division: 8, itemKey: 'window-aluminum-fixed', fallbackUnit: 'SF' },
  'Window': { division: 8, itemKey: 'window-aluminum-fixed', fallbackUnit: 'SF' },
  'Storefronts': { division: 8, itemKey: 'storefront-aluminum', fallbackUnit: 'SF' },
    // Finishes (Division 9)
  'Ceilings': { division: 9, itemKey: 'act-complete-system', fallbackUnit: 'SF' },
  'Ceiling': { division: 9, itemKey: 'act-complete-system', fallbackUnit: 'SF' },
  'Finishes': { division: 9, itemKey: 'paint-wall-2-coats', fallbackUnit: 'SF' },
  'Paint': { division: 9, itemKey: 'paint-wall-2-coats', fallbackUnit: 'SF' },
  'Tile': { division: 9, itemKey: 'ceramic-tile-floor', fallbackUnit: 'SF' },
  'Carpet': { division: 9, itemKey: 'carpet-tile-commercial', fallbackUnit: 'SF' },
  'VCT': { division: 9, itemKey: 'vct-commercial', fallbackUnit: 'SF' },
  'LVT': { division: 9, itemKey: 'lvt-healthcare', fallbackUnit: 'SF' },
    // Specialties (Division 10)
  'Specialties': { division: 10, itemKey: 'toilet-accessories-set', fallbackUnit: 'EA' },
  'Toilet Accessories': { division: 10, itemKey: 'toilet-accessories-set', fallbackUnit: 'EA' },
  'Grab Bars': { division: 10, itemKey: 'grab-bar-42in', fallbackUnit: 'EA' },
  'Signage': { division: 10, itemKey: 'signage-room-ada', fallbackUnit: 'EA' },
    // Equipment (Division 11)
  'Equipment': { division: 11, itemKey: 'kitchen-equipment-allowance', fallbackUnit: 'LS' },
    // Furnishings (Division 12)
  'Furniture': { division: 12, itemKey: 'entrance-mat', fallbackUnit: 'SF' },
    // Special Construction - PEMB (Division 13)
  'Metal Building': { division: 13, itemKey: 'pemb-complete', fallbackUnit: 'SF' },
  'PEMB': { division: 13, itemKey: 'pemb-complete', fallbackUnit: 'SF' },
    // Fire Suppression (Division 21)
  'Sprinklers': { division: 21, itemKey: 'sprinkler-head-pendant', fallbackUnit: 'EA' },
  'Fire Sprinklers': { division: 21, itemKey: 'sprinkler-wet-system', fallbackUnit: 'SF' },
    // Plumbing (Division 22)
  'Plumbing Fixtures': { division: 22, itemKey: 'plumbing-rough-per-fixture', fallbackUnit: 'EA' },
  'Plumbing': { division: 22, itemKey: 'plumbing-rough-per-fixture', fallbackUnit: 'EA' },
  'Pipe': { division: 22, itemKey: 'copper-pipe-3/4', fallbackUnit: 'LF' },
  'Piping': { division: 22, itemKey: 'copper-pipe-3/4', fallbackUnit: 'LF' },
  'Sanitary': { division: 22, itemKey: 'pvc-dwv-4', fallbackUnit: 'LF' },
  'Domestic Water': { division: 22, itemKey: 'copper-pipe-1', fallbackUnit: 'LF' },
  'Water Closet': { division: 22, itemKey: 'water-closet-commercial', fallbackUnit: 'EA' },
  'Lavatory': { division: 22, itemKey: 'lavatory-wall-hung', fallbackUnit: 'EA' },
    // HVAC (Division 23)
  'Mechanical Equipment': { division: 23, itemKey: 'rtu-10-ton', fallbackUnit: 'EA' },
  'HVAC': { division: 23, itemKey: 'rtu-10-ton', fallbackUnit: 'EA' },
  'Ducts': { division: 23, itemKey: 'duct-rectangular', fallbackUnit: 'LB' },
  'Ductwork': { division: 23, itemKey: 'duct-rectangular', fallbackUnit: 'LB' },
  'Air Terminals': { division: 23, itemKey: 'diffuser-supply', fallbackUnit: 'EA' },
  'Diffusers': { division: 23, itemKey: 'diffuser-supply', fallbackUnit: 'EA' },
  'VAV': { division: 23, itemKey: 'vav-box', fallbackUnit: 'EA' },
  'Exhaust Fan': { division: 23, itemKey: 'exhaust-fan', fallbackUnit: 'EA' },
    // Electrical (Division 26)
  'Electrical Equipment': { division: 26, itemKey: 'panel-200a', fallbackUnit: 'EA' },
  'Electrical Fixtures': { division: 26, itemKey: 'led-2x4-troffer', fallbackUnit: 'EA' },
  'Lighting Fixtures': { division: 26, itemKey: 'led-2x4-troffer', fallbackUnit: 'EA' },
  'Lighting': { division: 26, itemKey: 'led-2x4-troffer', fallbackUnit: 'EA' },
  'Electrical': { division: 26, itemKey: 'receptacle-duplex', fallbackUnit: 'EA' },
  'Panels': { division: 26, itemKey: 'panel-200a', fallbackUnit: 'EA' },
  'Receptacles': { division: 26, itemKey: 'receptacle-duplex', fallbackUnit: 'EA' },
  'Switches': { division: 26, itemKey: 'switch-single', fallbackUnit: 'EA' },
  'Conduit': { division: 26, itemKey: 'emt-3/4', fallbackUnit: 'LF' },
  'Wire': { division: 26, itemKey: 'wire-12awg', fallbackUnit: 'LF' },
  'Fire Alarm': { division: 26, itemKey: 'smoke-detector', fallbackUnit: 'EA' },
  'Fire Alarms': { division: 26, itemKey: 'smoke-detector', fallbackUnit: 'EA' },
    // Communications (Division 27)
  'Data Devices': { division: 27, itemKey: 'phone-system', fallbackUnit: 'EA' },
  'Communication Devices': { division: 27, itemKey: 'nurse-call-station', fallbackUnit: 'EA' },
    // Security (Division 28)
  'Security': { division: 28, itemKey: 'access-control-door', fallbackUnit: 'EA' },
  'Access Control': { division: 28, itemKey: 'card-reader', fallbackUnit: 'EA' },
    // Site/Earthwork (Divisions 31-33)
  'Site': { division: 32, itemKey: 'asphalt-paving-3in', fallbackUnit: 'SF' },
  'Sitework': { division: 31, itemKey: 'grading-fine', fallbackUnit: 'SF' },
  'Topography': { division: 31, itemKey: 'excavation-bulk', fallbackUnit: 'CY' },
  'Parking': { division: 32, itemKey: 'asphalt-paving-4in', fallbackUnit: 'SF' },
  'Landscaping': { division: 32, itemKey: 'sod', fallbackUnit: 'SF' },
  'Planting': { division: 32, itemKey: 'shrub-3gal', fallbackUnit: 'EA' },
  'Curb': { division: 3, itemKey: 'concrete-curb-gutter', fallbackUnit: 'LF' },
  'Sidewalk': { division: 3, itemKey: 'concrete-sidewalk-4in', fallbackUnit: 'SF' },
    // Metals misc (Division 5)
  'Railings': { division: 5, itemKey: 'handrail-steel', fallbackUnit: 'LF' },
  'Stairs': { division: 5, itemKey: 'steel-stair', fallbackUnit: 'RISER' },
  'Handrails': { division: 5, itemKey: 'handrail-steel', fallbackUnit: 'LF' },
    // Wood/Casework (Division 6)
  'Casework': { division: 6, itemKey: 'casework-base-cabinet', fallbackUnit: 'LF' },
  'Cabinets': { division: 6, itemKey: 'casework-base-cabinet', fallbackUnit: 'LF' },
  'Millwork': { division: 6, itemKey: 'wood-trim', fallbackUnit: 'LF' },
  'Blocking': { division: 6, itemKey: 'wood-blocking', fallbackUnit: 'LF' },
};

/**
 * Get price from CSI database for a BIM category
 */
export function getCSIPriceForCategory(
  category: string,
  unit: string,
  region: string = 'default'
): { unitCost: number; laborRate: number; source: string } | null {
  const mapping = BIM_TO_CSI_MAPPING[category];
  if (!mapping) return null;
  
  const division = CSI_DIVISION_PRICING.find(d => d.divisionCode === mapping.division);
  if (!division) return null;
  
  const entry = division.items[mapping.itemKey];
  if (!entry) return null;
  
  const multiplier = CSI_REGIONAL_MULTIPLIERS[region] || CSI_REGIONAL_MULTIPLIERS['default'];
  
  return {
    unitCost: Math.round(entry.totalInstalled * multiplier * 100) / 100,
    laborRate: Math.round((entry.laborCost / Math.max(entry.laborHoursPerUnit, 0.01)) * multiplier * 100) / 100,
    source: `CSI-${mapping.division}-${mapping.itemKey}`,
  };
}

// Default unit prices (2024 national averages - USD) - LEGACY FALLBACK
export const DEFAULT_UNIT_PRICES: Record<string, Record<string, { unitCost: number; laborRate: number }>> = {
  // CONCRETE (Division 03)
  'concrete': {
    'slab-on-grade': { unitCost: 185, laborRate: 65 },      // per CY
    'footings': { unitCost: 195, laborRate: 65 },            // per CY
    'foundation-walls': { unitCost: 210, laborRate: 70 },    // per CY
    'columns': { unitCost: 250, laborRate: 75 },             // per CY
    'beams': { unitCost: 275, laborRate: 75 },               // per CY
    'elevated-slab': { unitCost: 225, laborRate: 70 },       // per CY
    'curbs': { unitCost: 15, laborRate: 55 },                // per LF
    'formwork': { unitCost: 8.50, laborRate: 55 },           // per SFCA
  },
  
  // REBAR (Division 03)
  'rebar': {
    'rebar-light': { unitCost: 1200, laborRate: 65 },        // per TON
    'rebar-heavy': { unitCost: 1350, laborRate: 65 },        // per TON
    'wwf': { unitCost: 0.45, laborRate: 50 },                // per SF
    'dowels': { unitCost: 3.50, laborRate: 50 },             // per EA
  },
  
  // MASONRY (Division 04)
  'masonry': {
    'cmu': { unitCost: 12.50, laborRate: 55 },               // per SF
    'brick': { unitCost: 18.00, laborRate: 60 },             // per SF
    'grout': { unitCost: 8.00, laborRate: 45 },              // per CF
  },
  
  // STRUCTURAL STEEL (Division 05)
  'steel': {
    'wide-flange': { unitCost: 3500, laborRate: 85 },        // per TON
    'tube-steel': { unitCost: 4000, laborRate: 85 },         // per TON
    'angles': { unitCost: 8.50, laborRate: 70 },             // per LF
    'channels': { unitCost: 12.00, laborRate: 70 },          // per LF
    'metal-deck': { unitCost: 4.25, laborRate: 65 },         // per SF
    'misc-steel': { unitCost: 2.50, laborRate: 70 },         // per LBS
  },
  
  // WOOD & LUMBER (Division 06)
  'lumber': {
    'studs': { unitCost: 1.25, laborRate: 45 },              // per LF
    'joists': { unitCost: 2.50, laborRate: 50 },             // per LF
    'rafters': { unitCost: 3.00, laborRate: 55 },            // per LF
    'trusses': { unitCost: 125, laborRate: 60 },             // per EA
    'beams': { unitCost: 12.00, laborRate: 55 },             // per LF
    'sheathing': { unitCost: 1.85, laborRate: 45 },          // per SF
    'blocking': { unitCost: 0.85, laborRate: 40 },           // per LF
  },
  
  // HVAC (Division 23)
  'hvac': {
    'ductwork-rect': { unitCost: 3.50, laborRate: 75 },      // per LBS
    'ductwork-round': { unitCost: 18.00, laborRate: 75 },    // per LF
    'diffusers': { unitCost: 85, laborRate: 70 },            // per EA
    'ahu': { unitCost: 15000, laborRate: 95 },               // per EA
    'vav': { unitCost: 1200, laborRate: 85 },                // per EA
    'exhaust-fans': { unitCost: 450, laborRate: 75 },        // per EA
    'insulation-mech': { unitCost: 2.25, laborRate: 55 },    // per SF
  },
  
  // PLUMBING (Division 22)
  'plumbing': {
    'copper-pipe': { unitCost: 12.50, laborRate: 75 },       // per LF
    'pvc-pipe': { unitCost: 4.50, laborRate: 65 },           // per LF
    'cast-iron': { unitCost: 18.00, laborRate: 70 },         // per LF
    'fixtures': { unitCost: 650, laborRate: 80 },            // per EA
    'water-heater': { unitCost: 1800, laborRate: 85 },       // per EA
    'valves': { unitCost: 125, laborRate: 70 },              // per EA
    'pipe-insulation': { unitCost: 3.50, laborRate: 50 },    // per LF
  },
  
  // ELECTRICAL (Division 26)
  'electrical': {
    'conduit': { unitCost: 4.50, laborRate: 70 },            // per LF
    'wire': { unitCost: 1.25, laborRate: 60 },               // per LF
    'receptacles': { unitCost: 45, laborRate: 65 },          // per EA
    'switches': { unitCost: 35, laborRate: 60 },             // per EA
    'panels': { unitCost: 2500, laborRate: 90 },             // per EA
    'lighting': { unitCost: 185, laborRate: 70 },            // per EA
    'fire-alarm': { unitCost: 95, laborRate: 75 },           // per EA
  },
  
  // DRYWALL (Division 09) - Commercial rates (material + labor installed)
  'drywall': {
    'standard': { unitCost: 6.85, laborRate: 60 },           // per SF - Type X, Level 4 finish
    'fire-rated': { unitCost: 7.50, laborRate: 60 },         // per SF - 2-hour rated assembly
    'moisture-resistant': { unitCost: 7.25, laborRate: 60 }, // per SF - greenboard/densglass
    'finishing': { unitCost: 3.50, laborRate: 55 },          // per SF - Level 4/5 finish only
  },
  
  // FLOORING (Division 09) - Commercial healthcare rates (material + labor installed)
  'flooring': {
    'ceramic-tile': { unitCost: 18.50, laborRate: 65 },      // per SF - commercial porcelain
    'lvt': { unitCost: 12.50, laborRate: 55 },               // per SF - healthcare-grade antimicrobial
    'carpet': { unitCost: 8.75, laborRate: 50 },             // per SF - commercial carpet tile
    'polished-concrete': { unitCost: 12.00, laborRate: 60 }, // per SF - sealed/polished
    'epoxy': { unitCost: 14.50, laborRate: 65 },             // per SF - commercial epoxy system
  },
  
  // CEILINGS (Division 09) - Commercial rates (material + labor installed)
  'ceilings': {
    'act-grid': { unitCost: 3.75, laborRate: 55 },           // per SF - grid only
    'act-tile': { unitCost: 8.75, laborRate: 55 },           // per SF - grid + tile complete
    'gyp-ceiling': { unitCost: 9.50, laborRate: 65 },        // per SF - GWB ceiling
  },
  
  // DOORS & WINDOWS (Division 08)
  'doors_windows': {
    'hollow-metal-door': { unitCost: 850, laborRate: 65 },   // per EA
    'wood-door': { unitCost: 550, laborRate: 60 },           // per EA
    'frame': { unitCost: 350, laborRate: 55 },               // per EA
    'hardware-set': { unitCost: 450, laborRate: 50 },        // per EA
    'window': { unitCost: 65, laborRate: 60 },               // per SF
    'storefront': { unitCost: 85, laborRate: 70 },           // per SF
  },
  
  // ROOFING (Division 07)
  'roofing': {
    'tpo-membrane': { unitCost: 8.50, laborRate: 55 },       // per SF
    'epdm-membrane': { unitCost: 7.50, laborRate: 55 },      // per SF
    'metal-roofing': { unitCost: 12.00, laborRate: 60 },     // per SF
    'insulation': { unitCost: 3.50, laborRate: 45 },         // per SF
    'flashing': { unitCost: 8.00, laborRate: 50 },           // per LF
  },
  
  // INSULATION (Division 07)
  'insulation': {
    'batt': { unitCost: 1.25, laborRate: 40 },               // per SF
    'rigid': { unitCost: 2.50, laborRate: 45 },              // per SF
    'spray-foam': { unitCost: 4.50, laborRate: 50 },         // per SF
  },
  
  // EARTHWORK (Division 31)
  'earthwork': {
    'excavation': { unitCost: 12.00, laborRate: 85 },        // per CY
    'backfill': { unitCost: 18.00, laborRate: 85 },          // per CY
    'grading': { unitCost: 2.50, laborRate: 75 },            // per SF
    'compaction': { unitCost: 1.25, laborRate: 65 },         // per SF
  },
  
  // PAVING (Division 32)
  'paving': {
    'asphalt': { unitCost: 4.50, laborRate: 65 },            // per SF
    'concrete-paving': { unitCost: 8.50, laborRate: 70 },    // per SF
    'curb-gutter': { unitCost: 28.00, laborRate: 60 },       // per LF
    'sidewalk': { unitCost: 6.50, laborRate: 55 },           // per SF
  },
  
  // SITE UTILITIES (Division 33)
  'site_utilities': {
    'storm-pipe': { unitCost: 45.00, laborRate: 75 },        // per LF
    'sanitary-pipe': { unitCost: 55.00, laborRate: 80 },     // per LF
    'water-main': { unitCost: 65.00, laborRate: 85 },        // per LF
    'manholes': { unitCost: 3500, laborRate: 90 },           // per EA
  },
  
  // FINISHES (Division 09 - additional items) - Commercial rates
  'finishes': {
    'rubber-base': { unitCost: 6.25, laborRate: 50 },        // per LF - 4" cove commercial
    'trim': { unitCost: 8.50, laborRate: 55 },               // per LF - commercial millwork
    'paint': { unitCost: 3.25, laborRate: 45 },              // per SF - 2 coats commercial
    'wall-covering': { unitCost: 7.50, laborRate: 55 },      // per SF - commercial vinyl
  },
  
  // SITEWORK (Division 31-32 combined)
  'sitework': {
    'excavation': { unitCost: 12.00, laborRate: 85 },        // per CY
    'backfill': { unitCost: 18.00, laborRate: 85 },          // per CY
    'grading': { unitCost: 2.50, laborRate: 75 },            // per SF
  },
  
  // SPECIALTIES (Division 10)
  'specialties': {
    'toilet-accessories': { unitCost: 450, laborRate: 50 },  // per EA
    'lockers': { unitCost: 350, laborRate: 55 },             // per EA
    'signage': { unitCost: 150, laborRate: 45 },             // per EA
  },
};

export interface CostCalculationResult {
  itemId: string;
  baseQuantity: number;
  wastePercent: number;
  adjustedQuantity: number;
  unitCost: number;
  materialCost: number;
  laborHours: number;
  laborRate: number;
  laborCost: number;
  totalCost: number;
  priceSource: 'default' | 'project' | 'manual';
}

export interface TakeoffCostSummary {
  takeoffId: string;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalCost: number;
  totalLaborHours: number;
  itemCount: number;
  pricedItemCount: number;
  unpricedItems: string[];
  byCategory: CategoryCostSummary[];
}

export interface CategoryCostSummary {
  category: string;
  categoryName: string;
  itemCount: number;
  materialCost: number;
  laborCost: number;
  totalCost: number;
  laborHours: number;
}

/**
 * Get unit price for a specific item
 */
export async function getUnitPrice(
  category: string,
  subCategory: string | null,
  unit: string,
  projectId: string | null,
  region: string = 'default'
): Promise<{ unitCost: number; laborRate: number; source: string } | null> {
  try {
    // First try project-specific price
    if (projectId) {
      const projectPrice = await prisma.unitPrice.findFirst({
        where: {
          projectId,
          category: { equals: category, mode: 'insensitive' },
          subCategory: subCategory || undefined,
          unit: { equals: unit, mode: 'insensitive' },
          OR: [
            { expirationDate: null },
            { expirationDate: { gt: new Date() } }
          ]
        },
        orderBy: { effectiveDate: 'desc' }
      });
      
      if (projectPrice) {
        return {
          unitCost: projectPrice.unitCost,
          laborRate: projectPrice.laborRate || 65, // Default labor rate
          source: 'project'
        };
      }
    }
    
    // Then try global default from database
    const globalPrice = await prisma.unitPrice.findFirst({
      where: {
        projectId: null,
        category: { equals: category, mode: 'insensitive' },
        subCategory: subCategory || undefined,
        unit: { equals: unit, mode: 'insensitive' },
        region: { equals: region, mode: 'insensitive' },
        OR: [
          { expirationDate: null },
          { expirationDate: { gt: new Date() } }
        ]
      },
      orderBy: { effectiveDate: 'desc' }
    });
    
    if (globalPrice) {
      return {
        unitCost: globalPrice.unitCost,
        laborRate: globalPrice.laborRate || 65,
        source: 'global'
      };
    }
    
    // TRY CSI DATABASE FIRST - comprehensive industry pricing
    const csiPrice = getCSIPriceForCategory(category, unit, region);
    if (csiPrice) {
      return csiPrice;
    }
    
    // Try fuzzy matching against CSI database
    const normalizedCategory = category.toLowerCase();
    for (const [bimCategory, mapping] of Object.entries(BIM_TO_CSI_MAPPING)) {
      if (
        bimCategory.toLowerCase() === normalizedCategory ||
        bimCategory.toLowerCase().includes(normalizedCategory) ||
        normalizedCategory.includes(bimCategory.toLowerCase())
      ) {
        const matchedPrice = getCSIPriceForCategory(bimCategory, unit, region);
        if (matchedPrice) {
          return matchedPrice;
        }
      }
    }
    
    // Fall back to legacy hardcoded defaults - using category aliases for flexible matching
    const categoryLower = category.toLowerCase();
    const alias = CATEGORY_ALIASES[categoryLower];
    const priceCategory = alias?.priceCategory || categoryLower;
    const defaultSubCat = alias?.defaultSubCategory || null;
    
    const categoryPrices = DEFAULT_UNIT_PRICES[priceCategory];
    if (categoryPrices) {
      // Use provided subCategory, or alias default, or first available
      const subCatKey = subCategory?.toLowerCase().replace(/[\s-]/g, '-') 
        || defaultSubCat 
        || Object.keys(categoryPrices)[0];
      const prices = categoryPrices[subCatKey] || Object.values(categoryPrices)[0];
      
      if (prices) {
        const multiplier = REGIONAL_MULTIPLIERS[region] || 1.0;
        return {
          unitCost: prices.unitCost * multiplier,
          laborRate: prices.laborRate * multiplier,
          source: 'default'
        };
      }
    }
    
    // Last resort: Try generic matching in CSI database by keyword
    const foundPrice = findPriceByCategory(category, region);
    if (foundPrice) {
      return {
        unitCost: foundPrice.totalInstalled,
        laborRate: foundPrice.laborCost / Math.max(foundPrice.laborHoursPerUnit, 0.01),
        source: 'csi-fuzzy'
      };
    }
    
    return null;
  } catch (error) {
    logger.error('COST_CALCULATION', 'Error getting unit price', error as Error);
    return null;
  }
}

/**
 * Get waste factor for a category/subcategory
 */
export function getWasteFactor(category: string, subCategory: string | null): number {
  for (const cat of TAKEOFF_CATEGORIES) {
    if (cat.id.toLowerCase() === category.toLowerCase()) {
      if (subCategory) {
        const sub = cat.subCategories.find(
          s => s.id.toLowerCase() === subCategory.toLowerCase() ||
               s.name.toLowerCase() === subCategory.toLowerCase()
        );
        if (sub) return sub.wasteFactorPercent;
      }
      // Return average waste factor for category
      if (cat.subCategories.length > 0) {
        return cat.subCategories.reduce((sum, s) => sum + s.wasteFactorPercent, 0) / cat.subCategories.length;
      }
    }
  }
  return 5; // Default 5% waste
}

/**
 * Get labor hours per unit for a category/subcategory
 */
export function getLaborHoursPerUnit(category: string, subCategory: string | null): number {
  for (const cat of TAKEOFF_CATEGORIES) {
    if (cat.id.toLowerCase() === category.toLowerCase()) {
      if (subCategory) {
        const sub = cat.subCategories.find(
          s => s.id.toLowerCase() === subCategory.toLowerCase() ||
               s.name.toLowerCase() === subCategory.toLowerCase()
        );
        if (sub) return sub.laborHoursPerUnit;
      }
      // Return average for category
      if (cat.subCategories.length > 0) {
        return cat.subCategories.reduce((sum, s) => sum + s.laborHoursPerUnit, 0) / cat.subCategories.length;
      }
    }
  }
  return 0.5; // Default
}

/**
 * Calculate cost for a single line item
 */
export async function calculateItemCost(
  item: {
    id: string;
    category: string;
    itemName: string;
    quantity: number;
    unit: string;
    unitCost?: number | null;
  },
  projectId: string | null,
  region: string = 'default'
): Promise<CostCalculationResult> {
  const wastePercent = getWasteFactor(item.category, null);
  const laborHoursPerUnit = getLaborHoursPerUnit(item.category, null);
  const adjustedQuantity = item.quantity * (1 + wastePercent / 100);
  
  let unitCost = item.unitCost || 0;
  let laborRate = 65; // Default
  let priceSource: 'default' | 'project' | 'manual' = 'manual';
  
  // If no unit cost provided, look it up
  if (!item.unitCost) {
    const price = await getUnitPrice(item.category, null, item.unit, projectId, region);
    if (price) {
      unitCost = price.unitCost;
      laborRate = price.laborRate;
      priceSource = price.source === 'project' ? 'project' : 'default';
    }
  }
  
  const materialCost = adjustedQuantity * unitCost;
  const laborHours = item.quantity * laborHoursPerUnit;
  const laborCost = laborHours * laborRate;
  const totalCost = materialCost + laborCost;
  
  return {
    itemId: item.id,
    baseQuantity: item.quantity,
    wastePercent,
    adjustedQuantity,
    unitCost,
    materialCost,
    laborHours,
    laborRate,
    laborCost,
    totalCost,
    priceSource,
  };
}

/**
 * Calculate costs for all items in a takeoff
 */
export async function calculateTakeoffCosts(
  takeoffId: string,
  region: string = 'default'
): Promise<TakeoffCostSummary> {
  try {
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id: takeoffId },
      include: {
        TakeoffLineItem: true,
        Project: { select: { id: true } }
      }
    });
    
    if (!takeoff) {
      throw new Error('Takeoff not found');
    }
    
    const projectId = takeoff.Project?.id || null;
    const items = takeoff.TakeoffLineItem;
    
    let totalMaterialCost = 0;
    let totalLaborCost = 0;
    let totalLaborHours = 0;
    let pricedItemCount = 0;
    const unpricedItems: string[] = [];
    const categoryTotals = new Map<string, CategoryCostSummary>();
    
    for (const item of items) {
      const result = await calculateItemCost(
        {
          id: item.id,
          category: item.category,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
        },
        projectId,
        region
      );
      
      if (result.unitCost > 0) {
        pricedItemCount++;
      } else {
        unpricedItems.push(item.itemName);
      }
      
      totalMaterialCost += result.materialCost;
      totalLaborCost += result.laborCost;
      totalLaborHours += result.laborHours;
      
      // Aggregate by category
      const catName = getCategoryName(item.category);
      const existing = categoryTotals.get(item.category) || {
        category: item.category,
        categoryName: catName,
        itemCount: 0,
        materialCost: 0,
        laborCost: 0,
        totalCost: 0,
        laborHours: 0,
      };
      
      existing.itemCount++;
      existing.materialCost += result.materialCost;
      existing.laborCost += result.laborCost;
      existing.totalCost += result.totalCost;
      existing.laborHours += result.laborHours;
      
      categoryTotals.set(item.category, existing);
    }
    
    return {
      takeoffId,
      totalMaterialCost,
      totalLaborCost,
      totalCost: totalMaterialCost + totalLaborCost,
      totalLaborHours,
      itemCount: items.length,
      pricedItemCount,
      unpricedItems,
      byCategory: Array.from(categoryTotals.values()).sort((a, b) => b.totalCost - a.totalCost),
    };
  } catch (error) {
    logger.error('COST_CALCULATION', 'Error calculating takeoff costs', error as Error);
    throw error;
  }
}

/**
 * Apply calculated costs to line items in database
 */
export async function applyCalculatedCosts(
  takeoffId: string,
  region: string = 'default'
): Promise<{ updated: number; skipped: number }> {
  try {
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id: takeoffId },
      include: {
        TakeoffLineItem: true,
        Project: { select: { id: true } }
      }
    });
    
    if (!takeoff) {
      throw new Error('Takeoff not found');
    }
    
    const projectId = takeoff.Project?.id || null;
    let updated = 0;
    let skipped = 0;
    
    for (const item of takeoff.TakeoffLineItem) {
      // Skip items that already have manual costs
      if (item.unitCost && item.unitCost > 0) {
        skipped++;
        continue;
      }
      
      const price = await getUnitPrice(item.category, null, item.unit, projectId, region);
      
      if (price) {
        const wastePercent = getWasteFactor(item.category, null);
        const adjustedQty = item.quantity * (1 + wastePercent / 100);
        const totalCost = adjustedQty * price.unitCost;
        
        await prisma.takeoffLineItem.update({
          where: { id: item.id },
          data: {
            unitCost: price.unitCost,
            totalCost: totalCost,
          }
        });
        updated++;
      } else {
        skipped++;
      }
    }
    
    // Update takeoff total
    const newTotal = await prisma.takeoffLineItem.aggregate({
      where: { takeoffId },
      _sum: { totalCost: true }
    });
    
    await prisma.materialTakeoff.update({
      where: { id: takeoffId },
      data: { totalCost: newTotal._sum.totalCost || 0 }
    });
    
    return { updated, skipped };
  } catch (error) {
    logger.error('COST_CALCULATION', 'Error applying costs', error as Error);
    throw error;
  }
}

/**
 * Get category display name
 */
function getCategoryName(categoryId: string): string {
  const cat = TAKEOFF_CATEGORIES.find(c => c.id.toLowerCase() === categoryId.toLowerCase());
  return cat?.name || categoryId;
}

/**
 * Save or update a unit price
 */
export async function saveUnitPrice(
  data: {
    projectId?: string | null;
    category: string;
    subCategory?: string | null;
    itemName?: string | null;
    unit: string;
    unitCost: number;
    laborRate?: number | null;
    region?: string;
    supplier?: string | null;
    source?: string;
    notes?: string | null;
  },
  userId: string
): Promise<{ id: string; created: boolean }> {
  try {
    const existing = await prisma.unitPrice.findFirst({
      where: {
        projectId: data.projectId || null,
        category: data.category,
        subCategory: data.subCategory || null,
        itemName: data.itemName || null,
        unit: data.unit,
        region: data.region || 'default',
      }
    });
    
    if (existing) {
      // Update existing
      const updated = await prisma.unitPrice.update({
        where: { id: existing.id },
        data: {
          unitCost: data.unitCost,
          laborRate: data.laborRate,
          supplier: data.supplier,
          source: data.source,
          notes: data.notes,
          effectiveDate: new Date(),
        }
      });
      return { id: updated.id, created: false };
    } else {
      // Create new
      const created = await prisma.unitPrice.create({
        data: {
          projectId: data.projectId || null,
          category: data.category,
          subCategory: data.subCategory || null,
          itemName: data.itemName || null,
          unit: data.unit,
          unitCost: data.unitCost,
          laborRate: data.laborRate || null,
          region: data.region || 'default',
          supplier: data.supplier || null,
          source: data.source || 'manual',
          notes: data.notes || null,
          createdBy: userId,
        }
      });
      return { id: created.id, created: true };
    }
  } catch (error) {
    logger.error('COST_CALCULATION', 'Error saving unit price', error as Error);
    throw error;
  }
}

/**
 * Get all unit prices for a project (including global defaults)
 */
export async function getProjectUnitPrices(
  projectId: string | null,
  region: string = 'default'
): Promise<Array<{
  id: string;
  category: string;
  subCategory: string | null;
  unit: string;
  unitCost: number;
  laborRate: number | null;
  source: string;
  isProjectSpecific: boolean;
}>> {
  try {
    const prices = await prisma.unitPrice.findMany({
      where: {
        AND: [
          {
            OR: [
              { projectId: projectId },
              { projectId: null, region: region }
            ]
          },
          {
            OR: [
              { expirationDate: null },
              { expirationDate: { gt: new Date() } }
            ]
          }
        ]
      },
      orderBy: [{ category: 'asc' }, { subCategory: 'asc' }]
    });
    
    return prices.map(p => ({
      id: p.id,
      category: p.category,
      subCategory: p.subCategory,
      unit: p.unit,
      unitCost: p.unitCost,
      laborRate: p.laborRate,
      source: p.source || 'unknown',
      isProjectSpecific: p.projectId === projectId,
    }));
  } catch (error) {
    logger.error('COST_CALCULATION', 'Error getting project prices', error as Error);
    return [];
  }
}
