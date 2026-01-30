/**
 * Daily Report Cost Sync Service
 * 
 * Handles syncing daily report data to budget and schedule:
 * - Labor hours → Cost tracking by trade
 * - Equipment usage → Cost allocation
 * - Work completed → Schedule progress updates
 * - Weather conditions → Delay documentation
 */

import { prisma } from './db';
import { getProjectLaborRate } from './project-specific-pricing';

// Trade to budget phase mapping
const TRADE_TO_PHASE_CODE: Record<string, number> = {
  'GENERAL': 100,
  'SITEWORK': 200,
  'CONCRETE': 300,
  'MASONRY': 400,
  'METALS': 500,
  'WOOD_PLASTICS': 600,
  'THERMAL_MOISTURE': 700,
  'DOORS_WINDOWS': 800,
  'FINISHES': 900,
  'SPECIALTIES': 1000,
  'EQUIPMENT': 1100,
  'FURNISHINGS': 1200,
  'CONVEYING': 1400,
  'MECHANICAL': 1500,
  'ELECTRICAL': 1600,
};

// Standard hourly rates by trade (fallback if not specified)
const DEFAULT_HOURLY_RATES: Record<string, number> = {
  'General Labor': 35,
  'Carpenter': 55,
  'Electrician': 75,
  'Plumber': 70,
  'HVAC': 72,
  'Painter': 45,
  'Mason': 60,
  'Concrete': 50,
  'Ironworker': 65,
  'Roofer': 55,
  'Drywall': 48,
  'Insulation': 42,
  'default': 45,
};

export interface SyncResult {
  success: boolean;
  laborSynced: number;
  equipmentSynced: number;
  progressSynced: number;
  totalCostSynced: number;
  budgetItemsUpdated: number;
  scheduleTasksUpdated: number;
  warnings: string[];
  errors: string[];
}

export interface LaborSyncData {
  tradeName: string;
  workerCount: number;
  regularHours: number;
  overtimeHours: number;
  hourlyRate?: number;
  overtimeRate?: number;
  description?: string;
  budgetItemId?: string;
}

export interface EquipmentSyncData {
  equipmentName: string;
  equipmentType?: string;
  hours: number;
  dailyRate?: number;
  hourlyRate?: number;
  fuelCost?: number;
  operatorCost?: number;
  status?: string;
  notes?: string;
  budgetItemId?: string;
}

export interface ProgressSyncData {
  activityName: string;
  location?: string;
  unitsCompleted: number;
  unitOfMeasure?: string;
  percentComplete: number;
  scheduleTaskId?: string;
  budgetItemId?: string;
  notes?: string;
}

/**
 * Get hourly rate for a trade - uses project-specific pricing when available
 */
async function getHourlyRateForTrade(projectId: string, tradeName: string): Promise<{ rate: number; source: string }> {
  try {
    const projectRate = await getProjectLaborRate(projectId, tradeName);
    return { 
      rate: projectRate.hourlyRate, 
      source: projectRate.source 
    };
  } catch (error) {
    // Fallback to default rates if project-specific pricing fails
    const normalizedTrade = tradeName.toLowerCase();
    for (const [trade, rate] of Object.entries(DEFAULT_HOURLY_RATES)) {
      if (normalizedTrade.includes(trade.toLowerCase())) {
        return { rate, source: 'default_fallback' };
      }
    }
    return { rate: DEFAULT_HOURLY_RATES['default'], source: 'default_fallback' };
  }
}

/**
 * Match a trade name to a budget item
 */
async function matchTradeToBudgetItem(
  projectId: string,
  tradeName: string
): Promise<string | null> {
  const normalizedTrade = tradeName.toLowerCase();
  
  // Get project budget
  const budget = await prisma.projectBudget.findFirst({
    where: { projectId },
    include: { BudgetItem: true }
  });
  
  if (!budget) return null;
  
  // Try exact match first
  let match = budget.BudgetItem.find(item => 
    item.name.toLowerCase().includes(normalizedTrade) ||
    (item.description?.toLowerCase().includes(normalizedTrade))
  );
  
  if (match) return match.id;
  
  // Try matching by trade type
  const tradeTypeMapping: Record<string, string[]> = {
    'electrician': ['electrical'],
    'electric': ['electrical'],
    'plumber': ['plumbing'],
    'plumbing': ['plumbing'],
    'hvac': ['hvac_mechanical'],
    'mechanical': ['hvac_mechanical'],
    'fire protection': ['site_utilities'],
    'sprinkler': ['site_utilities'],
    'carpenter': ['carpentry_framing'],
    'framing': ['carpentry_framing'],
    'drywall': ['drywall_finishes'],
    'painter': ['painting_coating'],
    'flooring': ['flooring'],
    'roofing': ['roofing'],
    'concrete': ['concrete_masonry'],
    'mason': ['concrete_masonry'],
    'steel': ['structural_steel'],
    'iron': ['structural_steel'],
  };
  
  for (const [keyword, tradeTypes] of Object.entries(tradeTypeMapping)) {
    if (normalizedTrade.includes(keyword)) {
      match = budget.BudgetItem.find(item => 
        item.tradeType && tradeTypes.includes(item.tradeType)
      );
      if (match) return match.id;
    }
  }
  
  return null;
}

/**
 * Match equipment to a budget item
 */
async function matchEquipmentToBudgetItem(
  projectId: string,
  equipmentName: string,
  equipmentType?: string
): Promise<string | null> {
  const budget = await prisma.projectBudget.findFirst({
    where: { projectId },
    include: { BudgetItem: true }
  });
  
  if (!budget) return null;
  
  // Look for equipment line items (usually in General Requirements)
  const equipmentItem = budget.BudgetItem.find(item => {
    const nameMatch = item.name.toLowerCase().includes('equipment') ||
                      item.name.toLowerCase().includes(equipmentName.toLowerCase());
    const phaseMatch = item.phaseCode === 100; // General Requirements
    return nameMatch || phaseMatch;
  });
  
  return equipmentItem?.id || null;
}

/**
 * Sync labor entries from daily report to budget
 */
export async function syncLaborToBudget(
  reportId: string,
  projectId: string,
  laborEntries: LaborSyncData[]
): Promise<{ synced: number; totalCost: number; budgetItems: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const budgetItemsUpdated: Set<string> = new Set();
  let totalCost = 0;
  let synced = 0;
  
  for (const entry of laborEntries) {
    // Determine hourly rates - use project-specific pricing when available
    let hourlyRate = entry.hourlyRate;
    let rateSource = 'provided';
    
    if (!hourlyRate) {
      const projectRate = await getHourlyRateForTrade(projectId, entry.tradeName);
      hourlyRate = projectRate.rate;
      rateSource = projectRate.source;
    }
    
    const overtimeRate = entry.overtimeRate || (hourlyRate * 1.5);
    
    // Calculate total cost
    const regularCost = entry.workerCount * entry.regularHours * hourlyRate;
    const overtimeCost = entry.workerCount * entry.overtimeHours * overtimeRate;
    const entryCost = regularCost + overtimeCost;
    
    // Find or create budget item link
    let budgetItemId = entry.budgetItemId;
    if (!budgetItemId) {
      budgetItemId = await matchTradeToBudgetItem(projectId, entry.tradeName) || undefined;
      if (!budgetItemId) {
        warnings.push(`Could not match trade "${entry.tradeName}" to a budget item`);
      }
    }
    
    // Create or update labor entry
    await prisma.dailyReportLabor.upsert({
      where: {
        id: `${reportId}-${entry.tradeName}`
      },
      create: {
        id: `${reportId}-${entry.tradeName}`,
        reportId,
        tradeName: entry.tradeName,
        workerCount: entry.workerCount,
        regularHours: entry.regularHours,
        overtimeHours: entry.overtimeHours,
        hourlyRate,
        overtimeRate,
        totalCost: entryCost,
        description: entry.description,
        budgetItemId,
        isSyncedToBudget: !!budgetItemId,
        syncedAt: budgetItemId ? new Date() : null,
      },
      update: {
        workerCount: entry.workerCount,
        regularHours: entry.regularHours,
        overtimeHours: entry.overtimeHours,
        hourlyRate,
        overtimeRate,
        totalCost: entryCost,
        description: entry.description,
        budgetItemId,
        isSyncedToBudget: !!budgetItemId,
        syncedAt: budgetItemId ? new Date() : null,
      }
    });
    
    // Update budget item actual cost
    if (budgetItemId) {
      await prisma.budgetItem.update({
        where: { id: budgetItemId },
        data: {
          actualCost: { increment: entryCost },
          actualHours: { increment: entry.workerCount * (entry.regularHours + entry.overtimeHours) }
        }
      });
      budgetItemsUpdated.add(budgetItemId);
    }
    
    totalCost += entryCost;
    synced++;
  }
  
  return { synced, totalCost, budgetItems: Array.from(budgetItemsUpdated), warnings };
}

/**
 * Sync equipment entries from daily report to budget
 */
export async function syncEquipmentToBudget(
  reportId: string,
  projectId: string,
  equipmentEntries: EquipmentSyncData[]
): Promise<{ synced: number; totalCost: number; budgetItems: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const budgetItemsUpdated: Set<string> = new Set();
  let totalCost = 0;
  let synced = 0;
  
  for (const entry of equipmentEntries) {
    // Calculate equipment cost
    let entryCost = 0;
    if (entry.dailyRate) {
      entryCost = entry.dailyRate;
    } else if (entry.hourlyRate) {
      entryCost = entry.hours * entry.hourlyRate;
    }
    entryCost += (entry.fuelCost || 0) + (entry.operatorCost || 0);
    
    // Find budget item
    let budgetItemId = entry.budgetItemId;
    if (!budgetItemId) {
      budgetItemId = await matchEquipmentToBudgetItem(projectId, entry.equipmentName, entry.equipmentType) || undefined;
    }
    
    // Create equipment entry
    await prisma.dailyReportEquipment.create({
      data: {
        reportId,
        equipmentName: entry.equipmentName,
        equipmentType: entry.equipmentType,
        hours: entry.hours,
        dailyRate: entry.dailyRate || 0,
        hourlyRate: entry.hourlyRate || 0,
        fuelCost: entry.fuelCost || 0,
        operatorCost: entry.operatorCost || 0,
        totalCost: entryCost,
        status: entry.status,
        notes: entry.notes,
        budgetItemId,
        isSyncedToBudget: !!budgetItemId,
        syncedAt: budgetItemId ? new Date() : null,
      }
    });
    
    // Update budget item
    if (budgetItemId) {
      await prisma.budgetItem.update({
        where: { id: budgetItemId },
        data: {
          actualCost: { increment: entryCost }
        }
      });
      budgetItemsUpdated.add(budgetItemId);
    }
    
    totalCost += entryCost;
    synced++;
  }
  
  return { synced, totalCost, budgetItems: Array.from(budgetItemsUpdated), warnings };
}

/**
 * Sync work progress to schedule tasks
 */
export async function syncProgressToSchedule(
  reportId: string,
  projectId: string,
  progressEntries: ProgressSyncData[]
): Promise<{ synced: number; earnedValue: number; tasksUpdated: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const tasksUpdated: Set<string> = new Set();
  let totalEarnedValue = 0;
  let synced = 0;
  
  for (const entry of progressEntries) {
    let scheduleTaskId = entry.scheduleTaskId;
    let previousPercent = 0;
    let taskBudget = 0;
    
    // Try to find matching schedule task through schedule
    if (!scheduleTaskId && entry.activityName) {
      const schedule = await prisma.schedule.findFirst({
        where: { projectId },
        include: {
          ScheduleTask: {
            where: {
              OR: [
                { name: { contains: entry.activityName, mode: 'insensitive' } },
                { description: { contains: entry.activityName, mode: 'insensitive' } }
              ]
            },
            take: 1
          }
        }
      });
      const task = schedule?.ScheduleTask?.[0];
      if (task) {
        scheduleTaskId = task.id;
        previousPercent = task.percentComplete;
        taskBudget = task.budgetedCost || 0;
      }
    }
    
    // Calculate earned value
    const progressDelta = entry.percentComplete - previousPercent;
    const earnedValue = taskBudget * (progressDelta / 100);
    
    // Create progress entry
    await prisma.dailyReportProgress.create({
      data: {
        reportId,
        activityName: entry.activityName,
        location: entry.location,
        unitsCompleted: entry.unitsCompleted,
        unitOfMeasure: entry.unitOfMeasure,
        percentComplete: entry.percentComplete,
        previousPercent,
        valueEarned: earnedValue,
        scheduleTaskId,
        budgetItemId: entry.budgetItemId,
        notes: entry.notes,
        isSyncedToSchedule: !!scheduleTaskId,
        syncedAt: scheduleTaskId ? new Date() : null,
      }
    });
    
    // Update schedule task progress
    if (scheduleTaskId) {
      await prisma.scheduleTask.update({
        where: { id: scheduleTaskId },
        data: {
          percentComplete: entry.percentComplete,
          actualCost: { increment: earnedValue }
        }
      });
      tasksUpdated.add(scheduleTaskId);
    } else {
      warnings.push(`Could not match activity "${entry.activityName}" to a schedule task`);
    }
    
    totalEarnedValue += earnedValue;
    synced++;
  }
  
  return { synced, earnedValue: totalEarnedValue, tasksUpdated: Array.from(tasksUpdated), warnings };
}

/**
 * Record weather delay and document impact
 */
export async function recordWeatherDelay(
  reportId: string,
  projectId: string,
  delayHours: number,
  delayReason: string,
  weatherCondition: string
): Promise<{ recorded: boolean; impactedTasks: number }> {
  // Update the daily report with delay info
  await prisma.dailyReport.update({
    where: { id: reportId },
    data: {
      delayHours,
      delayReason,
      weatherCondition,
      delaysEncountered: `Weather delay: ${weatherCondition} - ${delayHours} hours lost`
    }
  });
  
  // Find active tasks that might be impacted through schedule
  const schedule = await prisma.schedule.findFirst({
    where: { projectId },
    include: {
      ScheduleTask: {
        where: {
          status: 'in_progress',
          percentComplete: { lt: 100 }
        }
      }
    }
  });
  const activeTasks = schedule?.ScheduleTask || [];
  
  // Create delay records for tracking
  for (const task of activeTasks) {
    await prisma.activityLog.create({
      data: {
        action: 'WEATHER_DELAY',
        resource: 'ScheduleTask',
        resourceId: task.id,
        details: {
          reportId,
          delayHours,
          delayReason,
          weatherCondition,
          taskName: task.name,
          originalEndDate: task.endDate
        }
      }
    });
  }
  
  return { recorded: true, impactedTasks: activeTasks.length };
}

/**
 * Full sync of daily report to budget and schedule
 */
export async function syncDailyReportFull(
  reportId: string
): Promise<SyncResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    // Get the daily report with all entries
    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      include: {
        laborEntries: true,
        equipmentEntries: true,
        progressEntries: true,
        project: true
      }
    });
    
    if (!report) {
      return {
        success: false,
        laborSynced: 0,
        equipmentSynced: 0,
        progressSynced: 0,
        totalCostSynced: 0,
        budgetItemsUpdated: 0,
        scheduleTasksUpdated: 0,
        warnings: [],
        errors: ['Daily report not found']
      };
    }
    
    const projectId = report.projectId;
    const budgetItemsSet = new Set<string>();
    const scheduleTasksSet = new Set<string>();
    let totalCost = 0;
    
    // Sync labor entries
    const laborResult = await syncLaborToBudget(
      reportId,
      projectId,
      report.laborEntries.map(e => ({
        tradeName: e.tradeName,
        workerCount: e.workerCount,
        regularHours: e.regularHours,
        overtimeHours: e.overtimeHours,
        hourlyRate: e.hourlyRate,
        overtimeRate: e.overtimeRate,
        description: e.description || undefined,
        budgetItemId: e.budgetItemId || undefined
      }))
    );
    warnings.push(...laborResult.warnings);
    laborResult.budgetItems.forEach(id => budgetItemsSet.add(id));
    totalCost += laborResult.totalCost;
    
    // Sync equipment entries
    const equipmentResult = await syncEquipmentToBudget(
      reportId,
      projectId,
      report.equipmentEntries.map(e => ({
        equipmentName: e.equipmentName,
        equipmentType: e.equipmentType || undefined,
        hours: e.hours,
        dailyRate: e.dailyRate,
        hourlyRate: e.hourlyRate,
        fuelCost: e.fuelCost,
        operatorCost: e.operatorCost,
        status: e.status || undefined,
        notes: e.notes || undefined,
        budgetItemId: e.budgetItemId || undefined
      }))
    );
    warnings.push(...equipmentResult.warnings);
    equipmentResult.budgetItems.forEach(id => budgetItemsSet.add(id));
    totalCost += equipmentResult.totalCost;
    
    // Sync progress entries
    const progressResult = await syncProgressToSchedule(
      reportId,
      projectId,
      report.progressEntries.map(e => ({
        activityName: e.activityName,
        location: e.location || undefined,
        unitsCompleted: e.unitsCompleted,
        unitOfMeasure: e.unitOfMeasure || undefined,
        percentComplete: e.percentComplete,
        scheduleTaskId: e.scheduleTaskId || undefined,
        budgetItemId: e.budgetItemId || undefined,
        notes: e.notes || undefined
      }))
    );
    warnings.push(...progressResult.warnings);
    progressResult.tasksUpdated.forEach(id => scheduleTasksSet.add(id));
    
    // Record weather delays if applicable
    if (report.delayHours && report.delayHours > 0 && report.weatherCondition) {
      await recordWeatherDelay(
        reportId,
        projectId,
        report.delayHours,
        report.delayReason || 'Weather',
        report.weatherCondition
      );
    }
    
    // Update project data source to indicate daily report data is active
    await prisma.projectDataSource.upsert({
      where: {
        projectId_featureType: {
          projectId,
          featureType: 'daily_reports'
        }
      },
      create: {
        projectId,
        featureType: 'daily_reports',
        sourceType: 'daily_report',
        confidence: 100
      },
      update: {
        extractedAt: new Date()
      }
    });
    
    return {
      success: true,
      laborSynced: laborResult.synced,
      equipmentSynced: equipmentResult.synced,
      progressSynced: progressResult.synced,
      totalCostSynced: totalCost,
      budgetItemsUpdated: budgetItemsSet.size,
      scheduleTasksUpdated: scheduleTasksSet.size,
      warnings,
      errors
    };
  } catch (error) {
    console.error('[DailyReportSync] Error:', error);
    return {
      success: false,
      laborSynced: 0,
      equipmentSynced: 0,
      progressSynced: 0,
      totalCostSynced: 0,
      budgetItemsUpdated: 0,
      scheduleTasksUpdated: 0,
      warnings,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

/**
 * Get daily report cost summary for a project
 */
export async function getDailyReportCostSummary(
  projectId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalLaborCost: number;
  totalEquipmentCost: number;
  totalHours: number;
  reportCount: number;
  byTrade: Record<string, { cost: number; hours: number }>;
  byDate: Array<{ date: string; labor: number; equipment: number; total: number }>;
}> {
  const dateFilter: Record<string, unknown> = {};
  if (startDate || endDate) {
    dateFilter.reportDate = {};
    if (startDate) (dateFilter.reportDate as Record<string, unknown>).gte = startDate;
    if (endDate) (dateFilter.reportDate as Record<string, unknown>).lte = endDate;
  }
  
  const reports = await prisma.dailyReport.findMany({
    where: {
      projectId,
      ...dateFilter
    },
    include: {
      laborEntries: true,
      equipmentEntries: true
    },
    orderBy: { reportDate: 'asc' }
  });
  
  const byTrade: Record<string, { cost: number; hours: number }> = {};
  const byDate: Array<{ date: string; labor: number; equipment: number; total: number }> = [];
  let totalLaborCost = 0;
  let totalEquipmentCost = 0;
  let totalHours = 0;
  
  for (const report of reports) {
    let dailyLabor = 0;
    let dailyEquipment = 0;
    
    for (const labor of report.laborEntries) {
      const cost = labor.totalCost;
      const hours = labor.workerCount * (labor.regularHours + labor.overtimeHours);
      
      totalLaborCost += cost;
      totalHours += hours;
      dailyLabor += cost;
      
      if (!byTrade[labor.tradeName]) {
        byTrade[labor.tradeName] = { cost: 0, hours: 0 };
      }
      byTrade[labor.tradeName].cost += cost;
      byTrade[labor.tradeName].hours += hours;
    }
    
    for (const equip of report.equipmentEntries) {
      totalEquipmentCost += equip.totalCost;
      dailyEquipment += equip.totalCost;
    }
    
    byDate.push({
      date: report.reportDate.toISOString().split('T')[0],
      labor: dailyLabor,
      equipment: dailyEquipment,
      total: dailyLabor + dailyEquipment
    });
  }
  
  return {
    totalLaborCost,
    totalEquipmentCost,
    totalHours,
    reportCount: reports.length,
    byTrade,
    byDate
  };
}
