import { logger } from '@/lib/logger';

export interface DimensionInput {
  value: string; // "15'-6\"", "4.72m", "24'"
  context?: string;
  type?: string; // horizontal, vertical, height, thickness
}

export interface RoomInput {
  roomNumber: string;
  width?: string;
  length?: string;
  area?: string; // stated area on plans
  ceilingHeight?: string;
  floorElevation?: string;
}

export interface CalculatedQuantity {
  element: string;
  quantity: number;
  unit: string; // SF, LF, CY, EA, LBS, GAL
  category: string; // CSI division
  tradeType: string;
  dimensions?: { width?: number; length?: number; height?: number; thickness?: number };
  confidence: number;
  calculationMethod: string;
  sourceRoom?: string;
}

/**
 * Parse dimension string to feet (decimal)
 * Handles: "15'-6\"", "15.5'", "186\"", "4572mm", "4.572m"
 */
export function parseDimension(dim: string): number | null {
  if (!dim || typeof dim !== 'string') return null;

  const cleaned = dim.trim().replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");

  // Feet and inches: 15'-6", 15'-6 1/2"
  const feetInchMatch = cleaned.match(/(\d+)\s*['\u2032]\s*[-\u2013]?\s*(\d+)?\s*(?:(\d+)\s*\/\s*(\d+))?\s*["\u2033]?/);
  if (feetInchMatch) {
    const feet = parseInt(feetInchMatch[1]) || 0;
    const inches = parseInt(feetInchMatch[2]) || 0;
    const fracNum = parseInt(feetInchMatch[3]) || 0;
    const fracDen = parseInt(feetInchMatch[4]) || 1;
    return feet + (inches + fracNum / fracDen) / 12;
  }

  // Feet only: 15', 15.5'
  const feetMatch = cleaned.match(/^(\d+\.?\d*)\s*['\u2032]$/);
  if (feetMatch) return parseFloat(feetMatch[1]);

  // Inches only: 186", 6"
  const inchMatch = cleaned.match(/^(\d+\.?\d*)\s*["\u2033]$/);
  if (inchMatch) return parseFloat(inchMatch[1]) / 12;

  // Metric meters: 4.572m, 4572mm
  const mmMatch = cleaned.match(/^(\d+\.?\d*)\s*mm$/i);
  if (mmMatch) return parseFloat(mmMatch[1]) / 304.8;

  const mMatch = cleaned.match(/^(\d+\.?\d*)\s*m$/i);
  if (mMatch) return parseFloat(mMatch[1]) * 3.28084;

  // Plain number (assume feet)
  const numMatch = cleaned.match(/^(\d+\.?\d*)$/);
  if (numMatch) return parseFloat(numMatch[1]);

  return null;
}

/**
 * Calculate room area from dimensions
 */
export function calculateRoomArea(room: RoomInput): CalculatedQuantity | null {
  // If stated area exists, parse it
  if (room.area) {
    const areaMatch = room.area.match(/(\d+\.?\d*)\s*(?:SF|sq\.?\s*ft\.?|square\s*feet)/i);
    if (areaMatch) {
      return {
        element: `Room ${room.roomNumber} Floor Area`,
        quantity: parseFloat(areaMatch[1]),
        unit: 'SF',
        category: '09 00 00',
        tradeType: 'Architectural',
        confidence: 0.95,
        calculationMethod: 'stated_on_plans',
        sourceRoom: room.roomNumber,
      };
    }
  }

  // Calculate from width x length
  const width = room.width ? parseDimension(room.width) : null;
  const length = room.length ? parseDimension(room.length) : null;

  if (width && length) {
    return {
      element: `Room ${room.roomNumber} Floor Area`,
      quantity: Math.round(width * length * 100) / 100,
      unit: 'SF',
      category: '09 00 00',
      tradeType: 'Architectural',
      dimensions: { width, length },
      confidence: 0.8,
      calculationMethod: 'width_x_length',
      sourceRoom: room.roomNumber,
    };
  }

  return null;
}

/**
 * Calculate wall perimeter and area for a room
 */
export function calculateWallQuantities(room: RoomInput): CalculatedQuantity[] {
  const results: CalculatedQuantity[] = [];

  const width = room.width ? parseDimension(room.width) : null;
  const length = room.length ? parseDimension(room.length) : null;
  const height = room.ceilingHeight ? parseDimension(room.ceilingHeight) : null;

  if (width && length) {
    const perimeter = 2 * (width + length);

    results.push({
      element: `Room ${room.roomNumber} Wall Perimeter`,
      quantity: Math.round(perimeter * 100) / 100,
      unit: 'LF',
      category: '09 00 00',
      tradeType: 'Architectural',
      dimensions: { width, length },
      confidence: width && length ? 0.8 : 0.5,
      calculationMethod: '2*(w+l)',
      sourceRoom: room.roomNumber,
    });

    if (height) {
      const grossWallArea = perimeter * height;
      results.push({
        element: `Room ${room.roomNumber} Gross Wall Area`,
        quantity: Math.round(grossWallArea * 100) / 100,
        unit: 'SF',
        category: '09 00 00',
        tradeType: 'Architectural',
        dimensions: { width, length, height },
        confidence: 0.75,
        calculationMethod: 'perimeter_x_height',
        sourceRoom: room.roomNumber,
      });
    }
  }

  return results;
}

/**
 * Calculate concrete volume from footing data
 */
export function calculateFootingVolume(
  footing: { width: string; depth: string; length: string; label?: string }
): CalculatedQuantity | null {
  const w = parseDimension(footing.width);
  const d = parseDimension(footing.depth);
  const l = parseDimension(footing.length);

  if (w && d && l) {
    const volumeCF = w * d * l;
    const volumeCY = volumeCF / 27;

    return {
      element: footing.label || 'Footing',
      quantity: Math.round(volumeCY * 100) / 100,
      unit: 'CY',
      category: '03 30 00',
      tradeType: 'Concrete',
      dimensions: { width: w, length: l, height: d },
      confidence: 0.85,
      calculationMethod: 'w_x_d_x_l_div_27',
    };
  }

  return null;
}

/**
 * Calculate slab volume
 */
export function calculateSlabVolume(
  area: number, // in SF
  thickness: string,
  label?: string
): CalculatedQuantity | null {
  const t = parseDimension(thickness);
  if (!t || !area) return null;

  const volumeCF = area * t;
  const volumeCY = volumeCF / 27;

  return {
    element: label || 'Slab on Grade',
    quantity: Math.round(volumeCY * 100) / 100,
    unit: 'CY',
    category: '03 30 00',
    tradeType: 'Concrete',
    dimensions: { thickness: t },
    confidence: 0.8,
    calculationMethod: 'area_x_thickness_div_27',
  };
}

/**
 * Count fixtures by type
 */
export function countFixtures(
  fixtures: Array<{ type: string; count?: number; room?: string }>
): CalculatedQuantity[] {
  const typeCounts: Record<string, { count: number; rooms: Set<string> }> = {};

  for (const f of fixtures) {
    if (!typeCounts[f.type]) typeCounts[f.type] = { count: 0, rooms: new Set() };
    typeCounts[f.type].count += f.count || 1;
    if (f.room) typeCounts[f.type].rooms.add(f.room);
  }

  return Object.entries(typeCounts).map(([type, data]) => ({
    element: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    quantity: data.count,
    unit: 'EA',
    category: type.includes('sprinkler') ? '21 00 00' :
              type.includes('receptacle') || type.includes('switch') || type.includes('light') ? '26 00 00' :
              '22 00 00',
    tradeType: type.includes('sprinkler') ? 'Fire Protection' :
               type.includes('receptacle') || type.includes('switch') || type.includes('light') ? 'Electrical' :
               'Plumbing',
    confidence: 0.85,
    calculationMethod: 'fixture_count',
  }));
}
