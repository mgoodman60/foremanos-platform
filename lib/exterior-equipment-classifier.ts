/**
 * Exterior Equipment Classifier
 * Identifies exterior/site MEP equipment to prevent incorrect assignment
 * to interior rooms in the Room Browser.
 */

import { logger } from '@/lib/logger';

/** Keywords that indicate exterior/site locations */
export const EXTERIOR_LOCATION_KEYWORDS = [
  'parking', 'exterior', 'site', 'roof', 'outdoor', 'perimeter', 'lot',
  'sidewalk', 'entrance', 'loading dock', 'dumpster', 'canopy', 'covered walk',
  'drive', 'courtyard', 'garden', 'patio', 'terrace', 'balcony', 'plaza',
  'grade', 'yard', 'bollard', 'pole', 'landscape',
];

/** Equipment item keys known to be exterior */
export const EXTERIOR_EQUIPMENT_ITEM_KEYS = [
  'exterior_light', 'wall_pack_led', 'wall_pack_full_cutoff',
  'pole_light', 'pole_light_20ft', 'pole_light_25ft', 'pole_light_30ft',
  'bollard_light', 'flood_light', 'canopy_light', 'hose_bibb',
  'site-light-pole', 'conduit-site-lighting', 'light-fixture-wall-pack',
];

/**
 * Check if a location string contains exterior/site keywords.
 * Case-insensitive.
 */
export function isExteriorLocation(locationStr: string): boolean {
  if (!locationStr) return false;
  const lower = locationStr.toLowerCase();
  return EXTERIOR_LOCATION_KEYWORDS.some(keyword => lower.includes(keyword));
}

/** Description phrases that reliably indicate exterior equipment */
const EXTERIOR_DESCRIPTION_PHRASES = [
  'parking', 'exterior', 'site', 'roof', 'outdoor', 'perimeter',
  'sidewalk', 'loading dock', 'dumpster', 'canopy',
  'courtyard', 'garden', 'patio', 'terrace', 'balcony', 'plaza',
  'landscape', 'bollard', 'wall pack', 'flood light',
  'pole light', 'pole mount',
];

/**
 * Check if an equipment item is exterior by item key or description.
 */
export function isExteriorEquipment(itemKey: string, description: string): boolean {
  if (!itemKey && !description) return false;
  const lowerKey = (itemKey || '').toLowerCase();
  const lowerDesc = (description || '').toLowerCase();

  if (EXTERIOR_EQUIPMENT_ITEM_KEYS.some(key => lowerKey === key || lowerKey.includes(key))) {
    return true;
  }

  return EXTERIOR_DESCRIPTION_PHRASES.some(phrase => lowerDesc.includes(phrase));
}

/** Roof-specific keywords for finer classification */
const ROOF_KEYWORDS = ['roof', 'rooftop'];
/** Site-specific keywords for finer classification */
const SITE_KEYWORDS = ['site', 'parking', 'lot', 'drive', 'sidewalk', 'grade', 'landscape', 'yard'];

/**
 * Classify a room/location string as interior, exterior, site, roof, or unknown.
 *
 * - null/empty room => 'unknown'
 * - room contains roof keywords => 'roof'
 * - room contains site keywords => 'site'
 * - room contains other exterior keywords => 'exterior'
 * - numeric room number BUT known-exterior equipment type => 'exterior'
 * - otherwise => 'interior'
 */
export function classifyLocation(
  room: string | null | undefined,
  equipmentType?: string,
): 'interior' | 'exterior' | 'site' | 'roof' | 'unknown' {
  if (!room || room.trim() === '') return 'unknown';

  const lower = room.toLowerCase();

  // Check roof first (more specific)
  if (ROOF_KEYWORDS.some(kw => lower.includes(kw))) return 'roof';

  // Check site keywords
  if (SITE_KEYWORDS.some(kw => lower.includes(kw))) return 'site';

  // Check remaining exterior keywords
  if (EXTERIOR_LOCATION_KEYWORDS.some(kw => lower.includes(kw))) return 'exterior';

  // If room is a numeric room number but equipment type is known-exterior, classify as exterior
  if (equipmentType) {
    const lowerType = equipmentType.toLowerCase();
    if (EXTERIOR_EQUIPMENT_ITEM_KEYS.some(key => lowerType === key || lowerType.includes(key))) {
      logger.info('EXTERIOR_CLASSIFIER', 'Exterior equipment in numeric room override', { room, equipmentType });
      return 'exterior';
    }
  }

  return 'interior';
}
