/**
 * Drawing Schedule Parser
 * Parses drawingScheduleTables from DocumentChunk metadata into structured
 * project records (DoorScheduleItem, WindowScheduleItem, FinishScheduleItem).
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface ScheduleParseResult {
  doorsCreated: number;
  windowsCreated: number;
  finishesCreated: number;
  equipmentCreated: number;
  errors: string[];
}

/**
 * Parse drawing schedule tables from document chunks into structured records.
 * Scans all DocumentChunks for the given document, extracts schedule table
 * data from metadata, and creates/updates the appropriate schedule item
 * records (doors, windows, finishes, equipment).
 */
export async function parseDrawingSchedules(
  documentId: string,
  projectId: string
): Promise<ScheduleParseResult> {
  logger.info('SCHEDULE_PARSER', 'Starting schedule parsing', { documentId, projectId });

  const result: ScheduleParseResult = {
    doorsCreated: 0,
    windowsCreated: 0,
    finishesCreated: 0,
    equipmentCreated: 0,
    errors: [],
  };

  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: { id: true, sheetNumber: true, metadata: true },
  });

  for (const chunk of chunks) {
    const meta = chunk.metadata as Record<string, any> | null;
    if (!meta?.drawingScheduleTables?.length) continue;

    for (const table of meta.drawingScheduleTables) {
      try {
        switch (table.scheduleType?.toLowerCase()) {
          case 'door':
            result.doorsCreated += await parseDoorSchedule(table, projectId, documentId, chunk.sheetNumber);
            break;
          case 'window':
            result.windowsCreated += await parseWindowSchedule(table, projectId, documentId, chunk.sheetNumber);
            break;
          case 'finish':
          case 'room_finish':
            result.finishesCreated += await parseFinishSchedule(table, projectId, documentId, chunk.sheetNumber);
            break;
          case 'equipment':
          case 'mechanical':
            result.equipmentCreated += await parseEquipmentSchedule(table, projectId, documentId, chunk.sheetNumber);
            break;
          default:
            logger.info('SCHEDULE_PARSER', `Unhandled schedule type: ${table.scheduleType}`, {
              documentId,
            });
        }
      } catch (error) {
        const msg = `Failed to parse ${table.scheduleType} schedule: ${(error as Error).message}`;
        result.errors.push(msg);
        logger.error('SCHEDULE_PARSER', msg);
      }
    }
  }

  logger.info('SCHEDULE_PARSER', 'Schedule parsing complete', {
    documentId,
    doorsCreated: result.doorsCreated,
    windowsCreated: result.windowsCreated,
    finishesCreated: result.finishesCreated,
    equipmentCreated: result.equipmentCreated,
    errorCount: result.errors.length,
  });

  return result;
}

// Internal helpers

function getColumn(headers: string[], row: any[], colNames: string[]): string | null {
  for (const name of colNames) {
    const idx = headers.findIndex((h: string) => h.includes(name));
    if (idx >= 0 && idx < row.length && row[idx] != null) {
      const val = String(row[idx]).trim();
      if (val !== '') return val;
    }
  }
  return null;
}

async function parseDoorSchedule(
  table: any,
  projectId: string,
  documentId: string,
  sheetNumber: string | null
): Promise<number> {
  const headers = (table.headers || []).map((h: string) => h.toLowerCase().trim());
  const rows = table.rows || [];
  let created = 0;

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const doorNumber =
      getColumn(headers, row, ['door no', 'door number', 'door #', 'mark', 'no.', 'no']) ||
      String(row[0]).trim();
    if (!doorNumber || doorNumber === '') continue;

    try {
      await prisma.doorScheduleItem.upsert({
        where: {
          projectId_doorNumber: { projectId, doorNumber },
        },
        update: {
          doorType: getColumn(headers, row, ['type', 'door type']) || 'unknown',
          width: getColumn(headers, row, ['width', 'w']),
          height: getColumn(headers, row, ['height', 'h']),
          frameMaterial: getColumn(headers, row, ['frame', 'frame material']),
          hardwareSet: getColumn(headers, row, ['hardware', 'hw set', 'hardware set']),
          fireRating: getColumn(headers, row, ['fire', 'fire rating', 'rating']),
          roomNumber: getColumn(headers, row, ['room', 'room no', 'from room']),
          sourceDocumentId: documentId,
          sourceSheetNumber: sheetNumber,
        },
        create: {
          projectId,
          doorNumber,
          doorType: getColumn(headers, row, ['type', 'door type']) || 'unknown',
          width: getColumn(headers, row, ['width', 'w']),
          height: getColumn(headers, row, ['height', 'h']),
          frameMaterial: getColumn(headers, row, ['frame', 'frame material']),
          hardwareSet: getColumn(headers, row, ['hardware', 'hw set', 'hardware set']),
          fireRating: getColumn(headers, row, ['fire', 'fire rating', 'rating']),
          roomNumber: getColumn(headers, row, ['room', 'room no', 'from room']),
          sourceDocumentId: documentId,
          sourceSheetNumber: sheetNumber,
        },
      });
      created++;
    } catch (error) {
      logger.warn('SCHEDULE_PARSER', `Failed to upsert door ${doorNumber}`, {
        error: (error as Error).message,
      });
    }
  }

  return created;
}

async function parseWindowSchedule(
  table: any,
  projectId: string,
  documentId: string,
  sheetNumber: string | null
): Promise<number> {
  const headers = (table.headers || []).map((h: string) => h.toLowerCase().trim());
  const rows = table.rows || [];
  let created = 0;

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const windowNumber =
      getColumn(headers, row, ['window no', 'window number', 'window #', 'mark', 'no.', 'no']) ||
      String(row[0]).trim();
    if (!windowNumber || windowNumber === '') continue;

    try {
      await prisma.windowScheduleItem.upsert({
        where: {
          projectId_windowNumber: { projectId, windowNumber },
        },
        update: {
          windowType: getColumn(headers, row, ['type', 'window type']) || 'unknown',
          width: getColumn(headers, row, ['width', 'w']),
          height: getColumn(headers, row, ['height', 'h']),
          glazingType: getColumn(headers, row, ['glazing', 'glass', 'glazing type']),
          frameMaterial: getColumn(headers, row, ['frame', 'frame material']),
          sillHeight: getColumn(headers, row, ['sill', 'sill height']),
          roomNumber: getColumn(headers, row, ['room', 'room no']),
          sourceDocumentId: documentId,
          sourceSheetNumber: sheetNumber,
        },
        create: {
          projectId,
          windowNumber,
          windowType: getColumn(headers, row, ['type', 'window type']) || 'unknown',
          width: getColumn(headers, row, ['width', 'w']),
          height: getColumn(headers, row, ['height', 'h']),
          glazingType: getColumn(headers, row, ['glazing', 'glass', 'glazing type']),
          frameMaterial: getColumn(headers, row, ['frame', 'frame material']),
          sillHeight: getColumn(headers, row, ['sill', 'sill height']),
          roomNumber: getColumn(headers, row, ['room', 'room no']),
          sourceDocumentId: documentId,
          sourceSheetNumber: sheetNumber,
        },
      });
      created++;
    } catch (error) {
      logger.warn('SCHEDULE_PARSER', `Failed to upsert window ${windowNumber}`, {
        error: (error as Error).message,
      });
    }
  }

  return created;
}

async function parseFinishSchedule(
  table: any,
  projectId: string,
  documentId: string,
  sheetNumber: string | null
): Promise<number> {
  const headers = (table.headers || []).map((h: string) => h.toLowerCase().trim());
  const rows = table.rows || [];
  let created = 0;

  const finishCategories = [
    { colNames: ['floor', 'floor finish', 'flooring'], category: 'flooring' },
    { colNames: ['wall', 'wall finish', 'walls'], category: 'walls' },
    { colNames: ['ceiling', 'ceiling finish', 'clg'], category: 'ceiling' },
    { colNames: ['base', 'baseboard', 'base finish'], category: 'base' },
  ];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const roomNumber =
      getColumn(headers, row, ['room', 'room no', 'room number', 'no.']) ||
      String(row[0]).trim();
    if (!roomNumber || roomNumber === '') continue;

    // Room.roomNumber is nullable; the unique constraint is @@unique([projectId, roomNumber])
    const room = await prisma.room.findFirst({
      where: { projectId, roomNumber },
      select: { id: true },
    });

    if (!room) {
      logger.info('SCHEDULE_PARSER', `Room ${roomNumber} not found for finish schedule, skipping`);
      continue;
    }

    for (const fc of finishCategories) {
      const material = getColumn(headers, row, fc.colNames);
      if (!material || material === '-') continue;

      try {
        // FinishScheduleItem has no compound unique — check for existing to avoid duplicates
        const existing = await prisma.finishScheduleItem.findFirst({
          where: {
            roomId: room.id,
            category: fc.category,
            sourceDocumentId: documentId,
          },
          select: { id: true },
        });

        if (existing) {
          await prisma.finishScheduleItem.update({
            where: { id: existing.id },
            data: {
              material,
              sourceSheetNumber: sheetNumber,
              extractedAt: new Date(),
            },
          });
        } else {
          await prisma.finishScheduleItem.create({
            data: {
              roomId: room.id,
              category: fc.category,
              material,
              sourceDocumentId: documentId,
              sourceSheetNumber: sheetNumber,
              extractedAt: new Date(),
            },
          });
        }
        created++;
      } catch (error) {
        logger.warn('SCHEDULE_PARSER', `Failed to create finish item for room ${roomNumber}`, {
          category: fc.category,
          error: (error as Error).message,
        });
      }
    }
  }

  return created;
}

async function parseEquipmentSchedule(
  _table: any,
  _projectId: string,
  documentId: string,
  _sheetNumber: string | null
): Promise<number> {
  logger.info('SCHEDULE_PARSER', `Found equipment schedule with ${_table.rows?.length || 0} rows`, {
    documentId,
  });
  return 0;
}
