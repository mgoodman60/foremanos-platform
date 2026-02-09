/**
 * Unit normalization and conversion for sitework quantities
 */

export interface UnitConversion {
  from: string;
  to: string;
  factor: number;
}

export const SITEWORK_UNIT_CONVERSIONS: UnitConversion[] = [
  { from: 'SF', to: 'SY', factor: 1/9 },
  { from: 'SY', to: 'SF', factor: 9 },
  { from: 'SF', to: 'AC', factor: 1/43560 },
  { from: 'AC', to: 'SF', factor: 43560 },
  { from: 'SY', to: 'AC', factor: 1/4840 },
  { from: 'AC', to: 'SY', factor: 4840 },
  { from: 'CF', to: 'CY', factor: 1/27 },
  { from: 'CY', to: 'CF', factor: 27 },
  { from: 'CY', to: 'TON', factor: 1.35 },
  { from: 'TON', to: 'CY', factor: 0.74 },
];

export function normalizeUnit(unit: string): string {
  const normalized: Record<string, string> = {
    'square feet': 'SF', 'sq ft': 'SF', 'sqft': 'SF', 's.f.': 'SF', 'sq. ft.': 'SF',
    'square yards': 'SY', 'sq yd': 'SY', 'sqyd': 'SY', 's.y.': 'SY',
    'acres': 'AC', 'acre': 'AC', 'ac': 'AC',
    'linear feet': 'LF', 'lin ft': 'LF', 'l.f.': 'LF', 'lin. ft.': 'LF', 'feet': 'LF',
    'cubic yards': 'CY', 'cu yd': 'CY', 'cuyd': 'CY', 'c.y.': 'CY', 'cu. yd.': 'CY',
    'cubic feet': 'CF', 'cu ft': 'CF', 'cuft': 'CF', 'c.f.': 'CF',
    'each': 'EA', 'ea': 'EA', 'no.': 'EA', 'qty': 'EA',
    'tons': 'TON', 'ton': 'TON', 't': 'TON',
    'pounds': 'LBS', 'lbs': 'LBS', 'lb': 'LBS',
    'gallons': 'GAL', 'gal': 'GAL', 'g': 'GAL',
  };
  const lower = unit.toLowerCase().trim();
  return normalized[lower] || unit.toUpperCase();
}

export function convertUnits(
  quantity: number, fromUnit: string, toUnit: string
): { quantity: number; unit: string } | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return { quantity, unit: to };
  const conversion = SITEWORK_UNIT_CONVERSIONS.find(c => c.from === from && c.to === to);
  if (!conversion) return null;
  return { quantity: Math.round(quantity * conversion.factor * 100) / 100, unit: to };
}

export function getStandardUnit(itemKey: string): string {
  if (itemKey.includes('excavation') || itemKey.includes('fill') || itemKey.includes('backfill')) return 'CY';
  if (itemKey.includes('grading') || itemKey.includes('compaction') || itemKey.includes('geotextile')) return 'SF';
  if (itemKey.includes('asphalt') || itemKey.includes('concrete-sidewalk') || itemKey.includes('concrete-parking')) return 'SF';
  if (itemKey.includes('curb') || itemKey.includes('striping') || itemKey.includes('marking')) return 'LF';
  if (itemKey.includes('pipe') || itemKey.includes('main') || itemKey.includes('conduit')) return 'LF';
  if (itemKey.includes('manhole') || itemKey.includes('hydrant') || itemKey.includes('catch-basin') || itemKey.includes('valve')) return 'EA';
  return 'EA';
}
