/**
 * Room Extraction Service
 * 
 * Extracts room information and finish schedules from construction documents
 * using the RAG system and LLM API.
 */

import { prisma } from './db';
import { createScopedLogger } from './logger';
import { getCSIDivisionByNumber, type CSIDivision } from './csi-divisions';
import { callAbacusLLM } from './abacus-llm';
import { generateAbbreviationContext } from './construction-abbreviations';
import { EXTRACTION_MODEL } from '@/lib/model-config';

const log = createScopedLogger('ROOM_EXTRACTOR');

interface ExtractedRoom {
  roomNumber: string;
  roomType: string;
  floor: string;
  area?: number;
  notes?: string;
  finishItems?: ExtractedFinishItem[];
}

interface ExtractedFinishItem {
  category: 'flooring' | 'walls' | 'ceiling' | 'base' | 'doors' | 'windows' | 'fixtures' | 'other';
  finishType?: string;
  material: string;
  manufacturer?: string;
  modelNumber?: string;
  color?: string;
  dimensions?: string;
  notes?: string;
  csiCode?: string;
}

interface ExtractionResult {
  rooms: ExtractedRoom[];
  summary: string;
  documentsProcessed: number;
}

/**
 * Extract rooms and finish schedules from project documents
 */
export async function extractRoomsFromDocuments(
  projectSlug: string
): Promise<ExtractionResult> {
  log.info('Starting extraction', { projectSlug });
  
  // Get project
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        where: {
          processed: true,
          deletedAt: null,
        },
        include: {
          DocumentChunk: true,
        },
      },
    },
  });

  if (!project) {
    log.error('Project not found', undefined, { projectSlug });
    throw new Error('Project not found');
  }

  log.info('Found project', { projectName: project.name, documentCount: project.Document.length });

  // Gather all relevant document chunks
  const relevantChunks: string[] = [];
  let documentsProcessed = 0;

  for (const doc of project.Document) {
    const chunks = doc.DocumentChunk || [];
    if (chunks.length > 0) {
      documentsProcessed++;
      log.info('Processing document', { documentName: doc.name, chunkCount: chunks.length });
      // Add chunks that might contain room or finish information
      for (const chunk of chunks) {
        if (chunk.content && chunk.content.trim().length > 0) {
          relevantChunks.push(chunk.content);
        }
      }
    }
  }

  log.info('Collected chunks', { chunkCount: relevantChunks.length, documentsProcessed });

  if (relevantChunks.length === 0) {
    log.info('No document chunks found');
    return {
      rooms: [],
      summary: 'No processed documents with content found. Please upload and process construction documents first.',
      documentsProcessed: 0,
    };
  }

  // Use LLM API to extract structured room data
  try {
    const extractedRooms = await extractRoomDataWithLLM(
      relevantChunks,
      project.name
    );

    log.info('Extraction complete', { roomCount: extractedRooms.length });

    return {
      rooms: extractedRooms,
      summary: `Successfully extracted ${extractedRooms.length} rooms from ${documentsProcessed} documents.`,
      documentsProcessed,
    };
  } catch (llmError: any) {
    log.error('LLM extraction error', llmError as Error);
    throw new Error(`Failed to extract rooms: ${llmError?.message || 'Unknown error'}`);
  }
}

/**
 * Extract room numbers using pattern matching (pre-LLM pass)
 * This catches room numbers that might be in formats the LLM misses
 */
function extractRoomNumbersWithPatterns(chunks: string[]): Set<string> {
  const roomNumbers = new Set<string>();
  
  // Room number patterns to match
  const patterns = [
    // Standard 3-digit: 001, 002, 003, etc.
    /\b0\d{2}\b/g,
    // Standard 2-3 digit: 01, 02, 10, 11, 101, 102, etc.
    /\b\d{2,3}\b/g,
    // With "Room" prefix: Room 001, Room 002, etc.
    /\bRoom\s*(\d{2,3})\b/gi,
    // With "RM" prefix: RM 001, RM-002, etc.
    /\bRM[-\s]*(\d{2,3})\b/gi,
    // With code prefixes: A-101, L1-005, etc.
    /\b[A-Z]\d?[-\s]*(\d{2,3})\b/gi,
  ];
  
  for (const chunk of chunks) {
    // Apply each pattern to the chunk
    for (const pattern of patterns) {
      const matches = chunk.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Clean up the match to get just the number
          let cleaned = match.replace(/\D/g, ''); // Remove non-digits
          
          // Pad to 3 digits if it's a valid room number
          if (cleaned.length === 1) {
            // Single digit - might not be a room number, skip
            return;
          } else if (cleaned.length === 2) {
            cleaned = '0' + cleaned; // Pad 01 -> 001
          }
          
          // Only keep numbers that could be room numbers (001-999)
          const num = parseInt(cleaned, 10);
          if (num >= 1 && num <= 999) {
            roomNumbers.add(cleaned);
          }
        });
      }
    }
  }
  
  return roomNumbers;
}

/**
 * Use LLM API to extract structured room data from document chunks
 * Now uses hybrid approach: pattern matching + LLM enrichment
 */
async function extractRoomDataWithLLM(
  chunks: string[],
  projectName: string
): Promise<ExtractedRoom[]> {
  // STEP 1: Pattern-based extraction to find all room numbers
  const detectedRoomNumbers = extractRoomNumbersWithPatterns(chunks);
  log.info('Pattern matching complete', { potentialRoomNumbers: detectedRoomNumbers.size });

  // Combine chunks (increased limit for large construction documents)
  // GPT-4o has 128K context window, so we can handle larger documents
  const MAX_CHUNKS = parseInt(process.env.ROOM_EXTRACTION_MAX_CHUNKS || '150', 10);
  const chunksToUse = chunks.slice(0, MAX_CHUNKS);
  log.info('Using chunks', { used: chunksToUse.length, total: chunks.length, max: MAX_CHUNKS });
  const combinedContent = chunksToUse.join('\n\n---\n\n');
  
  // STEP 2: Include detected room numbers in LLM prompt for validation
  const detectedRoomsList = Array.from(detectedRoomNumbers).sort().join(', ');

  // STEP 3: Generate abbreviation glossary from document content
  const abbreviationGlossary = generateAbbreviationContext(combinedContent);

  const prompt = `You are analyzing construction documents for the project "${projectName}".

Your task is to extract ALL rooms and their finish schedules from the provided document content.

🔍 DETECTED ROOM NUMBERS (via pattern matching):
${detectedRoomsList}
${abbreviationGlossary}

⚠️ CRITICAL - NO INFERENCE ALLOWED:
- ONLY use room types/names that are EXPLICITLY WRITTEN in the documents
- DO NOT guess, infer, or assume what a room might be based on context
- If a room is labeled "Vest" in the plans, use "Vestibule" NOT "Office"
- If area is shown (e.g., "96 SF"), extract that EXACT number
- If you cannot find an explicit label/name for a room, SKIP IT

PRIMARY SOURCES (Check these in order):
1. **Floor Plan Room Tags** - Look for room name + number + SF labels like:
   - "Vest | 001 | 96 SF" → roomType: "Vestibule", area: 96
   - "Reception | 003 | 240 SF" → roomType: "Reception", area: 240
   - "Multipurpose | 002 | 1500 SF" → roomType: "Multipurpose", area: 1500
2. **Room/Finish Schedule Pages** - Tables listing all rooms with finishes
3. **Door Schedules** - Often list room names for each door location
4. **Legend/Key Pages** - Room abbreviation definitions

ROOM TAG FORMAT (common in floor plans):
Many construction documents show room info in this format:
  [Room Name]
  [Room Number]
  [Area] SF

Examples from floor plans:
- "Vest" = Vestibule (NOT Office)
- "Rec" or "Reception" = Reception
- "Corr" = Corridor
- "Stor" = Storage
- "Mech" = Mechanical
- "Elec" = Electrical
- "Jan" = Janitor

ROOM DATA TO EXTRACT:
1. Room numbers/identifiers (REQUIRED)
2. Room names/types - USE EXACT LABELS from documents
3. Floor locations (e.g., "1st Floor", "Level 2", "Ground")
4. Room areas - USE EXACT VALUES from documents (in SF)
5. Finish specifications for each room

Document content:
${combinedContent}

---

Provide your response as a valid JSON array with the following structure:

[
  {
    "roomNumber": "001",
    "roomType": "Vestibule",
    "floor": "1st Floor",
    "area": 96,
    "notes": "",
    "finishItems": [...]
  }
]

⛔ STRICT RULES - VIOLATIONS WILL CAUSE DATA CORRUPTION:
1. **NO INFERENCE**: NEVER guess room types. Only use labels explicitly shown in documents.
2. **EXACT AREAS**: Extract the exact SF value shown in documents. Don't calculate or estimate.
3. **EXACT NAMES**: Use "Vestibule" if document says "Vest", NOT "Office" or other guesses.
4. **SKIP IF UNCLEAR**: If no explicit room name/type is visible, DO NOT include that room.
5. **DUPLICATES**: If same room appears multiple times, use the most complete data.
6. **ABBREVIATION EXPANSION**: 
   - "Vest" → "Vestibule"
   - "Rec" → "Reception"  
   - "Corr" → "Corridor"
   - "Stor" → "Storage"
   - "Mech" → "Mechanical"
   - "Elec" → "Electrical"
   - "Jan" → "Janitor"
   - "Multi" or "Multipurpose" → "Multipurpose"

FORMAT REQUIREMENTS:
- Valid JSON array only
- Use "category" values: flooring, walls, ceiling, base, doors, windows, fixtures, other
- "area" must be a number (no "SF" suffix)
- Include rooms even without complete finish information

Return ONLY the JSON array, no additional text.`;

  try {
    log.info('Calling LLM API for room extraction', { chunks: chunksToUse.length, characters: combinedContent.length });
    
    const llmResponse = await callAbacusLLM([
      {
        role: 'system',
        content: 'You are an expert construction document analyst. CRITICAL: You must ONLY extract data that is EXPLICITLY written in the documents. NEVER infer, guess, or assume room types. If a room is labeled "Vest" use "Vestibule", if labeled "Off" use "Office". Extract EXACT area values shown (e.g., "96 SF" → area: 96). If no explicit label exists for a room, SKIP it entirely. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      model: EXTRACTION_MODEL,
      temperature: 0.1,
      max_tokens: 16000, // Increased from 4000 to accommodate 50-100+ rooms with details
    });

    const content = llmResponse.content;
    log.info('LLM API call successful');

    if (!content) {
      throw new Error('No content in LLM response');
    }

    // Parse JSON response
    // Try to find JSON array in response
    let jsonContent = content;
    
    // Remove markdown code blocks if present
    if (content.includes('```json')) {
      const match = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonContent = match[1].trim();
      }
    } else if (content.includes('```')) {
      const match = content.match(/```\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonContent = match[1].trim();
      }
    }
    
    // Try to extract JSON array
    const jsonMatch = jsonContent.match(/\[\s*[\s\S]*\]/);
    if (!jsonMatch) {
      log.error('Could not extract JSON from response', undefined, { preview: content.substring(0, 500) });
      return [];
    }

    try {
      const extractedRooms = JSON.parse(jsonMatch[0]) as ExtractedRoom[];
      log.info('Successfully parsed rooms from LLM response', { roomCount: extractedRooms.length });
      
      // Filter out rooms with "Unknown" type (safety check)
      const filteredRooms = extractedRooms.filter(room => {
        const type = room.roomType?.trim().toLowerCase();
        if (!type || type === 'unknown' || type === 'n/a' || type === 'na' || type === 'tbd') {
          log.info('Skipping room with invalid type', { roomNumber: room.roomNumber, roomType: room.roomType });
          return false;
        }
        return true;
      });
      
      const skippedCount = extractedRooms.length - filteredRooms.length;
      if (skippedCount > 0) {
        log.info('Filtered out rooms with unknown/invalid types', { skippedCount });
      }
      
      // Log room numbers for debugging
      const roomNumbers = filteredRooms.map(r => r.roomNumber).join(', ');
      log.info('Final room numbers', { roomNumbers });
      
      // Log statistics
      const roomsWithFinishes = filteredRooms.filter(r => r.finishItems && r.finishItems.length > 0).length;
      log.info('Finish data summary', { withFinishes: roomsWithFinishes, withoutFinishes: filteredRooms.length - roomsWithFinishes });
      
      return filteredRooms;
    } catch (parseError) {
      log.error('JSON parse error', parseError as Error, { preview: jsonMatch[0].substring(0, 500) });
      return [];
    }
  } catch (error: any) {
    log.error('Error extracting room data with LLM', error as Error);
    throw new Error(`Failed to extract rooms: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Save extracted rooms to database
 */
export async function saveExtractedRooms(
  projectSlug: string,
  extractedRooms: ExtractedRoom[],
  sourceDocumentId?: string
): Promise<{ created: number; updated: number }> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  let created = 0;
  let updated = 0;

  for (const extractedRoom of extractedRooms) {
    // Check if room already exists (dedup by roomNumber + sourceDocumentId to prevent cross-document contamination)
    const existing = await prisma.room.findFirst({
      where: {
        projectId: project.id,
        roomNumber: extractedRoom.roomNumber,
        ...(sourceDocumentId ? { sourceDocumentId } : {}),
      },
    });

    if (existing) {
      // Update existing room
      await prisma.room.update({
        where: { id: existing.id },
        data: {
          type: extractedRoom.roomType || existing.type || 'Unknown',
          area: extractedRoom.area,
          notes: extractedRoom.notes,
        },
      });
      updated++;

      // Add finish items
      if (extractedRoom.finishItems) {
        for (const finishItem of extractedRoom.finishItems) {
          await createOrUpdateFinishItem(existing.id, finishItem, sourceDocumentId);
        }
      }
    } else {
      // Create new room
      const roomType = extractedRoom.roomType || 'Unknown';
      const newRoom = await prisma.room.create({
        data: {
          projectId: project.id,
          name: extractedRoom.roomNumber || `Room ${roomType}`,
          roomNumber: extractedRoom.roomNumber,
          type: roomType,
          floorNumber: extractedRoom.floor ? parseInt(extractedRoom.floor) : null,
          area: extractedRoom.area,
          notes: extractedRoom.notes,
          status: 'not_started',
          sourceDocumentId: sourceDocumentId || null,
        },
      });
      created++;

      // Add finish items
      if (extractedRoom.finishItems) {
        for (const finishItem of extractedRoom.finishItems) {
          await createOrUpdateFinishItem(newRoom.id, finishItem, sourceDocumentId);
        }
      }
    }
  }

  return { created, updated };
}

/**
 * Create or update a finish item for a room
 */
async function createOrUpdateFinishItem(
  roomId: string,
  finishItem: ExtractedFinishItem,
  sourceDocumentId?: string
): Promise<void> {
  // Check if finish item already exists
  const existing = await prisma.finishScheduleItem.findFirst({
    where: {
      roomId,
      category: finishItem.category,
      material: finishItem.material,
    },
  });

  // Parse CSI division from code
  let csiDivision: number | undefined;
  if (finishItem.csiCode) {
    const divisionNumber = parseInt(finishItem.csiCode.split(' ')[0]);
    if (!isNaN(divisionNumber)) {
      csiDivision = divisionNumber;
    }
  }

  const data = {
    finishType: finishItem.finishType,
    material: finishItem.material,
    manufacturer: finishItem.manufacturer,
    modelNumber: finishItem.modelNumber,
    color: finishItem.color,
    dimensions: finishItem.dimensions,
    notes: finishItem.notes,
    csiCode: finishItem.csiCode,
    csiDivision,
    sourceDocumentId,
    extractedAt: new Date(),
    status: 'proposed',
  };

  if (existing) {
    await prisma.finishScheduleItem.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.finishScheduleItem.create({
      data: {
        ...data,
        roomId,
        category: finishItem.category,
      },
    });
  }
}
