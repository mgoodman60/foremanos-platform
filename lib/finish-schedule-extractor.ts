/**
 * Dedicated Finish Schedule Extractor
 * 
 * Extracts finish schedule data from construction documents and correlates it with rooms.
 * Handles the common case where finish schedules are in tables separate from room lists.
 */

import { prisma } from './db';
import { createScopedLogger } from './logger';
import { callAbacusLLM } from './abacus-llm';
import { EXTRACTION_MODEL } from '@/lib/model-config';

const log = createScopedLogger('FINISH_SCHEDULE');

interface FinishScheduleEntry {
  roomNumber: string;
  flooring?: {
    material: string;
    manufacturer?: string;
    modelNumber?: string;
    color?: string;
    productDescription?: string;
  };
  walls?: {
    material: string;
    color?: string;
    manufacturer?: string;
    productDescription?: string;
  };
  ceiling?: {
    material: string;
    height?: string;
    manufacturer?: string;
    productDescription?: string;
  };
  base?: {
    material: string;
    height?: string;
    manufacturer?: string;
    productDescription?: string;
  };
  notes?: string;
}

// Product specs from Room Finish Legend
interface FinishLegendEntry {
  code: string;          // e.g., "LVT-1", "CPT-1", "T-1"
  type: string;          // e.g., "LUXURY VINYL TILE", "CARPET"  
  manufacturer: string;  // e.g., "MOHAWK", "SHERWIN WILLIAMS"
  description: string;   // Full product description with specs
  color?: string;
  modelNumber?: string;
}

/**
 * Extract finish schedule data specifically and correlate with existing rooms
 */
export async function extractFinishSchedules(
  projectSlug: string
): Promise<{
  success: boolean;
  matchedRooms: number;
  totalFinishes: number;
  errors?: string[];
}> {
  log.info('Starting extraction', { projectSlug });
  
  // Get project and existing rooms
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Room: {
        select: {
          id: true,
          roomNumber: true,
          name: true
        }
      },
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
    throw new Error('Project not found');
  }

  log.info('Found existing rooms', { count: project.Room.length });

  // Gather chunks that likely contain finish schedule information
  // Enhanced with construction abbreviations from actual finish schedule format
  const finishKeywords = [
    // Table headers and general terms
    'finish', 'flooring', 'wall', 'ceiling', 'base', 'carpet', 'vinyl', 'paint', 'tile',
    'room finish', 'room no', 'schedule',
    
    // Construction abbreviations (CRITICAL - from actual document)
    'gwb',      // Gypsum Wall Board
    'cmw',      // Concrete Masonry Wall
    'act',      // Acoustic Ceiling Tile
    'vct',      // Vinyl Composition Tile
    'lvt',      // Luxury Vinyl Tile
    'cpt',      // Carpet
    'cer',      // Ceramic
    'por',      // Porcelain
    'gyp',      // Gypsum
    'cmu',      // Concrete Masonry Unit
    'fib',      // Fiberboard
    'sus',      // Suspended
    'arws',     // Wall system codes
    
    // Common finish codes
    'r-1', 'r-2', 'r-3', 'r-4', 'r-5',
    
    // Directional indicators (for multi-wall schedules)
    'north', 'south', 'east', 'west',
    "mat'l",    // Material column header
  ];
  const relevantChunks: string[] = [];

  for (const doc of project.Document) {
    for (const chunk of doc.DocumentChunk || []) {
      const content = chunk.content.toLowerCase();
      // Check if chunk contains finish-related keywords
      const keywordCount = finishKeywords.filter(kw => content.includes(kw)).length;
      
      // Lower threshold to 1 since we have many specific abbreviations
      if (keywordCount >= 1) {
        relevantChunks.push(chunk.content);
      }
    }
  }

  log.info('Found chunks with finish-related content', { count: relevantChunks.length });

  if (relevantChunks.length === 0) {
    return {
      success: false,
      matchedRooms: 0,
      totalFinishes: 0,
      errors: ['No finish schedule content found in documents']
    };
  }

  // Use LLM to extract structured finish schedule data
  // Process rooms in batches to get better coverage (LLM handles ~20-25 rooms well per call)
  const allRoomNumbers = project.Room.map((r: any) => r.roomNumber);
  const BATCH_SIZE = 25;
  const allFinishSchedules: FinishScheduleEntry[] = [];
  
  for (let i = 0; i < allRoomNumbers.length; i += BATCH_SIZE) {
    const batchRoomNumbers = allRoomNumbers.slice(i, i + BATCH_SIZE);
    log.info('Processing batch', { batch: Math.floor(i/BATCH_SIZE) + 1, fromRoom: batchRoomNumbers[0], toRoom: batchRoomNumbers[batchRoomNumbers.length - 1] });
    
    const batchSchedules = await extractFinishDataWithLLM(
      relevantChunks,
      batchRoomNumbers
    );
    
    allFinishSchedules.push(...batchSchedules);
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < allRoomNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const finishSchedules = allFinishSchedules;
  log.info('Extracted finish schedule entries', { total: finishSchedules.length });

  // Extract Room Finish Legend for product specifications
  log.info('Extracting Room Finish Legend for product specs');
  const finishLegend = await extractFinishLegend(relevantChunks);
  log.info('Found legend entries', { count: finishLegend.size });

  // Match and update rooms with finish data
  let matchedCount = 0;
  let totalFinishes = 0;

  for (const schedule of finishSchedules) {
    const room = project.Room.find((r: any) => r.roomNumber === schedule.roomNumber);
    
    if (room) {
      // Create finish schedule items with legend enrichment
      const finishItems = [];

      if (schedule.flooring) {
        const legendData = enrichWithLegend(schedule.flooring.material, schedule.flooring.material, finishLegend);
        finishItems.push({
          roomId: room.id,
          category: 'flooring' as const,
          finishType: 'Flooring',
          material: schedule.flooring.material,
          manufacturer: schedule.flooring.manufacturer || legendData.manufacturer,
          modelNumber: schedule.flooring.modelNumber || legendData.modelNumber,
          color: schedule.flooring.color || legendData.color,
          notes: legendData.productDescription || schedule.flooring.productDescription,
        });
      }

      if (schedule.walls) {
        const legendData = enrichWithLegend(schedule.walls.material, schedule.walls.material, finishLegend);
        finishItems.push({
          roomId: room.id,
          category: 'walls' as const,
          finishType: 'Wall Finish',
          material: schedule.walls.material,
          manufacturer: schedule.walls.manufacturer || legendData.manufacturer,
          modelNumber: legendData.modelNumber,
          color: schedule.walls.color || legendData.color,
          notes: legendData.productDescription || schedule.walls.productDescription,
        });
      }

      if (schedule.ceiling) {
        const legendData = enrichWithLegend(schedule.ceiling.material, schedule.ceiling.material, finishLegend);
        finishItems.push({
          roomId: room.id,
          category: 'ceiling' as const,
          finishType: 'Ceiling',
          material: schedule.ceiling.material,
          dimensions: schedule.ceiling.height,
          manufacturer: schedule.ceiling.manufacturer || legendData.manufacturer,
          modelNumber: legendData.modelNumber,
          color: legendData.color,
          notes: legendData.productDescription || schedule.ceiling.productDescription,
        });
      }

      if (schedule.base) {
        const legendData = enrichWithLegend(schedule.base.material, schedule.base.material, finishLegend);
        finishItems.push({
          roomId: room.id,
          category: 'base' as const,
          finishType: 'Base',
          material: schedule.base.material,
          dimensions: schedule.base.height,
          manufacturer: schedule.base.manufacturer || legendData.manufacturer,
          modelNumber: legendData.modelNumber,
          color: legendData.color,
          notes: legendData.productDescription || schedule.base.productDescription,
        });
      }

      // Delete existing finish items for this room
      await prisma.finishScheduleItem.deleteMany({
        where: { roomId: room.id }
      });

      // Create new finish items
      if (finishItems.length > 0) {
        await prisma.finishScheduleItem.createMany({
          data: finishItems
        });
        matchedCount++;
        totalFinishes += finishItems.length;
        log.info('Updated room with finish items', { roomNumber: room.roomNumber, finishItemCount: finishItems.length });
      }
    } else {
      log.info('No matching room found', { roomNumber: schedule.roomNumber });
    }
  }

  return {
    success: true,
    matchedRooms: matchedCount,
    totalFinishes: totalFinishes
  };
}

/**
 * Use LLM to extract finish schedule data from document chunks
 */
async function extractFinishDataWithLLM(
  chunks: string[],
  existingRoomNumbers: string[]
): Promise<FinishScheduleEntry[]> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Combine relevant chunks
  const combinedContent = chunks.slice(0, 100).join('\n\n---\n\n');
  const roomNumbersList = existingRoomNumbers.sort().join(', ');

  const prompt = `You are analyzing construction finish schedule documents with TABLE-BASED formats.

🎯 TARGET ROOM NUMBERS: ${roomNumbersList}

🔍 DOCUMENT FORMAT CONTEXT:
The finish schedule is likely in a TABLE format with these characteristics:
- Room Number column (001, 002, 004, etc.)
- Floor type column (LVT-1, T-1, CONC-1, etc.)
- Base type column (RB-1, T-2, etc.)
- Multiple WALL columns (North, East, South, West) with finish codes (GWB R-1, CMW R-1, etc.)
- Ceiling columns (MAT'L and FINISH - typically ACT, ARWS-1, etc.)
- Notes column

📋 CONSTRUCTION ABBREVIATIONS YOU MUST RECOGNIZE:
- **GWB** = Gypsum Wall Board (drywall)
- **CMW** = Concrete Masonry Wall
- **ACT** = Acoustic Ceiling Tile
- **VCT** = Vinyl Composition Tile
- **LVT** = Luxury Vinyl Tile
- **CPT** = Carpet
- **CER** = Ceramic Tile
- **POR** = Porcelain Tile
- **CMU** = Concrete Masonry Unit
- **CONC** = Concrete
- **RB** = Rubber Base
- **T-** = Tile code prefix
- **R-1, R-2, etc.** = Finish/Paint codes
- **ARWS** = Wall system codes

📄 DOCUMENT CONTENT:
${combinedContent}

---

🎯 EXTRACTION TASK:
Extract finish data for EACH room number listed above. Format each entry as:

{
  "roomNumber": "001",
  "flooring": {
    "material": "LVT-1 (Luxury Vinyl Tile)",
    "notes": "See flooring schedule for details"
  },
  "walls": {
    "material": "GWB R-1 (Gypsum Wall Board, Paint Finish R-1)",
    "notes": "North: GWB R-1, East: CMW R-1, South: GWB R-1, West: GWB R-1"
  },
  "ceiling": {
    "material": "ACT (Acoustic Ceiling Tile)",
    "notes": "ARWS-1 finish"
  },
  "base": {
    "material": "RB-1 (Rubber Base)",
    "height": "4\""
  },
  "notes": "Any additional room-specific notes"
}

📌 CRITICAL INSTRUCTIONS:
1. **ROOM NUMBERS**: Only extract for rooms listed in TARGET ROOM NUMBERS above
2. **TABLE PARSING**: Look for tabular data with room numbers in first column
3. **MULTI-DIRECTIONAL WALLS**: If walls have different finishes by direction (North/East/South/West), note them ALL in walls.notes
4. **ABBREVIATIONS**: Keep abbreviations but ADD FULL NAMES in parentheses (e.g., "ACT (Acoustic Ceiling Tile)")
5. **FINISH CODES**: Include codes like R-1, ARWS-1, LVT-1 in material field
6. **COMPLETENESS**: Extract flooring, walls, ceiling, base for every room found
7. **SKIP MISSING**: If NO finish data found for a room, don't include it in output

⚠️ SPECIAL HANDLING:
- If you see "GWB" in multiple wall columns with different codes, note: "GWB finish varies by wall direction"
- If a cell shows "---" or is empty, note: "See plans" or "Not specified"
- Room names (OFFICE, CORRIDOR, etc.) are helpful context but room NUMBER is the key identifier

Return ONLY a valid JSON array. No markdown, no extra text.

[{finish_entry_1}, {finish_entry_2}, ...]`;

  try {
    log.info('Calling LLM API for finish schedule extraction');
    
    const llmResponse = await callAbacusLLM([
      {
        role: 'system',
        content: 'You are an expert at extracting finish schedule data from construction documents. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      model: EXTRACTION_MODEL,
      temperature: 0.1,
      max_tokens: 8000,
    });

    const content = llmResponse.content;
    log.info('LLM API call successful');

    if (!content) {
      return [];
    }

    // Parse JSON response
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
      log.error('Could not extract JSON from response');
      return [];
    }

    const finishSchedules = JSON.parse(jsonMatch[0]) as FinishScheduleEntry[];
    log.info('Successfully parsed finish schedules', { count: finishSchedules.length });
    
    return finishSchedules;
  } catch (error: any) {
    log.error('Finish schedule extraction error', error as Error);
    return [];
  }
}

/**
 * Extract product specifications from Room Finish Legend table
 */
async function extractFinishLegend(chunks: string[]): Promise<Map<string, FinishLegendEntry>> {
  const combinedContent = chunks.slice(0, 100).join('\n\n---\n\n');
  
  const prompt = `You are analyzing a ROOM FINISH LEGEND from construction documents.

📄 DOCUMENT CONTENT:
${combinedContent}

🎯 EXTRACTION TASK:
Extract the ROOM FINISH LEGEND table which lists finish codes and their product specifications.

The legend typically has these columns:
- CODE (e.g., "CONC-1", "CPT-1", "LVT-1", "T-1", "T-2", "RB-1", "P-1", "P-2", "ARA-1")
- TYPE (e.g., "CONCRETE AND STAIN", "CARPET", "LUXURY VINYL TILE", "TILE", "RUBBER BASE", "PAINT")
- MANUFACTURER (e.g., "SHERWIN WILLIAMS", "MOHAWK", "ANATOLIA TILE", "ARMSTRONG")
- DESCRIPTION (full product details including product name, color, model, size, warranty, etc.)

For each legend entry, extract:
{
  "code": "LVT-1",
  "type": "LUXURY VINYL TILE",
  "manufacturer": "MOHAWK",
  "description": "MOHAWK LIVING LOCAL - PREMIUM WOOD, COLOR: STUCCO 05, SIZE: 7.12\" x 51.97\", WEAR LAYER: 20 MIL, WARRANTY: 20 YEAR M-FORCE ULTRA COMMERCIAL WARRANTY",
  "color": "STUCCO 05",
  "modelNumber": "LIVING LOCAL - PREMIUM WOOD"
}

IMPORTANT:
- Include ALL product details from DESCRIPTION column (sizes, colors, warranty info, etc.)
- Keep the full specification text - do NOT truncate
- Extract color and model number separately if identifiable

Return ONLY a valid JSON array. No markdown, no extra text.`;

  try {
    log.info('Extracting Room Finish Legend');
    
    const llmResponse = await callAbacusLLM([
      {
        role: 'system',
        content: 'You are an expert at extracting finish legend data from construction documents. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      model: EXTRACTION_MODEL,
      temperature: 0.1,
      max_tokens: 8000,
    });

    const content = llmResponse.content;
    if (!content) return new Map();

    let jsonContent = content;
    if (content.includes('```json')) {
      const match = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) jsonContent = match[1].trim();
    } else if (content.includes('```')) {
      const match = content.match(/```\s*([\s\S]*?)\s*```/);
      if (match) jsonContent = match[1].trim();
    }
    
    const jsonMatch = jsonContent.match(/\[\s*[\s\S]*\]/);
    if (!jsonMatch) return new Map();

    const legendEntries = JSON.parse(jsonMatch[0]) as FinishLegendEntry[];
    log.info('Extracted legend entries', { count: legendEntries.length });
    
    // Build lookup map by code
    const legendMap = new Map<string, FinishLegendEntry>();
    for (const entry of legendEntries) {
      legendMap.set(entry.code.toUpperCase(), entry);
      // Also add without suffix (e.g., "LVT" for "LVT-1")
      const baseCode = entry.code.replace(/-\d+$/, '').toUpperCase();
      if (!legendMap.has(baseCode)) {
        legendMap.set(baseCode, entry);
      }
    }
    
    return legendMap;
  } catch (error: any) {
    log.error('Legend extraction error', error as Error);
    return new Map();
  }
}

/**
 * Enrich finish entry with legend product specs
 */
function enrichWithLegend(
  finishType: string | undefined,
  material: string | undefined,
  legend: Map<string, FinishLegendEntry>
): { manufacturer?: string; modelNumber?: string; color?: string; productDescription?: string } {
  if (!material) return {};
  
  // Try to find matching legend entry by code in material field
  // Material might be "LVT-1 (Luxury Vinyl Tile)" or just "LVT-1"
  const codeMatch = material.match(/^([A-Z]+-?\d*)/i);
  if (!codeMatch) return {};
  
  const code = codeMatch[1].toUpperCase();
  const entry = legend.get(code);
  
  if (entry) {
    return {
      manufacturer: entry.manufacturer,
      modelNumber: entry.modelNumber,
      color: entry.color,
      productDescription: entry.description
    };
  }
  
  return {};
}
