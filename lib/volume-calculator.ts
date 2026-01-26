/**
 * Construction Volume Calculator
 * Accurate calculations for concrete, aggregate, and backfill volumes
 * Supports various element types with proper geometry formulas
 */

import { findPriceByDivision, REGIONAL_MULTIPLIERS } from './construction-pricing-database';

// ============================================================================
// CONCRETE VOLUME CALCULATIONS
// ============================================================================

export interface ConcreteVolumeInput {
  elementType: ConcreteElementType;
  dimensions: ElementDimensions;
  quantity?: number;  // Number of elements (default 1)
  wasteFactorPercent?: number;  // Default 5%
}

export type ConcreteElementType = 
  | 'slab'           // Length x Width x Thickness
  | 'footing'        // Length x Width x Depth (continuous or spread)
  | 'spread-footing' // Length x Width x Depth
  | 'grade-beam'     // Length x Width x Depth
  | 'foundation-wall'// Length x Height x Thickness
  | 'column-rect'    // Length x Width x Height
  | 'column-round'   // Diameter x Height
  | 'pier'           // Diameter x Depth
  | 'beam'           // Length x Width x Depth
  | 'curb-gutter'    // Length x Cross-Section Area
  | 'sidewalk'       // Length x Width x Thickness
  | 'slab-on-grade'; // Area x Thickness

export interface ElementDimensions {
  // Primary dimensions (all in feet unless noted)
  length?: number;
  width?: number;
  height?: number;
  depth?: number;
  thickness?: number;  // In inches for slabs, feet for walls
  diameter?: number;   // For round elements
  area?: number;       // Pre-calculated area in SF
  crossSectionArea?: number;  // For curbs, in SF
  thicknessInches?: number;   // Explicit inches
}

export interface ConcreteVolumeResult {
  volumeCY: number;           // Cubic yards
  volumeCF: number;           // Cubic feet
  volumeWithWasteCY: number;  // With waste factor
  wasteFactorApplied: number; // Percentage
  formula: string;            // Calculation formula used
  elementCount: number;       // Number of elements
  costEstimate: {
    materialCost: number;
    laborCost: number;
    totalCost: number;
    pricePerCY: number;
    regionalMultiplier: number;
  };
}

/**
 * Calculate concrete volume for various element types
 */
export function calculateConcreteVolume(
  input: ConcreteVolumeInput,
  region: string = 'morehead-ky'
): ConcreteVolumeResult {
  const { elementType, dimensions, quantity = 1, wasteFactorPercent = 5 } = input;
  
  let volumeCF = 0;
  let formula = '';
  
  switch (elementType) {
    case 'slab':
    case 'slab-on-grade': {
      const length = dimensions.length || 0;
      const width = dimensions.width || 0;
      const area = dimensions.area || (length * width);
      // Thickness: prefer thicknessInches, then thickness (assume inches if < 2)
      let thicknessInches = dimensions.thicknessInches ||
        (dimensions.thickness && dimensions.thickness < 2 ? dimensions.thickness * 12 : dimensions.thickness || 4);
      if (dimensions.thickness && dimensions.thickness >= 2 && dimensions.thickness <= 12) {
        thicknessInches = dimensions.thickness; // Already in inches
      }
      const thicknessFt = thicknessInches / 12;
      volumeCF = area * thicknessFt;
      formula = `${area.toFixed(1)} SF × ${thicknessInches}" thick = ${volumeCF.toFixed(2)} CF`;
      break;
    }
    
    case 'footing':
    case 'spread-footing': {
      const length = dimensions.length || 0;
      const width = dimensions.width || 0;
      const depth = dimensions.depth || dimensions.height || 1;
      volumeCF = length * width * depth;
      formula = `${length}' L × ${width}' W × ${depth}' D = ${volumeCF.toFixed(2)} CF`;
      break;
    }
    
    case 'grade-beam': {
      const length = dimensions.length || 0;
      const width = dimensions.width || 1;
      const depth = dimensions.depth || 2;
      volumeCF = length * width * depth;
      formula = `${length}' L × ${width}' W × ${depth}' D = ${volumeCF.toFixed(2)} CF`;
      break;
    }
    
    case 'foundation-wall': {
      const length = dimensions.length || 0;
      const height = dimensions.height || 8;
      // Wall thickness typically in inches, convert to feet
      let thicknessFt = dimensions.thickness || 0.667; // Default 8"
      if (thicknessFt > 2) thicknessFt = thicknessFt / 12; // Was in inches
      volumeCF = length * height * thicknessFt;
      formula = `${length}' L × ${height}' H × ${(thicknessFt * 12).toFixed(0)}" T = ${volumeCF.toFixed(2)} CF`;
      break;
    }
    
    case 'column-rect': {
      const length = dimensions.length || dimensions.width || 1;
      const width = dimensions.width || dimensions.length || 1;
      const height = dimensions.height || 10;
      volumeCF = length * width * height;
      formula = `${length}' × ${width}' × ${height}' H = ${volumeCF.toFixed(2)} CF`;
      break;
    }
    
    case 'column-round':
    case 'pier': {
      const diameter = dimensions.diameter || 1;
      const height = dimensions.height || dimensions.depth || 10;
      const radius = diameter / 2;
      volumeCF = Math.PI * radius * radius * height;
      formula = `π × (${diameter}/2)² × ${height}' = ${volumeCF.toFixed(2)} CF`;
      break;
    }
    
    case 'beam': {
      const length = dimensions.length || 0;
      const width = dimensions.width || 1;
      const depth = dimensions.depth || dimensions.height || 1.5;
      volumeCF = length * width * depth;
      formula = `${length}' L × ${width}' W × ${depth}' D = ${volumeCF.toFixed(2)} CF`;
      break;
    }
    
    case 'curb-gutter': {
      const length = dimensions.length || 0;
      const crossSectionSF = dimensions.crossSectionArea || 1.0; // Default ~1 SF
      volumeCF = length * crossSectionSF;
      formula = `${length}' L × ${crossSectionSF} SF cross-section = ${volumeCF.toFixed(2)} CF`;
      break;
    }
    
    case 'sidewalk': {
      const length = dimensions.length || 0;
      const width = dimensions.width || 4;
      let thicknessInches = dimensions.thicknessInches || dimensions.thickness || 4;
      if (thicknessInches > 12) thicknessInches = thicknessInches; // Already feet, convert back
      const thicknessFt = thicknessInches / 12;
      volumeCF = length * width * thicknessFt;
      formula = `${length}' L × ${width}' W × ${thicknessInches}" T = ${volumeCF.toFixed(2)} CF`;
      break;
    }
  }
  
  // Apply quantity multiplier
  const totalVolumeCF = volumeCF * quantity;
  const volumeCY = totalVolumeCF / 27;
  const volumeWithWasteCY = volumeCY * (1 + wasteFactorPercent / 100);
  
  // Get pricing based on element type
  let priceKey = 'concrete-footings';
  switch (elementType) {
    case 'slab':
    case 'slab-on-grade':
    case 'sidewalk':
      priceKey = 'concrete-slab-on-grade-4in';
      break;
    case 'foundation-wall':
      priceKey = 'concrete-foundation-wall';
      break;
    case 'column-rect':
    case 'column-round':
      priceKey = 'concrete-columns';
      break;
    case 'beam':
    case 'grade-beam':
      priceKey = 'concrete-beams';
      break;
    case 'pier':
      priceKey = 'concrete-pier';
      break;
    case 'curb-gutter':
      priceKey = 'concrete-curb-gutter';
      break;
  }
  
  const pricing = findPriceByDivision(3, priceKey);
  const regionalMult = REGIONAL_MULTIPLIERS[region] || 1.0;
  
  // Calculate costs - pricing is per CY for most, per SF for slabs
  let materialCost = 0;
  let laborCost = 0;
  let pricePerCY = 0;
  
  if (pricing) {
    if (pricing.unit === 'SF') {
      // For slab pricing, need to convert back to area
      const areaSF = totalVolumeCF / (dimensions.thicknessInches || 4) * 12;
      materialCost = pricing.materialCost * areaSF * regionalMult;
      laborCost = pricing.laborCost * areaSF * regionalMult;
      pricePerCY = pricing.totalInstalled * 27 / ((dimensions.thicknessInches || 4) / 12);
    } else {
      materialCost = pricing.materialCost * volumeWithWasteCY * regionalMult;
      laborCost = pricing.laborCost * volumeWithWasteCY * regionalMult;
      pricePerCY = pricing.totalInstalled * regionalMult;
    }
  }
  
  return {
    volumeCY: Math.round(volumeCY * 100) / 100,
    volumeCF: Math.round(totalVolumeCF * 100) / 100,
    volumeWithWasteCY: Math.round(volumeWithWasteCY * 100) / 100,
    wasteFactorApplied: wasteFactorPercent,
    formula: quantity > 1 ? `${formula} × ${quantity} EA` : formula,
    elementCount: quantity,
    costEstimate: {
      materialCost: Math.round(materialCost),
      laborCost: Math.round(laborCost),
      totalCost: Math.round(materialCost + laborCost),
      pricePerCY: Math.round(pricePerCY),
      regionalMultiplier: regionalMult,
    }
  };
}

// ============================================================================
// AGGREGATE / STONE VOLUME CALCULATIONS
// ============================================================================

export interface AggregateVolumeInput {
  materialType: AggregateMaterialType;
  dimensions: {
    area?: number;         // Area in SF
    length?: number;       // Length in feet
    width?: number;        // Width in feet
    thicknessInches: number; // Depth/thickness in inches
  };
  compactionFactor?: number;  // Default varies by material
  wasteFactorPercent?: number; // Default 8%
}

export type AggregateMaterialType = 
  | 'dga'             // Dense Grade Aggregate
  | 'crusher-run'     // Crusher Run
  | 'aggregate-base'  // ABC Stone
  | 'stone-57'        // #57 Stone (3/4" - 1")
  | 'stone-2'         // #2 Stone (2.5" - 3")
  | 'stone-3'         // #3 Stone (1.5" - 2.5")
  | 'pea-gravel'      // 3/8" Pea Gravel
  | 'rip-rap'         // Erosion control
  | 'topsoil'         // Topsoil
  | 'sand'            // Sand (bedding, etc.)
  | 'select-fill';    // Select/structural fill

export interface AggregateVolumeResult {
  volumeCY: number;              // Loose cubic yards
  volumeTons: number;            // Approximate tonnage
  volumeWithWasteCY: number;     // With waste factor
  areaApplied: number;           // Area in SF
  thicknessInches: number;
  formula: string;
  compactionFactor: number;      // Applied compaction
  costEstimate: {
    materialCost: number;
    laborCost: number;
    totalCost: number;
    pricePerCY: number;
    pricePerTon: number;
    regionalMultiplier: number;
  };
}

// Material densities (tons per loose CY) and compaction factors
const AGGREGATE_PROPERTIES: Record<AggregateMaterialType, { densityTonsPerCY: number; compactionFactor: number; priceKey: string }> = {
  'dga': { densityTonsPerCY: 1.4, compactionFactor: 1.10, priceKey: 'dga-by-cy' },
  'crusher-run': { densityTonsPerCY: 1.35, compactionFactor: 1.10, priceKey: 'crusher-run-by-cy' },
  'aggregate-base': { densityTonsPerCY: 1.35, compactionFactor: 1.08, priceKey: 'aggregate-base-6in' },
  'stone-57': { densityTonsPerCY: 1.3, compactionFactor: 1.02, priceKey: 'stone-57-by-cy' },
  'stone-2': { densityTonsPerCY: 1.25, compactionFactor: 1.02, priceKey: 'stone-2-by-cy' },
  'stone-3': { densityTonsPerCY: 1.28, compactionFactor: 1.02, priceKey: 'stone-3-by-cy' },
  'pea-gravel': { densityTonsPerCY: 1.35, compactionFactor: 1.05, priceKey: 'pea-gravel-by-cy' },
  'rip-rap': { densityTonsPerCY: 1.5, compactionFactor: 1.0, priceKey: 'rip-rap-by-cy' },
  'topsoil': { densityTonsPerCY: 1.1, compactionFactor: 1.15, priceKey: 'topsoil-strip' },
  'sand': { densityTonsPerCY: 1.35, compactionFactor: 1.05, priceKey: 'backfill-select' },
  'select-fill': { densityTonsPerCY: 1.4, compactionFactor: 1.12, priceKey: 'backfill-structural' },
};

/**
 * Calculate aggregate/stone volume
 */
export function calculateAggregateVolume(
  input: AggregateVolumeInput,
  region: string = 'morehead-ky'
): AggregateVolumeResult {
  const { materialType, dimensions, wasteFactorPercent = 8 } = input;
  
  // Get material properties
  const props = AGGREGATE_PROPERTIES[materialType];
  const compactionFactor = input.compactionFactor || props.compactionFactor;
  
  // Calculate area
  const area = dimensions.area || (dimensions.length || 0) * (dimensions.width || 0);
  const thicknessInches = dimensions.thicknessInches;
  const thicknessFt = thicknessInches / 12;
  
  // Volume calculations
  const volumeCF = area * thicknessFt * compactionFactor;
  const volumeCY = volumeCF / 27;
  const volumeWithWasteCY = volumeCY * (1 + wasteFactorPercent / 100);
  const volumeTons = volumeWithWasteCY * props.densityTonsPerCY;
  
  // Get pricing
  const pricing = findPriceByDivision(31, props.priceKey);
  const regionalMult = REGIONAL_MULTIPLIERS[region] || 1.0;
  
  let materialCost = 0;
  let laborCost = 0;
  let pricePerCY = 0;
  
  if (pricing) {
    if (pricing.unit === 'SF') {
      // Area-based pricing
      materialCost = pricing.materialCost * area * regionalMult;
      laborCost = pricing.laborCost * area * regionalMult;
      pricePerCY = pricing.totalInstalled * area / volumeWithWasteCY * regionalMult;
    } else {
      materialCost = pricing.materialCost * volumeWithWasteCY * regionalMult;
      laborCost = pricing.laborCost * volumeWithWasteCY * regionalMult;
      pricePerCY = pricing.totalInstalled * regionalMult;
    }
  }
  
  const formula = `${area.toLocaleString()} SF × ${thicknessInches}" × ${compactionFactor.toFixed(2)} compaction = ${volumeCY.toFixed(2)} CY`;
  
  return {
    volumeCY: Math.round(volumeCY * 100) / 100,
    volumeTons: Math.round(volumeTons * 10) / 10,
    volumeWithWasteCY: Math.round(volumeWithWasteCY * 100) / 100,
    areaApplied: area,
    thicknessInches,
    formula,
    compactionFactor,
    costEstimate: {
      materialCost: Math.round(materialCost),
      laborCost: Math.round(laborCost),
      totalCost: Math.round(materialCost + laborCost),
      pricePerCY: Math.round(pricePerCY),
      pricePerTon: props.densityTonsPerCY > 0 ? Math.round(pricePerCY / props.densityTonsPerCY) : 0,
      regionalMultiplier: regionalMult,
    }
  };
}

// ============================================================================
// BACKFILL CALCULATIONS
// ============================================================================

export interface BackfillVolumeInput {
  excavationType: 'footing' | 'trench' | 'foundation' | 'general';
  excavationVolumeCY: number;    // Original excavation volume
  concreteVolumeCY?: number;     // Concrete placed (reduces backfill)
  pipeVolumeCY?: number;         // Pipe/utility volume (reduces backfill)
  materialType: 'on-site' | 'select' | 'structural' | 'pipe-zone';
  shrinkageFactor?: number;      // Default based on material
}

export interface BackfillVolumeResult {
  backfillRequiredCY: number;    // Net backfill needed
  importRequiredCY: number;      // If on-site insufficient
  compactedVolumeCY: number;     // Final compacted volume
  formula: string;
  costEstimate: {
    backfillCost: number;
    importCost: number;
    compactionCost: number;
    totalCost: number;
    regionalMultiplier: number;
  };
}

const BACKFILL_SHRINKAGE: Record<string, number> = {
  'on-site': 0.90,      // 10% shrinkage
  'select': 0.92,       // 8% shrinkage
  'structural': 0.95,   // 5% shrinkage
  'pipe-zone': 0.95,    // 5% shrinkage
};

/**
 * Calculate backfill volume required based on excavation
 */
export function calculateBackfillVolume(
  input: BackfillVolumeInput,
  region: string = 'morehead-ky'
): BackfillVolumeResult {
  const {
    excavationVolumeCY,
    concreteVolumeCY = 0,
    pipeVolumeCY = 0,
    materialType,
  } = input;
  
  const shrinkageFactor = input.shrinkageFactor || BACKFILL_SHRINKAGE[materialType];
  
  // Net volume to fill = excavation - concrete - pipe
  const netVoidCY = excavationVolumeCY - concreteVolumeCY - pipeVolumeCY;
  
  // Account for shrinkage: need more loose material to achieve compacted volume
  const backfillRequiredCY = netVoidCY / shrinkageFactor;
  
  // Assume we can reuse 80% of on-site material for 'on-site' type
  const availableOnsiteCY = materialType === 'on-site' ? excavationVolumeCY * 0.8 : 0;
  const importRequiredCY = Math.max(0, backfillRequiredCY - availableOnsiteCY);
  
  // Final compacted volume
  const compactedVolumeCY = netVoidCY;
  
  // Get pricing
  const regionalMult = REGIONAL_MULTIPLIERS[region] || 1.0;
  let backfillPrice = findPriceByDivision(31, 'backfill-compacted');
  let importPrice = findPriceByDivision(31, 'import-fill');
  
  if (materialType === 'structural') {
    backfillPrice = findPriceByDivision(31, 'backfill-structural');
    importPrice = findPriceByDivision(31, 'import-structural-fill');
  } else if (materialType === 'pipe-zone') {
    backfillPrice = findPriceByDivision(31, 'backfill-pipe-zone');
  } else if (materialType === 'select') {
    backfillPrice = findPriceByDivision(31, 'backfill-select');
  }
  
  const backfillCost = (backfillPrice?.totalInstalled || 20) * (backfillRequiredCY - importRequiredCY) * regionalMult;
  const importCost = (importPrice?.totalInstalled || 30) * importRequiredCY * regionalMult;
  const compactionPrice = findPriceByDivision(31, 'compaction');
  // Compaction is per SF, estimate SF from CY (average 1' thick)
  const compactionSF = compactedVolumeCY * 27;
  const compactionCost = (compactionPrice?.totalInstalled || 0.50) * compactionSF * regionalMult;
  
  const formula = `(${excavationVolumeCY.toFixed(1)} CY excav - ${concreteVolumeCY.toFixed(1)} CY conc - ${pipeVolumeCY.toFixed(1)} CY pipe) ÷ ${shrinkageFactor} shrink = ${backfillRequiredCY.toFixed(1)} CY`;
  
  return {
    backfillRequiredCY: Math.round(backfillRequiredCY * 10) / 10,
    importRequiredCY: Math.round(importRequiredCY * 10) / 10,
    compactedVolumeCY: Math.round(compactedVolumeCY * 10) / 10,
    formula,
    costEstimate: {
      backfillCost: Math.round(backfillCost),
      importCost: Math.round(importCost),
      compactionCost: Math.round(compactionCost),
      totalCost: Math.round(backfillCost + importCost + compactionCost),
      regionalMultiplier: regionalMult,
    }
  };
}

// ============================================================================
// QUICK VOLUME HELPERS
// ============================================================================

/**
 * Quick slab volume calculation
 * @param areaSF - Area in square feet
 * @param thicknessInches - Thickness in inches
 * @param wastePercent - Waste factor (default 5%)
 */
export function slabVolumeCY(areaSF: number, thicknessInches: number, wastePercent: number = 5): number {
  const volumeCF = areaSF * (thicknessInches / 12);
  const volumeCY = volumeCF / 27;
  return Math.round(volumeCY * (1 + wastePercent / 100) * 100) / 100;
}

/**
 * Quick footing volume calculation
 * @param lengthFt - Footing length in feet
 * @param widthFt - Footing width in feet  
 * @param depthFt - Footing depth in feet
 * @param quantity - Number of footings
 * @param wastePercent - Waste factor (default 5%)
 */
export function footingVolumeCY(
  lengthFt: number,
  widthFt: number,
  depthFt: number,
  quantity: number = 1,
  wastePercent: number = 5
): number {
  const volumeCF = lengthFt * widthFt * depthFt * quantity;
  const volumeCY = volumeCF / 27;
  return Math.round(volumeCY * (1 + wastePercent / 100) * 100) / 100;
}

/**
 * Quick aggregate/DGA volume from area
 * @param areaSF - Area in square feet
 * @param thicknessInches - Thickness in inches
 * @param compactionFactor - Compaction factor (default 1.10 for DGA)
 * @param wastePercent - Waste factor (default 8%)
 */
export function aggregateVolumeCY(
  areaSF: number,
  thicknessInches: number,
  compactionFactor: number = 1.10,
  wastePercent: number = 8
): number {
  const volumeCF = areaSF * (thicknessInches / 12) * compactionFactor;
  const volumeCY = volumeCF / 27;
  return Math.round(volumeCY * (1 + wastePercent / 100) * 100) / 100;
}

/**
 * Estimate tonnage from cubic yards
 * @param volumeCY - Volume in cubic yards
 * @param material - Material type
 */
export function cyToTons(volumeCY: number, material: AggregateMaterialType = 'dga'): number {
  const props = AGGREGATE_PROPERTIES[material];
  return Math.round(volumeCY * props.densityTonsPerCY * 10) / 10;
}

// ============================================================================
// SUMMARY CALCULATOR
// ============================================================================

export interface VolumeSummary {
  concreteItems: Array<{ name: string; volumeCY: number; cost: number }>;
  aggregateItems: Array<{ name: string; volumeCY: number; tons: number; cost: number }>;
  earthworkItems: Array<{ name: string; volumeCY: number; cost: number }>;
  totals: {
    totalConcreteCY: number;
    totalAggregateCY: number;
    totalAggregateTons: number;
    totalBackfillCY: number;
    totalCost: number;
  };
}

/**
 * Generate a complete volume summary for all site/structural materials
 */
export function generateVolumeSummary(
  concreteInputs: Array<{ name: string; input: ConcreteVolumeInput }>,
  aggregateInputs: Array<{ name: string; input: AggregateVolumeInput }>,
  earthworkInputs: Array<{ name: string; input: BackfillVolumeInput }>,
  region: string = 'morehead-ky'
): VolumeSummary {
  const concreteItems = concreteInputs.map(item => {
    const result = calculateConcreteVolume(item.input, region);
    return {
      name: item.name,
      volumeCY: result.volumeWithWasteCY,
      cost: result.costEstimate.totalCost,
    };
  });
  
  const aggregateItems = aggregateInputs.map(item => {
    const result = calculateAggregateVolume(item.input, region);
    return {
      name: item.name,
      volumeCY: result.volumeWithWasteCY,
      tons: result.volumeTons,
      cost: result.costEstimate.totalCost,
    };
  });
  
  const earthworkItems = earthworkInputs.map(item => {
    const result = calculateBackfillVolume(item.input, region);
    return {
      name: item.name,
      volumeCY: result.backfillRequiredCY,
      cost: result.costEstimate.totalCost,
    };
  });
  
  return {
    concreteItems,
    aggregateItems,
    earthworkItems,
    totals: {
      totalConcreteCY: concreteItems.reduce((sum, i) => sum + i.volumeCY, 0),
      totalAggregateCY: aggregateItems.reduce((sum, i) => sum + i.volumeCY, 0),
      totalAggregateTons: aggregateItems.reduce((sum, i) => sum + i.tons, 0),
      totalBackfillCY: earthworkItems.reduce((sum, i) => sum + i.volumeCY, 0),
      totalCost: [
        ...concreteItems.map(i => i.cost),
        ...aggregateItems.map(i => i.cost),
        ...earthworkItems.map(i => i.cost),
      ].reduce((sum, c) => sum + c, 0),
    }
  };
}
