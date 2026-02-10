/**
 * Spatial Data Aggregator
 * Aggregates dimensional/spatial data across all sheets for a document,
 * including room dimensions, levels, grid spacing, heights, and thicknesses.
 */

import { prisma } from './db';
import { logger } from '@/lib/logger';

export interface DuctSizingEntry {
  ductId: string;
  size: string;
  type: string;
  cfm?: number;
  location?: string;
  sourceSheet?: string;
}

export interface PipeSizingEntry {
  pipeId: string;
  size: string;
  material: string;
  system?: string;
  location?: string;
  sourceSheet?: string;
}

export interface SpatialAggregation {
  roomDimensions: Record<string, { width?: string; length?: string; area?: string; ceilingHeight?: string; floorElevation?: string }>;
  levels: Record<string, string>; // levelName -> elevation
  gridSpacing: Record<string, Record<string, string>>; // fromGrid -> toGrid -> distance
  aggregatedHeights: any[];
  aggregatedThicknesses: any[];
  ductSizing: DuctSizingEntry[];
  pipeSizing: PipeSizingEntry[];
}

/**
 * Aggregate spatial data from all document chunks into a unified map
 */
export async function aggregateSpatialData(documentId: string): Promise<SpatialAggregation> {
  logger.info('SPATIAL_AGG', 'Starting spatial data aggregation', { documentId });

  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: { id: true, sheetNumber: true, metadata: true },
  });

  const result: SpatialAggregation = {
    roomDimensions: {},
    levels: {},
    gridSpacing: {},
    aggregatedHeights: [],
    aggregatedThicknesses: [],
    ductSizing: [],
    pipeSizing: [],
  };

  for (const chunk of chunks) {
    const meta = chunk.metadata as any;
    if (!meta?.spatialData) continue;

    const sd = meta.spatialData;

    // Aggregate contextual dimensions into room dimension map
    if (sd.contextualDimensions) {
      for (const dim of sd.contextualDimensions) {
        if (dim.context) {
          // Try to extract room number from context
          const roomMatch = dim.context.match(/room\s*(\w+)/i);
          if (roomMatch) {
            const room = roomMatch[1];
            if (!result.roomDimensions[room]) result.roomDimensions[room] = {};
            if (dim.type === 'horizontal' && !result.roomDimensions[room].width) {
              result.roomDimensions[room].width = dim.value;
            } else if (dim.type === 'vertical' && !result.roomDimensions[room].length) {
              result.roomDimensions[room].length = dim.value;
            }
          }
        }
      }
    }

    // Aggregate heights
    if (sd.heights?.length > 0) {
      result.aggregatedHeights.push(...sd.heights.map((h: any) => ({
        ...h,
        sourceSheet: chunk.sheetNumber,
      })));
      // Extract ceiling heights for rooms
      for (const h of sd.heights) {
        if (h.type === 'floor_to_ceiling' && h.location) {
          const roomMatch = h.location.match(/room\s*(\w+)/i);
          if (roomMatch) {
            const room = roomMatch[1];
            if (!result.roomDimensions[room]) result.roomDimensions[room] = {};
            result.roomDimensions[room].ceilingHeight = h.value;
          }
        }
      }
    }

    // Aggregate thicknesses
    if (sd.thicknesses?.length > 0) {
      result.aggregatedThicknesses.push(...sd.thicknesses.map((t: any) => ({
        ...t,
        sourceSheet: chunk.sheetNumber,
      })));
    }

    // Aggregate levels
    if (sd.levels) {
      for (const level of sd.levels) {
        if (level.name && level.elevation) {
          result.levels[level.name] = level.elevation;
        }
      }
    }

    // Aggregate grid spacing
    if (sd.gridSpacing) {
      for (const gs of sd.gridSpacing) {
        if (gs.from && gs.to && gs.distance) {
          if (!result.gridSpacing[gs.from]) result.gridSpacing[gs.from] = {};
          result.gridSpacing[gs.from][gs.to] = gs.distance;
        }
      }
    }

    // Aggregate spot elevations into room floor elevations
    if (sd.spotElevations) {
      for (const se of sd.spotElevations) {
        if (se.type === 'finished_floor' && se.location) {
          const roomMatch = se.location.match(/room\s*(\w+)/i);
          if (roomMatch) {
            const room = roomMatch[1];
            if (!result.roomDimensions[room]) result.roomDimensions[room] = {};
            result.roomDimensions[room].floorElevation = se.value;
          }
        }
      }
    }

    // Aggregate duct sizing data
    if (sd.ductSizing?.length > 0) {
      for (const duct of sd.ductSizing) {
        if (!duct.size) continue;
        result.ductSizing.push({
          ductId: duct.ductId || duct.id || `duct-${result.ductSizing.length}`,
          size: duct.size,
          type: duct.type || 'rectangular',
          cfm: duct.cfm ?? duct.airflow,
          location: duct.location,
          sourceSheet: chunk.sheetNumber || undefined,
        });
      }
    }

    // Aggregate pipe sizing data
    if (sd.pipeSizing?.length > 0) {
      for (const pipe of sd.pipeSizing) {
        if (!pipe.size) continue;
        result.pipeSizing.push({
          pipeId: pipe.pipeId || pipe.id || `pipe-${result.pipeSizing.length}`,
          size: pipe.size,
          material: pipe.material || 'unknown',
          system: pipe.system,
          location: pipe.location,
          sourceSheet: chunk.sheetNumber || undefined,
        });
      }
    }
  }

  // Store aggregation on document
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
          spatialAggregation: result,
        } as any,
      },
    });
  } catch (error) {
    logger.warn('SPATIAL_AGG', 'Failed to store spatial aggregation', { error: (error as Error).message });
  }

  logger.info('SPATIAL_AGG', 'Spatial data aggregation complete', {
    documentId,
    roomCount: Object.keys(result.roomDimensions).length,
    levelCount: Object.keys(result.levels).length,
    ductCount: result.ductSizing.length,
    pipeCount: result.pipeSizing.length,
  });

  return result;
}
