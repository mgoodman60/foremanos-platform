/**
 * Feature-Specific Sync Services
 * Handles extraction and updates for each feature type based on document content
 */

import { prisma } from '@/lib/db';
import OpenAI from 'openai';
import { FeatureType, DataSourceType, DATA_SOURCE_PRIORITY, recordDataSource } from './document-intelligence-router';

const openai = new OpenAI({
  apiKey: process.env.ABACUSAI_API_KEY,
  baseURL: 'https://routellm.abacus.ai/v1',
});

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
      console.log(`[Scale Sync] Updated project scale to ${bestScale} from ${sourceType} source`);
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
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: { content: true, metadata: true },
  });

  const content = chunks.map(c => c.content).join('\n');
  
  // Use AI to extract room data
  const prompt = `Extract room information from this document. Return JSON array:
[
  { "name": "Office 101", "roomNumber": "101", "type": "Office", "sqft": 150, "floor": "1" }
]

Document content:
${content.substring(0, 10000)}

Return ONLY JSON array.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
    });

    const text = response.choices[0]?.message?.content || '';
    const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    
    if (match) {
      const rooms = JSON.parse(match[0]);
      let created = 0, updated = 0;

      for (const room of rooms) {
        const existing = await prisma.room.findFirst({
          where: {
            projectId,
            OR: [
              { roomNumber: room.roomNumber },
              { name: room.name },
            ],
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
        } else {
          await prisma.room.create({
            data: {
              projectId,
              name: room.name,
              roomNumber: room.roomNumber,
              type: room.type || 'General',
              area: room.sqft || 0,
              floorNumber: room.floor ? parseInt(room.floor) : 1,
            },
          });
          created++;
        }
      }

      await recordDataSource(projectId, documentId, 'rooms', sourceType, {
        totalRooms: rooms.length,
        created,
        updated,
      });

      return { created, updated };
    }
  } catch (error) {
    console.error('[Room Sync] Error:', error);
  }

  return { created: 0, updated: 0 };
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
    const response = await openai.chat.completions.create({
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
    console.error('[Door Sync] Error:', error);
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
    const response = await openai.chat.completions.create({
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
    console.error(`[MEP Sync - ${mepType}] Error:`, error);
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
    console.log('[Schedule Sync] Schedule already exists for this document');
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
    console.error('[Schedule Sync] Error:', error);
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
    const response = await openai.chat.completions.create({
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
    console.error('[Materials Sync] Error:', error);
  }

  return { materials: 0 };
}
