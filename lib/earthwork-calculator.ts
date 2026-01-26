/**
 * Earthwork Volume Calculator
 * Calculates cut and fill volumes from elevation data using industry-standard methods:
 * - Grid Method (for regular grids)
 * - Average End Area Method (for cross-sections)
 * - Prismoidal Method (for highest accuracy)
 */

import { findPriceByDivision, REGIONAL_MULTIPLIERS } from './construction-pricing-database';

export interface ElevationPoint {
  x: number;  // Easting or X coordinate
  y: number;  // Northing or Y coordinate
  existingElev: number;  // Existing ground elevation
  proposedElev: number;  // Proposed/design elevation
}

export interface ElevationGrid {
  points: ElevationPoint[];
  gridSpacing: number;  // Grid cell size in feet
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface CrossSection {
  station: number;  // Station number (e.g., 0+00, 1+00)
  cutArea: number;  // Cut area in SF
  fillArea: number; // Fill area in SF
}

export interface EarthworkResult {
  cutVolumeCY: number;      // Cut volume in cubic yards
  fillVolumeCY: number;     // Fill volume in cubic yards
  netVolumeCY: number;      // Net volume (+ = export, - = import)
  cutAreaSF: number;        // Total cut area in square feet
  fillAreaSF: number;       // Total fill area in square feet
  balancePoint: string;     // Description of earthwork balance
  shrinkageFactor: number;  // Applied shrinkage factor
  swellFactor: number;      // Applied swell factor
  adjustedCutCY: number;    // Cut adjusted for shrinkage
  adjustedFillCY: number;   // Fill adjusted for swell
  method: 'grid' | 'average-end-area' | 'prismoidal';
  costEstimate: EarthworkCostEstimate;
}

export interface EarthworkCostEstimate {
  excavationCost: number;   // Cost to excavate (cut)
  fillCost: number;         // Cost to place fill
  compactionCost: number;   // Cost to compact
  importCost: number;       // Cost to import material (if needed)
  exportCost: number;       // Cost to export/haul away (if needed)
  gradingCost: number;      // Fine grading cost
  totalCost: number;        // Total earthwork cost
  laborHours: number;       // Estimated labor hours
  regionalMultiplier: number;
  breakdown: {
    item: string;
    quantity: number;
    unit: string;
    unitCost: number;
    total: number;
  }[];
}

// Default factors for different soil types
export const SOIL_FACTORS = {
  'clay': { shrinkage: 0.90, swell: 1.30 },
  'sand': { shrinkage: 0.95, swell: 1.15 },
  'gravel': { shrinkage: 0.95, swell: 1.12 },
  'topsoil': { shrinkage: 0.90, swell: 1.25 },
  'rock': { shrinkage: 1.00, swell: 1.50 },
  'mixed': { shrinkage: 0.92, swell: 1.20 },
} as const;

export type SoilType = keyof typeof SOIL_FACTORS;

/**
 * Calculate earthwork volumes using the Grid Method
 * Best for: Irregular sites, digital terrain models
 */
export function calculateGridMethod(
  grid: ElevationGrid,
  soilType: SoilType = 'mixed'
): EarthworkResult {
  let totalCutCF = 0;  // Cubic feet
  let totalFillCF = 0;
  let cutAreaSF = 0;
  let fillAreaSF = 0;
  
  const cellArea = grid.gridSpacing * grid.gridSpacing;  // Area per grid cell in SF
  
  for (const point of grid.points) {
    const diff = point.existingElev - point.proposedElev;
    
    if (diff > 0) {
      // Cut needed (existing is higher than proposed)
      totalCutCF += diff * cellArea;
      cutAreaSF += cellArea;
    } else if (diff < 0) {
      // Fill needed (existing is lower than proposed)
      totalFillCF += Math.abs(diff) * cellArea;
      fillAreaSF += cellArea;
    }
  }
  
  // Convert to cubic yards (27 CF = 1 CY)
  const cutVolumeCY = totalCutCF / 27;
  const fillVolumeCY = totalFillCF / 27;
  
  return applyFactorsAndCalculateCost(
    cutVolumeCY,
    fillVolumeCY,
    cutAreaSF,
    fillAreaSF,
    soilType,
    'grid'
  );
}

/**
 * Calculate earthwork volumes using Average End Area Method
 * Best for: Linear projects (roads, channels), cross-section based surveys
 */
export function calculateAverageEndArea(
  sections: CrossSection[],
  soilType: SoilType = 'mixed'
): EarthworkResult {
  let totalCutCF = 0;
  let totalFillCF = 0;
  let totalCutAreaSF = 0;
  let totalFillAreaSF = 0;
  
  // Sort sections by station
  const sortedSections = [...sections].sort((a, b) => a.station - b.station);
  
  for (let i = 0; i < sortedSections.length - 1; i++) {
    const section1 = sortedSections[i];
    const section2 = sortedSections[i + 1];
    
    // Distance between stations in feet
    const distance = (section2.station - section1.station) * 100; // Assuming station format like 1+00 = 100ft
    
    // Average End Area formula: V = (A1 + A2) / 2 * L
    const avgCutArea = (section1.cutArea + section2.cutArea) / 2;
    const avgFillArea = (section1.fillArea + section2.fillArea) / 2;
    
    totalCutCF += avgCutArea * distance;
    totalFillCF += avgFillArea * distance;
    
    totalCutAreaSF += section1.cutArea;
    totalFillAreaSF += section1.fillArea;
  }
  
  // Add last section areas
  if (sortedSections.length > 0) {
    totalCutAreaSF += sortedSections[sortedSections.length - 1].cutArea;
    totalFillAreaSF += sortedSections[sortedSections.length - 1].fillArea;
  }
  
  const cutVolumeCY = totalCutCF / 27;
  const fillVolumeCY = totalFillCF / 27;
  
  return applyFactorsAndCalculateCost(
    cutVolumeCY,
    fillVolumeCY,
    totalCutAreaSF,
    totalFillAreaSF,
    soilType,
    'average-end-area'
  );
}

/**
 * Calculate earthwork from simple area and depth inputs
 * For quick estimates when detailed survey data isn't available
 */
export function calculateSimpleVolume(
  areaSF: number,
  avgCutDepthFt: number,
  avgFillDepthFt: number,
  soilType: SoilType = 'mixed'
): EarthworkResult {
  const cutVolumeCF = areaSF * avgCutDepthFt;
  const fillVolumeCF = areaSF * avgFillDepthFt;
  
  const cutVolumeCY = cutVolumeCF / 27;
  const fillVolumeCY = fillVolumeCF / 27;
  
  const cutAreaSF = avgCutDepthFt > 0 ? areaSF : 0;
  const fillAreaSF = avgFillDepthFt > 0 ? areaSF : 0;
  
  return applyFactorsAndCalculateCost(
    cutVolumeCY,
    fillVolumeCY,
    cutAreaSF,
    fillAreaSF,
    soilType,
    'grid'
  );
}

/**
 * Apply shrinkage/swell factors and calculate costs
 */
function applyFactorsAndCalculateCost(
  cutVolumeCY: number,
  fillVolumeCY: number,
  cutAreaSF: number,
  fillAreaSF: number,
  soilType: SoilType,
  method: 'grid' | 'average-end-area' | 'prismoidal'
): EarthworkResult {
  const factors = SOIL_FACTORS[soilType];
  
  // Apply shrinkage to cut (compacted volume is less than loose)
  const adjustedCutCY = cutVolumeCY * factors.shrinkage;
  
  // Apply swell to fill requirements (need more material due to swell)
  const adjustedFillCY = fillVolumeCY * factors.swell;
  
  // Net volume (positive = export excess, negative = need import)
  const netVolumeCY = adjustedCutCY - adjustedFillCY;
  
  // Determine balance description
  let balancePoint: string;
  if (Math.abs(netVolumeCY) < 50) {
    balancePoint = 'Site is balanced - minimal import/export needed';
  } else if (netVolumeCY > 0) {
    balancePoint = `Export ${netVolumeCY.toFixed(0)} CY of excess material`;
  } else {
    balancePoint = `Import ${Math.abs(netVolumeCY).toFixed(0)} CY of fill material`;
  }
  
  // Calculate costs
  const costEstimate = calculateEarthworkCosts(
    cutVolumeCY,
    fillVolumeCY,
    adjustedCutCY,
    adjustedFillCY,
    cutAreaSF + fillAreaSF
  );
  
  return {
    cutVolumeCY: Math.round(cutVolumeCY * 10) / 10,
    fillVolumeCY: Math.round(fillVolumeCY * 10) / 10,
    netVolumeCY: Math.round(netVolumeCY * 10) / 10,
    cutAreaSF: Math.round(cutAreaSF),
    fillAreaSF: Math.round(fillAreaSF),
    balancePoint,
    shrinkageFactor: factors.shrinkage,
    swellFactor: factors.swell,
    adjustedCutCY: Math.round(adjustedCutCY * 10) / 10,
    adjustedFillCY: Math.round(adjustedFillCY * 10) / 10,
    method,
    costEstimate,
  };
}

/**
 * Calculate earthwork costs using CSI Division 31 pricing
 */
function calculateEarthworkCosts(
  cutVolumeCY: number,
  fillVolumeCY: number,
  adjustedCutCY: number,
  adjustedFillCY: number,
  totalAreaSF: number,
  region: string = 'KY-Morehead'
): EarthworkCostEstimate {
  // Get regional multiplier (default to 0.86 for Kentucky)
  const regionalMultiplier = REGIONAL_MULTIPLIERS[region] || REGIONAL_MULTIPLIERS['KY'] || 0.86;
  
  const breakdown: EarthworkCostEstimate['breakdown'] = [];
  let totalCost = 0;
  let totalLaborHours = 0;
  
  // Define earthwork pricing (CSI Division 31)
  const earthworkPrices = {
    'excavation-bulk': { totalInstalled: 8.00, laborHoursPerUnit: 0.11, unit: 'CY' },
    'backfill-compacted': { totalInstalled: 20.00, laborHoursPerUnit: 0.11, unit: 'CY' },
    'grading-fine': { totalInstalled: 1.00, laborHoursPerUnit: 0.011, unit: 'SF' },
    'compaction': { totalInstalled: 0.50, laborHoursPerUnit: 0.005, unit: 'SF' },
  };
  
  // Excavation (bulk) - CSI 31 23 16
  const excavationPrice = earthworkPrices['excavation-bulk'];
  if (cutVolumeCY > 0) {
    const cost = cutVolumeCY * excavationPrice.totalInstalled * regionalMultiplier;
    const hours = cutVolumeCY * excavationPrice.laborHoursPerUnit;
    breakdown.push({
      item: 'Bulk Excavation',
      quantity: Math.round(cutVolumeCY),
      unit: 'CY',
      unitCost: excavationPrice.totalInstalled * regionalMultiplier,
      total: cost,
    });
    totalCost += cost;
    totalLaborHours += hours;
  }
  
  // Backfill (compacted) - CSI 31 23 23
  const backfillPrice = earthworkPrices['backfill-compacted'];
  if (fillVolumeCY > 0) {
    const cost = fillVolumeCY * backfillPrice.totalInstalled * regionalMultiplier;
    const hours = fillVolumeCY * backfillPrice.laborHoursPerUnit;
    breakdown.push({
      item: 'Compacted Backfill',
      quantity: Math.round(fillVolumeCY),
      unit: 'CY',
      unitCost: backfillPrice.totalInstalled * regionalMultiplier,
      total: cost,
    });
    totalCost += cost;
    totalLaborHours += hours;
  }
  
  // Fine grading - CSI 31 22 13
  const gradingPrice = earthworkPrices['grading-fine'];
  if (totalAreaSF > 0) {
    const cost = totalAreaSF * gradingPrice.totalInstalled * regionalMultiplier;
    const hours = totalAreaSF * gradingPrice.laborHoursPerUnit;
    breakdown.push({
      item: 'Fine Grading',
      quantity: Math.round(totalAreaSF),
      unit: 'SF',
      unitCost: gradingPrice.totalInstalled * regionalMultiplier,
      total: cost,
    });
    totalCost += cost;
    totalLaborHours += hours;
  }
  
  // Compaction - CSI 31 23 23.13
  const compactionPrice = earthworkPrices['compaction'];
  if (totalAreaSF > 0) {
    const cost = totalAreaSF * compactionPrice.totalInstalled * regionalMultiplier;
    const hours = totalAreaSF * compactionPrice.laborHoursPerUnit;
    breakdown.push({
      item: 'Compaction',
      quantity: Math.round(totalAreaSF),
      unit: 'SF',
      unitCost: compactionPrice.totalInstalled * regionalMultiplier,
      total: cost,
    });
    totalCost += cost;
    totalLaborHours += hours;
  }
  
  // Import/Export costs (if unbalanced)
  const netVolume = adjustedCutCY - adjustedFillCY;
  const haulCostPerCY = 12.50 * regionalMultiplier; // Average haul cost
  
  let importCost = 0;
  let exportCost = 0;
  
  if (netVolume < -50) {
    // Need to import fill
    const importQty = Math.abs(netVolume);
    importCost = importQty * (haulCostPerCY + 18); // Haul + material cost
    breakdown.push({
      item: 'Import Fill Material',
      quantity: Math.round(importQty),
      unit: 'CY',
      unitCost: haulCostPerCY + 18,
      total: importCost,
    });
    totalCost += importCost;
    totalLaborHours += importQty * 0.05;
  } else if (netVolume > 50) {
    // Need to export excess
    exportCost = netVolume * haulCostPerCY;
    breakdown.push({
      item: 'Export Excess Material',
      quantity: Math.round(netVolume),
      unit: 'CY',
      unitCost: haulCostPerCY,
      total: exportCost,
    });
    totalCost += exportCost;
    totalLaborHours += netVolume * 0.03;
  }
  
  return {
    excavationCost: breakdown.find(b => b.item === 'Bulk Excavation')?.total || 0,
    fillCost: breakdown.find(b => b.item === 'Compacted Backfill')?.total || 0,
    compactionCost: breakdown.find(b => b.item === 'Compaction')?.total || 0,
    importCost,
    exportCost,
    gradingCost: breakdown.find(b => b.item === 'Fine Grading')?.total || 0,
    totalCost: Math.round(totalCost * 100) / 100,
    laborHours: Math.round(totalLaborHours * 10) / 10,
    regionalMultiplier,
    breakdown,
  };
}

/**
 * Parse elevation data from extracted text/numbers
 */
export function parseElevationData(
  existingElevations: { x: number; y: number; elev: number }[],
  proposedElevations: { x: number; y: number; elev: number }[],
  gridSpacing: number = 25  // Default 25ft grid
): ElevationGrid | null {
  if (existingElevations.length === 0 || proposedElevations.length === 0) {
    return null;
  }
  
  // Find bounds
  const allPoints = [...existingElevations, ...proposedElevations];
  const minX = Math.min(...allPoints.map(p => p.x));
  const maxX = Math.max(...allPoints.map(p => p.x));
  const minY = Math.min(...allPoints.map(p => p.y));
  const maxY = Math.max(...allPoints.map(p => p.y));
  
  // Create interpolated grid
  const points: ElevationPoint[] = [];
  
  for (let x = minX; x <= maxX; x += gridSpacing) {
    for (let y = minY; y <= maxY; y += gridSpacing) {
      const existingElev = interpolateElevation(x, y, existingElevations);
      const proposedElev = interpolateElevation(x, y, proposedElevations);
      
      if (existingElev !== null && proposedElev !== null) {
        points.push({ x, y, existingElev, proposedElev });
      }
    }
  }
  
  if (points.length === 0) {
    return null;
  }
  
  return {
    points,
    gridSpacing,
    bounds: { minX, maxX, minY, maxY },
  };
}

/**
 * Inverse Distance Weighting interpolation for elevation
 */
function interpolateElevation(
  x: number,
  y: number,
  points: { x: number; y: number; elev: number }[],
  power: number = 2,
  maxDistance: number = 100
): number | null {
  let weightSum = 0;
  let valueSum = 0;
  let hasNearbyPoints = false;
  
  for (const point of points) {
    const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
    
    if (distance < 0.001) {
      // Exact match
      return point.elev;
    }
    
    if (distance <= maxDistance) {
      hasNearbyPoints = true;
      const weight = 1 / Math.pow(distance, power);
      weightSum += weight;
      valueSum += weight * point.elev;
    }
  }
  
  if (!hasNearbyPoints || weightSum === 0) {
    return null;
  }
  
  return valueSum / weightSum;
}

/**
 * Generate summary report for earthwork
 */
export function generateEarthworkReport(result: EarthworkResult): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════',
    '           EARTHWORK VOLUME CALCULATION REPORT',
    '═══════════════════════════════════════════════════════',
    '',
    `Calculation Method: ${result.method.toUpperCase().replace('-', ' ')}`,
    '',
    '─── VOLUMES ───',
    `Cut Volume:      ${result.cutVolumeCY.toLocaleString()} CY`,
    `Fill Volume:     ${result.fillVolumeCY.toLocaleString()} CY`,
    `Net Volume:      ${result.netVolumeCY.toLocaleString()} CY`,
    '',
    '─── ADJUSTED VOLUMES (with soil factors) ───',
    `Shrinkage Factor:    ${(result.shrinkageFactor * 100).toFixed(0)}%`,
    `Swell Factor:        ${(result.swellFactor * 100).toFixed(0)}%`,
    `Adjusted Cut:        ${result.adjustedCutCY.toLocaleString()} CY`,
    `Adjusted Fill:       ${result.adjustedFillCY.toLocaleString()} CY`,
    '',
    '─── AREAS ───',
    `Cut Area:        ${result.cutAreaSF.toLocaleString()} SF`,
    `Fill Area:       ${result.fillAreaSF.toLocaleString()} SF`,
    '',
    '─── BALANCE ───',
    result.balancePoint,
    '',
    '─── COST ESTIMATE ───',
    `Regional Multiplier: ${result.costEstimate.regionalMultiplier}x`,
    '',
  ];
  
  // Add breakdown
  for (const item of result.costEstimate.breakdown) {
    lines.push(
      `${item.item.padEnd(25)} ${item.quantity.toLocaleString().padStart(8)} ${item.unit.padEnd(4)} @ $${item.unitCost.toFixed(2).padStart(7)} = $${item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(12)}`
    );
  }
  
  lines.push(
    '',
    '─────────────────────────────────────────────────────',
    `TOTAL EARTHWORK COST:  $${result.costEstimate.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `ESTIMATED LABOR HOURS: ${result.costEstimate.laborHours.toLocaleString()} hrs`,
    '═══════════════════════════════════════════════════════',
  );
  
  return lines.join('\n');
}
