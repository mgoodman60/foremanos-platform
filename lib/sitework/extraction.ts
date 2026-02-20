/**
 * Core sitework extraction logic - drawing-type-specific data extraction
 */

import { normalizeUnit } from './unit-conversion';
import { ALL_SITEWORK_PATTERNS } from './patterns';
import type { DrawingType } from './drawing-classification';

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
      results.push(...extractGeneralSiteworkData(content, metadata));
  }

  return results;
}

function extractGradingData(content: string, metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];

  const spotElevPattern = /(?:spot\s*elev(?:ation)?|SE)\s*[=:]?\s*([\d.]+)/gi;
  let elevMatch;
  const elevations: number[] = [];
  while ((elevMatch = spotElevPattern.exec(content)) !== null) {
    elevations.push(parseFloat(elevMatch[1]));
  }

  if (metadata?.existingElevations && metadata?.proposedElevations) {
    const existing = metadata.existingElevations;
    const proposed = metadata.proposedElevations;
    const avgExisting = existing.reduce((a: number, b: number) => a + b, 0) / existing.length;
    const avgProposed = proposed.reduce((a: number, b: number) => a + b, 0) / proposed.length;
    const difference = avgProposed - avgExisting;

    if (Math.abs(difference) > 0.1) {
      results.push({
        itemName: difference > 0 ? 'Fill Required' : 'Cut Required',
        description: `Average elevation change: ${Math.abs(difference).toFixed(2)} ft`,
        quantity: 0,
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

  const contourPattern = /(?:contour|elev)\s*([\d.]+)/gi;
  const contours: number[] = [];
  let contourMatch;
  while ((contourMatch = contourPattern.exec(content)) !== null) {
    contours.push(parseFloat(contourMatch[1]));
  }

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

function extractUtilityData(content: string, _metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];

  const pipePattern = /(\d+)["']?\s*(PVC|RCP|HDPE|DIP|CIP|VCP|PE|PP|ABS)\s*(?:SDR\d+|C900|C905)?\s*(?:@\s*([\d.]+)%)?/gi;
  let pipeMatch;
  while ((pipeMatch = pipePattern.exec(content)) !== null) {
    const diameter = parseInt(pipeMatch[1]);
    const material = pipeMatch[2].toUpperCase();
    const slope = pipeMatch[3] ? parseFloat(pipeMatch[3]) : null;

    const isStorm = content.toLowerCase().includes('storm') || content.toLowerCase().includes('rcp');
    const isWater = content.toLowerCase().includes('water') || material === 'DIP';

    let itemKey = 'storm-pipe-12';
    const category = 'utilities';

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
      quantity: 0,
      unit: 'LF',
      division: 33,
      category,
      itemKey,
      confidence: 80,
      source: 'pattern_match'
    });
  }

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

function extractLandscapeData(content: string, _metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];

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

function extractPavingData(content: string, _metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];

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

function extractErosionControlData(content: string, _metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];

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

function extractStormwaterData(content: string, _metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];

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

function extractGeneralSiteworkData(content: string, _metadata: any): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];

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

export function consolidateResults(items: SiteworkExtractionResult[]): SiteworkExtractionResult[] {
  const consolidated = new Map<string, SiteworkExtractionResult>();

  for (const item of items) {
    const key = `${item.itemKey}-${item.unit}`;

    if (consolidated.has(key)) {
      const existing = consolidated.get(key)!;
      existing.quantity += item.quantity;
      existing.confidence = Math.round((existing.confidence + item.confidence) / 2);
      if (!existing.source.includes(item.source)) {
        existing.source += `, ${item.source}`;
      }
    } else {
      consolidated.set(key, { ...item });
    }
  }

  return Array.from(consolidated.values());
}
