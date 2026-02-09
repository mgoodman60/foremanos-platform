/**
 * Revision Comparator
 * Compares extraction data between document revisions to detect
 * changes in rooms, dimensions, doors, windows, and other fields.
 */

import { prisma } from './db';
import { logger } from '@/lib/logger';

export interface RevisionDiff {
  sheetNumber: string;
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    significance: 'high' | 'medium' | 'low';
  }>;
}

export interface RevisionComparisonResult {
  hasOverlap: boolean;
  overlappingSheets: string[];
  diffs: RevisionDiff[];
}

/**
 * Compare a newly processed document against existing documents in the project
 * to detect revision changes
 */
export async function compareRevisions(
  newDocumentId: string,
  projectId: string
): Promise<RevisionComparisonResult> {
  logger.info('REVISION_CMP', 'Starting revision comparison', { newDocumentId, projectId });

  // Get sheet numbers from the new document
  const newChunks = await prisma.documentChunk.findMany({
    where: { documentId: newDocumentId, sheetNumber: { not: null } },
    select: { sheetNumber: true, metadata: true },
  });

  const newSheetMap: Record<string, any> = {};
  for (const chunk of newChunks) {
    if (chunk.sheetNumber) {
      newSheetMap[chunk.sheetNumber] = chunk.metadata;
    }
  }

  const newSheetNumbers = Object.keys(newSheetMap);
  if (newSheetNumbers.length === 0) {
    return { hasOverlap: false, overlappingSheets: [], diffs: [] };
  }

  // Find existing documents in the same project (excluding the new one)
  const existingChunks = await prisma.documentChunk.findMany({
    where: {
      Document: { projectId, id: { not: newDocumentId }, deletedAt: null },
      sheetNumber: { in: newSheetNumbers },
    },
    select: { sheetNumber: true, metadata: true, documentId: true },
  });

  const existingSheetMap: Record<string, any> = {};
  for (const chunk of existingChunks) {
    if (chunk.sheetNumber && !existingSheetMap[chunk.sheetNumber]) {
      existingSheetMap[chunk.sheetNumber] = chunk.metadata;
    }
  }

  const overlappingSheets = newSheetNumbers.filter(s => existingSheetMap[s]);

  if (overlappingSheets.length === 0) {
    return { hasOverlap: false, overlappingSheets: [], diffs: [] };
  }

  // Compare metadata per overlapping sheet
  const diffs: RevisionDiff[] = [];

  for (const sheet of overlappingSheets) {
    const oldMeta = existingSheetMap[sheet] as any;
    const newMeta = newSheetMap[sheet] as any;
    const changes: RevisionDiff['changes'] = [];

    // Compare key fields
    const fieldsToCompare = [
      { field: 'rooms', significance: 'high' as const },
      { field: 'dimensions', significance: 'high' as const },
      { field: 'doors', significance: 'medium' as const },
      { field: 'windows', significance: 'medium' as const },
      { field: 'notes', significance: 'medium' as const },
      { field: 'equipment', significance: 'medium' as const },
      { field: 'scale', significance: 'low' as const },
    ];

    for (const { field, significance } of fieldsToCompare) {
      const oldVal = oldMeta?.[field];
      const newVal = newMeta?.[field];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field,
          oldValue: oldVal,
          newValue: newVal,
          significance,
        });
      }
    }

    if (changes.length > 0) {
      diffs.push({ sheetNumber: sheet, changes });
    }
  }

  logger.info('REVISION_CMP', 'Revision comparison complete', {
    newDocumentId, overlappingSheets: overlappingSheets.length, sheetsWithChanges: diffs.length,
  });

  return { hasOverlap: true, overlappingSheets, diffs };
}
