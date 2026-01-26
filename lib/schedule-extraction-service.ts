import { prisma } from '@/lib/db';
import { processDoorScheduleForProject } from './door-schedule-extractor';
import { processWindowScheduleForProject } from './window-schedule-extractor';
import { extractMEPSchedules } from './mep-schedule-extractor';

export interface ExtractionResult {
  success: boolean;
  scheduleType: string;
  itemsExtracted: number;
  itemsUpdated: number;
  errors: string[];
}

export interface FullExtractionResult {
  projectId: string;
  documentId?: string;
  results: ExtractionResult[];
  totalExtracted: number;
  timestamp: Date;
}

/**
 * Extracts all schedule data from a project's documents
 */
export async function extractAllSchedules(projectSlug: string): Promise<FullExtractionResult> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });

  if (!project) {
    return {
      projectId: '',
      results: [],
      totalExtracted: 0,
      timestamp: new Date(),
    };
  }

  const results: ExtractionResult[] = [];
  let totalExtracted = 0;

  // Extract door schedules
  try {
    const doorResult = await extractDoorSchedule(project.id);
    results.push(doorResult);
    totalExtracted += doorResult.itemsExtracted;
  } catch (error) {
    results.push({
      success: false,
      scheduleType: 'doors',
      itemsExtracted: 0,
      itemsUpdated: 0,
      errors: [String(error)],
    });
  }

  // Extract window schedules
  try {
    const windowResult = await extractWindowSchedule(project.id);
    results.push(windowResult);
    totalExtracted += windowResult.itemsExtracted;
  } catch (error) {
    results.push({
      success: false,
      scheduleType: 'windows',
      itemsExtracted: 0,
      itemsUpdated: 0,
      errors: [String(error)],
    });
  }

  // Extract MEP schedules
  try {
    const mepResult = await extractMEPSchedule(project.id);
    results.push(mepResult);
    totalExtracted += mepResult.itemsExtracted;
  } catch (error) {
    results.push({
      success: false,
      scheduleType: 'mep',
      itemsExtracted: 0,
      itemsUpdated: 0,
      errors: [String(error)],
    });
  }

  return {
    projectId: project.id,
    results,
    totalExtracted,
    timestamp: new Date(),
  };
}

/**
 * Extract door schedule data from project documents
 */
async function extractDoorSchedule(projectId: string): Promise<ExtractionResult> {
  const errors: string[] = [];
  let itemsExtracted = 0;
  let itemsUpdated = 0;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { slug: true },
    });

    if (!project) {
      return { success: false, scheduleType: 'doors', itemsExtracted: 0, itemsUpdated: 0, errors: ['Project not found'] };
    }

    // Use the door schedule extractor to process project documents
    const result = await processDoorScheduleForProject(project.slug);
    
    if (result) {
      itemsExtracted = result.doorsExtracted || 0;
    }

    // Count what's in the database
    const doorCount = await prisma.doorScheduleItem.count({ where: { projectId } });
    const hwSetCount = await prisma.hardwareSetDefinition.count({ where: { projectId } });
    
    itemsExtracted = doorCount + hwSetCount;

  } catch (error) {
    errors.push(String(error));
  }

  return {
    success: errors.length === 0,
    scheduleType: 'doors',
    itemsExtracted,
    itemsUpdated,
    errors,
  };
}

/**
 * Extract window schedule data from project documents
 */
async function extractWindowSchedule(projectId: string): Promise<ExtractionResult> {
  const errors: string[] = [];
  let itemsExtracted = 0;
  let itemsUpdated = 0;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { slug: true },
    });

    if (!project) {
      return { success: false, scheduleType: 'windows', itemsExtracted: 0, itemsUpdated: 0, errors: ['Project not found'] };
    }

    // Use the window schedule extractor to process project documents
    const result = await processWindowScheduleForProject(project.slug);
    
    if (result) {
      itemsExtracted = result.windowsExtracted || 0;
    }

    // Count what's in the database
    const windowCount = await prisma.windowScheduleItem.count({ where: { projectId } });
    itemsExtracted = windowCount;

  } catch (error) {
    errors.push(String(error));
  }

  return {
    success: errors.length === 0,
    scheduleType: 'windows',
    itemsExtracted,
    itemsUpdated,
    errors,
  };
}

/**
 * Extract MEP schedule data (plumbing, electrical, HVAC)
 */
async function extractMEPSchedule(projectId: string): Promise<ExtractionResult> {
  const errors: string[] = [];
  let itemsExtracted = 0;
  let itemsUpdated = 0;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { slug: true },
    });

    if (!project) {
      return { success: false, scheduleType: 'mep', itemsExtracted: 0, itemsUpdated: 0, errors: ['Project not found'] };
    }

    // Use the MEP schedule extractor
    const result = await extractMEPSchedules(project.slug);
    
    if (result) {
      // Count items from the result
      itemsExtracted = (result.lightFixtures?.length || 0) + 
                       (result.plumbingFixtures?.length || 0) + 
                       (result.hvacEquipment?.length || 0) + 
                       (result.equipment?.length || 0);
    }

    // Also count quantity requirements with MEP-related categories
    const mepRequirements = await prisma.quantityRequirement.count({
      where: {
        projectId,
        itemCategory: { in: ['plumbing', 'electrical', 'hvac', 'mechanical', 'lighting'] },
      },
    });
    
    itemsExtracted = Math.max(itemsExtracted, mepRequirements);

  } catch (error) {
    errors.push(String(error));
  }

  return {
    success: errors.length === 0,
    scheduleType: 'mep',
    itemsExtracted,
    itemsUpdated,
    errors,
  };
}

/**
 * Trigger extraction after document upload/processing
 */
export async function triggerExtractionForDocument(
  documentId: string,
  projectId: string
): Promise<FullExtractionResult | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { slug: true },
  });

  if (!project) return null;

  // Run full extraction
  const result = await extractAllSchedules(project.slug);
  result.documentId = documentId;

  // Log the extraction
  await prisma.activityLog.create({
    data: {
      action: 'SCHEDULE_EXTRACTION',
      resource: 'document',
      resourceId: documentId,
      details: JSON.stringify({
        projectId,
        results: result.results.map(r => ({
          scheduleType: r.scheduleType,
          itemsExtracted: r.itemsExtracted,
          success: r.success,
        })),
        totalExtracted: result.totalExtracted,
      }),
    },
  });

  return result;
}
