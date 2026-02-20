/**
 * Location/Room Detection Service
 * Extracts room numbers, locations, and spatial information from floor plans
 */

import { prisma } from './db';
import { logger } from './logger';

interface RoomData {
  name: string;
  roomNumber?: string;
  type: string;
  floorNumber?: number;
  area?: number;
  gridLocation?: string;
  sheetId?: string;
}

/**
 * Extract rooms from document chunks (already processed floor plans)
 */
export async function extractRoomsFromDocument(
  documentId: string,
  _projectId: string
): Promise<RoomData[]> {
  try {
    logger.info('LOCATION_DETECTOR', 'Extracting rooms from document', { documentId });

    // Get document chunks with room data
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' }
    });

    const rooms: RoomData[] = [];
    const seenRoomNumbers = new Set<string>();

    for (const chunk of chunks) {
      const metadata = chunk.metadata as any;
      
      // Extract room numbers from metadata
      if (metadata?.roomNumbers && Array.isArray(metadata.roomNumbers)) {
        for (const roomNum of metadata.roomNumbers) {
          if (!seenRoomNumbers.has(roomNum)) {
            seenRoomNumbers.add(roomNum);
            rooms.push({
              name: `Room ${roomNum}`,
              roomNumber: roomNum,
              type: detectRoomType(roomNum, chunk.content),
              sheetId: metadata.sheet_number || (chunk.pageNumber?.toString() || 'unknown'),
              gridLocation: metadata.grid_location
            });
          }
        }
      }

      // Parse room numbers from content
      const contentRooms = parseRoomNumbers(chunk.content);
      for (const room of contentRooms) {
        if (!seenRoomNumbers.has(room.roomNumber || room.name)) {
          seenRoomNumbers.add(room.roomNumber || room.name);
          rooms.push({
            ...room,
            sheetId: metadata?.sheet_number || (chunk.pageNumber?.toString() || 'unknown')
          });
        }
      }
    }

    logger.info('LOCATION_DETECTOR', `Found ${rooms.length} rooms`);
    return rooms;
  } catch (error) {
    logger.error('LOCATION_DETECTOR', 'Error extracting rooms', error as Error);
    throw error;
  }
}

/**
 * Parse room numbers from text content
 */
function parseRoomNumbers(content: string): RoomData[] {
  const rooms: RoomData[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Pattern 1: "Room 101" or "ROOM 101"
    const roomMatch = line.match(/\bROOM\s+([A-Z]?\d{2,4}[A-Z]?)\b/i);
    if (roomMatch) {
      const roomNum = roomMatch[1];
      rooms.push({
        name: `Room ${roomNum}`,
        roomNumber: roomNum,
        type: detectRoomType(roomNum, line)
      });
      continue;
    }

    // Pattern 2: "Unit 203" or "Suite 101"
    const unitMatch = line.match(/\b(?:UNIT|SUITE)\s+([A-Z]?\d{2,4}[A-Z]?)\b/i);
    if (unitMatch) {
      const roomNum = unitMatch[1];
      rooms.push({
        name: `Unit ${roomNum}`,
        roomNumber: roomNum,
        type: 'unit'
      });
      continue;
    }

    // Pattern 3: Standalone room numbers (e.g., "203", "B-101")
    const standaloneMatch = line.match(/\b([A-Z]?\d{2,4}[A-Z]?)\s*-?\s*(Office|Bath|Kitchen|Bedroom|Living|Storage)/i);
    if (standaloneMatch) {
      const roomNum = standaloneMatch[1];
      const roomType = standaloneMatch[2].toLowerCase();
      rooms.push({
        name: `${standaloneMatch[2]} ${roomNum}`,
        roomNumber: roomNum,
        type: roomType
      });
    }
  }

  return rooms;
}

/**
 * Detect room type from room number and context
 */
function detectRoomType(roomNumber: string, context: string): string {
  const lowerContext = context.toLowerCase();

  // Common room type keywords
  if (lowerContext.includes('bathroom') || lowerContext.includes('wc') || lowerContext.includes('restroom')) {
    return 'bathroom';
  }
  if (lowerContext.includes('kitchen') || lowerContext.includes('pantry')) {
    return 'kitchen';
  }
  if (lowerContext.includes('bedroom') || lowerContext.includes('bed')) {
    return 'bedroom';
  }
  if (lowerContext.includes('office')) {
    return 'office';
  }
  if (lowerContext.includes('living') || lowerContext.includes('lounge')) {
    return 'living';
  }
  if (lowerContext.includes('mechanical') || lowerContext.includes('mech') || lowerContext.includes('hvac')) {
    return 'mechanical';
  }
  if (lowerContext.includes('electrical') || lowerContext.includes('elec')) {
    return 'electrical';
  }
  if (lowerContext.includes('storage') || lowerContext.includes('closet')) {
    return 'storage';
  }
  if (lowerContext.includes('lobby') || lowerContext.includes('entrance') || lowerContext.includes('corridor') || lowerContext.includes('hallway')) {
    return 'common_area';
  }

  // Default based on room number patterns
  if (roomNumber.match(/^M/i)) return 'mechanical';
  if (roomNumber.match(/^E/i)) return 'electrical';
  
  return 'other';
}

/**
 * Create rooms in database from extracted data
 */
export async function createRoomsFromExtraction(
  projectId: string,
  rooms: RoomData[],
  _userId: string
): Promise<number> {
  let created = 0;

  for (const roomData of rooms) {
    try {
      // Check if room already exists
      if (roomData.roomNumber) {
        const existing = await prisma.room.findUnique({
          where: {
            projectId_roomNumber: {
              projectId,
              roomNumber: roomData.roomNumber
            }
          }
        });

        if (existing) {
          logger.info('LOCATION_DETECTOR', `Room ${roomData.roomNumber} already exists, skipping`);
          continue;
        }
      }

      // Create new room
      await prisma.room.create({
        data: {
          projectId,
          name: roomData.name,
          roomNumber: roomData.roomNumber,
          type: roomData.type,
          floorNumber: roomData.floorNumber,
          area: roomData.area,
          gridLocation: roomData.gridLocation,
          sheetId: roomData.sheetId
        }
      });

      created++;
    } catch (error: any) {
      logger.error('LOCATION_DETECTOR', `Error creating room ${roomData.name}`, undefined, { error: error.message });
    }
  }

  logger.info('LOCATION_DETECTOR', `Created ${created} new rooms`);
  return created;
}

/**
 * Get room progress summary for a project
 */
export async function getRoomProgressSummary(projectId: string) {
  const rooms = await prisma.room.findMany({
    where: { projectId },
    select: {
      id: true,
      status: true,
      percentComplete: true,
      type: true
    }
  });

  const totalRooms = rooms.length;
  const completed = rooms.filter((r: any) => r.status === 'completed').length;
  const inProgress = rooms.filter((r: any) => r.status === 'in_progress').length;
  const notStarted = rooms.filter((r: any) => r.status === 'not_started').length;

  // Group by type
  const byType: Record<string, number> = {};
  for (const room of rooms) {
    byType[room.type] = (byType[room.type] || 0) + 1;
  }

  const avgProgress = totalRooms > 0
    ? rooms.reduce((sum: any, r: any) => sum + r.percentComplete, 0) / totalRooms
    : 0;

  return {
    totalRooms,
    completed,
    inProgress,
    notStarted,
    averageProgress: Math.round(avgProgress * 10) / 10,
    byType
  };
}

// ============================================================================
// LEGACY COMPATIBILITY - Stub functions for old location features
// ============================================================================

export interface LocationData {
  room?: string;
  floor?: number;
  zone?: string;
  location_identifier?: string;
  location_type?: string;
}

export interface AvailableLocations {
  rooms: any[];
  floors: number[];
  zones: string[];
  areas: any[];
  elevations: any[];
  siteZones: any[];
  hasPlans?: boolean;
}

/**
 * STUB: Parse location data from text response
 */
export function parseLocationResponse(_text: string, _availableLocations: AvailableLocations): LocationData | null {
  logger.info('LOCATION_DETECTOR', 'parseLocationResponse - stub implementation');
  return null;
}

/**
 * STUB: Structure location data
 */
export function structureLocationData(_locationType: string, _locationIdentifier: string, _activity: string): LocationData {
  logger.info('LOCATION_DETECTOR', 'structureLocationData - stub implementation');
  return {};
}

/**
 * STUB: Validate location data
 */
export function validateLocation(_locationIdentifier: string, _locationType: string): boolean {
  logger.info('LOCATION_DETECTOR', 'validateLocation - stub implementation');
  return true;
}

/**
 * STUB: Find available locations in project
 */
export async function findAvailableLocations(_projectId: string): Promise<AvailableLocations> {
  logger.info('LOCATION_DETECTOR', 'findAvailableLocations - stub implementation');
  return {
    rooms: [],
    floors: [],
    zones: [],
    areas: [],
    elevations: [],
    siteZones: []
  };
}
