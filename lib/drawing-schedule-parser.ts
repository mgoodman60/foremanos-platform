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
  fixturesProcessed: number;
  hardwareSetsCreated: number;
  metadataSchedulesStored: number;
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
    fixturesProcessed: 0,
    hardwareSetsCreated: 0,
    metadataSchedulesStored: 0,
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
          case 'fixture':
          case 'fixture_schedule':
          case 'plumbing_fixture':
          case 'plumbing_fixture_schedule':
            result.fixturesProcessed += await parseFixtureSchedule(table, projectId, documentId, chunk.sheetNumber);
            break;
          case 'hardware':
          case 'hardware_schedule':
            result.hardwareSetsCreated += await parseHardwareSchedule(table, projectId, documentId, chunk.sheetNumber);
            break;
          case 'lighting':
          case 'lighting_schedule':
            result.metadataSchedulesStored += await parseLightingSchedule(table, documentId, chunk.id, chunk.sheetNumber);
            break;
          case 'panel':
          case 'panel_schedule':
            result.metadataSchedulesStored += await storePanelScheduleMetadata(table, documentId, chunk.id);
            break;
          case 'structural':
          case 'structural_schedule':
          case 'beam':
          case 'column':
          case 'footing':
            result.metadataSchedulesStored += await storeMetadataSchedule(table, documentId, chunk.id, 'structural_schedule');
            break;
          case 'stair':
          case 'stair_schedule':
            result.metadataSchedulesStored += await storeMetadataSchedule(table, documentId, chunk.id, 'stair_schedule');
            break;
          case 'elevator':
          case 'elevator_schedule':
            result.metadataSchedulesStored += await storeMetadataSchedule(table, documentId, chunk.id, 'elevator_schedule');
            break;
          case 'roof_drain':
          case 'roof_drain_schedule':
            result.metadataSchedulesStored += await storeMetadataSchedule(table, documentId, chunk.id, 'roof_drain_schedule');
            break;
          case 'louver':
          case 'damper':
          case 'louver_damper':
          case 'louver_damper_schedule':
            result.metadataSchedulesStored += await storeMetadataSchedule(table, documentId, chunk.id, 'louver_damper_schedule');
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
    fixturesProcessed: result.fixturesProcessed,
    hardwareSetsCreated: result.hardwareSetsCreated,
    metadataSchedulesStored: result.metadataSchedulesStored,
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

async function parseFixtureSchedule(
  table: any,
  projectId: string,
  documentId: string,
  sheetNumber: string | null
): Promise<number> {
  const headers = (table.headers || []).map((h: string) => h.toLowerCase().trim());
  const rows = table.rows || [];
  let processed = 0;

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const fixtureType =
      getColumn(headers, row, ['type', 'fixture type', 'fixture', 'description']) ||
      String(row[0]).trim();
    if (!fixtureType || fixtureType === '') continue;

    const roomNumbers = getColumn(headers, row, ['room', 'room no', 'rooms', 'location']);
    const count = getColumn(headers, row, ['count', 'qty', 'quantity']);
    const connectionSize = getColumn(headers, row, ['connection', 'connection size', 'pipe size', 'size']);
    const manufacturer = getColumn(headers, row, ['manufacturer', 'mfr', 'mfg']);

    // Find matching rooms and update their fixture data
    if (roomNumbers) {
      const roomNums = roomNumbers.split(/[,;\/]/).map(r => r.trim()).filter(Boolean);
      for (const roomNum of roomNums) {
        try {
          const room = await prisma.room.findFirst({
            where: { projectId, roomNumber: roomNum },
            select: { id: true },
          });
          if (room) {
            // Check for existing FinishScheduleItem used as fixture record
            const existing = await prisma.finishScheduleItem.findFirst({
              where: {
                roomId: room.id,
                category: 'fixture',
                material: fixtureType,
                sourceDocumentId: documentId,
              },
              select: { id: true },
            });

            if (!existing) {
              await prisma.finishScheduleItem.create({
                data: {
                  roomId: room.id,
                  category: 'fixture',
                  material: fixtureType,
                  manufacturer: manufacturer,
                  dimensions: connectionSize,
                  notes: count ? `Qty: ${count}` : null,
                  sourceDocumentId: documentId,
                  sourceSheetNumber: sheetNumber,
                  extractedAt: new Date(),
                },
              });
              processed++;
            }
          }
        } catch (error) {
          logger.warn('SCHEDULE_PARSER', `Failed to process fixture for room ${roomNum}`, {
            error: (error as Error).message,
          });
        }
      }
    } else {
      processed++;
    }
  }

  return processed;
}

async function parseHardwareSchedule(
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

    const setNumber =
      getColumn(headers, row, ['set', 'set no', 'hw set', 'hardware set', 'set number', 'no.']) ||
      String(row[0]).trim();
    if (!setNumber || setNumber === '') continue;

    const setName = getColumn(headers, row, ['name', 'set name', 'description']);
    const description = getColumn(headers, row, ['description', 'desc', 'components', 'items']);
    const fireRating = getColumn(headers, row, ['fire', 'fire rating', 'rating', 'fire rated']);
    const ada = getColumn(headers, row, ['ada', 'accessible', 'ada compliant']);

    try {
      await prisma.hardwareSetDefinition.upsert({
        where: {
          projectId_setNumber: { projectId, setNumber },
        },
        update: {
          setName: setName || undefined,
          description: description || undefined,
          fireRated: fireRating ? fireRating.toLowerCase() !== 'no' && fireRating !== '-' : undefined,
          fireRating: fireRating && fireRating.toLowerCase() !== 'no' ? fireRating : undefined,
          adaCompliant: ada ? ada.toLowerCase() === 'yes' || ada.toLowerCase() === 'x' : undefined,
          sourceDocumentId: documentId,
          sourceType: `schedule:${sheetNumber || 'unknown'}`,
        },
        create: {
          projectId,
          setNumber,
          setName,
          description,
          fireRated: fireRating ? fireRating.toLowerCase() !== 'no' && fireRating !== '-' : false,
          fireRating: fireRating && fireRating.toLowerCase() !== 'no' ? fireRating : null,
          adaCompliant: ada ? ada.toLowerCase() === 'yes' || ada.toLowerCase() === 'x' : false,
          sourceDocumentId: documentId,
          sourceType: `schedule:${sheetNumber || 'unknown'}`,
        },
      });
      created++;
    } catch (error) {
      logger.warn('SCHEDULE_PARSER', `Failed to upsert hardware set ${setNumber}`, {
        error: (error as Error).message,
      });
    }
  }

  return created;
}

async function parseLightingSchedule(
  table: any,
  documentId: string,
  chunkId: string,
  sheetNumber: string | null
): Promise<number> {
  const headers = (table.headers || []).map((h: string) => h.toLowerCase().trim());
  const rows = table.rows || [];
  const fixtures: any[] = [];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const fixtureTag =
      getColumn(headers, row, ['type', 'tag', 'fixture type', 'mark', 'symbol']) ||
      String(row[0]).trim();
    if (!fixtureTag || fixtureTag === '') continue;

    fixtures.push({
      tag: fixtureTag,
      manufacturer: getColumn(headers, row, ['manufacturer', 'mfr', 'mfg']),
      catalog: getColumn(headers, row, ['catalog', 'catalog no', 'catalog number', 'model']),
      description: getColumn(headers, row, ['description', 'desc', 'lamp', 'lamp type']),
      wattage: getColumn(headers, row, ['wattage', 'watts', 'w']),
      voltage: getColumn(headers, row, ['voltage', 'volts', 'v']),
      mounting: getColumn(headers, row, ['mounting', 'mount', 'mounting type']),
      sourceSheet: sheetNumber,
    });
  }

  if (fixtures.length === 0) return 0;

  try {
    const chunk = await prisma.documentChunk.findUnique({
      where: { id: chunkId },
      select: { metadata: true },
    });
    const existingMeta = (chunk?.metadata as Record<string, any>) || {};

    const lightingSchedules = existingMeta.lightingSchedules || [];
    lightingSchedules.push({
      fixtures,
      fixtureCount: fixtures.length,
      parsedAt: new Date().toISOString(),
    });

    await prisma.documentChunk.update({
      where: { id: chunkId },
      data: {
        metadata: {
          ...existingMeta,
          lightingSchedules,
        },
      },
    });
    return 1;
  } catch (error) {
    logger.warn('SCHEDULE_PARSER', 'Failed to store lighting schedule metadata', {
      error: (error as Error).message,
      documentId,
    });
    return 0;
  }
}

async function storePanelScheduleMetadata(
  table: any,
  documentId: string,
  chunkId: string
): Promise<number> {
  try {
    const chunk = await prisma.documentChunk.findUnique({
      where: { id: chunkId },
      select: { metadata: true },
    });
    const existingMeta = (chunk?.metadata as Record<string, any>) || {};

    const panelSchedules = existingMeta.panelSchedules || [];
    panelSchedules.push({
      panelName: table.panelName || getColumnFromTable(table, ['panel', 'panel name', 'designation']),
      voltage: table.voltage || getColumnFromTable(table, ['voltage', 'volts']),
      phase: table.phase || getColumnFromTable(table, ['phase']),
      mainBreaker: table.mainBreaker || getColumnFromTable(table, ['main', 'main breaker', 'main cb']),
      circuits: (table.rows || []).length,
      rawData: {
        headers: table.headers,
        rowCount: (table.rows || []).length,
      },
    });

    await prisma.documentChunk.update({
      where: { id: chunkId },
      data: {
        metadata: {
          ...existingMeta,
          panelSchedules,
        },
      },
    });
    return 1;
  } catch (error) {
    logger.warn('SCHEDULE_PARSER', 'Failed to store panel schedule metadata', {
      error: (error as Error).message,
      documentId,
    });
    return 0;
  }
}

async function storeMetadataSchedule(
  table: any,
  documentId: string,
  chunkId: string,
  scheduleKey: string
): Promise<number> {
  try {
    const chunk = await prisma.documentChunk.findUnique({
      where: { id: chunkId },
      select: { metadata: true },
    });
    const existingMeta = (chunk?.metadata as Record<string, any>) || {};

    const schedules = existingMeta[scheduleKey] || [];
    schedules.push({
      headers: table.headers || [],
      rows: table.rows || [],
      rowCount: (table.rows || []).length,
      parsedAt: new Date().toISOString(),
    });

    await prisma.documentChunk.update({
      where: { id: chunkId },
      data: {
        metadata: {
          ...existingMeta,
          [scheduleKey]: schedules,
        },
      },
    });
    return 1;
  } catch (error) {
    logger.warn('SCHEDULE_PARSER', `Failed to store ${scheduleKey} metadata`, {
      error: (error as Error).message,
      documentId,
    });
    return 0;
  }
}

/** Extract a value from the first row of a table by column name */
function getColumnFromTable(table: any, colNames: string[]): string | null {
  const headers = (table.headers || []).map((h: string) => h.toLowerCase().trim());
  const firstRow = table.rows?.[0];
  if (!Array.isArray(firstRow)) return null;
  return getColumn(headers, firstRow, colNames);
}
