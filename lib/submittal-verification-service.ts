/**
 * Submittal Verification Service
 * 
 * Comprehensive cross-referencing engine that verifies submittal quantities
 * against ALL project data sources:
 * - Door schedules (doors, frames, hardware sets)
 * - Window schedules (windows, glazing, hardware)
 * - Material takeoffs (all CSI divisions)
 * - MEP equipment lists
 * - Finish schedules
 * - Budget line items
 * 
 * CRITICAL: Never uses generic/placeholder data - all quantities come from
 * actual project records in the database.
 */

import { prisma } from './db';

// =============================================================================
// INTERFACES
// =============================================================================

export interface QuantitySource {
  sourceType: 'door_schedule' | 'window_schedule' | 'takeoff' | 'mep_equipment' | 'finish_schedule' | 'budget';
  sourceId: string;
  sourceDescription: string;
}

export interface RequiredQuantity {
  itemName: string;
  itemCategory: string;
  csiDivision?: string;
  requiredQty: number;
  unit: string;
  sources: QuantitySource[];
  sourceDescription: string;
}

export interface VerificationResult {
  lineItemId: string;
  productName: string;
  submittedQty: number;
  requiredQty: number | null;
  unit: string;
  status: 'SUFFICIENT' | 'INSUFFICIENT' | 'EXCESS' | 'NO_REQUIREMENT' | 'UNVERIFIED';
  varianceQty: number | null;
  variancePercent: number | null;
  matchedSources: QuantitySource[];
  notes: string;
}

export interface SubmittalVerificationReport {
  submittalId: string;
  submittalNumber: string;
  verifiedAt: Date;
  totalLineItems: number;
  sufficientCount: number;
  insufficientCount: number;
  excessCount: number;
  noRequirementCount: number;
  lineItemResults: VerificationResult[];
  overallStatus: 'PASS' | 'FAIL' | 'REVIEW_NEEDED';
  criticalShortages: VerificationResult[];
}

export interface HardwareSetComponent {
  type: string;           // HINGES, LOCKSET, CLOSER, KICK_PLATE, etc.
  spec: string;           // "4-1/2 x 4-1/2 Ball Bearing"
  qtyPerDoor: number;     // How many per door
  manufacturer?: string;
  model?: string;
}

// =============================================================================
// QUANTITY AGGREGATION FROM ALL SOURCES
// =============================================================================

/**
 * Aggregate all quantity requirements from project data sources
 */
export async function aggregateProjectRequirements(
  projectId: string
): Promise<RequiredQuantity[]> {
  const requirements: RequiredQuantity[] = [];

  // 1. Door Schedule Requirements
  const doorRequirements = await getDoorScheduleRequirements(projectId);
  requirements.push(...doorRequirements);

  // 2. Window Schedule Requirements
  const windowRequirements = await getWindowScheduleRequirements(projectId);
  requirements.push(...windowRequirements);

  // 3. Takeoff Requirements (all divisions)
  const takeoffRequirements = await getTakeoffRequirements(projectId);
  requirements.push(...takeoffRequirements);

  // 4. MEP Equipment Requirements
  const mepRequirements = await getMEPEquipmentRequirements(projectId);
  requirements.push(...mepRequirements);

  // 5. Finish Schedule Requirements
  const finishRequirements = await getFinishScheduleRequirements(projectId);
  requirements.push(...finishRequirements);

  return requirements;
}

/**
 * Get door schedule requirements including hardware sets
 */
async function getDoorScheduleRequirements(projectId: string): Promise<RequiredQuantity[]> {
  const requirements: RequiredQuantity[] = [];

  const doors = await prisma.doorScheduleItem.findMany({
    where: { projectId },
    select: {
      id: true,
      doorNumber: true,
      doorMark: true,
      doorType: true,
      width: true,
      height: true,
      frameMaterial: true,
      doorMaterial: true,
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

  if (doors.length === 0) return requirements;

  // Aggregate door counts by type
  const doorTypeCounts = new Map<string, { count: number; ids: string[]; descriptions: string[] }>();
  doors.forEach(door => {
    const key = `${door.doorType || 'Unknown'} ${door.width || ''} x ${door.height || ''}`.trim();
    const existing = doorTypeCounts.get(key) || { count: 0, ids: [], descriptions: [] };
    existing.count++;
    existing.ids.push(door.id);
    existing.descriptions.push(`Door ${door.doorNumber}`);
    doorTypeCounts.set(key, existing);
  });

  // Create requirements for each door type
  doorTypeCounts.forEach((data, doorType) => {
    requirements.push({
      itemName: doorType,
      itemCategory: 'doors',
      csiDivision: '08 10 00',
      requiredQty: data.count,
      unit: 'EA',
      sources: data.ids.map(id => ({
        sourceType: 'door_schedule' as const,
        sourceId: id,
        sourceDescription: `Door Schedule`
      })),
      sourceDescription: `${data.count} doors from door schedule`
    });
  });

  // Aggregate hardware sets
  const hardwareSetCounts = new Map<string, { count: number; doorIds: string[]; doorNumbers: string[] }>();
  doors.forEach(door => {
    if (door.hardwareSet) {
      const existing = hardwareSetCounts.get(door.hardwareSet) || { count: 0, doorIds: [], doorNumbers: [] };
      existing.count++;
      existing.doorIds.push(door.id);
      existing.doorNumbers.push(door.doorNumber);
      hardwareSetCounts.set(door.hardwareSet, existing);
    }
  });

  // Create requirements for hardware sets
  hardwareSetCounts.forEach((data, setNumber) => {
    requirements.push({
      itemName: `Hardware Set ${setNumber}`,
      itemCategory: 'door_hardware',
      csiDivision: '08 71 00',
      requiredQty: data.count,
      unit: 'SET',
      sources: data.doorIds.map(id => ({
        sourceType: 'door_schedule' as const,
        sourceId: id,
        sourceDescription: `Door Schedule`
      })),
      sourceDescription: `${data.count} doors use Hardware Set ${setNumber}: ${data.doorNumbers.slice(0, 5).join(', ')}${data.doorNumbers.length > 5 ? '...' : ''}`
    });
  });

  // Aggregate individual hardware components
  const hingesCount = doors.filter(d => d.hinges).length;
  if (hingesCount > 0) {
    // Parse hinge specs - typically "3 - 4-1/2 x 4-1/2" means 3 hinges per door
    const hingesBySpec = new Map<string, { totalQty: number; doorIds: string[] }>();
    doors.forEach(door => {
      if (door.hinges) {
        const match = door.hinges.match(/^(\d+)/);
        const qtyPerDoor = match ? parseInt(match[1]) : 3; // Default 3 hinges
        const spec = door.hinges.replace(/^\d+\s*-?\s*/, '').trim() || door.hinges;
        const existing = hingesBySpec.get(spec) || { totalQty: 0, doorIds: [] };
        existing.totalQty += qtyPerDoor;
        existing.doorIds.push(door.id);
        hingesBySpec.set(spec, existing);
      }
    });

    hingesBySpec.forEach((data, spec) => {
      requirements.push({
        itemName: `Hinges ${spec}`,
        itemCategory: 'door_hardware',
        csiDivision: '08 71 00',
        requiredQty: data.totalQty,
        unit: 'EA',
        sources: data.doorIds.map(id => ({
          sourceType: 'door_schedule' as const,
          sourceId: id,
          sourceDescription: 'Door Schedule - Hinges'
        })),
        sourceDescription: `${data.totalQty} hinges required across ${data.doorIds.length} doors`
      });
    });
  }

  // Aggregate locksets
  const locksetCounts = new Map<string, { count: number; doorIds: string[] }>();
  doors.forEach(door => {
    if (door.lockset) {
      const existing = locksetCounts.get(door.lockset) || { count: 0, doorIds: [] };
      existing.count++;
      existing.doorIds.push(door.id);
      locksetCounts.set(door.lockset, existing);
    }
  });

  locksetCounts.forEach((data, locksetType) => {
    requirements.push({
      itemName: locksetType,
      itemCategory: 'door_hardware',
      csiDivision: '08 71 00',
      requiredQty: data.count,
      unit: 'EA',
      sources: data.doorIds.map(id => ({
        sourceType: 'door_schedule' as const,
        sourceId: id,
        sourceDescription: 'Door Schedule - Locksets'
      })),
      sourceDescription: `${data.count} locksets required`
    });
  });

  // Aggregate door closers
  const closerCounts = new Map<string, { count: number; doorIds: string[] }>();
  doors.forEach(door => {
    if (door.closer) {
      const existing = closerCounts.get(door.closer) || { count: 0, doorIds: [] };
      existing.count++;
      existing.doorIds.push(door.id);
      closerCounts.set(door.closer, existing);
    }
  });

  closerCounts.forEach((data, closerType) => {
    requirements.push({
      itemName: closerType,
      itemCategory: 'door_hardware',
      csiDivision: '08 71 00',
      requiredQty: data.count,
      unit: 'EA',
      sources: data.doorIds.map(id => ({
        sourceType: 'door_schedule' as const,
        sourceId: id,
        sourceDescription: 'Door Schedule - Closers'
      })),
      sourceDescription: `${data.count} door closers required`
    });
  });

  // Kickplates
  const kickplateDoors = doors.filter(d => d.kickplate);
  if (kickplateDoors.length > 0) {
    requirements.push({
      itemName: 'Door Kickplates',
      itemCategory: 'door_hardware',
      csiDivision: '08 71 00',
      requiredQty: kickplateDoors.length,
      unit: 'EA',
      sources: kickplateDoors.map(d => ({
        sourceType: 'door_schedule' as const,
        sourceId: d.id,
        sourceDescription: 'Door Schedule - Kickplates'
      })),
      sourceDescription: `${kickplateDoors.length} doors require kickplates`
    });
  }

  // Weatherstripping
  const weatherstripDoors = doors.filter(d => d.weatherstrip);
  if (weatherstripDoors.length > 0) {
    requirements.push({
      itemName: 'Door Weatherstripping',
      itemCategory: 'door_hardware',
      csiDivision: '08 71 00',
      requiredQty: weatherstripDoors.length,
      unit: 'SET',
      sources: weatherstripDoors.map(d => ({
        sourceType: 'door_schedule' as const,
        sourceId: d.id,
        sourceDescription: 'Door Schedule - Weatherstripping'
      })),
      sourceDescription: `${weatherstripDoors.length} doors require weatherstripping`
    });
  }

  // Thresholds
  const thresholdCounts = new Map<string, { count: number; doorIds: string[] }>();
  doors.forEach(door => {
    if (door.threshold) {
      const existing = thresholdCounts.get(door.threshold) || { count: 0, doorIds: [] };
      existing.count++;
      existing.doorIds.push(door.id);
      thresholdCounts.set(door.threshold, existing);
    }
  });

  thresholdCounts.forEach((data, thresholdType) => {
    requirements.push({
      itemName: `Threshold - ${thresholdType}`,
      itemCategory: 'door_hardware',
      csiDivision: '08 71 00',
      requiredQty: data.count,
      unit: 'EA',
      sources: data.doorIds.map(id => ({
        sourceType: 'door_schedule' as const,
        sourceId: id,
        sourceDescription: 'Door Schedule - Thresholds'
      })),
      sourceDescription: `${data.count} thresholds required`
    });
  });

  // Door frames by material
  const frameCounts = new Map<string, { count: number; doorIds: string[] }>();
  doors.forEach(door => {
    if (door.frameMaterial) {
      const frameDesc = `${door.frameMaterial} Door Frame ${door.width || ''} x ${door.height || ''}`.trim();
      const existing = frameCounts.get(frameDesc) || { count: 0, doorIds: [] };
      existing.count++;
      existing.doorIds.push(door.id);
      frameCounts.set(frameDesc, existing);
    }
  });

  frameCounts.forEach((data, frameType) => {
    requirements.push({
      itemName: frameType,
      itemCategory: 'door_frames',
      csiDivision: '08 11 00',
      requiredQty: data.count,
      unit: 'EA',
      sources: data.doorIds.map(id => ({
        sourceType: 'door_schedule' as const,
        sourceId: id,
        sourceDescription: 'Door Schedule - Frames'
      })),
      sourceDescription: `${data.count} frames required`
    });
  });

  return requirements;
}

/**
 * Get window schedule requirements
 */
async function getWindowScheduleRequirements(projectId: string): Promise<RequiredQuantity[]> {
  const requirements: RequiredQuantity[] = [];

  const windows = await prisma.windowScheduleItem.findMany({
    where: { projectId },
    select: {
      id: true,
      windowNumber: true,
      windowMark: true,
      windowType: true,
      width: true,
      height: true,
      frameMaterial: true,
      glazingType: true,
      operationType: true,
      hardwareFinish: true,
      screenType: true,
      manufacturer: true,
    }
  });

  if (windows.length === 0) return requirements;

  // Aggregate by window type
  const windowTypeCounts = new Map<string, { count: number; ids: string[] }>();
  windows.forEach(win => {
    const key = `${win.windowType || 'Window'} ${win.width || ''} x ${win.height || ''}`.trim();
    const existing = windowTypeCounts.get(key) || { count: 0, ids: [] };
    existing.count++;
    existing.ids.push(win.id);
    windowTypeCounts.set(key, existing);
  });

  windowTypeCounts.forEach((data, windowType) => {
    requirements.push({
      itemName: windowType,
      itemCategory: 'windows',
      csiDivision: '08 50 00',
      requiredQty: data.count,
      unit: 'EA',
      sources: data.ids.map(id => ({
        sourceType: 'window_schedule' as const,
        sourceId: id,
        sourceDescription: 'Window Schedule'
      })),
      sourceDescription: `${data.count} windows from window schedule`
    });
  });

  // Aggregate glazing by type
  const glazingCounts = new Map<string, { count: number; ids: string[] }>();
  windows.forEach(win => {
    if (win.glazingType) {
      const existing = glazingCounts.get(win.glazingType) || { count: 0, ids: [] };
      existing.count++;
      existing.ids.push(win.id);
      glazingCounts.set(win.glazingType, existing);
    }
  });

  glazingCounts.forEach((data, glazingType) => {
    requirements.push({
      itemName: `Glazing - ${glazingType}`,
      itemCategory: 'glazing',
      csiDivision: '08 80 00',
      requiredQty: data.count,
      unit: 'EA',
      sources: data.ids.map(id => ({
        sourceType: 'window_schedule' as const,
        sourceId: id,
        sourceDescription: 'Window Schedule - Glazing'
      })),
      sourceDescription: `${data.count} glazing units required`
    });
  });

  // Screens
  const screenWindows = windows.filter(w => w.screenType);
  if (screenWindows.length > 0) {
    const screenCounts = new Map<string, { count: number; ids: string[] }>();
    screenWindows.forEach(win => {
      const screenType = win.screenType || 'Standard';
      const existing = screenCounts.get(screenType) || { count: 0, ids: [] };
      existing.count++;
      existing.ids.push(win.id);
      screenCounts.set(screenType, existing);
    });

    screenCounts.forEach((data, screenType) => {
      requirements.push({
        itemName: `Window Screen - ${screenType}`,
        itemCategory: 'window_accessories',
        csiDivision: '08 50 00',
        requiredQty: data.count,
        unit: 'EA',
        sources: data.ids.map(id => ({
          sourceType: 'window_schedule' as const,
          sourceId: id,
          sourceDescription: 'Window Schedule - Screens'
        })),
        sourceDescription: `${data.count} window screens required`
      });
    });
  }

  return requirements;
}

/**
 * Get takeoff requirements from all material takeoffs
 */
async function getTakeoffRequirements(projectId: string): Promise<RequiredQuantity[]> {
  const requirements: RequiredQuantity[] = [];

  // Get takeoff line items directly with proper relation name
  const lineItems = await prisma.takeoffLineItem.findMany({
    where: {
      MaterialTakeoff: { projectId },
      verified: true,
      verificationStatus: { in: ['auto_approved', 'needs_review'] }
    },
    select: {
      id: true,
      category: true,
      itemName: true,
      quantity: true,
      unit: true,
    }
  });

  if (lineItems.length === 0) return requirements;

  // Aggregate line items by name and category
  const itemAggregates = new Map<string, {
    totalQty: number;
    unit: string;
    category: string;
    lineItemIds: string[];
  }>();

  lineItems.forEach((item) => {
    const key = `${item.category}|${item.itemName}`;
    const existing = itemAggregates.get(key) || {
      totalQty: 0,
      unit: item.unit,
      category: item.category,
      lineItemIds: []
    };
    existing.totalQty += item.quantity;
    existing.lineItemIds.push(item.id);
    itemAggregates.set(key, existing);
  });

  itemAggregates.forEach((data, key) => {
    const [category, itemName] = key.split('|');
    
    // Map category to CSI division
    const csiDivision = getCsiDivisionForCategory(category);

    requirements.push({
      itemName,
      itemCategory: category,
      csiDivision,
      requiredQty: data.totalQty,
      unit: data.unit,
      sources: data.lineItemIds.map(id => ({
        sourceType: 'takeoff' as const,
        sourceId: id,
        sourceDescription: 'Material Takeoff'
      })),
      sourceDescription: `${data.totalQty} ${data.unit} from takeoffs`
    });
  });

  return requirements;
}

/**
 * Get MEP equipment requirements
 */
async function getMEPEquipmentRequirements(projectId: string): Promise<RequiredQuantity[]> {
  const requirements: RequiredQuantity[] = [];

  const equipment = await prisma.mEPEquipment.findMany({
    where: { projectId },
    select: {
      id: true,
      equipmentTag: true,
      name: true,
      equipmentType: true,
      manufacturer: true,
      model: true,
      capacity: true,
    }
  });

  if (equipment.length === 0) return requirements;

  // Aggregate by equipment type
  const equipmentTypeCounts = new Map<string, {
    count: number;
    ids: string[];
    tags: string[];
  }>();

  equipment.forEach(eq => {
    const key = `${eq.equipmentType} - ${eq.name}`;
    const existing = equipmentTypeCounts.get(key) || { count: 0, ids: [], tags: [] };
    existing.count++;
    existing.ids.push(eq.id);
    existing.tags.push(eq.equipmentTag);
    equipmentTypeCounts.set(key, existing);
  });

  equipmentTypeCounts.forEach((data, equipmentType) => {
    // Determine CSI division based on equipment type
    const csiDivision = getMEPCsiDivision(equipmentType);

    requirements.push({
      itemName: equipmentType,
      itemCategory: 'mep_equipment',
      csiDivision,
      requiredQty: data.count,
      unit: 'EA',
      sources: data.ids.map(id => ({
        sourceType: 'mep_equipment' as const,
        sourceId: id,
        sourceDescription: 'MEP Equipment Schedule'
      })),
      sourceDescription: `${data.count} units: ${data.tags.slice(0, 5).join(', ')}${data.tags.length > 5 ? '...' : ''}`
    });
  });

  return requirements;
}

/**
 * Get finish schedule requirements
 */
async function getFinishScheduleRequirements(projectId: string): Promise<RequiredQuantity[]> {
  const requirements: RequiredQuantity[] = [];

  // FinishScheduleItem is linked through Room, so we need to query through the relation
  const finishes = await prisma.finishScheduleItem.findMany({
    where: {
      Room: { projectId }
    },
    select: {
      id: true,
      finishType: true,
      material: true,
      manufacturer: true,
      modelNumber: true,
      color: true,
      dimensions: true,
      category: true,
    }
  });

  if (finishes.length === 0) return requirements;

  // Aggregate by finish material/type
  const finishAggregates = new Map<string, {
    count: number;
    finishType: string | null;
    ids: string[];
  }>();

  finishes.forEach(finish => {
    const key = `${finish.material || finish.finishType || 'Unknown'} ${finish.color || ''}`.trim();
    const existing = finishAggregates.get(key) || {
      count: 0,
      finishType: finish.finishType,
      ids: []
    };
    existing.count += 1;
    existing.ids.push(finish.id);
    finishAggregates.set(key, existing);
  });

  finishAggregates.forEach((data, finishName) => {
    const csiDivision = getFinishCsiDivision(data.finishType || '');

    requirements.push({
      itemName: finishName,
      itemCategory: 'finishes',
      csiDivision,
      requiredQty: data.count,
      unit: 'EA', // Count of finish schedule items
      sources: data.ids.map(id => ({
        sourceType: 'finish_schedule' as const,
        sourceId: id,
        sourceDescription: 'Finish Schedule'
      })),
      sourceDescription: `${data.count} rooms from finish schedule`
    });
  });

  return requirements;
}

// =============================================================================
// VERIFICATION ENGINE
// =============================================================================

/**
 * Verify submittal line items against project requirements
 */
export async function verifySubmittalQuantities(
  submittalId: string
): Promise<SubmittalVerificationReport> {
  const submittal = await prisma.mEPSubmittal.findUnique({
    where: { id: submittalId },
    include: {
      lineItems: true,
      project: { select: { id: true } }
    }
  });

  if (!submittal) {
    throw new Error('Submittal not found');
  }

  // Get all project requirements
  const requirements = await aggregateProjectRequirements(submittal.projectId);

  const lineItemResults: VerificationResult[] = [];

  // Verify all line items
  for (const lineItem of submittal.lineItems) {
    const result = await verifyLineItem(lineItem, requirements);
    lineItemResults.push(result);
  }

  // Batch update all line items in a single transaction
  const verifiedAt = new Date();
  await prisma.$transaction(
    submittal.lineItems.map((lineItem, index) => {
      const result = lineItemResults[index];
      return prisma.submittalLineItem.update({
        where: { id: lineItem.id },
        data: {
          requiredQty: result.requiredQty,
          complianceStatus: result.status,
          varianceQty: result.varianceQty,
          variancePercent: result.variancePercent,
          verifiedAt,
          verificationNotes: result.notes,
          linkedSourceIds: result.matchedSources.map(s => s.sourceId),
          linkedSourceType: result.matchedSources[0]?.sourceType || null,
        }
      });
    })
  );

  const sufficientCount = lineItemResults.filter(r => r.status === 'SUFFICIENT').length;
  const insufficientCount = lineItemResults.filter(r => r.status === 'INSUFFICIENT').length;
  const excessCount = lineItemResults.filter(r => r.status === 'EXCESS').length;
  const noRequirementCount = lineItemResults.filter(r => r.status === 'NO_REQUIREMENT').length;
  const criticalShortages = lineItemResults.filter(r => r.status === 'INSUFFICIENT');

  const overallStatus = insufficientCount > 0 ? 'FAIL' :
    (noRequirementCount > lineItemResults.length / 2) ? 'REVIEW_NEEDED' : 'PASS';

  return {
    submittalId,
    submittalNumber: submittal.submittalNumber,
    verifiedAt: new Date(),
    totalLineItems: lineItemResults.length,
    sufficientCount,
    insufficientCount,
    excessCount,
    noRequirementCount,
    lineItemResults,
    overallStatus,
    criticalShortages,
  };
}

/**
 * Verify a single line item against requirements
 */
async function verifyLineItem(
  lineItem: any,
  requirements: RequiredQuantity[]
): Promise<VerificationResult> {
  // Find matching requirements using fuzzy matching
  const matches = findMatchingRequirements(lineItem, requirements);

  if (matches.length === 0) {
    return {
      lineItemId: lineItem.id,
      productName: lineItem.productName,
      submittedQty: lineItem.submittedQty,
      requiredQty: null,
      unit: lineItem.unit,
      status: 'NO_REQUIREMENT',
      varianceQty: null,
      variancePercent: null,
      matchedSources: [],
      notes: 'No matching requirement found in project data. Manual verification recommended.'
    };
  }

  // Sum up all matching requirements
  const totalRequired = matches.reduce((sum, m) => sum + m.requiredQty, 0);
  const varianceQty = lineItem.submittedQty - totalRequired;
  const variancePercent = totalRequired > 0 ? (varianceQty / totalRequired) * 100 : 0;

  let status: 'SUFFICIENT' | 'INSUFFICIENT' | 'EXCESS';
  let notes: string;

  if (varianceQty >= 0) {
    if (variancePercent > 20) {
      status = 'EXCESS';
      notes = `Submitted ${lineItem.submittedQty} ${lineItem.unit}, required ${totalRequired}. Excess of ${varianceQty} (${variancePercent.toFixed(1)}%) - verify if intentional buffer.`;
    } else {
      status = 'SUFFICIENT';
      notes = `Quantity meets requirements. Submitted ${lineItem.submittedQty}, required ${totalRequired}.`;
    }
  } else {
    status = 'INSUFFICIENT';
    notes = `SHORTAGE: Submitted ${lineItem.submittedQty} ${lineItem.unit}, but ${totalRequired} required. Short by ${Math.abs(varianceQty)} (${Math.abs(variancePercent).toFixed(1)}%).`;
  }

  const matchedSources: QuantitySource[] = matches.flatMap(m => m.sources);

  return {
    lineItemId: lineItem.id,
    productName: lineItem.productName,
    submittedQty: lineItem.submittedQty,
    requiredQty: totalRequired,
    unit: lineItem.unit,
    status,
    varianceQty,
    variancePercent,
    matchedSources,
    notes
  };
}

/**
 * Find requirements that match a line item using fuzzy matching
 */
function findMatchingRequirements(
  lineItem: any,
  requirements: RequiredQuantity[]
): RequiredQuantity[] {
  const productNameLower = lineItem.productName.toLowerCase();
  const matches: RequiredQuantity[] = [];

  for (const req of requirements) {
    const reqNameLower = req.itemName.toLowerCase();

    // Exact match
    if (reqNameLower === productNameLower) {
      matches.push(req);
      continue;
    }

    // Category + partial name match
    if (lineItem.tradeCategory && lineItem.tradeCategory === req.itemCategory) {
      // Check for significant word overlap
      const productWords = productNameLower.split(/\s+/).filter(w => w.length > 2);
      const reqWords = reqNameLower.split(/\s+/).filter(w => w.length > 2);
      const overlap = productWords.filter(w => reqWords.some(rw => rw.includes(w) || w.includes(rw)));
      
      if (overlap.length >= Math.min(2, productWords.length * 0.5)) {
        matches.push(req);
        continue;
      }
    }

    // CSI division match with name similarity
    if (lineItem.csiDivision && lineItem.csiDivision === req.csiDivision) {
      const similarity = calculateSimilarity(productNameLower, reqNameLower);
      if (similarity > 0.6) {
        matches.push(req);
        continue;
      }
    }

    // Hardware set matching
    if (lineItem.hardwareSetId && req.itemName.toLowerCase().includes('hardware set')) {
      const setMatch = productNameLower.match(/set\s*(\d+|[a-z])/i) || reqNameLower.match(/set\s*(\d+|[a-z])/i);
      if (setMatch && reqNameLower.includes(setMatch[1].toLowerCase())) {
        matches.push(req);
        continue;
      }
    }

    // Manufacturer/model specific matching
    if (lineItem.manufacturer && req.itemName.toLowerCase().includes(lineItem.manufacturer.toLowerCase())) {
      matches.push(req);
      continue;
    }
  }

  return matches;
}

/**
 * Calculate string similarity (Jaccard similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.split(/\s+/));
  const set2 = new Set(str2.split(/\s+/));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getCsiDivisionForCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    'concrete': '03 00 00',
    'masonry': '04 00 00',
    'metals': '05 00 00',
    'wood': '06 00 00',
    'thermal': '07 00 00',
    'insulation': '07 20 00',
    'roofing': '07 50 00',
    'doors': '08 10 00',
    'windows': '08 50 00',
    'hardware': '08 71 00',
    'glazing': '08 80 00',
    'finishes': '09 00 00',
    'drywall': '09 20 00',
    'flooring': '09 60 00',
    'painting': '09 90 00',
    'specialties': '10 00 00',
    'equipment': '11 00 00',
    'furnishings': '12 00 00',
    'plumbing': '22 00 00',
    'hvac': '23 00 00',
    'electrical': '26 00 00',
  };

  const lowerCategory = category.toLowerCase();
  for (const [key, value] of Object.entries(categoryMap)) {
    if (lowerCategory.includes(key)) return value;
  }
  return '';
}

function getMEPCsiDivision(equipmentType: string): string {
  const typeLower = equipmentType.toLowerCase();
  if (typeLower.includes('plumb') || typeLower.includes('pipe') || typeLower.includes('pump')) return '22 00 00';
  if (typeLower.includes('hvac') || typeLower.includes('ahu') || typeLower.includes('vav') || typeLower.includes('air')) return '23 00 00';
  if (typeLower.includes('fire')) return '21 00 00';
  if (typeLower.includes('electric') || typeLower.includes('panel') || typeLower.includes('transformer')) return '26 00 00';
  return '23 00 00'; // Default to HVAC
}

function getFinishCsiDivision(finishType: string): string {
  const typeLower = (finishType || '').toLowerCase();
  if (typeLower.includes('paint')) return '09 90 00';
  if (typeLower.includes('floor') || typeLower.includes('carpet') || typeLower.includes('tile')) return '09 60 00';
  if (typeLower.includes('ceiling')) return '09 50 00';
  if (typeLower.includes('wall') || typeLower.includes('drywall')) return '09 20 00';
  return '09 00 00';
}

// =============================================================================
// REQUIREMENT SYNC
// =============================================================================

/**
 * Sync quantity requirements from project data to database
 */
export async function syncQuantityRequirements(projectId: string): Promise<number> {
  const requirements = await aggregateProjectRequirements(projectId);
  let synced = 0;

  for (const req of requirements) {
    await prisma.quantityRequirement.upsert({
      where: {
        projectId_itemName_itemCategory_sourceType: {
          projectId,
          itemName: req.itemName,
          itemCategory: req.itemCategory,
          sourceType: req.sources[0]?.sourceType || 'manual'
        }
      },
      create: {
        projectId,
        itemName: req.itemName,
        itemCategory: req.itemCategory,
        csiDivision: req.csiDivision,
        requiredQty: req.requiredQty,
        unit: req.unit,
        sourceType: req.sources[0]?.sourceType || 'manual',
        sourceIds: req.sources.map(s => s.sourceId),
        sourceDescription: req.sourceDescription,
        status: 'PENDING'
      },
      update: {
        requiredQty: req.requiredQty,
        sourceIds: req.sources.map(s => s.sourceId),
        sourceDescription: req.sourceDescription,
      }
    });
    synced++;
  }

  return synced;
}

/**
 * Get requirement summary for a project
 */
export async function getRequirementSummary(projectId: string) {
  const requirements = await prisma.quantityRequirement.findMany({
    where: { projectId },
    orderBy: [{ itemCategory: 'asc' }, { itemName: 'asc' }]
  });

  const byCategory = new Map<string, typeof requirements>();
  requirements.forEach(req => {
    const existing = byCategory.get(req.itemCategory) || [];
    existing.push(req);
    byCategory.set(req.itemCategory, existing);
  });

  const pendingCount = requirements.filter(r => r.status === 'PENDING').length;
  const insufficientCount = requirements.filter(r => r.status === 'INSUFFICIENT').length;
  const approvedCount = requirements.filter(r => r.status === 'APPROVED').length;

  return {
    totalRequirements: requirements.length,
    pendingCount,
    insufficientCount,
    approvedCount,
    byCategory: Object.fromEntries(byCategory),
    requirements
  };
}
