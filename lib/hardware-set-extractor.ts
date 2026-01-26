/**
 * Hardware Set Extractor
 * 
 * Extracts and manages hardware set definitions from:
 * - Door schedules (extracted hardware set column)
 * - Window schedules (hardware requirements)
 * - Specification documents (hardware groups)
 * 
 * Creates detailed component breakdowns for quantity verification.
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';

// =============================================================================
// INTERFACES
// =============================================================================

export interface HardwareComponent {
  type: string;           // HINGES, LOCKSET, CLOSER, KICK_PLATE, PULL, PUSH_PLATE, etc.
  spec: string;           // "4-1/2 x 4-1/2 Ball Bearing", "Mortise Lock"
  qtyPerDoor: number;     // How many per door/window
  manufacturer?: string;
  model?: string;
  finish?: string;
}

export interface ExtractedHardwareSet {
  setNumber: string;
  setName?: string;
  description?: string;
  components: HardwareComponent[];
  fireRated: boolean;
  fireRating?: string;
  adaCompliant: boolean;
  sourceType: 'door_schedule' | 'spec_section' | 'window_schedule';
}

// =============================================================================
// HARDWARE SET EXTRACTION FROM DOOR SCHEDULE
// =============================================================================

/**
 * Extract hardware sets from door schedule data
 */
export async function extractHardwareSetsFromDoorSchedule(
  projectId: string
): Promise<ExtractedHardwareSet[]> {
  const doors = await prisma.doorScheduleItem.findMany({
    where: { projectId },
    select: {
      id: true,
      doorNumber: true,
      hardwareSet: true,
      hinges: true,
      lockset: true,
      closer: true,
      fireRating: true,
      kickplate: true,
      weatherstrip: true,
      threshold: true,
    }
  });

  if (doors.length === 0) return [];

  // Group doors by hardware set
  const setGroups = new Map<string, typeof doors>();
  doors.forEach(door => {
    if (door.hardwareSet) {
      const existing = setGroups.get(door.hardwareSet) || [];
      existing.push(door);
      setGroups.set(door.hardwareSet, existing);
    }
  });

  const extractedSets: ExtractedHardwareSet[] = [];

  setGroups.forEach((doorsInSet, setNumber) => {
    const components: HardwareComponent[] = [];
    
    // Analyze doors to build component list
    // Use the first door as reference (assuming same set = same components)
    const refDoor = doorsInSet[0];

    // Hinges
    if (refDoor.hinges) {
      const hingeMatch = refDoor.hinges.match(/^(\d+)/);
      const qtyPerDoor = hingeMatch ? parseInt(hingeMatch[1]) : 3;
      const spec = refDoor.hinges.replace(/^\d+\s*-?\s*/, '').trim() || refDoor.hinges;
      
      components.push({
        type: 'HINGES',
        spec,
        qtyPerDoor,
      });
    }

    // Lockset
    if (refDoor.lockset) {
      components.push({
        type: 'LOCKSET',
        spec: refDoor.lockset,
        qtyPerDoor: 1,
      });
    }

    // Closer
    if (refDoor.closer) {
      components.push({
        type: 'CLOSER',
        spec: refDoor.closer,
        qtyPerDoor: 1,
      });
    }

    // Kickplate
    if (refDoor.kickplate) {
      components.push({
        type: 'KICK_PLATE',
        spec: 'Kick Plate',
        qtyPerDoor: 1,
      });
    }

    // Weatherstrip
    if (refDoor.weatherstrip) {
      components.push({
        type: 'WEATHERSTRIP',
        spec: 'Weatherstripping Set',
        qtyPerDoor: 1,
      });
    }

    // Threshold
    if (refDoor.threshold) {
      components.push({
        type: 'THRESHOLD',
        spec: refDoor.threshold,
        qtyPerDoor: 1,
      });
    }

    // Check for fire rating
    const fireRatedDoors = doorsInSet.filter(d => d.fireRating);
    const fireRated = fireRatedDoors.length > 0;
    const fireRating = fireRated ? fireRatedDoors[0].fireRating || undefined : undefined;

    extractedSets.push({
      setNumber,
      setName: `Hardware Set ${setNumber}`,
      description: generateSetDescription(components, fireRated),
      components,
      fireRated,
      fireRating,
      adaCompliant: checkADACompliance(refDoor),
      sourceType: 'door_schedule'
    });
  });

  return extractedSets;
}

/**
 * Generate human-readable description from components
 */
function generateSetDescription(components: HardwareComponent[], fireRated: boolean): string {
  const parts: string[] = [];
  
  components.forEach(c => {
    if (c.type === 'LOCKSET') {
      parts.push(c.spec);
    } else if (c.type === 'CLOSER') {
      parts.push('Door Closer');
    } else if (c.type === 'KICK_PLATE') {
      parts.push('Kick Plate');
    }
  });

  if (fireRated) {
    parts.push('Fire Rated');
  }

  return parts.join(', ') || 'Standard Hardware';
}

/**
 * Check if hardware appears ADA compliant based on lockset type
 */
function checkADACompliance(door: any): boolean {
  const lockset = (door.lockset || '').toLowerCase();
  return lockset.includes('lever') || 
         lockset.includes('ada') || 
         lockset.includes('accessible');
}

// =============================================================================
// HARDWARE SET EXTRACTION FROM SPECS
// =============================================================================

/**
 * Extract hardware sets from specification text using LLM
 */
export async function extractHardwareSetsFromSpec(
  specText: string,
  specSection?: string
): Promise<ExtractedHardwareSet[]> {
  const prompt = `You are a construction specifications expert. Extract all hardware set definitions from this specification text.

For each hardware set, identify:
1. Set number/identifier (e.g., "1", "A", "HS-1")
2. Set name or description
3. All components with:
   - Type (HINGES, LOCKSET, CLOSER, KICK_PLATE, PULL, PUSH_PLATE, DOOR_STOP, THRESHOLD, WEATHERSTRIP, etc.)
   - Specification (size, type, model)
   - Quantity per door
   - Manufacturer if specified
   - Model number if specified
   - Finish if specified
4. Fire rating requirements
5. ADA compliance

Return JSON array:
[
  {
    "setNumber": "1",
    "setName": "Entry Hardware",
    "description": "Entrance door hardware with mortise lock, closer, and kick plate",
    "components": [
      {
        "type": "HINGES",
        "spec": "4-1/2 x 4-1/2 Ball Bearing, Heavy Weight",
        "qtyPerDoor": 3,
        "manufacturer": "Hager",
        "model": "BB1279",
        "finish": "US26D"
      },
      {
        "type": "LOCKSET",
        "spec": "Mortise Lock, Classroom Function",
        "qtyPerDoor": 1,
        "manufacturer": "Schlage",
        "model": "L9453P"
      },
      {
        "type": "CLOSER",
        "spec": "Surface Mounted, Adjustable",
        "qtyPerDoor": 1,
        "manufacturer": "LCN",
        "model": "4040XP"
      }
    ],
    "fireRated": true,
    "fireRating": "20 MIN",
    "adaCompliant": true
  }
]

Spec Section: ${specSection || 'Not specified'}

Specification text:
${specText.substring(0, 12000)}`;

  try {
    const response = await callAbacusLLM(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, max_tokens: 4000 }
    );

    const jsonMatch = response.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      console.log('[HardwareSetExtractor] No valid JSON found in response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((set: any) => ({
      ...set,
      sourceType: 'spec_section' as const
    }));
  } catch (error) {
    console.error('[HardwareSetExtractor] Spec extraction failed:', error);
    return [];
  }
}

// =============================================================================
// DATABASE SYNC
// =============================================================================

/**
 * Sync extracted hardware sets to database
 */
export async function syncHardwareSets(
  projectId: string,
  extractedSets: ExtractedHardwareSet[],
  sourceDocumentId?: string
): Promise<{ created: number; updated: number }> {
  const stats = { created: 0, updated: 0 };

  for (const set of extractedSets) {
    // Count doors using this hardware set
    const doorCount = await prisma.doorScheduleItem.count({
      where: { projectId, hardwareSet: set.setNumber }
    });

    // Count windows if applicable
    const windowCount = await prisma.windowScheduleItem.count({
      where: { projectId, hardwareFinish: { contains: set.setNumber } }
    });

    const existing = await prisma.hardwareSetDefinition.findUnique({
      where: {
        projectId_setNumber: {
          projectId,
          setNumber: set.setNumber
        }
      }
    });

    if (existing) {
      await prisma.hardwareSetDefinition.update({
        where: { id: existing.id },
        data: {
          setName: set.setName || existing.setName,
          description: set.description || existing.description,
          components: set.components as any,
          doorCount,
          windowCount,
          fireRated: set.fireRated,
          fireRating: set.fireRating,
          adaCompliant: set.adaCompliant,
          sourceDocumentId: sourceDocumentId || existing.sourceDocumentId,
          sourceType: set.sourceType,
        }
      });
      stats.updated++;
    } else {
      await prisma.hardwareSetDefinition.create({
        data: {
          projectId,
          setNumber: set.setNumber,
          setName: set.setName,
          description: set.description,
          components: set.components as any,
          doorCount,
          windowCount,
          fireRated: set.fireRated,
          fireRating: set.fireRating,
          adaCompliant: set.adaCompliant,
          sourceDocumentId,
          sourceType: set.sourceType,
        }
      });
      stats.created++;
    }
  }

  return stats;
}

/**
 * Extract and sync hardware sets from all project data
 */
export async function extractAndSyncAllHardwareSets(
  projectId: string
): Promise<{ doorScheduleSets: number; specSets: number }> {
  // Extract from door schedule
  const doorScheduleSets = await extractHardwareSetsFromDoorSchedule(projectId);
  
  // Sync door schedule sets
  if (doorScheduleSets.length > 0) {
    await syncHardwareSets(projectId, doorScheduleSets);
  }

  return {
    doorScheduleSets: doorScheduleSets.length,
    specSets: 0 // Will be populated when spec parsing is triggered
  };
}

// =============================================================================
// HARDWARE SET QUERIES
// =============================================================================

/**
 * Get all hardware sets for a project with door counts
 */
export async function getProjectHardwareSets(projectId: string) {
  const sets = await prisma.hardwareSetDefinition.findMany({
    where: { projectId },
    orderBy: { setNumber: 'asc' }
  });

  // Enrich with actual door counts
  const enrichedSets = await Promise.all(sets.map(async (set) => {
    const doorCount = await prisma.doorScheduleItem.count({
      where: { projectId, hardwareSet: set.setNumber }
    });

    const doors = await prisma.doorScheduleItem.findMany({
      where: { projectId, hardwareSet: set.setNumber },
      select: { doorNumber: true, roomNumber: true, fireRating: true },
      take: 10
    });

    return {
      ...set,
      doorCount,
      sampleDoors: doors.map(d => d.doorNumber),
      components: (set.components as unknown as HardwareComponent[]) || []
    };
  }));

  return enrichedSets;
}

/**
 * Calculate total component requirements from hardware sets
 */
export async function calculateHardwareRequirements(projectId: string) {
  const sets = await getProjectHardwareSets(projectId);
  
  const componentTotals = new Map<string, {
    type: string;
    spec: string;
    totalQty: number;
    manufacturer?: string;
    model?: string;
    sets: string[];
  }>();

  sets.forEach(set => {
    const components = set.components || [];
    components.forEach((comp: HardwareComponent) => {
      const key = `${comp.type}|${comp.spec}`;
      const existing = componentTotals.get(key) || {
        type: comp.type,
        spec: comp.spec,
        totalQty: 0,
        manufacturer: comp.manufacturer,
        model: comp.model,
        sets: []
      };
      existing.totalQty += comp.qtyPerDoor * set.doorCount;
      existing.sets.push(set.setNumber);
      componentTotals.set(key, existing);
    });
  });

  return {
    sets,
    componentTotals: Array.from(componentTotals.values()),
    totalDoors: sets.reduce((sum, s) => sum + s.doorCount, 0)
  };
}
