/**
 * Feature-Specific Sync Services
 * Handles extraction and updates for each feature type based on document content
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import OpenAI from 'openai';
import { FeatureType, DataSourceType, DATA_SOURCE_PRIORITY, recordDataSource } from './document-intelligence-router';
import { resolveModelAlias } from '@/lib/model-config';

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }
  return openaiInstance;
}

// ============= SCALE SYNC =============
export async function syncScaleData(
  projectId: string,
  documentId: string,
  sourceType: DataSourceType
): Promise<{ updated: boolean; scale?: string; ratio?: number }> {
  // Get document chunks with scale data
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: { scaleData: true, primaryScale: true, scaleRatio: true },
  });

  let bestScale: string | null = null;
  let bestRatio: number | null = null;

  for (const chunk of chunks) {
    if (chunk.primaryScale) {
      bestScale = chunk.primaryScale;
      bestRatio = chunk.scaleRatio || null;
      break;
    }
    if (chunk.scaleData && typeof chunk.scaleData === 'object') {
      const sd = chunk.scaleData as any;
      if (sd.scale) {
        bestScale = sd.scale;
        bestRatio = sd.ratio || null;
      }
    }
  }

  if (bestScale) {
    await recordDataSource(projectId, documentId, 'scale', sourceType, {
      scale: bestScale,
      ratio: bestRatio,
    });

    // Log scale update for higher confidence sources
    if (sourceType === 'dwg' || sourceType === 'rvt') {
      logger.info('FEATURE_SYNC', `Updated project scale to ${bestScale} from ${sourceType} source`);
    }

    return { updated: true, scale: bestScale, ratio: bestRatio || undefined };
  }

  return { updated: false };
}

// ============= ROOM SYNC =============
export async function syncRoomData(
  projectId: string,
  documentId: string,
  sourceType: DataSourceType
): Promise<{ updated: number; created: number }> {
  // Try metadata-first extraction (zero LLM calls)
  let extractedRooms: {
    roomNumber: string;
    name: string;
    type: string;
    sqft?: number;
    floor?: string;
    hotspotX?: number;
    hotspotY?: number;
    hotspotWidth?: number;
    hotspotHeight?: number;
  }[] = [];

  try {
    const { extractRoomsFromMetadata } = await import('@/lib/room-extractor');
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { slug: true },
    });
    if (project?.slug) {
      const metadataRooms = await extractRoomsFromMetadata(project.slug, documentId);
      extractedRooms = metadataRooms.map(r => ({
        roomNumber: r.roomNumber,
        name: `${r.roomType} ${r.roomNumber}`,
        type: r.roomType,
        sqft: r.area,
        floor: r.floor,
        hotspotX: r.hotspotX,
        hotspotY: r.hotspotY,
        hotspotWidth: r.hotspotWidth,
        hotspotHeight: r.hotspotHeight,
      }));
      if (extractedRooms.length > 0) {
        logger.info('FEATURE_SYNC', 'Room sync using metadata extraction (no LLM)', { roomCount: extractedRooms.length });
      }
    }
  } catch (metaErr) {
    logger.warn('FEATURE_SYNC', 'Metadata room extraction failed, falling back to LLM', { error: (metaErr as Error).message });
  }

  // Fall back to LLM extraction if metadata yielded zero rooms
  if (extractedRooms.length === 0) {
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      select: { content: true, metadata: true },
    });

    const content = chunks.map(c => c.content).join('\n');

    const prompt = `Extract room information from this document. Return JSON array:
[
  { "name": "Office 101", "roomNumber": "101", "type": "Office", "sqft": 150, "floor": "1" }
]

Document content:
${content.substring(0, 10000)}

Return ONLY JSON array.`;

    try {
      const response = await getOpenAI().chat.completions.create({
        model: resolveModelAlias('gpt-4o-mini'),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
      });

      const text = response.choices[0]?.message?.content || '';
      const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);

      if (match) {
        extractedRooms = JSON.parse(match[0]);
      }
    } catch (error) {
      logger.error('FEATURE_SYNC', 'Room sync LLM error', error as Error);
      return { created: 0, updated: 0 };
    }
  }

  if (extractedRooms.length === 0) {
    return { created: 0, updated: 0 };
  }

  let created = 0, updated = 0;

  for (const room of extractedRooms) {
    const existing = await prisma.room.findFirst({
      where: {
        projectId,
        OR: [
          { roomNumber: room.roomNumber },
          { name: room.name },
        ],
      },
      select: {
        id: true,
        area: true,
        type: true,
        floorNumber: true,
        hotspotX: true,
        hotspotY: true,
        hotspotWidth: true,
        hotspotHeight: true,
      },
    });

    if (existing) {
      // Only update if new source is higher confidence
      const existingSource = await prisma.projectDataSource.findFirst({
        where: { projectId, featureType: 'rooms' },
      });

      if (!existingSource || DATA_SOURCE_PRIORITY[sourceType] > existingSource.confidence) {
        await prisma.room.update({
          where: { id: existing.id },
          data: {
            area: room.sqft || existing.area,
            type: room.type || existing.type,
            floorNumber: room.floor ? parseInt(room.floor) : existing.floorNumber,
          },
        });
        updated++;
      }

      // Always try to fill empty hotspot fields regardless of source priority
      if (
        existing.hotspotX == null &&
        room.hotspotX != null &&
        room.hotspotY != null &&
        room.hotspotWidth != null &&
        room.hotspotHeight != null
      ) {
        await prisma.room.update({
          where: { id: existing.id },
          data: {
            hotspotX: room.hotspotX,
            hotspotY: room.hotspotY,
            hotspotWidth: room.hotspotWidth,
            hotspotHeight: room.hotspotHeight,
          },
        });
        logger.info('FEATURE_SYNC', 'Filled hotspot data for room', { roomNumber: room.roomNumber });
      }
    } else {
      await prisma.room.create({
        data: {
          projectId,
          name: room.name,
          roomNumber: room.roomNumber,
          type: room.type || 'General',
          area: room.sqft || 0,
          floorNumber: room.floor ? parseInt(room.floor) : 1,
          hotspotX: room.hotspotX,
          hotspotY: room.hotspotY,
          hotspotWidth: room.hotspotWidth,
          hotspotHeight: room.hotspotHeight,
        },
      });
      created++;
    }
  }

  await recordDataSource(projectId, documentId, 'rooms', sourceType, {
    totalRooms: extractedRooms.length,
    created,
    updated,
  });

  // Auto-create FloorPlan for architectural floor plan documents
  try {
    const chunks = await prisma.documentChunk.findFirst({
      where: { documentId },
      select: {
        sheetNumber: true,
        discipline: true,
        drawingType: true,
        scaleRatio: true,
      },
    });

    if (chunks) {
      const floorPlanId = await autoCreateFloorPlan(projectId, documentId, {
        sheetNumber: chunks.sheetNumber || undefined,
        discipline: chunks.discipline || undefined,
        drawingType: chunks.drawingType || undefined,
        scaleRatio: chunks.scaleRatio || undefined,
      });

      // Update created rooms with floorPlanId if FloorPlan was created
      if (floorPlanId && created > 0) {
        const { parseSheetNumber } = await import('./sheet-number-parser');
        const parsed = chunks.sheetNumber ? parseSheetNumber(chunks.sheetNumber) : null;
        const level = parsed?.level;

        if (level) {
          await prisma.room.updateMany({
            where: {
              projectId,
              floorPlanId: null,
              floorNumber: parseInt(level),
            },
            data: {
              floorPlanId,
            },
          });
          logger.info('FEATURE_SYNC', 'Linked rooms to FloorPlan', { floorPlanId, roomCount: created });
        }
      }
    }
  } catch (fpError) {
    logger.warn('FEATURE_SYNC', 'FloorPlan auto-create failed (non-blocking)', { error: (fpError as Error).message });
  }

  return { created, updated };
}

// ============= DOOR SYNC =============
export async function syncDoorData(
  projectId: string,
  documentId: string,
  sourceType: DataSourceType
): Promise<{ updated: number; created: number }> {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: { content: true },
  });

  const content = chunks.map(c => c.content).join('\n');
  
  const prompt = `Extract door schedule from this document. Return JSON array:
[
  { "mark": "101", "type": "Single-Flush", "size": "3'-0\" x 7'-0\"", "material": "HM", "hardware": "Set A" }
]

Document content:
${content.substring(0, 10000)}

Return ONLY JSON array.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
    });

    const text = response.choices[0]?.message?.content || '';
    const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);

    if (match) {
      const doors = JSON.parse(match[0]);
      
      await recordDataSource(projectId, documentId, 'doors', sourceType, {
        totalDoors: doors.length,
        doorTypes: [...new Set(doors.map((d: any) => d.type))],
        doors: doors,
      });

      return { created: doors.length, updated: 0 };
    }
  } catch (error) {
    logger.error('FEATURE_SYNC', 'Door sync error', error as Error);
  }

  return { created: 0, updated: 0 };
}

// ============= MEP SYNC =============
export async function syncMEPData(
  projectId: string,
  documentId: string,
  sourceType: DataSourceType,
  mepType: 'mep_electrical' | 'mep_plumbing' | 'mep_hvac'
): Promise<{ items: number }> {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: { content: true, metadata: true },
  });

  const content = chunks.map(c => c.content).join('\n');
  const typeLabels = {
    mep_electrical: 'electrical (outlets, panels, circuits, fixtures)',
    mep_plumbing: 'plumbing (pipes, fixtures, valves, drains)',
    mep_hvac: 'HVAC (ducts, units, vents, thermostats)',
  };

  const prompt = `Extract ${typeLabels[mepType]} items from this MEP document. Return JSON array:
[
  { "name": "Duplex Outlet", "quantity": 24, "location": "Office areas", "specs": "20A, 120V" }
]

Document content:
${content.substring(0, 10000)}

Return ONLY JSON array.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
    });

    const text = response.choices[0]?.message?.content || '';
    const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);

    if (match) {
      const items = JSON.parse(match[0]);
      
      await recordDataSource(projectId, documentId, mepType, sourceType, {
        totalItems: items.length,
        items: items,
      });

      return { items: items.length };
    }
  } catch (error) {
    logger.error('FEATURE_SYNC', `MEP sync error (${mepType})`, error as Error);
  }

  return { items: 0 };
}

// ============= SCHEDULE SYNC =============
export async function syncScheduleData(
  projectId: string,
  documentId: string,
  sourceType: DataSourceType
): Promise<{ tasks: number }> {
  // Check if schedule already exists with this document
  const existingSchedule = await prisma.schedule.findFirst({
    where: { projectId, documentId },
    include: { _count: { select: { ScheduleTask: true } } },
  });

  if (existingSchedule) {
    logger.info('FEATURE_SYNC', 'Schedule already exists for this document');
    return { tasks: existingSchedule._count.ScheduleTask || 0 };
  }

  // Trigger schedule extraction
  try {
    const { extractScheduleFromDocument } = await import('./schedule-document-extractor');
    const result = await extractScheduleFromDocument(documentId);
    
    if (result.success && result.extractedTasks.length > 0) {
      await recordDataSource(projectId, documentId, 'schedule', sourceType, {
        taskCount: result.extractedTasks.length,
        source: result.source,
      });
      
      return { tasks: result.extractedTasks.length };
    }
  } catch (error) {
    logger.error('FEATURE_SYNC', 'Schedule sync error', error as Error);
  }

  return { tasks: 0 };
}

// ============= DIMENSIONS SYNC =============
export async function syncDimensionData(
  projectId: string,
  documentId: string,
  sourceType: DataSourceType
): Promise<{ dimensions: number }> {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: { dimensionSummary: true, dimensionCount: true, dimensions: true },
  });

  let totalDimensions = 0;
  const allDimensions: any[] = [];

  for (const chunk of chunks) {
    totalDimensions += chunk.dimensionCount || 0;
    if (chunk.dimensions) {
      allDimensions.push(...(Array.isArray(chunk.dimensions) ? chunk.dimensions : []));
    }
  }

  if (totalDimensions > 0) {
    await recordDataSource(projectId, documentId, 'dimensions', sourceType, {
      totalDimensions,
      sample: allDimensions.slice(0, 20),
    });
  }

  return { dimensions: totalDimensions };
}

// ============= LEGEND SYNC =============
export async function syncLegendData(
  projectId: string,
  documentId: string,
  sourceType: DataSourceType
): Promise<{ symbols: number }> {
  const legends = await prisma.sheetLegend.findMany({
    where: { documentId },
  });

  if (legends.length > 0) {
    // Count symbols from legendEntries JSON
    let totalSymbols = 0;
    for (const legend of legends) {
      if (legend.legendEntries && Array.isArray(legend.legendEntries)) {
        totalSymbols += (legend.legendEntries as any[]).length;
      }
    }
    
    await recordDataSource(projectId, documentId, 'legends', sourceType, {
      legendCount: legends.length,
      totalSymbols,
    });

    return { symbols: totalSymbols };
  }

  return { symbols: 0 };
}

// ============= MATERIALS SYNC =============
export async function syncMaterialsData(
  projectId: string,
  documentId: string,
  sourceType: DataSourceType
): Promise<{ materials: number }> {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: { content: true },
  });

  const content = chunks.map(c => c.content).join('\n');
  
  const prompt = `Extract material specifications from this document. Return JSON array:
[
  { "name": "Concrete", "spec": "4000 PSI", "application": "Foundation" },
  { "name": "Steel", "spec": "A992 Grade 50", "application": "Structural" }
]

Document content:
${content.substring(0, 10000)}

Return ONLY JSON array.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
    });

    const text = response.choices[0]?.message?.content || '';
    const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);

    if (match) {
      const materials = JSON.parse(match[0]);
      
      await recordDataSource(projectId, documentId, 'materials', sourceType, {
        totalMaterials: materials.length,
        materials: materials,
      });

      return { materials: materials.length };
    }
  } catch (error) {
    logger.error('FEATURE_SYNC', 'Materials sync error', error as Error);
  }

  return { materials: 0 };
}

// ============= FINISH COLOR SYNC =============
export interface FinishColorEntry {
  room: string;
  surface: string;
  colorName: string;
  colorCode: string;
  manufacturer: string;
}

/**
 * Sync finish color data from extraction metadata into FinishScheduleItem records.
 * Maps surface types to finish categories and updates color/manufacturer fields.
 */
export async function syncFinishColors(
  projectId: string,
  documentId: string,
  finishColors: FinishColorEntry[]
): Promise<{ updated: number }> {
  if (!finishColors || finishColors.length === 0) {
    return { updated: 0 };
  }

  logger.info('FEATURE_SYNC', 'Syncing finish colors', {
    projectId,
    documentId,
    colorEntries: finishColors.length,
  });

  let updated = 0;

  // Map surface names to finish categories
  const surfaceToCategoryMap: Record<string, string> = {
    floor: 'flooring',
    flooring: 'flooring',
    wall: 'walls',
    walls: 'walls',
    ceiling: 'ceiling',
    base: 'base',
    baseboard: 'base',
    trim: 'base',
    door: 'door',
    frame: 'frame',
  };

  for (const entry of finishColors) {
    if (!entry.room || !entry.surface) continue;

    const category = surfaceToCategoryMap[entry.surface.toLowerCase()] || entry.surface.toLowerCase();

    try {
      const room = await prisma.room.findFirst({
        where: { projectId, roomNumber: entry.room },
        select: { id: true },
      });

      if (!room) continue;

      // Find the matching FinishScheduleItem
      const finishItem = await prisma.finishScheduleItem.findFirst({
        where: {
          roomId: room.id,
          category,
        },
        select: { id: true, color: true, manufacturer: true },
      });

      if (finishItem) {
        // Only update if color is not already set
        if (!finishItem.color && (entry.colorName || entry.colorCode)) {
          await prisma.finishScheduleItem.update({
            where: { id: finishItem.id },
            data: {
              color: entry.colorName
                ? `${entry.colorName}${entry.colorCode ? ` (${entry.colorCode})` : ''}`
                : entry.colorCode,
              manufacturer: entry.manufacturer || finishItem.manufacturer,
            },
          });
          updated++;
        }
      } else if (entry.colorName || entry.colorCode) {
        // Create new finish item with color data
        await prisma.finishScheduleItem.create({
          data: {
            roomId: room.id,
            category,
            color: entry.colorName
              ? `${entry.colorName}${entry.colorCode ? ` (${entry.colorCode})` : ''}`
              : entry.colorCode,
            manufacturer: entry.manufacturer || null,
            sourceDocumentId: documentId,
            extractedAt: new Date(),
          },
        });
        updated++;
      }
    } catch (error) {
      logger.warn('FEATURE_SYNC', `Failed to sync finish color for room ${entry.room}`, {
        error: (error as Error).message,
        surface: entry.surface,
      });
    }
  }

  logger.info('FEATURE_SYNC', 'Finish color sync complete', { updated });
  return { updated };
}

// ============= AUTO-CREATE FLOOR PLAN =============
/**
 * Auto-create FloorPlan record from architectural floor plan sheets
 * Called from syncRoomData after extracting rooms
 * @returns FloorPlan ID if created, null otherwise
 */
export async function autoCreateFloorPlan(
  projectId: string,
  documentId: string,
  chunk: { sheetNumber?: string; discipline?: string; drawingType?: string; scaleRatio?: number }
): Promise<string | null> {
  try {
    // Only trigger for architectural floor plans
    if (chunk.discipline !== 'Architectural' && chunk.discipline !== 'A') {
      return null;
    }

    if (chunk.drawingType !== 'floor_plan') {
      return null;
    }

    if (!chunk.sheetNumber) {
      logger.warn('FEATURE_SYNC', 'Cannot auto-create FloorPlan without sheet number');
      return null;
    }

    // Parse sheet number to get floor level
    const { parseSheetNumber } = await import('./sheet-number-parser');
    const parsed = parseSheetNumber(chunk.sheetNumber);
    if (!parsed) {
      logger.warn('FEATURE_SYNC', 'Failed to parse sheet number for FloorPlan', { sheetNumber: chunk.sheetNumber });
      return null;
    }

    const level = parsed.level; // '1', '2', '3', etc.

    // Check if FloorPlan already exists for this floor
    const existing = await prisma.floorPlan.findFirst({
      where: {
        projectId,
        floor: level,
        isActive: true,
      },
    });

    if (existing) {
      logger.info('FEATURE_SYNC', 'FloorPlan already exists for this floor', { floor: level });
      return existing.id;
    }

    // Get document to access cloud_storage_path
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { cloud_storage_path: true },
    });

    if (!document?.cloud_storage_path) {
      logger.warn('FEATURE_SYNC', 'Cannot auto-create FloorPlan without document cloud_storage_path');
      return null;
    }

    // Create FloorPlan
    const floorPlan = await prisma.floorPlan.create({
      data: {
        projectId,
        name: `Floor ${level} Plan`,
        floor: level,
        sourceDocumentId: documentId,
        sourceSheetNumber: chunk.sheetNumber,
        cloud_storage_path: document.cloud_storage_path,
        scale: chunk.scaleRatio?.toString(),
        isActive: true,
      },
    });

    logger.info('FEATURE_SYNC', 'Auto-created FloorPlan', {
      floorPlanId: floorPlan.id,
      floor: level,
      sheetNumber: chunk.sheetNumber,
    });

    return floorPlan.id;
  } catch (error) {
    logger.error('FEATURE_SYNC', 'Error auto-creating FloorPlan', error as Error);
    return null;
  }
}
