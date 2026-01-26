/**
 * Door Schedule Extractor
 * 
 * Extracts detailed door schedule data from architectural drawings:
 * - Door numbers, marks, and types
 * - Physical dimensions (width, height, thickness)
 * - Materials (frame, door leaf, glazing)
 * - Hardware sets (hinges, locksets, closers)
 * - Fire ratings
 * - Special features (louvers, kickplates, weatherstripping)
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ExtractedDoor {
  doorNumber: string;
  doorMark?: string;
  doorType: string;
  roomNumber?: string;
  fromRoom?: string;
  toRoom?: string;
  width?: string;
  height?: string;
  thickness?: string;
  frameMaterial?: string;
  frameType?: string;
  doorMaterial?: string;
  glazing?: string;
  hardwareSet?: string;
  hinges?: string;
  lockset?: string;
  closer?: string;
  fireRating?: string;
  smokeRating?: boolean;
  louver?: boolean;
  kickplate?: boolean;
  weatherstrip?: boolean;
  threshold?: string;
  notes?: string;
  sourceSheet?: string;
}

export interface DoorScheduleExtractionResult {
  doors: ExtractedDoor[];
  doorTypes: Record<string, string>;
  hardwareSets: Record<string, string>;
  sourceDocument?: string;
  extractedAt: Date;
}

// ============================================================================
// DOOR SCHEDULE EXTRACTION
// ============================================================================

/**
 * Extract door schedule from document text using LLM
 */
export async function extractDoorScheduleFromText(
  documentText: string,
  sourceSheetNumber?: string
): Promise<DoorScheduleExtractionResult> {
  const prompt = `You are a construction document expert. Extract all door schedule information from this document.

Focus on:
1. Door Schedule tables (typically show door number, width, height, type, frame, hardware set)
2. Door Type Legend (shows mark codes like "A", "B", "C" with descriptions)
3. Hardware Set Legend (shows hardware groups and their components)
4. Fire rating requirements
5. Special features (louvers, vision panels, kickplates)

Return a JSON object with this structure:
{
  "doors": [
    {
      "doorNumber": "101",
      "doorMark": "A",
      "doorType": "3'-0\" x 7'-0\" HOLLOW METAL",
      "roomNumber": "101",
      "fromRoom": "CORRIDOR",
      "toRoom": "OFFICE",
      "width": "3'-0\"",
      "height": "7'-0\"",
      "thickness": "1-3/4\"",
      "frameMaterial": "HM",
      "frameType": "K",
      "doorMaterial": "HM",
      "glazing": null,
      "hardwareSet": "1",
      "hinges": "3 - 4-1/2\" X 4-1/2\"",
      "lockset": "MORTISE LOCK",
      "closer": "LCN 4040XP",
      "fireRating": "20 MIN",
      "smokeRating": false,
      "louver": false,
      "kickplate": true,
      "weatherstrip": false,
      "threshold": "SADDLE",
      "notes": "ADA COMPLIANT"
    }
  ],
  "doorTypes": {
    "A": "HOLLOW METAL DOOR AND FRAME",
    "B": "WOOD DOOR IN HOLLOW METAL FRAME"
  },
  "hardwareSets": {
    "1": "ENTRY LOCK, CLOSER, KICK PLATE",
    "2": "PASSAGE SET ONLY"
  }
}

Document text:
${documentText.substring(0, 15000)}`;

  try {
    const response = await callAbacusLLM(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, max_tokens: 4000 }
    );

    // Parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[DoorScheduleExtractor] No valid JSON found in response');
      return { doors: [], doorTypes: {}, hardwareSets: {}, extractedAt: new Date() };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Add source sheet to all doors
    const doors = (parsed.doors || []).map((door: ExtractedDoor) => ({
      ...door,
      sourceSheet: sourceSheetNumber || door.sourceSheet,
    }));

    return {
      doors,
      doorTypes: parsed.doorTypes || {},
      hardwareSets: parsed.hardwareSets || {},
      extractedAt: new Date(),
    };
  } catch (error) {
    console.error('[DoorScheduleExtractor] Extraction failed:', error);
    return { doors: [], doorTypes: {}, hardwareSets: {}, extractedAt: new Date() };
  }
}

/**
 * Store extracted door schedule data in the database
 */
export async function storeDoorScheduleData(
  projectId: string,
  extractionResult: DoorScheduleExtractionResult,
  sourceDocumentId?: string
): Promise<{ created: number; updated: number; errors: string[] }> {
  const stats = { created: 0, updated: 0, errors: [] as string[] };

  for (const door of extractionResult.doors) {
    try {
      // Try to find room by room number for linking
      let roomId: string | undefined;
      if (door.roomNumber) {
        const room = await prisma.room.findFirst({
          where: {
            projectId,
            OR: [
              { roomNumber: door.roomNumber },
              { name: { contains: door.roomNumber } },
            ],
          },
        });
        if (room) roomId = room.id;
      }

      // Upsert door schedule item
      await prisma.doorScheduleItem.upsert({
        where: {
          projectId_doorNumber: {
            projectId,
            doorNumber: door.doorNumber,
          },
        },
        create: {
          projectId,
          roomId,
          doorNumber: door.doorNumber,
          doorMark: door.doorMark,
          doorType: door.doorType,
          roomNumber: door.roomNumber,
          fromRoom: door.fromRoom,
          toRoom: door.toRoom,
          width: door.width,
          height: door.height,
          thickness: door.thickness,
          frameMaterial: door.frameMaterial,
          frameType: door.frameType,
          doorMaterial: door.doorMaterial,
          glazing: door.glazing,
          hardwareSet: door.hardwareSet,
          hinges: door.hinges,
          lockset: door.lockset,
          closer: door.closer,
          fireRating: door.fireRating,
          smokeRating: door.smokeRating || false,
          louver: door.louver || false,
          kickplate: door.kickplate || false,
          weatherstrip: door.weatherstrip || false,
          threshold: door.threshold,
          notes: door.notes,
          sourceDocumentId,
          sourceSheetNumber: door.sourceSheet,
        },
        update: {
          roomId,
          doorMark: door.doorMark,
          doorType: door.doorType,
          roomNumber: door.roomNumber,
          fromRoom: door.fromRoom,
          toRoom: door.toRoom,
          width: door.width,
          height: door.height,
          thickness: door.thickness,
          frameMaterial: door.frameMaterial,
          frameType: door.frameType,
          doorMaterial: door.doorMaterial,
          glazing: door.glazing,
          hardwareSet: door.hardwareSet,
          hinges: door.hinges,
          lockset: door.lockset,
          closer: door.closer,
          fireRating: door.fireRating,
          smokeRating: door.smokeRating || false,
          louver: door.louver || false,
          kickplate: door.kickplate || false,
          weatherstrip: door.weatherstrip || false,
          threshold: door.threshold,
          notes: door.notes,
          sourceDocumentId,
          sourceSheetNumber: door.sourceSheet,
        },
      });

      stats.created++;
    } catch (error) {
      const errorMsg = `Failed to store door ${door.doorNumber}: ${error}`;
      console.error('[DoorScheduleExtractor]', errorMsg);
      stats.errors.push(errorMsg);
    }
  }

  console.log(`[DoorScheduleExtractor] Stored ${stats.created} doors for project ${projectId}`);
  return stats;
}

/**
 * Get door schedule context for RAG queries
 */
export async function getDoorScheduleContext(projectSlug: string): Promise<string | null> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });

    if (!project) return null;

    const doors = await prisma.doorScheduleItem.findMany({
      where: { projectId: project.id },
      orderBy: { doorNumber: 'asc' },
    });

    if (doors.length === 0) return null;

    // Build context string
    let context = `=== DOOR SCHEDULE (${doors.length} doors) ===\n\n`;

    // Group by fire rating for summary
    const byFireRating: Record<string, typeof doors> = {};
    doors.forEach((door) => {
      const rating = door.fireRating || 'Non-Rated';
      if (!byFireRating[rating]) byFireRating[rating] = [];
      byFireRating[rating].push(door);
    });

    context += 'Fire Rating Summary:\n';
    Object.entries(byFireRating).forEach(([rating, doorList]) => {
      context += `  ${rating}: ${doorList.length} doors\n`;
    });
    context += '\n';

    // List all doors
    context += 'Door Details:\n';
    doors.forEach((door) => {
      context += `  ${door.doorNumber}: ${door.doorType}`;
      if (door.width && door.height) context += ` (${door.width} x ${door.height})`;
      if (door.fireRating) context += ` [${door.fireRating}]`;
      if (door.roomNumber) context += ` @ Room ${door.roomNumber}`;
      if (door.hardwareSet) context += ` HW Set: ${door.hardwareSet}`;
      context += '\n';
    });

    return context;
  } catch (error) {
    console.error('[DoorScheduleExtractor] Failed to get context:', error);
    return null;
  }
}

/**
 * Extract and store door schedule from a project's documents
 */
export async function processDoorScheduleForProject(
  projectId: string,
  documentId?: string
): Promise<{ success: boolean; doorsExtracted: number; errors: string[] }> {
  try {
    // Get architectural documents that likely contain door schedules
    const whereClause: any = {
      projectId,
      deletedAt: null,
      OR: [
        { name: { contains: 'door', mode: 'insensitive' } },
        { name: { contains: 'schedule', mode: 'insensitive' } },
        { name: { contains: 'architectural', mode: 'insensitive' } },
        { category: 'ARCHITECTURAL' },
      ],
    };

    if (documentId) {
      whereClause.id = documentId;
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        DocumentChunk: {
          where: {
            OR: [
              { content: { contains: 'door schedule', mode: 'insensitive' } },
              { content: { contains: 'door type', mode: 'insensitive' } },
              { content: { contains: 'hardware set', mode: 'insensitive' } },
            ],
          },
          orderBy: { pageNumber: 'asc' },
        },
      },
    });

    let totalDoors = 0;
    const allErrors: string[] = [];

    for (const doc of documents) {
      if (doc.DocumentChunk.length === 0) continue;

      // Combine relevant chunks
      const combinedText = doc.DocumentChunk.map((chunk) => chunk.content).join('\n\n');

      // Extract door schedule
      const extraction = await extractDoorScheduleFromText(
        combinedText,
        doc.DocumentChunk[0]?.sheetNumber || undefined
      );

      if (extraction.doors.length > 0) {
        const result = await storeDoorScheduleData(projectId, extraction, doc.id);
        totalDoors += result.created;
        allErrors.push(...result.errors);
      }
    }

    return {
      success: allErrors.length === 0,
      doorsExtracted: totalDoors,
      errors: allErrors,
    };
  } catch (error) {
    console.error('[DoorScheduleExtractor] Processing failed:', error);
    return {
      success: false,
      doorsExtracted: 0,
      errors: [String(error)],
    };
  }
}


/**
 * Get the primary door type for a room
 */
export async function getPrimaryDoorTypeForRoom(
  projectId: string,
  roomNumber: string
): Promise<string | null> {
  try {
    const door = await prisma.doorScheduleItem.findFirst({
      where: {
        projectId,
        OR: [
          { roomNumber: roomNumber },
          { fromRoom: { contains: roomNumber, mode: 'insensitive' } },
          { toRoom: { contains: roomNumber, mode: 'insensitive' } },
        ],
      },
      select: { doorType: true },
    });

    return door?.doorType || null;
  } catch (error) {
    console.error('[DoorScheduleExtractor] Error getting door type:', error);
    return null;
  }
}