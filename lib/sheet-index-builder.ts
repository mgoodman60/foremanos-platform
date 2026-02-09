/**
 * Sheet Index Builder
 * Builds a navigable table of contents from extracted sheets,
 * organized by discipline with drawing type classifications.
 */

import { prisma } from './db';
import { logger } from '@/lib/logger';

export interface SheetIndex {
  disciplines: Record<string, {
    sheets: Array<{
      number: string;
      title: string;
      type: string;
      pageNumber: number | null;
      confidence: number | null;
    }>;
  }>;
  totalSheets: number;
  disciplineBreakdown: Record<string, number>;
}

/**
 * Build a navigable sheet table of contents for a document
 */
export async function buildSheetIndex(documentId: string): Promise<SheetIndex> {
  logger.info('SHEET_INDEX', 'Building sheet index', { documentId });

  const chunks = await prisma.documentChunk.findMany({
    where: { documentId, sheetNumber: { not: null } },
    select: {
      sheetNumber: true,
      pageNumber: true,
      discipline: true,
      metadata: true,
    },
    orderBy: { pageNumber: 'asc' },
  });

  // Also get DrawingType classifications
  const drawingTypes = await prisma.drawingType.findMany({
    where: { documentId },
    select: { sheetNumber: true, type: true, confidence: true },
  });

  const typeMap: Record<string, { type: string; confidence: number }> = {};
  for (const dt of drawingTypes) {
    typeMap[dt.sheetNumber] = { type: dt.type, confidence: dt.confidence };
  }

  const index: SheetIndex = {
    disciplines: {},
    totalSheets: 0,
    disciplineBreakdown: {},
  };

  const seenSheets = new Set<string>();

  for (const chunk of chunks) {
    const sheet = chunk.sheetNumber!;
    if (seenSheets.has(sheet)) continue;
    seenSheets.add(sheet);

    const meta = chunk.metadata as any;
    const discipline = chunk.discipline || meta?.discipline || 'General';
    const title = meta?.sheetTitle || meta?.sheetNumber || sheet;
    const dt = typeMap[sheet];

    if (!index.disciplines[discipline]) {
      index.disciplines[discipline] = { sheets: [] };
    }

    index.disciplines[discipline].sheets.push({
      number: sheet,
      title,
      type: dt?.type || 'unknown',
      pageNumber: chunk.pageNumber,
      confidence: dt?.confidence || null,
    });

    index.disciplineBreakdown[discipline] = (index.disciplineBreakdown[discipline] || 0) + 1;
    index.totalSheets++;
  }

  // Sort sheets within each discipline by sheet number
  for (const discipline of Object.values(index.disciplines)) {
    discipline.sheets.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }

  // Store on document
  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { sheetIndex: true },
    });
    const currentIndex = (doc?.sheetIndex as any) || {};

    await prisma.document.update({
      where: { id: documentId },
      data: {
        sheetIndex: {
          ...currentIndex,
          ...index,
        } as any,
      },
    });
  } catch (error) {
    logger.warn('SHEET_INDEX', 'Failed to store sheet index', { error: (error as Error).message });
  }

  logger.info('SHEET_INDEX', 'Sheet index built', { documentId, totalSheets: index.totalSheets });
  return index;
}
