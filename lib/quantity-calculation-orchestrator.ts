import { prisma } from './db';
import { logger } from '@/lib/logger';
import {
  type CalculatedQuantity,
  calculateRoomArea,
  calculateWallQuantities,
  countFixtures,
  type RoomInput,
} from './quantity-calculator';

export interface CalculationResult {
  documentId: string;
  quantities: CalculatedQuantity[];
  roomsCalculated: number;
  totalQuantityItems: number;
}

/**
 * Run quantity calculations for a document using its aggregated spatial data
 */
export async function runQuantityCalculations(documentId: string): Promise<CalculationResult> {
  logger.info('QUANTITY_CALC', 'Starting quantity calculations', { documentId });

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { sheetIndex: true },
  });

  const sheetIndex = doc?.sheetIndex as any;
  const spatialAgg = sheetIndex?.spatialAggregation;
  const fixtures = sheetIndex?.fixtures;

  const allQuantities: CalculatedQuantity[] = [];
  let roomsCalculated = 0;

  // 1. Room-based calculations
  if (spatialAgg?.roomDimensions) {
    for (const [roomNumber, dims] of Object.entries(spatialAgg.roomDimensions as Record<string, any>)) {
      const room: RoomInput = {
        roomNumber,
        width: dims.width,
        length: dims.length,
        area: dims.area,
        ceilingHeight: dims.ceilingHeight,
        floorElevation: dims.floorElevation,
      };

      // Floor area
      const floorArea = calculateRoomArea(room);
      if (floorArea) {
        allQuantities.push(floorArea);

        // Ceiling area (same as floor for simple rooms)
        allQuantities.push({
          ...floorArea,
          element: `Room ${roomNumber} Ceiling Area`,
          calculationMethod: floorArea.calculationMethod + '_ceiling_equals_floor',
        });
      }

      // Wall quantities
      const wallQuantities = calculateWallQuantities(room);
      allQuantities.push(...wallQuantities);

      roomsCalculated++;
    }
  }

  // 2. Fixture counts
  if (fixtures?.plumbing) {
    const allPlumbing: any[] = [];
    for (const roomFixtures of Object.values(fixtures.plumbing as Record<string, any[]>)) {
      allPlumbing.push(...roomFixtures);
    }
    if (allPlumbing.length > 0) {
      allQuantities.push(...countFixtures(allPlumbing));
    }
  }

  if (fixtures?.electrical) {
    const allElectrical: any[] = [];
    for (const roomDevices of Object.values(fixtures.electrical as Record<string, any[]>)) {
      allElectrical.push(...roomDevices);
    }
    if (allElectrical.length > 0) {
      allQuantities.push(...countFixtures(allElectrical));
    }
  }

  // Store calculation results on document
  try {
    const currentIndex = (doc?.sheetIndex as any) || {};
    await prisma.document.update({
      where: { id: documentId },
      data: {
        sheetIndex: {
          ...currentIndex,
          calculatedQuantities: allQuantities,
          calculationSummary: {
            roomsCalculated,
            totalItems: allQuantities.length,
            calculatedAt: new Date().toISOString(),
          },
        } as any,
      },
    });
  } catch (error) {
    logger.warn('QUANTITY_CALC', 'Failed to store calculations', { error: (error as Error).message });
  }

  logger.info('QUANTITY_CALC', 'Quantity calculations complete', {
    documentId, roomsCalculated, totalItems: allQuantities.length,
  });

  return {
    documentId,
    quantities: allQuantities,
    roomsCalculated,
    totalQuantityItems: allQuantities.length,
  };
}
