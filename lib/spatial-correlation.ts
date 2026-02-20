/**
 * Multi-Sheet Spatial Correlation System
 * Enables coordinate mapping and spatial queries across multiple construction drawing sheets
 * 
 * Features:
 * - Grid coordinate normalization across disciplines (A/S/M/E/P)
 * - Spatial relationship mapping between sheets
 * - Coordinate transformation and alignment
 * - Cross-sheet location queries
 */

import { prisma } from './db';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface GridCoordinate {
  x: string; // e.g., "A", "B", "C" or "1", "2", "3"
  y: string;
  numeric?: { x: number; y: number }; // Converted to numeric for calculations
}

export interface SpatialReference {
  sheetNumber: string;
  discipline: 'architectural' | 'structural' | 'mechanical' | 'electrical' | 'plumbing' | 'civil' | 'unknown';
  gridSystem: GridCoordinate[];
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  scale?: string;
  orientation?: 'portrait' | 'landscape';
}

export interface SpatialMatch {
  sourceSheet: string;
  targetSheet: string;
  matchType: 'grid' | 'room' | 'element' | 'coordinate';
  confidence: number; // 0-1
  location: {
    description: string;
    grid?: GridCoordinate;
    coordinates?: { x: number; y: number };
  };
  context?: string;
}

export interface CrossSheetQuery {
  location: string; // e.g., "Grid A-3", "Room 101", "Northeast corner"
  disciplines?: string[];
  includeRelated?: boolean;
}

// ============================================================================
// GRID SYSTEM UTILITIES
// ============================================================================

/**
 * Parse grid coordinate from various formats
 * Examples: "A-3", "A/3", "Grid A-3", "Between A-3 and A-4"
 */
export function parseGridCoordinate(text: string): GridCoordinate | null {
  // Remove common prefixes
  const cleaned = text.replace(/^(grid|at|between)\s+/i, '').trim();
  
  // Pattern: Letter-Number (A-3, B-12, etc.)
  const letterNumber = /([A-Z]+)[-\/\s]+(\d+)/i.exec(cleaned);
  if (letterNumber) {
    return {
      x: letterNumber[1].toUpperCase(),
      y: letterNumber[2],
      numeric: {
        x: letterToNumber(letterNumber[1].toUpperCase()),
        y: parseInt(letterNumber[2])
      }
    };
  }
  
  // Pattern: Number-Letter (3-A, 12-B, etc.) - less common but exists
  const numberLetter = /(\d+)[-\/\s]+([A-Z]+)/i.exec(cleaned);
  if (numberLetter) {
    return {
      x: numberLetter[1],
      y: numberLetter[2].toUpperCase(),
      numeric: {
        x: parseInt(numberLetter[1]),
        y: letterToNumber(numberLetter[2].toUpperCase())
      }
    };
  }
  
  return null;
}

/**
 * Convert letter coordinate to number (A=1, B=2, ..., Z=26, AA=27, etc.)
 */
function letterToNumber(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result;
}

/**
 * Convert number to letter coordinate (1=A, 2=B, ..., 26=Z, 27=AA, etc.)
 */
function _numberToLetter(num: number): string {
  let result = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 * Calculate distance between two grid coordinates
 */
export function calculateGridDistance(
  grid1: GridCoordinate,
  grid2: GridCoordinate
): number {
  if (!grid1.numeric || !grid2.numeric) {
    return Infinity;
  }
  
  const dx = grid2.numeric.x - grid1.numeric.x;
  const dy = grid2.numeric.y - grid1.numeric.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two grid coordinates are adjacent
 */
export function areGridsAdjacent(
  grid1: GridCoordinate,
  grid2: GridCoordinate
): boolean {
  const distance = calculateGridDistance(grid1, grid2);
  return distance <= Math.sqrt(2); // Adjacent or diagonal
}

// ============================================================================
// SHEET ANALYSIS
// ============================================================================

/**
 * Extract grid system from a sheet's chunk data
 */
export async function extractGridSystem(
  projectSlug: string,
  sheetNumber: string
): Promise<SpatialReference | null> {
  try {
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          Project: { slug: projectSlug }
        },
        metadata: {
          path: ['sheet_number'],
          equals: sheetNumber
        }
      },
      take: 10 // Get first few chunks to analyze
    });
    
    if (chunks.length === 0) return null;
    
    const gridCoordinates: GridCoordinate[] = [];
    let discipline: SpatialReference['discipline'] = 'unknown';
    let scale: string | undefined;
    
    // Analyze chunks for grid references
    for (const chunk of chunks) {
      const metadata = chunk.metadata as any;
      
      // Extract discipline from sheet type or title
      if (metadata?.drawing_type) {
        discipline = inferDiscipline(metadata.drawing_type);
      }
      
      // Extract scale
      if (metadata?.scaleData?.primaryScale) {
        scale = metadata.scaleData.primaryScale;
      }
      
      // Extract grid coordinates from content and cross-references
      const content = chunk.content || '';
      const gridMatches = content.match(/\b[A-Z][-\/]\d+\b|\bgrid\s+[A-Z][-\/]\d+/gi);
      
      if (gridMatches) {
        for (const match of gridMatches) {
          const coord = parseGridCoordinate(match);
          if (coord && !gridCoordinates.some(g => 
            g.x === coord.x && g.y === coord.y
          )) {
            gridCoordinates.push(coord);
          }
        }
      }
      
      // Extract from cross-references if available
      if (metadata?.crossReferences) {
        for (const ref of metadata.crossReferences) {
          const coord = parseGridCoordinate(ref.location || ref.context || '');
          if (coord && !gridCoordinates.some(g => 
            g.x === coord.x && g.y === coord.y
          )) {
            gridCoordinates.push(coord);
          }
        }
      }
    }
    
    // Calculate bounds if we have coordinates
    let bounds: SpatialReference['bounds'] | undefined;
    if (gridCoordinates.length > 0 && gridCoordinates.every(g => g.numeric)) {
      const xValues = gridCoordinates.map(g => g.numeric!.x);
      const yValues = gridCoordinates.map(g => g.numeric!.y);
      
      bounds = {
        minX: Math.min(...xValues),
        maxX: Math.max(...xValues),
        minY: Math.min(...yValues),
        maxY: Math.max(...yValues)
      };
    }
    
    return {
      sheetNumber,
      discipline,
      gridSystem: gridCoordinates,
      bounds,
      scale
    };
  } catch (error) {
    logger.error('SPATIAL_CORRELATION', 'Error extracting grid system', error instanceof Error ? error : undefined, { sheetNumber });
    return null;
  }
}

/**
 * Infer discipline from drawing type or title
 */
function inferDiscipline(drawingType: string): SpatialReference['discipline'] {
  const type = drawingType.toLowerCase();
  
  if (type.includes('arch') || type.includes('floor plan') || type.includes('elevation')) {
    return 'architectural';
  }
  if (type.includes('struct') || type.includes('foundation') || type.includes('framing')) {
    return 'structural';
  }
  if (type.includes('mech') || type.includes('hvac') || type.includes('ventilation')) {
    return 'mechanical';
  }
  if (type.includes('elec') || type.includes('power') || type.includes('lighting')) {
    return 'electrical';
  }
  if (type.includes('plumb') || type.includes('sanitary') || type.includes('water')) {
    return 'plumbing';
  }
  if (type.includes('civil') || type.includes('site') || type.includes('grading')) {
    return 'civil';
  }
  
  return 'unknown';
}

// ============================================================================
// CROSS-SHEET CORRELATION
// ============================================================================

/**
 * Find all sheets that reference a specific location
 */
export async function findSheetsAtLocation(
  projectSlug: string,
  query: CrossSheetQuery
): Promise<SpatialMatch[]> {
  try {
    const matches: SpatialMatch[] = [];
    
    // Parse the location query
    const gridCoord = parseGridCoordinate(query.location);
    
    // Get all relevant chunks
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          Project: { slug: projectSlug }
        }
      }
    });
    
    // Search through chunks for matches
    for (const chunk of chunks) {
      const metadata = chunk.metadata as any;
      const sheetNumber = metadata?.sheet_number || 'unknown';
      const discipline = inferDiscipline(metadata?.drawing_type || '');
      
      // Skip if discipline filter is specified and doesn't match
      if (query.disciplines && query.disciplines.length > 0) {
        if (!query.disciplines.includes(discipline)) {
          continue;
        }
      }
      
      const content = chunk.content || '';
      let matchFound = false;
      let matchType: SpatialMatch['matchType'] = 'coordinate';
      let confidence = 0;
      let matchLocation: { description: string; grid?: GridCoordinate; coordinates?: { x: number; y: number } } = { description: query.location };
      
      // Check for grid coordinate match
      if (gridCoord) {
        const chunkGrids = extractGridsFromText(content);
        const exactMatch = chunkGrids.find(g => 
          g.x === gridCoord.x && g.y === gridCoord.y
        );
        
        if (exactMatch) {
          matchFound = true;
          matchType = 'grid';
          confidence = 1.0;
          matchLocation = {
            description: `Grid ${gridCoord.x}-${gridCoord.y}`,
            grid: gridCoord
          };
        } else if (query.includeRelated) {
          // Check for adjacent grids
          const adjacent = chunkGrids.find(g => 
            areGridsAdjacent(g, gridCoord)
          );
          if (adjacent) {
            matchFound = true;
            matchType = 'grid';
            confidence = 0.7;
            matchLocation = {
              description: `Near Grid ${gridCoord.x}-${gridCoord.y}`,
              grid: gridCoord
            };
          }
        }
      }
      
      // Check for room number match
      if (!matchFound && /room\s+\d+|#\d+/i.test(query.location)) {
        const roomMatch = query.location.match(/\d+/);
        if (roomMatch) {
          const roomNumber = roomMatch[0];
          if (new RegExp(`\\b${roomNumber}\\b`, 'i').test(content)) {
            matchFound = true;
            matchType = 'room';
            confidence = 0.9;
            matchLocation = { description: `Room ${roomNumber}` };
          }
        }
      }
      
      // Check for general location match (fuzzy)
      if (!matchFound && query.includeRelated) {
        const queryLower = query.location.toLowerCase();
        const contentLower = content.toLowerCase();
        
        if (contentLower.includes(queryLower)) {
          matchFound = true;
          matchType = 'element';
          confidence = 0.5;
          matchLocation = { description: query.location };
        }
      }
      
      if (matchFound) {
        matches.push({
          sourceSheet: sheetNumber,
          targetSheet: sheetNumber,
          matchType,
          confidence,
          location: matchLocation,
          context: content.substring(0, 200)
        });
      }
    }
    
    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);
    
    return matches;
  } catch (error) {
    logger.error('SPATIAL_CORRELATION', 'Error finding sheets at location', error instanceof Error ? error : undefined);
    return [];
  }
}

/**
 * Extract all grid coordinates from text
 */
function extractGridsFromText(text: string): GridCoordinate[] {
  const grids: GridCoordinate[] = [];
  const matches = text.match(/\b[A-Z][-\/]\d+\b|\bgrid\s+[A-Z][-\/]\d+/gi);
  
  if (matches) {
    for (const match of matches) {
      const coord = parseGridCoordinate(match);
      if (coord && !grids.some(g => g.x === coord.x && g.y === coord.y)) {
        grids.push(coord);
      }
    }
  }
  
  return grids;
}

/**
 * Get spatial relationships between two sheets
 */
export async function correlateTwoSheets(
  projectSlug: string,
  sheet1: string,
  sheet2: string
): Promise<{
  commonGrids: GridCoordinate[];
  commonRooms: string[];
  spatialOverlap: number; // 0-1
  discipline1: string;
  discipline2: string;
} | null> {
  try {
    const ref1 = await extractGridSystem(projectSlug, sheet1);
    const ref2 = await extractGridSystem(projectSlug, sheet2);
    
    if (!ref1 || !ref2) return null;
    
    // Find common grid coordinates
    const commonGrids = ref1.gridSystem.filter(g1 =>
      ref2.gridSystem.some(g2 => g1.x === g2.x && g1.y === g2.y)
    );
    
    // Calculate spatial overlap if both have bounds
    let spatialOverlap = 0;
    if (ref1.bounds && ref2.bounds) {
      const xOverlap = Math.max(0,
        Math.min(ref1.bounds.maxX, ref2.bounds.maxX) -
        Math.max(ref1.bounds.minX, ref2.bounds.minX)
      );
      const yOverlap = Math.max(0,
        Math.min(ref1.bounds.maxY, ref2.bounds.maxY) -
        Math.max(ref1.bounds.minY, ref2.bounds.minY)
      );
      
      const area1 = (ref1.bounds.maxX - ref1.bounds.minX) * 
                     (ref1.bounds.maxY - ref1.bounds.minY);
      const area2 = (ref2.bounds.maxX - ref2.bounds.minX) * 
                     (ref2.bounds.maxY - ref2.bounds.minY);
      const overlapArea = xOverlap * yOverlap;
      
      spatialOverlap = overlapArea / Math.min(area1, area2);
    }
    
    // Extract room numbers from both sheets
    const chunks1 = await prisma.documentChunk.findMany({
      where: {
        Document: { Project: { slug: projectSlug } },
        metadata: { path: ['sheet_number'], equals: sheet1 }
      }
    });
    
    const chunks2 = await prisma.documentChunk.findMany({
      where: {
        Document: { Project: { slug: projectSlug } },
        metadata: { path: ['sheet_number'], equals: sheet2 }
      }
    });
    
    const rooms1 = extractRoomNumbers(chunks1.map((c: any) => c.content).join(' '));
    const rooms2 = extractRoomNumbers(chunks2.map((c: any) => c.content).join(' '));
    const commonRooms = rooms1.filter(r => rooms2.includes(r));
    
    return {
      commonGrids,
      commonRooms,
      spatialOverlap,
      discipline1: ref1.discipline,
      discipline2: ref2.discipline
    };
  } catch (error) {
    logger.error('SPATIAL_CORRELATION', 'Error correlating sheets', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Extract room numbers from text
 */
function extractRoomNumbers(text: string): string[] {
  const rooms: string[] = [];
  const matches = text.match(/\broom\s+(\d+)|#(\d+)|\b(\d{3,4})\b(?=\s*(office|conference|storage|mech|elec))/gi);
  
  if (matches) {
    for (const match of matches) {
      const number = match.match(/\d+/)?.[0];
      if (number && !rooms.includes(number)) {
        rooms.push(number);
      }
    }
  }
  
  return rooms;
}

// ============================================================================
// COORDINATE TRANSFORMATION
// ============================================================================

/**
 * Transform a coordinate from one sheet's coordinate system to another
 * Useful for overlaying different discipline sheets
 */
export async function transformCoordinate(
  projectSlug: string,
  fromSheet: string,
  toSheet: string,
  coordinate: GridCoordinate
): Promise<GridCoordinate | null> {
  try {
    const correlation = await correlateTwoSheets(projectSlug, fromSheet, toSheet);
    
    if (!correlation || correlation.commonGrids.length < 2) {
      // Not enough common grids to establish transformation
      return null;
    }
    
    // For now, if the coordinate exists in common grids, it's a direct match
    const match = correlation.commonGrids.find(g => 
      g.x === coordinate.x && g.y === coordinate.y
    );
    
    return match || null;
  } catch (error) {
    logger.error('SPATIAL_CORRELATION', 'Error transforming coordinate', error instanceof Error ? error : undefined);
    return null;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const spatialCorrelation = {
  parseGridCoordinate,
  calculateGridDistance,
  areGridsAdjacent,
  extractGridSystem,
  findSheetsAtLocation,
  correlateTwoSheets,
  transformCoordinate
};
