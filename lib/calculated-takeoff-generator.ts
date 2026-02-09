import { prisma } from './db';
import { logger } from '@/lib/logger';
import type { CalculatedQuantity } from './quantity-calculator';

export interface TakeoffGenerationResult {
  takeoffId: string | null;
  lineItemsCreated: number;
  errors: string[];
}

/**
 * Auto-generate a MaterialTakeoff from calculated quantities.
 * All items are created as draft status requiring user approval.
 *
 * TakeoffLineItem schema fields used:
 *   itemName (required), category (required), quantity, unit, unitCost,
 *   totalCost, confidence, calculationMethod, location, notes, metadata
 */
export async function generateTakeoffFromCalculations(
  documentId: string,
  projectId: string,
  createdBy: string
): Promise<TakeoffGenerationResult> {
  logger.info('TAKEOFF_GEN', 'Generating takeoff from calculations', { documentId, projectId });

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { name: true, sheetIndex: true },
  });

  const quantities: CalculatedQuantity[] = (doc?.sheetIndex as any)?.calculatedQuantities || [];

  if (quantities.length === 0) {
    logger.info('TAKEOFF_GEN', 'No calculated quantities to generate takeoff from', { documentId });
    return { takeoffId: null, lineItemsCreated: 0, errors: [] };
  }

  const errors: string[] = [];

  try {
    // Create the takeoff
    const takeoff = await prisma.materialTakeoff.create({
      data: {
        projectId,
        name: `Auto-calculated: ${doc?.name || 'Document'}`,
        description: 'Automatically generated from spatial data extraction. All quantities are draft and require verification.',
        status: 'draft',
        documentId,
        extractedBy: 'auto-calculation',
        extractedAt: new Date(),
        createdBy,
      },
    });

    let lineItemsCreated = 0;

    for (const qty of quantities) {
      if (qty.quantity <= 0) continue;

      try {
        await prisma.takeoffLineItem.create({
          data: {
            takeoffId: takeoff.id,
            itemName: qty.element,
            category: qty.category || 'Uncategorized',
            description: `${qty.calculationMethod} | Confidence: ${Math.round(qty.confidence * 100)}%`,
            quantity: qty.quantity,
            unit: qty.unit,
            unitCost: null,
            totalCost: null,
            confidence: qty.confidence,
            calculationMethod: qty.calculationMethod,
            location: qty.sourceRoom || null,
            notes: qty.tradeType ? `Trade: ${qty.tradeType}` : null,
            metadata: qty.dimensions ? (qty.dimensions as any) : undefined,
          },
        });
        lineItemsCreated++;
      } catch (error) {
        errors.push(`Failed to create line item for ${qty.element}: ${(error as Error).message}`);
      }
    }

    logger.info('TAKEOFF_GEN', 'Takeoff generation complete', {
      documentId, takeoffId: takeoff.id, lineItemsCreated,
    });

    return { takeoffId: takeoff.id, lineItemsCreated, errors };
  } catch (error) {
    const msg = `Failed to create takeoff: ${(error as Error).message}`;
    errors.push(msg);
    logger.error('TAKEOFF_GEN', msg);
    return { takeoffId: null, lineItemsCreated: 0, errors };
  }
}
