/**
 * Geotechnical data extraction and takeoff adjustment
 */

import { calculateAggregateVolume } from './quantity-derivation';
import type { SiteworkExtractionResult } from './extraction';

export interface GeotechData {
  soilBearingCapacity?: number;
  soilType?: string;
  waterTableDepth?: number;
  frostDepth?: number;
  requiredSubbaseDepth?: number;
  compactionRequirement?: number;
  dewateringRequired?: boolean;
  rockEncountered?: boolean;
  rockDepth?: number;
  recommendations?: string[];
}

export function extractGeotechData(content: string): GeotechData {
  const data: GeotechData = {};
  const bearingMatch = content.match(/(?:bearing\s*capacity|allowable\s*bearing)\s*[:\-]?\s*([\d,]+)\s*(?:PSF|psf|pounds?\s*per\s*square\s*foot)/i);
  if (bearingMatch) data.soilBearingCapacity = parseFloat(bearingMatch[1].replace(/,/g, ''));
  const soilMatch = content.match(/(?:soil\s*classification|USCS)\s*[:\-]?\s*(CL|CH|ML|MH|SC|SM|SP|SW|GP|GW|GM|GC)/i);
  if (soilMatch) data.soilType = soilMatch[1].toUpperCase();
  const waterMatch = content.match(/(?:water\s*table|groundwater)\s*(?:encountered\s*)?(?:at)?\s*([\d.]+)\s*(?:feet|ft|')/i);
  if (waterMatch) { data.waterTableDepth = parseFloat(waterMatch[1]); data.dewateringRequired = data.waterTableDepth < 8; }
  const frostMatch = content.match(/frost\s*(?:depth|line)\s*[:\-]?\s*(\d+)\s*(?:inches?|in|"|')/i);
  if (frostMatch) data.frostDepth = parseInt(frostMatch[1]);
  const compactionMatch = content.match(/(\d{2,3})%\s*(?:of\s*)?(?:maximum\s*dry\s*density|proctor|compaction)/i);
  if (compactionMatch) data.compactionRequirement = parseInt(compactionMatch[1]);
  const rockMatch = content.match(/rock\s*(?:encountered|found)\s*(?:at)?\s*([\d.]+)\s*(?:feet|ft|')/i);
  if (rockMatch) { data.rockEncountered = true; data.rockDepth = parseFloat(rockMatch[1]); }
  const subbaseMatch = content.match(/(?:subbase|base\s*course)\s*(?:thickness)?\s*[:\-]?\s*(\d+)\s*(?:inches?|in|")/i);
  if (subbaseMatch) data.requiredSubbaseDepth = parseInt(subbaseMatch[1]);
  return data;
}

export function adjustForGeotechConditions(
  items: SiteworkExtractionResult[], geotech: GeotechData
): SiteworkExtractionResult[] {
  const adjusted = [...items];
  if (geotech.rockEncountered && geotech.rockDepth) {
    const rockExcavation = items.find(i => i.itemKey.includes('excavation'));
    if (rockExcavation) {
      adjusted.push({
        itemName: 'Rock Excavation Allowance',
        description: `Rock encountered at ${geotech.rockDepth}' - mechanical removal`,
        quantity: Math.round(rockExcavation.quantity * 0.2), unit: 'CY', division: 31,
        category: 'earthwork', itemKey: 'excavation-rock-mechanical',
        confidence: 65, source: 'geotech_adjustment', derivedFrom: 'geotech_report'
      });
    }
  }
  if (geotech.dewateringRequired) {
    adjusted.push({
      itemName: 'Dewatering Allowance',
      description: `Water table at ${geotech.waterTableDepth}' - dewatering required`,
      quantity: 1, unit: 'LS', division: 31, category: 'earthwork',
      itemKey: 'temporary-dewatering', confidence: 60, source: 'geotech_adjustment'
    });
  }
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
          quantity: subbaseQty.quantity, unit: subbaseQty.unit, division: 31,
          category: 'earthwork', itemKey: `aggregate-base-${geotech.requiredSubbaseDepth}in`,
          confidence: 75, source: 'geotech_adjustment', derivedFrom: 'geotech_report'
        });
      }
    }
  }
  return adjusted;
}
