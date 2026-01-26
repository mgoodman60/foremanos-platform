/**
 * Takeoff Labor & Schedule Integration Service
 * 
 * Links material takeoff quantities to schedule tasks and labor requirements.
 * Calculates crew sizes, durations, and resource loading.
 */

import { prisma } from './db';
import { TAKEOFF_CATEGORIES, getLaborHoursPerUnit } from './takeoff-categories';

// Types
export interface LaborRequirement {
  takeoffItemId: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  laborHoursPerUnit: number;
  totalLaborHours: number;
  suggestedCrewSize: number;
  suggestedDuration: number; // in days
  tradeType: string;
}

export interface ScheduleLink {
  takeoffItemId: string;
  scheduleTaskId: string;
  taskName: string;
  linkType: 'direct' | 'inferred' | 'manual';
  matchConfidence: number;
  assignedQuantity: number;
  assignedLaborHours: number;
}

export interface ResourceLoadingData {
  date: string;
  trade: string;
  laborHours: number;
  crewSize: number;
  tasks: string[];
}

export interface LaborSummary {
  totalLaborHours: number;
  byTrade: Array<{
    trade: string;
    laborHours: number;
    itemCount: number;
    suggestedCrewDays: number;
  }>;
  byCategory: Array<{
    category: string;
    laborHours: number;
    itemCount: number;
  }>;
  peakCrewSize: number;
  estimatedDuration: number; // days
}

// Trade type mappings from categories
const CATEGORY_TO_TRADE: Record<string, string> = {
  'Concrete': 'Concrete',
  'Rebar': 'Concrete',
  'Masonry': 'Masonry',
  'Structural Steel': 'Structural Steel',
  'Wood Framing': 'Carpentry',
  'HVAC': 'HVAC',
  'Plumbing': 'Plumbing',
  'Electrical': 'Electrical',
  'Drywall': 'Drywall',
  'Flooring': 'Flooring',
  'Ceilings': 'Ceilings',
  'Finishes': 'Painting',
  'Doors': 'Doors & Hardware',
  'Windows & Glazing': 'Glazing',
  'Earthwork': 'Sitework',
  'Paving': 'Paving',
  'Site Utilities': 'Site Utilities',
  'Roofing': 'Roofing',
  'Insulation': 'Insulation'
};

// Default crew sizes by trade (industry standards - fallback only)
const DEFAULT_CREW_SIZES: Record<string, number> = {
  'Concrete': 6,
  'Masonry': 4,
  'Structural Steel': 4,
  'Carpentry': 4,
  'HVAC': 3,
  'Plumbing': 3,
  'Electrical': 4,
  'Drywall': 4,
  'Flooring': 3,
  'Ceilings': 3,
  'Painting': 4,
  'Doors & Hardware': 2,
  'Glazing': 3,
  'Sitework': 6,
  'Paving': 5,
  'Site Utilities': 5,
  'Roofing': 4,
  'Insulation': 3
};

// Cache for project-specific crew sizes (populated from daily reports)
const projectCrewSizeCache = new Map<string, Map<string, number>>();

/**
 * Get project-specific crew size from daily report history
 */
async function getProjectCrewSize(projectId: string, tradeType: string): Promise<number | null> {
  // Check cache first
  const cacheKey = projectId;
  if (!projectCrewSizeCache.has(cacheKey)) {
    // Load crew sizes from daily reports
    try {
      const laborEntries = await prisma.laborEntry.findMany({
        where: { 
          projectId,
          status: 'APPROVED'
        },
        orderBy: { date: 'desc' },
        take: 100 // Last 100 entries
      });

      const tradeCrewSizes = new Map<string, number[]>();
      
      for (const entry of laborEntries) {
        const trade = entry.tradeType?.toString() || 'GENERAL';
        if (!tradeCrewSizes.has(trade)) {
          tradeCrewSizes.set(trade, []);
        }
        // Worker name often contains crew count like "Plumber Crew (4 workers)"
        const match = entry.workerName?.match(/\((\d+)\s*workers?\)/i);
        if (match) {
          tradeCrewSizes.get(trade)!.push(parseInt(match[1], 10));
        }
      }

      // Calculate average crew size per trade
      const avgCrewSizes = new Map<string, number>();
      tradeCrewSizes.forEach((sizes, trade) => {
        if (sizes.length > 0) {
          const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
          avgCrewSizes.set(trade, Math.round(avg));
        }
      });

      projectCrewSizeCache.set(cacheKey, avgCrewSizes);
    } catch (error) {
      console.error('[Labor Schedule] Error loading project crew sizes:', error);
      projectCrewSizeCache.set(cacheKey, new Map());
    }
  }

  const projectSizes = projectCrewSizeCache.get(cacheKey);
  if (projectSizes) {
    // Try exact match
    const normalizedTrade = tradeType.toUpperCase().replace(/[\s&-]/g, '_');
    if (projectSizes.has(normalizedTrade)) {
      return projectSizes.get(normalizedTrade)!;
    }
    
    // Try fuzzy match
    for (const [trade, size] of projectSizes.entries()) {
      if (trade.includes(normalizedTrade) || normalizedTrade.includes(trade)) {
        return size;
      }
    }
  }

  return null;
}

/**
 * Get crew size with project-specific override
 */
async function getCrewSize(projectId: string | null, tradeType: string): Promise<number> {
  // Try project-specific first
  if (projectId) {
    const projectSize = await getProjectCrewSize(projectId, tradeType);
    if (projectSize) {
      return projectSize;
    }
  }
  
  // Fall back to defaults
  return DEFAULT_CREW_SIZES[tradeType] || 4;
}

// Standard work hours per day
const WORK_HOURS_PER_DAY = 8;
const PRODUCTIVITY_FACTOR = 0.85; // Account for breaks, setup, etc.

/**
 * Calculate labor requirements for takeoff items
 */
export async function calculateLaborRequirements(takeoffId: string): Promise<LaborRequirement[]> {
  const items = await prisma.takeoffLineItem.findMany({
    where: {
      takeoffId,
      verificationStatus: { not: 'rejected' }
    }
  });

  const requirements: LaborRequirement[] = [];

  for (const item of items) {
    const laborHoursPerUnit = getLaborHoursPerUnit(item.category, undefined);
    const totalLaborHours = item.quantity * laborHoursPerUnit;
    const tradeType = CATEGORY_TO_TRADE[item.category] || item.category;
    const defaultCrewSize = DEFAULT_CREW_SIZES[tradeType] || 4;

    // Calculate suggested crew size and duration
    const effectiveHoursPerDay = WORK_HOURS_PER_DAY * PRODUCTIVITY_FACTOR * defaultCrewSize;
    const suggestedDuration = Math.ceil(totalLaborHours / effectiveHoursPerDay);
    const suggestedCrewSize = Math.min(
      Math.ceil(totalLaborHours / (suggestedDuration * WORK_HOURS_PER_DAY * PRODUCTIVITY_FACTOR)),
      defaultCrewSize * 2 // Cap at 2x default crew
    );

    requirements.push({
      takeoffItemId: item.id,
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      laborHoursPerUnit,
      totalLaborHours,
      suggestedCrewSize: Math.max(1, suggestedCrewSize),
      suggestedDuration: Math.max(1, suggestedDuration),
      tradeType
    });
  }

  return requirements;
}

/**
 * Get labor summary for a takeoff
 */
export async function getLaborSummary(takeoffId: string): Promise<LaborSummary> {
  const requirements = await calculateLaborRequirements(takeoffId);

  if (requirements.length === 0) {
    return {
      totalLaborHours: 0,
      byTrade: [],
      byCategory: [],
      peakCrewSize: 0,
      estimatedDuration: 0
    };
  }

  const totalLaborHours = requirements.reduce((sum, r) => sum + r.totalLaborHours, 0);

  // Group by trade
  const tradeMap = new Map<string, { hours: number; items: number }>();
  for (const req of requirements) {
    const existing = tradeMap.get(req.tradeType) || { hours: 0, items: 0 };
    existing.hours += req.totalLaborHours;
    existing.items++;
    tradeMap.set(req.tradeType, existing);
  }

  const byTrade = Array.from(tradeMap.entries()).map(([trade, data]) => {
    const crewSize = DEFAULT_CREW_SIZES[trade] || 4;
    const effectiveHoursPerDay = WORK_HOURS_PER_DAY * PRODUCTIVITY_FACTOR * crewSize;
    return {
      trade,
      laborHours: Math.round(data.hours),
      itemCount: data.items,
      suggestedCrewDays: Math.ceil(data.hours / effectiveHoursPerDay)
    };
  }).sort((a, b) => b.laborHours - a.laborHours);

  // Group by category
  const categoryMap = new Map<string, { hours: number; items: number }>();
  for (const req of requirements) {
    const existing = categoryMap.get(req.category) || { hours: 0, items: 0 };
    existing.hours += req.totalLaborHours;
    existing.items++;
    categoryMap.set(req.category, existing);
  }

  const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    laborHours: Math.round(data.hours),
    itemCount: data.items
  })).sort((a, b) => b.laborHours - a.laborHours);

  // Calculate peak crew size (sum of suggested crews for concurrent work)
  const peakCrewSize = byTrade.reduce((sum, t) => {
    const crewSize = DEFAULT_CREW_SIZES[t.trade] || 4;
    return sum + crewSize;
  }, 0);

  // Estimate total duration based on critical path (assume 50% parallel work)
  const totalCrewDays = byTrade.reduce((sum, t) => sum + t.suggestedCrewDays, 0);
  const estimatedDuration = Math.ceil(totalCrewDays * 0.6); // 40% overlap assumed

  return {
    totalLaborHours: Math.round(totalLaborHours),
    byTrade,
    byCategory,
    peakCrewSize: Math.min(peakCrewSize, 50), // Cap at 50
    estimatedDuration
  };
}

/**
 * Find matching schedule tasks for takeoff items
 */
export async function findMatchingScheduleTasks(
  takeoffId: string,
  projectId: string
): Promise<ScheduleLink[]> {
  const items = await prisma.takeoffLineItem.findMany({
    where: { takeoffId }
  });

  const tasks = await prisma.scheduleTask.findMany({
    where: {
      Schedule: { projectId }
    },
    include: {
      Schedule: true
    }
  });

  const links: ScheduleLink[] = [];

  for (const item of items) {
    const tradeType = CATEGORY_TO_TRADE[item.category] || item.category;
    const laborHoursPerUnit = getLaborHoursPerUnit(item.category, undefined);
    const totalLaborHours = item.quantity * laborHoursPerUnit;

    // Find best matching task
    let bestMatch: typeof tasks[0] | null = null;
    let bestConfidence = 0;

    for (const task of tasks) {
      let confidence = 0;

      // Trade type match (strongest signal)
      if (task.tradeType?.toLowerCase() === tradeType.toLowerCase() ||
          task.inferredTradeType?.toLowerCase() === tradeType.toLowerCase()) {
        confidence += 40;
      }

      // Name keyword match
      const taskNameLower = task.name.toLowerCase();
      const itemNameLower = item.itemName.toLowerCase();
      const categoryLower = item.category.toLowerCase();

      if (taskNameLower.includes(categoryLower) || taskNameLower.includes(itemNameLower)) {
        confidence += 30;
      }

      // Check for common construction keywords
      const keywords = itemNameLower.split(/\s+/);
      for (const kw of keywords) {
        if (kw.length > 3 && taskNameLower.includes(kw)) {
          confidence += 10;
          break;
        }
      }

      // Location match
      if (item.location && task.location) {
        if (item.location.toLowerCase().includes(task.location.toLowerCase()) ||
            task.location.toLowerCase().includes(item.location.toLowerCase())) {
          confidence += 15;
        }
      }

      // WBS code category match
      if (task.wbsCode) {
        const wbsPrefix = task.wbsCode.substring(0, 2);
        const categoryWBS: Record<string, string[]> = {
          '03': ['Concrete', 'Rebar'],
          '04': ['Masonry'],
          '05': ['Structural Steel'],
          '06': ['Wood Framing'],
          '07': ['Roofing', 'Insulation'],
          '08': ['Doors', 'Windows & Glazing'],
          '09': ['Drywall', 'Flooring', 'Ceilings', 'Finishes'],
          '22': ['Plumbing'],
          '23': ['HVAC'],
          '26': ['Electrical'],
          '31': ['Earthwork'],
          '32': ['Paving'],
          '33': ['Site Utilities']
        };

        if (categoryWBS[wbsPrefix]?.includes(item.category)) {
          confidence += 20;
        }
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = task;
      }
    }

    if (bestMatch && bestConfidence >= 30) {
      links.push({
        takeoffItemId: item.id,
        scheduleTaskId: bestMatch.id,
        taskName: bestMatch.name,
        linkType: bestConfidence >= 60 ? 'direct' : 'inferred',
        matchConfidence: Math.min(bestConfidence, 100),
        assignedQuantity: item.quantity,
        assignedLaborHours: totalLaborHours
      });
    }
  }

  return links.sort((a, b) => b.matchConfidence - a.matchConfidence);
}

/**
 * Generate resource loading curve data
 */
export async function generateResourceLoadingCurve(
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<ResourceLoadingData[]> {
  // Get schedule tasks with dates
  const tasks = await prisma.scheduleTask.findMany({
    where: {
      Schedule: { projectId },
      startDate: { gte: startDate },
      endDate: { lte: endDate }
    },
    orderBy: { startDate: 'asc' }
  });

  // Get all takeoffs for the project
  const takeoffs = await prisma.materialTakeoff.findMany({
    where: { projectId },
    include: {
      TakeoffLineItem: true
    }
  });

  // Build labor hours by trade
  const laborByTrade = new Map<string, number>();
  for (const takeoff of takeoffs) {
    for (const item of takeoff.TakeoffLineItem) {
      if (item.verificationStatus === 'rejected') continue;
      
      const trade = CATEGORY_TO_TRADE[item.category] || item.category;
      const laborHours = item.quantity * getLaborHoursPerUnit(item.category, undefined);
      const existing = laborByTrade.get(trade) || 0;
      laborByTrade.set(trade, existing + laborHours);
    }
  }

  // Generate daily resource data
  const resourceData: ResourceLoadingData[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dayTasks = tasks.filter(t => 
      t.startDate <= current && t.endDate >= current
    );

    // Group by trade
    const tradeGroups = new Map<string, { tasks: string[]; hours: number }>();
    
    for (const task of dayTasks) {
      const trade = task.tradeType || task.inferredTradeType || 'General';
      const existing = tradeGroups.get(trade) || { tasks: [], hours: 0 };
      existing.tasks.push(task.name);
      
      // Distribute labor hours evenly across task duration
      const taskLaborHours = laborByTrade.get(trade) || 0;
      const taskDays = Math.max(1, Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)));
      existing.hours += taskLaborHours / (tasks.filter(t => t.tradeType === trade).length * taskDays);
      
      tradeGroups.set(trade, existing);
    }

    for (const [trade, data] of tradeGroups.entries()) {
      const crewSize = DEFAULT_CREW_SIZES[trade] || 4;
      resourceData.push({
        date: dateStr,
        trade,
        laborHours: Math.round(data.hours),
        crewSize,
        tasks: data.tasks
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return resourceData;
}

/**
 * Get suggested schedule adjustments based on takeoff labor requirements
 */
export async function suggestScheduleAdjustments(
  takeoffId: string,
  projectId: string
): Promise<Array<{
  taskId: string;
  taskName: string;
  currentDuration: number;
  suggestedDuration: number;
  reason: string;
  laborDelta: number;
}>> {
  const links = await findMatchingScheduleTasks(takeoffId, projectId);
  const requirements = await calculateLaborRequirements(takeoffId);
  const suggestions: Array<{
    taskId: string;
    taskName: string;
    currentDuration: number;
    suggestedDuration: number;
    reason: string;
    laborDelta: number;
  }> = [];

  // Get linked tasks
  const tasks = await prisma.scheduleTask.findMany({
    where: {
      id: { in: links.map(l => l.scheduleTaskId) }
    }
  });

  for (const task of tasks) {
    const linkedItems = links.filter(l => l.scheduleTaskId === task.id);
    const totalLaborHours = linkedItems.reduce((sum, l) => sum + l.assignedLaborHours, 0);
    
    const tradeType = task.tradeType || task.inferredTradeType || 'General';
    const crewSize = DEFAULT_CREW_SIZES[tradeType] || 4;
    const effectiveHoursPerDay = WORK_HOURS_PER_DAY * PRODUCTIVITY_FACTOR * crewSize;
    
    const suggestedDuration = Math.ceil(totalLaborHours / effectiveHoursPerDay);
    const laborDelta = suggestedDuration - task.duration;

    if (Math.abs(laborDelta) >= 1) {
      suggestions.push({
        taskId: task.id,
        taskName: task.name,
        currentDuration: task.duration,
        suggestedDuration,
        reason: laborDelta > 0 
          ? `Takeoff indicates ${Math.round(totalLaborHours)} labor hours, requiring ${suggestedDuration} days with ${crewSize}-person crew`
          : `Takeoff labor hours (${Math.round(totalLaborHours)}) suggest task could be completed faster`,
        laborDelta
      });
    }
  }

  return suggestions.sort((a, b) => Math.abs(b.laborDelta) - Math.abs(a.laborDelta));
}

/**
 * Export labor plan to structured format
 */
export async function exportLaborPlan(takeoffId: string): Promise<{
  summary: LaborSummary;
  requirements: LaborRequirement[];
  dailyPlan: Array<{
    day: number;
    trade: string;
    crewSize: number;
    items: string[];
    hours: number;
  }>;
}> {
  const summary = await getLaborSummary(takeoffId);
  const requirements = await calculateLaborRequirements(takeoffId);

  // Generate daily work plan
  const dailyPlan: Array<{
    day: number;
    trade: string;
    crewSize: number;
    items: string[];
    hours: number;
  }> = [];

  // Group requirements by trade
  const tradeGroups = new Map<string, LaborRequirement[]>();
  for (const req of requirements) {
    const existing = tradeGroups.get(req.tradeType) || [];
    existing.push(req);
    tradeGroups.set(req.tradeType, existing);
  }

  // Create daily assignments
  for (const [trade, reqs] of tradeGroups.entries()) {
    const crewSize = DEFAULT_CREW_SIZES[trade] || 4;
    const effectiveHoursPerDay = WORK_HOURS_PER_DAY * PRODUCTIVITY_FACTOR * crewSize;
    
    let dayCounter = 1;
    let remainingHours = 0;
    let dayItems: string[] = [];

    for (const req of reqs) {
      let itemHours = req.totalLaborHours;

      while (itemHours > 0) {
        const availableHours = effectiveHoursPerDay - remainingHours;
        const assignedHours = Math.min(itemHours, availableHours);

        if (assignedHours > 0) {
          dayItems.push(req.itemName);
          remainingHours += assignedHours;
          itemHours -= assignedHours;
        }

        if (remainingHours >= effectiveHoursPerDay || itemHours <= 0) {
          if (dayItems.length > 0) {
            dailyPlan.push({
              day: dayCounter,
              trade,
              crewSize,
              items: [...new Set(dayItems)],
              hours: Math.round(remainingHours)
            });
          }

          if (remainingHours >= effectiveHoursPerDay) {
            dayCounter++;
            remainingHours = 0;
            dayItems = [];
          }
        }
      }
    }

    // Add remaining partial day
    if (remainingHours > 0 && dayItems.length > 0) {
      dailyPlan.push({
        day: dayCounter,
        trade,
        crewSize,
        items: [...new Set(dayItems)],
        hours: Math.round(remainingHours)
      });
    }
  }

  return {
    summary,
    requirements,
    dailyPlan: dailyPlan.sort((a, b) => a.day - b.day || a.trade.localeCompare(b.trade))
  };
}
