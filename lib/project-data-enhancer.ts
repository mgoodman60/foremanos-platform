/**
 * Project Data Enhancer
 *
 * Automatically improves all aspects of project data after any document is processed.
 * This orchestrator runs enhancement modules in sequence to:
 * - Extract and reconcile budget data
 * - Improve takeoff accuracy with budget cross-reference
 * - Enhance schedule with document-derived milestones
 * - Update room finishes from specs
 * - Link related items across data types
 */

import { createScopedLogger } from './logger';

const log = createScopedLogger('PROJECT_ENHANCER');

import { prisma } from './db';
import { autoGenerateTakeoffs } from './auto-takeoff-generator';

// Budget phase mapping (CSI Division structure)
const WALKER_PHASES = {
  100: 'GENERAL REQUIREMENTS',
  200: 'SITEWORK',
  300: 'CONCRETE',
  400: 'MASONRY',
  500: 'METALS',
  600: 'WOODS & PLASTICS',
  700: 'THERMAL INSULATION',
  800: 'DOORS & WINDOWS',
  900: 'INTERIOR FINISHES',
  1000: 'SPECIALTIES',
  1300: 'SPECIAL CONSTRUCTION',
  2100: 'FIRE SUPPRESSION',
  2300: 'HVAC / PLUMBING',
  2600: 'ELECTRICAL',
  3000: 'DESIGN',
} as const;

// Category to phase mapping for takeoff reconciliation
const TAKEOFF_TO_PHASE: Record<string, number> = {
  'Flooring': 900,
  'Wall Finishes': 900,
  'Ceiling': 900,
  'Base': 900,
  'Doors': 800,
  'Windows': 800,
  'HVAC': 2300,
  'Plumbing': 2300,
  'Electrical': 2600,
  'Concrete': 300,
  'Masonry': 400,
  'Metals': 500,
  'Casework': 600,
  'Specialties': 1000,
};

export interface EnhancementResult {
  success: boolean;
  modulesRun: string[];
  improvements: {
    budgetItems: number;
    takeoffReconciled: number;
    roomsUpdated: number;
    scheduleLinked: number;
  };
  errors: string[];
}

/**
 * Main enhancement orchestrator - runs after any document is processed
 */
export async function enhanceProjectData(projectSlug: string): Promise<EnhancementResult> {
  const result: EnhancementResult = {
    success: true,
    modulesRun: [],
    improvements: {
      budgetItems: 0,
      takeoffReconciled: 0,
      roomsUpdated: 0,
      scheduleLinked: 0,
    },
    errors: [],
  };

  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        ProjectBudget: { include: { BudgetItem: true } },
        Document: { where: { deletedAt: null } },
      },
    });

    if (!project) {
      result.success = false;
      result.errors.push('Project not found');
      return result;
    }

    log.info('Starting project data enhancement', { projectName: project.name });

    // Module 1: Extract budget from documents if not present
    const budgetDocs = project.Document.filter(d =>
      d.name.toLowerCase().includes('budget') ||
      d.category === 'budget_cost'
    );

    if (budgetDocs.length > 0) {
      const budgetResult = await enhanceBudgetData(project.id, budgetDocs);
      result.modulesRun.push('budget_extraction');
      result.improvements.budgetItems = budgetResult.itemsCreated;
      if (budgetResult.error) result.errors.push(budgetResult.error);
    }

    // Module 2: Generate/update takeoffs
    const plansDocs = project.Document.filter(d =>
      d.name.toLowerCase().includes('plan') ||
      d.category === 'plans_drawings'
    );
    
    if (plansDocs.length > 0) {
      try {
        await autoGenerateTakeoffs(projectSlug);
        result.modulesRun.push('takeoff_generation');
      } catch (e) {
        result.errors.push(`Takeoff generation: ${e}`);
      }
    }

    // Module 3: Reconcile takeoffs with budget
    const reconcileResult = await reconcileTakeoffsWithBudget(project.id);
    result.modulesRun.push('budget_reconciliation');
    result.improvements.takeoffReconciled = reconcileResult.itemsReconciled;

    // Module 4: Update schedule links
    const scheduleResult = await linkScheduleToBudget(project.id);
    result.modulesRun.push('schedule_linking');
    result.improvements.scheduleLinked = scheduleResult.tasksLinked;

    // Module 5: Cross-reference room data
    const roomResult = await enhanceRoomData(project.id);
    result.modulesRun.push('room_enhancement');
    result.improvements.roomsUpdated = roomResult.roomsUpdated;

    log.info('Enhancement completed', { modulesRun: result.modulesRun.length, totalImprovements: Object.values(result.improvements).reduce((a, b) => a + b, 0) });

  } catch (error) {
    result.success = false;
    result.errors.push(`Enhancement failed: ${error}`);
    log.error('Enhancement error', error as Error);
  }

  return result;
}

/**
 * Extract and import budget data from budget documents
 */
async function enhanceBudgetData(
  projectId: string,
  budgetDocs: Array<{ id: string; name: string }>
): Promise<{ itemsCreated: number; error?: string }> {
  try {
    // Check if budget already exists
    let budget = await prisma.projectBudget.findFirst({
      where: { projectId },
      include: { BudgetItem: true },
    });

    // If budget has items already, skip extraction
    if (budget && budget.BudgetItem.length > 0) {
      log.info('Budget already populated, skipping extraction');
      return { itemsCreated: 0 };
    }

    // Create budget if not exists
    if (!budget) {
      budget = await prisma.projectBudget.create({
        data: {
          projectId,
          totalBudget: 0,
          contingency: 0,
          baselineDate: new Date(),
        },
        include: { BudgetItem: true },
      });
    }

    // Get document chunks to extract budget data
    const chunks = await prisma.documentChunk.findMany({
      where: {
        documentId: { in: budgetDocs.map(d => d.id) },
      },
      orderBy: { pageNumber: 'asc' },
    });

    if (chunks.length === 0) {
      return { itemsCreated: 0, error: 'No budget document content found' };
    }

    // Parse budget content using regex patterns for Walker Company format
    const budgetText = chunks.map(c => c.content).join('\n');
    const items = parseWalkerBudget(budgetText);

    if (items.length === 0) {
      return { itemsCreated: 0, error: 'Could not parse budget items' };
    }

    // Create budget items
    let itemsCreated = 0;
    for (const item of items) {
      await prisma.budgetItem.create({
        data: {
          budgetId: budget.id,
          name: item.name,
          description: item.description,
          phaseCode: item.phaseCode,
          phaseName: item.phaseName,
          categoryNumber: item.categoryNumber,
          budgetedAmount: item.budgetedAmount,
          actualCost: item.actualCost || 0,
          billedToDate: item.billedToDate || 0,
        },
      });
      itemsCreated++;
    }

    // Update total budget
    const totalBudget = items.reduce((sum, i) => sum + i.budgetedAmount, 0);
    await prisma.projectBudget.update({
      where: { id: budget.id },
      data: { totalBudget },
    });

    log.info('Created budget items', { itemsCreated, totalBudget });
    return { itemsCreated };

  } catch (error) {
    log.error('Budget extraction error', error as Error);
    return { itemsCreated: 0, error: `${error}` };
  }
}

/**
 * Parse Walker Company job cost format
 */
function parseWalkerBudget(text: string): Array<{
  name: string;
  description?: string;
  phaseCode: number;
  phaseName: string;
  categoryNumber: number;
  budgetedAmount: number;
  actualCost?: number;
  billedToDate?: number;
}> {
  const items: Array<{
    name: string;
    description?: string;
    phaseCode: number;
    phaseName: string;
    categoryNumber: number;
    budgetedAmount: number;
    actualCost?: number;
    billedToDate?: number;
  }> = [];

  let currentPhase = 0;
  let currentPhaseName = '';

  const lines = text.split('\n');
  
  for (const line of lines) {
    // Detect phase headers: "Phase: 100 - GENERAL REQUIREMENTS"
    const phaseMatch = line.match(/Phase:\s*(\d+)\s*-\s*(.+)/i);
    if (phaseMatch) {
      currentPhase = parseInt(phaseMatch[1]);
      currentPhaseName = phaseMatch[2].trim();
      continue;
    }

    // Detect line items: "1   Mobilization / Demobilization   0   0   2,500"
    const itemMatch = line.match(/^(\d+)\s+([A-Za-z][^0-9]{3,})\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/i);
    if (itemMatch && currentPhase > 0) {
      const catNum = parseInt(itemMatch[1]);
      const name = itemMatch[2].trim();
      const budgetedAmount = parseFloat(itemMatch[5].replace(/,/g, '')) || 0;
      const actualCost = parseFloat(itemMatch[4].replace(/,/g, '')) || 0;

      if (budgetedAmount === 0 && name.length < 5) continue;

      items.push({
        name,
        phaseCode: currentPhase,
        phaseName: currentPhaseName,
        categoryNumber: catNum,
        budgetedAmount,
        actualCost,
      });
    }
  }

  return items;
}

/**
 * Reconcile takeoffs with budget items using TakeoffLineItem
 */
async function reconcileTakeoffsWithBudget(
  projectId: string
): Promise<{ itemsReconciled: number }> {
  try {
    // Get budget items
    const budget = await prisma.projectBudget.findFirst({
      where: { projectId },
      include: { BudgetItem: true },
    });

    if (!budget || budget.BudgetItem.length === 0) {
      return { itemsReconciled: 0 };
    }

    // Get takeoffs with line items
    const takeoffs = await prisma.materialTakeoff.findMany({
      where: { projectId },
      include: { TakeoffLineItem: true },
    });

    if (takeoffs.length === 0) {
      return { itemsReconciled: 0 };
    }

    // Group line items by category and sum
    const takeoffSummary: Record<string, { total: number; count: number; items: Array<{ id: string; unitCost: number | null; totalCost: number | null }> }> = {};
    
    for (const takeoff of takeoffs) {
      for (const item of takeoff.TakeoffLineItem) {
        if (!takeoffSummary[item.category]) {
          takeoffSummary[item.category] = { total: 0, count: 0, items: [] };
        }
        takeoffSummary[item.category].total += item.totalCost || 0;
        takeoffSummary[item.category].count++;
        takeoffSummary[item.category].items.push({
          id: item.id,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
        });
      }
    }

    // Map to budget phases and compare
    let itemsReconciled = 0;
    for (const [category, summary] of Object.entries(takeoffSummary)) {
      const phaseCode = TAKEOFF_TO_PHASE[category];
      if (!phaseCode) continue;

      const budgetItem = budget.BudgetItem.find(b => b.phaseCode === phaseCode);
      if (!budgetItem) continue;

      // Calculate variance
      const variance = Math.abs(budgetItem.budgetedAmount - summary.total);
      const variancePercent = budgetItem.budgetedAmount > 0 
        ? (variance / budgetItem.budgetedAmount) * 100 
        : 0;

      // If variance is significant (>20%), adjust takeoff pricing
      if (variancePercent > 20 && budgetItem.budgetedAmount > 0 && summary.total > 0) {
        const adjustmentFactor = budgetItem.budgetedAmount / summary.total;
        
        // Only adjust if reasonable (0.5x to 2x)
        if (adjustmentFactor >= 0.5 && adjustmentFactor <= 2) {
          log.info('Adjusting category to match budget', { category, adjustmentPercent: (adjustmentFactor * 100 - 100).toFixed(1) });
          
          // Update takeoff line items in this category
          for (const item of summary.items) {
            await prisma.takeoffLineItem.update({
              where: { id: item.id },
              data: {
                unitCost: (item.unitCost || 0) * adjustmentFactor,
                totalCost: (item.totalCost || 0) * adjustmentFactor,
              },
            });
          }
          itemsReconciled += summary.items.length;
        }
      }
    }

    log.info('Reconciled takeoff line items with budget', { itemsReconciled });
    return { itemsReconciled };

  } catch (error) {
    log.error('Reconciliation error', error as Error);
    return { itemsReconciled: 0 };
  }
}

/**
 * Link schedule tasks to budget items
 */
async function linkScheduleToBudget(
  projectId: string
): Promise<{ tasksLinked: number }> {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: { projectId },
      include: { ScheduleTask: true },
    });

    if (!schedule || schedule.ScheduleTask.length === 0) {
      return { tasksLinked: 0 };
    }

    const budget = await prisma.projectBudget.findFirst({
      where: { projectId },
      include: { BudgetItem: true },
    });

    if (!budget || budget.BudgetItem.length === 0) {
      return { tasksLinked: 0 };
    }

    let tasksLinked = 0;

    // Create keyword to phase mapping
    const phaseKeywords: Record<number, string[]> = {
      100: ['mobilization', 'setup', 'temporary', 'permit', 'survey', 'inspection'],
      200: ['sitework', 'grading', 'excavation', 'asphalt', 'paving', 'curb', 'landscape'],
      300: ['concrete', 'foundation', 'slab', 'footing'],
      400: ['masonry', 'block', 'brick', 'cmu'],
      500: ['steel', 'metal', 'handrail', 'railing'],
      600: ['wood', 'framing', 'casework', 'cabinet', 'millwork'],
      700: ['insulation', 'thermal'],
      800: ['door', 'window', 'glazing', 'storefront', 'hardware'],
      900: ['finish', 'drywall', 'paint', 'flooring', 'ceiling', 'tile', 'carpet'],
      1000: ['specialty', 'toilet accessory', 'signage', 'locker'],
      1300: ['pemb', 'pre-engineered', 'metal building'],
      2100: ['fire', 'sprinkler', 'suppression'],
      2300: ['hvac', 'plumbing', 'mechanical', 'duct', 'pipe'],
      2600: ['electrical', 'power', 'lighting', 'panel'],
      3000: ['design', 'architectural', 'engineering'],
    };

    for (const task of schedule.ScheduleTask) {
      const taskNameLower = task.name.toLowerCase();
      
      // Find matching phase
      let matchedPhase: number | null = null;
      for (const [phase, keywords] of Object.entries(phaseKeywords)) {
        if (keywords.some(kw => taskNameLower.includes(kw))) {
          matchedPhase = parseInt(phase);
          break;
        }
      }

      if (matchedPhase) {
        // Find corresponding budget item
        const budgetItem = budget.BudgetItem.find(b => b.phaseCode === matchedPhase);
        if (budgetItem) {
          // Update task with budget link if not already linked
          const linkedIds = budgetItem.linkedTaskIds || [];
          if (!linkedIds.includes(task.id)) {
            await prisma.budgetItem.update({
              where: { id: budgetItem.id },
              data: {
                linkedTaskIds: [...linkedIds, task.id],
              },
            });
            tasksLinked++;
          }
        }
      }
    }

    log.info('Linked schedule tasks to budget items', { tasksLinked });
    return { tasksLinked };

  } catch (error) {
    log.error('Schedule linking error', error as Error);
    return { tasksLinked: 0 };
  }
}

/**
 * Enhance room data with cross-referenced information
 * Updates room notes with calculated metadata
 */
async function enhanceRoomData(
  projectId: string
): Promise<{ roomsUpdated: number }> {
  try {
    const rooms = await prisma.room.findMany({
      where: { projectId },
    });

    if (rooms.length === 0) {
      return { roomsUpdated: 0 };
    }

    let roomsUpdated = 0;

    for (const room of rooms) {
      // Calculate estimated perimeter from area if area exists
      if (room.area && room.area > 0) {
        const width = Math.sqrt(room.area / 1.5);
        const length = width * 1.5;
        const estimatedPerimeter = Math.round(2 * (width + length));
        
        // Determine ceiling height based on room type
        const roomType = room.type?.toLowerCase() || room.name.toLowerCase();
        let ceilingHeight = 9; // Default
        if (roomType.includes('corridor') || roomType.includes('hall')) {
          ceilingHeight = 9;
        } else if (roomType.includes('lobby') || roomType.includes('reception')) {
          ceilingHeight = 10;
        } else if (roomType.includes('mechanical') || roomType.includes('utility')) {
          ceilingHeight = 12;
        }
        
        // Store calculated values in notes if not already present
        const currentNotes = room.notes || '';
        if (!currentNotes.includes('Estimated Perimeter:')) {
          const enhancedNotes = `${currentNotes}\n[Auto-calculated] Estimated Perimeter: ${estimatedPerimeter} LF, Ceiling Height: ${ceilingHeight} ft`.trim();
          await prisma.room.update({
            where: { id: room.id },
            data: { notes: enhancedNotes },
          });
          roomsUpdated++;
        }
      }
    }

    log.info('Updated rooms with calculated values', { roomsUpdated });
    return { roomsUpdated };

  } catch (error) {
    log.error('Room enhancement error', error as Error);
    return { roomsUpdated: 0 };
  }
}

/**
 * Trigger enhancement after document processing completes
 */
export async function triggerEnhancementAfterProcessing(
  projectSlug: string,
  documentName: string
): Promise<void> {
  log.info('Document processed, triggering project enhancement', { documentName, projectSlug });

  // Run enhancement in background
  enhanceProjectData(projectSlug)
    .then(result => {
      log.info('Enhancement complete', { improvements: result.improvements });
    })
    .catch(error => {
      log.error('Enhancement failed', error as Error);
    });
}
