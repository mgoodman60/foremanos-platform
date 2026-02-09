/**
 * Automatic Takeoff Calculator
 * Calculates material quantities from room dimensions and finish schedules
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Standard assumptions for calculations
const DEFAULTS = {
  CEILING_HEIGHT: 9, // feet
  FLOORING_WASTE_FACTOR: 1.10, // 10% waste
  WALL_WASTE_FACTOR: 1.15, // 15% waste
  CEILING_WASTE_FACTOR: 1.10, // 10% waste
  BASE_WASTE_FACTOR: 1.05, // 5% waste
};

export interface TakeoffCalculation {
  roomId: string;
  roomNumber: string;
  roomName: string;
  category: string; // 'flooring', 'walls', 'ceiling', 'base'
  material: string;
  quantity: number;
  unit: string; // 'SF' or 'LF'
  location: string;
  notes?: string;
}

export interface TakeoffSummary {
  category: string;
  material: string;
  totalQuantity: number;
  unit: string;
  roomCount: number;
  rooms: string[]; // room numbers
}

/**
 * Calculate perimeter from area (assumes rectangular room)
 * Formula: P ≈ 2 * sqrt(4 * A) for square, adjusted for typical aspect ratios
 */
function estimatePerimeter(area: number): number {
  // Assume 1.5:1 aspect ratio (typical room)
  const width = Math.sqrt(area / 1.5);
  const length = width * 1.5;
  return 2 * (width + length);
}

/**
 * Calculate wall area from floor area and ceiling height
 */
function calculateWallArea(floorArea: number, ceilingHeight: number = DEFAULTS.CEILING_HEIGHT): number {
  const perimeter = estimatePerimeter(floorArea);
  return perimeter * ceilingHeight;
}

/**
 * Generate takeoff calculations for a single room
 */
export async function calculateRoomTakeoffs(
  roomId: string,
  ceilingHeight: number = DEFAULTS.CEILING_HEIGHT
): Promise<TakeoffCalculation[]> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      FinishScheduleItem: true,
    },
  });

  if (!room) {
    throw new Error(`Room ${roomId} not found`);
  }

  if (!room.area || room.area <= 0) {
    throw new Error(`Room ${room.roomNumber} has no area defined`);
  }

  const calculations: TakeoffCalculation[] = [];
  const location = `${room.roomNumber || 'N/A'} - ${room.name}`;

  // Group finish items by category
  const finishMap = new Map<string, typeof room.FinishScheduleItem[0]>();
  room.FinishScheduleItem.forEach((item: typeof room.FinishScheduleItem[0]) => {
    finishMap.set(item.category.toLowerCase(), item);
  });

  // FLOORING
  const flooringItem = finishMap.get('flooring') || finishMap.get('floor');
  if (flooringItem && flooringItem.material) {
    const quantity = room.area * DEFAULTS.FLOORING_WASTE_FACTOR;
    calculations.push({
      roomId: room.id,
      roomNumber: room.roomNumber || 'N/A',
      roomName: room.name,
      category: 'Flooring',
      material: flooringItem.material,
      quantity: Math.ceil(quantity), // Round up
      unit: 'SF',
      location,
      notes: flooringItem.finishType ? `Type: ${flooringItem.finishType}` : undefined,
    });
  }

  // CEILING
  const ceilingItem = finishMap.get('ceiling');
  if (ceilingItem && ceilingItem.material) {
    const quantity = room.area * DEFAULTS.CEILING_WASTE_FACTOR;
    calculations.push({
      roomId: room.id,
      roomNumber: room.roomNumber || 'N/A',
      roomName: room.name,
      category: 'Ceiling',
      material: ceilingItem.material,
      quantity: Math.ceil(quantity),
      unit: 'SF',
      location,
      notes: ceilingItem.finishType ? `Type: ${ceilingItem.finishType}` : undefined,
    });
  }

  // WALLS
  const wallsItem = finishMap.get('walls') || finishMap.get('wall');
  if (wallsItem && wallsItem.material) {
    const wallArea = calculateWallArea(room.area, ceilingHeight);
    const quantity = wallArea * DEFAULTS.WALL_WASTE_FACTOR;
    calculations.push({
      roomId: room.id,
      roomNumber: room.roomNumber || 'N/A',
      roomName: room.name,
      category: 'Walls',
      material: wallsItem.material,
      quantity: Math.ceil(quantity),
      unit: 'SF',
      location,
      notes: `Ceiling Height: ${ceilingHeight}' ${wallsItem.finishType ? `| Type: ${wallsItem.finishType}` : ''}`,
    });
  }

  // BASE MOLDING
  const baseItem = finishMap.get('base') || finishMap.get('baseboard');
  if (baseItem && baseItem.material) {
    const perimeter = estimatePerimeter(room.area);
    const quantity = perimeter * DEFAULTS.BASE_WASTE_FACTOR;
    calculations.push({
      roomId: room.id,
      roomNumber: room.roomNumber || 'N/A',
      roomName: room.name,
      category: 'Base',
      material: baseItem.material,
      quantity: Math.ceil(quantity),
      unit: 'LF',
      location,
      notes: baseItem.finishType ? `Type: ${baseItem.finishType}` : undefined,
    });
  }

  return calculations;
}

/**
 * Generate takeoffs for all rooms in a project
 */
export async function calculateProjectTakeoffs(
  projectId: string,
  ceilingHeight: number = DEFAULTS.CEILING_HEIGHT
): Promise<TakeoffCalculation[]> {
  const rooms = await prisma.room.findMany({
    where: {
      projectId,
      area: { gt: 0 },
    },
    include: {
      FinishScheduleItem: true,
    },
    orderBy: {
      roomNumber: 'asc',
    },
  });

  const allCalculations: TakeoffCalculation[] = [];

  for (const room of rooms) {
    try {
      const calculations = await calculateRoomTakeoffs(room.id, ceilingHeight);
      allCalculations.push(...calculations);
    } catch (error) {
      logger.error('TAKEOFF_CALCULATOR', `Failed to calculate takeoffs for room ${room.roomNumber}`, error as Error);
      // Continue with other rooms
    }
  }

  return allCalculations;
}

/**
 * Aggregate takeoffs by material type
 */
export function aggregateTakeoffs(calculations: TakeoffCalculation[]): TakeoffSummary[] {
  const summaryMap = new Map<string, TakeoffSummary>();

  calculations.forEach((calc) => {
    const key = `${calc.category}::${calc.material}::${calc.unit}`;

    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        category: calc.category,
        material: calc.material,
        totalQuantity: 0,
        unit: calc.unit,
        roomCount: 0,
        rooms: [],
      });
    }

    const summary = summaryMap.get(key)!;
    summary.totalQuantity += calc.quantity;
    summary.roomCount += 1;
    summary.rooms.push(calc.roomNumber);
  });

  return Array.from(summaryMap.values()).sort((a, b) => {
    // Sort by category, then material
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.material.localeCompare(b.material);
  });
}

/**
 * Save takeoff calculations to database
 */
export async function saveTakeoffsToDatabase(
  projectId: string,
  calculations: TakeoffCalculation[],
  userId: string,
  takeoffName: string = 'Automatic Takeoff'
): Promise<string> {
  // Create MaterialTakeoff record
  const takeoff = await prisma.materialTakeoff.create({
    data: {
      projectId,
      name: takeoffName,
      description: `Automatically generated takeoff from ${calculations.length} room calculations`,
      status: 'draft',
      extractedBy: 'system',
      extractedAt: new Date(),
      createdBy: userId,
    },
  });

  // Create TakeoffLineItem records with proper confidence (0-100 scale)
  const lineItems = calculations.map((calc) => ({
    takeoffId: takeoff.id,
    category: calc.category,
    itemName: calc.material,
    description: calc.notes || '',
    quantity: calc.quantity,
    unit: calc.unit,
    location: calc.location,
    sheetNumber: null,
    gridLocation: calc.roomNumber,
    confidence: 85, // High confidence for calculated values (0-100 scale)
    extractedFrom: `Calculated from ${calc.roomNumber || 'room'} dimensions: ${calc.location || 'project area'}`,
    calculationMethod: `${calc.category} calculation based on room dimensions - ${calc.quantity.toFixed(2)} ${calc.unit}`,
    verificationStatus: 'needs_review',
    verified: false,
  }));

  await prisma.takeoffLineItem.createMany({
    data: lineItems,
  });

  return takeoff.id;
}
