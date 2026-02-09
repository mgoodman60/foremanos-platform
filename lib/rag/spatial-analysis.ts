/**
 * Spatial Analysis Module (Phase 3B)
 *
 * Grid-based spatial referencing, distance calculation,
 * element lookup by grid area, and spatial context generation.
 *
 * Extracted from lib/rag-enhancements.ts
 */

import { prisma } from '@/lib/db';
import type { EnhancedChunk, GridReference } from './types';

/**
 * Extract grid references from content
 */
export function extractGridReferences(chunk: EnhancedChunk): GridReference[] {
  const content = chunk.content;
  const metadata = chunk.metadata || {};
  const gridRefs: GridReference[] = [];

  // Common grid patterns
  const patterns = [
    // Letter-Number format: A.1, A-1, A/1, A1
    /\b([A-Z])[\.\-\/]?(\d+)\b/g,
    // Number-Letter format: 1.A, 1-A, 1/A, 1A
    /\b(\d+)[\.\-\/]?([A-Z])\b/g,
    // Between grids: "between grids A and B"
    /between\s+grids?\s+([A-Z\d])\s+and\s+([A-Z\d])/gi,
    // At grid: "at grid A.1"
    /at\s+grid\s+([A-Z])[\.\-\/]?(\d+)/gi,
    // Grid line references
    /grid\s+line\s+([A-Z\d]+)/gi,
  ];

  // Extract standard grid references
  let match;
  patterns[0].lastIndex = 0;
  while ((match = patterns[0].exec(content)) !== null) {
    gridRefs.push({
      gridId: `${match[1]}.${match[2]}`,
      gridType: 'structural',
      coordinates: {
        x: match[1],
        y: match[2],
      },
      confidence: 'high',
    });
  }

  patterns[1].lastIndex = 0;
  while ((match = patterns[1].exec(content)) !== null) {
    gridRefs.push({
      gridId: `${match[2]}.${match[1]}`,
      gridType: 'structural',
      coordinates: {
        x: match[2],
        y: match[1],
      },
      confidence: 'high',
    });
  }

  // Check metadata for grid information
  if (metadata.grid_lines) {
    const gridLines = Array.isArray(metadata.grid_lines)
      ? metadata.grid_lines
      : [metadata.grid_lines];

    for (const grid of gridLines) {
      if (typeof grid === 'string') {
        gridRefs.push({
          gridId: grid,
          gridType: 'structural',
          confidence: 'high',
        });
      }
    }
  }

  // Remove duplicates
  const uniqueRefs = Array.from(
    new Map(gridRefs.map(ref => [ref.gridId, ref])).values()
  );

  return uniqueRefs;
}

/**
 * Calculate spatial relationships between grid references
 */
export function calculateGridDistance(
  grid1: GridReference,
  grid2: GridReference
): { distance: number; direction: string; confidence: 'high' | 'medium' | 'low' } {
  if (!grid1.coordinates || !grid2.coordinates) {
    return { distance: 0, direction: 'unknown', confidence: 'low' };
  }

  // Calculate letter distance (A-Z)
  const letterDist = Math.abs(
    grid1.coordinates.x.charCodeAt(0) - grid2.coordinates.x.charCodeAt(0)
  );

  // Calculate number distance
  const numberDist = Math.abs(
    parseInt(grid1.coordinates.y) - parseInt(grid2.coordinates.y)
  );

  // Determine direction
  let direction = '';
  if (letterDist > 0) {
    direction += grid1.coordinates.x < grid2.coordinates.x ? 'east' : 'west';
  }
  if (numberDist > 0) {
    if (direction) direction += '-';
    direction += parseInt(grid1.coordinates.y) < parseInt(grid2.coordinates.y) ? 'north' : 'south';
  }

  // Calculate Manhattan distance (grid squares)
  const distance = letterDist + numberDist;

  return {
    distance,
    direction: direction || 'same location',
    confidence: 'high',
  };
}

/**
 * Find all elements within a grid area
 */
export async function findElementsInGridArea(
  projectSlug: string,
  gridArea: { from: string; to: string }
): Promise<EnhancedChunk[]> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        include: {
          DocumentChunk: true,
        },
      },
    },
  });

  if (!project) return [];

  const chunks: EnhancedChunk[] = [];

  for (const doc of project.Document) {
    for (const chunk of doc.DocumentChunk) {
      const gridRefs = extractGridReferences(chunk as EnhancedChunk);

      // Check if any grid reference falls within the specified area
      for (const ref of gridRefs) {
        if (isGridInArea(ref.gridId, gridArea)) {
          chunks.push(chunk as EnhancedChunk);
          break;
        }
      }
    }
  }

  return chunks;
}

/**
 * Helper: Check if a grid reference is within an area
 */
function isGridInArea(gridId: string, area: { from: string; to: string }): boolean {
  // Parse grid coordinates
  const parseGrid = (grid: string) => {
    const match = /([A-Z])[\.\-\/]?(\d+)/.exec(grid);
    if (!match) return null;
    return { letter: match[1], number: parseInt(match[2]) };
  };

  const grid = parseGrid(gridId);
  const from = parseGrid(area.from);
  const to = parseGrid(area.to);

  if (!grid || !from || !to) return false;

  // Check if within bounds
  const letterInRange = grid.letter >= from.letter && grid.letter <= to.letter;
  const numberInRange = grid.number >= from.number && grid.number <= to.number;

  return letterInRange && numberInRange;
}

/**
 * Generate spatial context from grid references
 */
export function generateSpatialContext(
  gridRefs: GridReference[],
  roomNumber?: string
): string {
  if (gridRefs.length === 0 && !roomNumber) {
    return 'Location not specified';
  }

  const parts: string[] = [];

  if (roomNumber) {
    parts.push(`Room ${roomNumber}`);
  }

  if (gridRefs.length > 0) {
    const gridIds = gridRefs.map(ref => ref.gridId).join(', ');
    parts.push(`Grid location: ${gridIds}`);
  }

  if (gridRefs.length >= 2) {
    const distance = calculateGridDistance(gridRefs[0], gridRefs[1]);
    parts.push(`(${distance.distance} grid squares ${distance.direction})`);
  }

  return parts.join(' • ');
}
