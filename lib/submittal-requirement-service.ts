/**
 * Submittal Requirement Auto-Import Service
 * Unifies all schedule extractors to automatically populate submittal requirements
 */

import { prisma } from './db';
import { logger } from './logger';
import { extractPlumbingFixtures, getPlumbingRequirements } from './plumbing-fixture-extractor';
import { extractElectricalSchedule, getElectricalRequirements } from './electrical-panel-extractor';
import { extractEquipmentSchedule, getEquipmentRequirements } from './equipment-schedule-extractor';

// Import existing extractors
import { getDoorScheduleContext } from './door-schedule-extractor';
import { getWindowScheduleContext } from './window-schedule-extractor';

export interface RequirementItem {
  productName: string;
  manufacturer?: string;
  model?: string;
  requiredQty: number;
  unit: string;
  specSection: string;
  tradeCategory: string;
  linkedSourceType: string;
  linkedSourceIds: string[];
  sourceDescription?: string;
}

export interface ProjectRequirements {
  projectId: string;
  extractedAt: Date;
  categories: {
    doors: RequirementItem[];
    hardware: RequirementItem[];
    windows: RequirementItem[];
    plumbing: RequirementItem[];
    electrical: RequirementItem[];
    lighting: RequirementItem[];
    mechanical: RequirementItem[];
    finishes: RequirementItem[];
  };
  totals: {
    totalItems: number;
    byCategory: Record<string, number>;
    bySpecSection: Record<string, number>;
  };
}

/**
 * Extract all requirements from project schedules
 */
export async function extractAllRequirements(projectId: string): Promise<ProjectRequirements> {
  logger.info('SUBMITTAL_REQUIREMENTS', 'Extracting requirements', { projectId });

  const categories: ProjectRequirements['categories'] = {
    doors: [],
    hardware: [],
    windows: [],
    plumbing: [],
    electrical: [],
    lighting: [],
    mechanical: [],
    finishes: [],
  };

  // Extract door and hardware requirements
  try {
    const doorReqs = await extractDoorRequirements(projectId);
    categories.doors = doorReqs.doors;
    categories.hardware = doorReqs.hardware;
  } catch (e) {
    logger.warn('SUBMITTAL_REQUIREMENTS', 'Door extraction failed', { error: (e as Error).message });
  }

  // Extract window requirements
  try {
    const windowReqs = await extractWindowRequirements(projectId);
    categories.windows = windowReqs;
  } catch (e) {
    logger.warn('SUBMITTAL_REQUIREMENTS', 'Window extraction failed', { error: (e as Error).message });
  }

  // Extract plumbing requirements
  try {
    const plumbingReqs = await getPlumbingRequirements(projectId);
    categories.plumbing = plumbingReqs.fixtures;
  } catch (e) {
    logger.warn('SUBMITTAL_REQUIREMENTS', 'Plumbing extraction failed', { error: (e as Error).message });
  }

  // Extract electrical requirements
  try {
    const electricalReqs = await getElectricalRequirements(projectId);
    categories.electrical = electricalReqs.panels;
    categories.lighting = electricalReqs.lightingFixtures;
  } catch (e) {
    logger.warn('SUBMITTAL_REQUIREMENTS', 'Electrical extraction failed', { error: (e as Error).message });
  }

  // Extract mechanical equipment requirements
  try {
    const mechReqs = await getEquipmentRequirements(projectId);
    categories.mechanical = [...mechReqs.equipment, ...mechReqs.diffusers];
  } catch (e) {
    logger.warn('SUBMITTAL_REQUIREMENTS', 'Mechanical extraction failed', { error: (e as Error).message });
  }

  // Extract finish requirements
  try {
    const finishReqs = await extractFinishRequirements(projectId);
    categories.finishes = finishReqs;
  } catch (e) {
    logger.warn('SUBMITTAL_REQUIREMENTS', 'Finish extraction failed', { error: (e as Error).message });
  }

  // Calculate totals
  const allItems = Object.values(categories).flat();
  const byCategory: Record<string, number> = {};
  const bySpecSection: Record<string, number> = {};

  for (const [cat, items] of Object.entries(categories)) {
    byCategory[cat] = items.reduce((sum, i) => sum + i.requiredQty, 0);
  }

  allItems.forEach(item => {
    const section = item.specSection || 'Unknown';
    bySpecSection[section] = (bySpecSection[section] || 0) + item.requiredQty;
  });

  return {
    projectId,
    extractedAt: new Date(),
    categories,
    totals: {
      totalItems: allItems.length,
      byCategory,
      bySpecSection,
    },
  };
}

/**
 * Extract door and hardware requirements from door schedule
 */
async function extractDoorRequirements(projectId: string): Promise<{
  doors: RequirementItem[];
  hardware: RequirementItem[];
}> {
  // Find door schedule data
  const doorData = await prisma.doorScheduleItem.findMany({
    where: { projectId },
  });

  // Find hardware set definitions (components is a JSON field)
  const hardwareSets = await prisma.hardwareSetDefinition.findMany({
    where: { projectId },
  });

  const doors: RequirementItem[] = [];
  const hardware: RequirementItem[] = [];

  // Group doors by type
  const doorsByType: Record<string, typeof doorData> = {};
  doorData.forEach(door => {
    const type = `${door.width || ''}x${door.height || ''} ${door.doorMaterial || ''} ${door.doorType || ''}`.trim();
    if (!doorsByType[type]) doorsByType[type] = [];
    doorsByType[type].push(door);
  });

  for (const [type, doorsOfType] of Object.entries(doorsByType)) {
    doors.push({
      productName: `Door - ${type}`,
      requiredQty: doorsOfType.length,
      unit: 'EA',
      specSection: '08 11 00', // Metal Doors and Frames
      tradeCategory: 'doors',
      linkedSourceType: 'door_schedule',
      linkedSourceIds: doorsOfType.map(d => d.id),
      sourceDescription: `From door schedule: ${doorsOfType.map(d => d.doorNumber).join(', ')}`,
    });
  }

  // Calculate hardware requirements based on doors and hardware sets
  for (const hwSet of hardwareSets) {
    const doorsWithSet = doorData.filter(d => d.hardwareSet === hwSet.setNumber || d.hardwareSet === hwSet.setName);
    if (doorsWithSet.length === 0) continue;

    // Parse components from JSON field
    const components = (hwSet.components as any[]) || [];
    for (const comp of components) {
      const qtyPerDoor = comp.qtyPerDoor || comp.quantity || 1;
      const totalQty = doorsWithSet.length * qtyPerDoor;
      hardware.push({
        productName: comp.type || comp.itemName || 'Hardware Component',
        manufacturer: comp.manufacturer || undefined,
        model: comp.model || comp.modelNumber || undefined,
        requiredQty: totalQty,
        unit: 'EA',
        specSection: '08 71 00', // Door Hardware
        tradeCategory: 'door_hardware',
        linkedSourceType: 'hardware_schedule',
        linkedSourceIds: [hwSet.id],
        sourceDescription: `${qtyPerDoor} per door × ${doorsWithSet.length} doors with set ${hwSet.setNumber}`,
      });
    }
  }

  return { doors, hardware };
}

/**
 * Extract window requirements
 */
async function extractWindowRequirements(projectId: string): Promise<RequirementItem[]> {
  const windowData = await prisma.windowScheduleItem.findMany({
    where: { projectId },
  });

  const windows: RequirementItem[] = [];

  // Group by type
  const byType: Record<string, typeof windowData> = {};
  windowData.forEach(win => {
    const type = `${win.windowType || ''} ${win.width || ''}x${win.height || ''}`.trim();
    if (!byType[type]) byType[type] = [];
    byType[type].push(win);
  });

  for (const [type, windowsOfType] of Object.entries(byType)) {
    windows.push({
      productName: `Window - ${type}`,
      manufacturer: windowsOfType[0]?.manufacturer || undefined,
      model: windowsOfType[0]?.modelNumber || undefined,
      requiredQty: windowsOfType.length,
      unit: 'EA',
      specSection: '08 50 00', // Windows
      tradeCategory: 'windows',
      linkedSourceType: 'window_schedule',
      linkedSourceIds: windowsOfType.map(w => w.id),
      sourceDescription: `From window schedule: ${windowsOfType.map(w => w.windowNumber).join(', ')}`,
    });
  }

  return windows;
}

/**
 * Extract finish requirements
 */
async function extractFinishRequirements(projectId: string): Promise<RequirementItem[]> {
  // FinishScheduleItem is linked via Room, so we need to get rooms first
  const rooms = await prisma.room.findMany({
    where: { projectId },
    include: { FinishScheduleItem: true },
  });

  const finishes: RequirementItem[] = [];

  // Group finish items by category and finishType
  const byFinish: Record<string, { items: any[]; category: string; manufacturer?: string; model?: string }> = {};

  for (const room of rooms) {
    for (const finish of room.FinishScheduleItem) {
      const key = `${finish.category || 'general'}-${finish.finishType || finish.material || 'unknown'}`;
      if (!byFinish[key]) {
        byFinish[key] = {
          items: [],
          category: finish.category,
          manufacturer: finish.manufacturer || undefined,
          model: finish.modelNumber || undefined,
        };
      }
      byFinish[key].items.push({ ...finish, roomNumber: room.roomNumber });
    }
  }

  // Create requirement items
  for (const [key, data] of Object.entries(byFinish)) {
    const categoryLabel = data.category?.replace(/_/g, ' ') || 'Finish';
    const finishType = data.items[0]?.finishType || data.items[0]?.material || 'Standard';
    
    // Determine spec section based on category
    let specSection = '09 00 00'; // General Finishes
    if (data.category?.toLowerCase().includes('floor')) specSection = '09 60 00';
    else if (data.category?.toLowerCase().includes('ceiling')) specSection = '09 51 00';
    else if (data.category?.toLowerCase().includes('wall')) specSection = '09 21 00';
    else if (data.category?.toLowerCase().includes('paint')) specSection = '09 91 00';

    finishes.push({
      productName: `${categoryLabel} - ${finishType}`,
      manufacturer: data.manufacturer,
      model: data.model,
      requiredQty: data.items.length,
      unit: 'EA', // Count by room applications
      specSection,
      tradeCategory: 'finishes',
      linkedSourceType: 'finish_schedule',
      linkedSourceIds: data.items.map(i => i.id),
      sourceDescription: `${data.items.length} locations`,
    });
  }

  return finishes;
}

/**
 * Auto-import requirements into a submittal
 */
export async function autoImportRequirements(
  submittalId: string,
  categoryFilter?: string[],
  specSectionFilter?: string[]
): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const submittal = await prisma.mEPSubmittal.findUnique({
    where: { id: submittalId },
    include: { lineItems: true },
  });

  if (!submittal) {
    return { imported: 0, skipped: 0, errors: ['Submittal not found'] };
  }

  const requirements = await extractAllRequirements(submittal.projectId);
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  // Get existing line items to avoid duplicates
  const existingProducts = new Set(
    submittal.lineItems.map(li => li.productName.toLowerCase())
  );

  // Flatten all requirements
  let allItems: RequirementItem[] = Object.values(requirements.categories).flat();

  // Apply filters
  if (categoryFilter && categoryFilter.length > 0) {
    allItems = allItems.filter(item => categoryFilter.includes(item.tradeCategory));
  }

  if (specSectionFilter && specSectionFilter.length > 0) {
    allItems = allItems.filter(item => 
      specSectionFilter.some(section => item.specSection.startsWith(section))
    );
  }

  // Import each requirement as a line item
  for (const item of allItems) {
    if (existingProducts.has(item.productName.toLowerCase())) {
      skipped++;
      continue;
    }

    try {
      await prisma.submittalLineItem.create({
        data: {
          submittalId,
          productName: item.productName,
          manufacturer: item.manufacturer,
          modelNumber: item.model,
          submittedQty: 0, // To be filled by contractor
          requiredQty: item.requiredQty,
          unit: item.unit,
          specSection: item.specSection,
          tradeCategory: item.tradeCategory,
          linkedSourceType: item.linkedSourceType,
          linkedSourceIds: item.linkedSourceIds,
          notes: item.sourceDescription,
          complianceStatus: 'UNVERIFIED',
        },
      });
      imported++;
    } catch (e: any) {
      errors.push(`Failed to import ${item.productName}: ${e.message}`);
    }
  }

  logger.info('SUBMITTAL_REQUIREMENTS', `Imported ${imported} requirements, skipped ${skipped} duplicates`);
  return { imported, skipped, errors };
}

/**
 * Get available requirement categories for a project
 */
export async function getAvailableCategories(projectId: string): Promise<{
  category: string;
  label: string;
  itemCount: number;
  specSections: string[];
}[]> {
  const requirements = await extractAllRequirements(projectId);

  return Object.entries(requirements.categories)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items]) => ({
      category,
      label: getCategoryLabel(category),
      itemCount: items.length,
      specSections: [...new Set(items.map(i => i.specSection))],
    }));
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    doors: 'Doors & Frames',
    hardware: 'Door Hardware',
    windows: 'Windows',
    plumbing: 'Plumbing Fixtures',
    electrical: 'Electrical Panels',
    lighting: 'Lighting Fixtures',
    mechanical: 'Mechanical Equipment',
    finishes: 'Finishes',
  };
  return labels[category] || category;
}
