/**
 * Budget Importer
 * 
 * Imports budget data from Walker Company Job Cost format
 * and creates budget items in the database.
 */

import { prisma } from './db';
import { logger } from '@/lib/logger';

export interface WalkerBudgetLine {
  phaseCode: number;
  phaseName: string;
  categoryNumber: number;
  name: string;
  contractAmount: number;
  billedToDate: number;
  actualCost: number;
  budgetedAmount: number;
  budgetedHours: number;
  actualHours: number;
}

// Standard Walker Company budget structure for One Senior Care - Morehead
export const ONE_SENIOR_CARE_BUDGET: WalkerBudgetLine[] = [
  // Phase 100 - General Requirements ($257,900)
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 1, name: 'Mobilization / Demobilization', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 2500, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 2, name: 'Site Superintendent', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 77400, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 5, name: 'Temporary Fence', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 5000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 6, name: 'Dumpsters', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 6000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 7, name: 'Temporary Toilet', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 2400, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 8, name: 'Temporary Stone', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 1500, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 9, name: 'Connex / Office Trailer', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 4800, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 11, name: 'Construction Tools, Supplies', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 4000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 12, name: 'Weekly Cleaning', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 4800, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 13, name: 'Final Cleaning', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 4000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 14, name: 'Dewatering', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 2500, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 16, name: 'Builders Risk', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 8000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 18, name: 'Warranty / Punchlist', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 3500, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 19, name: 'Permits / Fees', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 2500, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 20, name: 'Surveying / Staking', contractAmount: 0, billedToDate: 0, actualCost: 4125, budgetedAmount: 10000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 21, name: 'Special Inspections', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 35000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 22, name: 'Geotech', contractAmount: 0, billedToDate: 0, actualCost: 11000, budgetedAmount: 25000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 23, name: 'EComm Fee', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 3500, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 24, name: 'Plans', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 1000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 25, name: 'Skid Steer', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 4500, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 26, name: 'Contingency', contractAmount: 0, billedToDate: 0, actualCost: 2568, budgetedAmount: 50000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 200 - Sitework ($220,000)
  { phaseCode: 200, phaseName: 'SITEWORK', categoryNumber: 1, name: 'Sitework / Asphalt Pavement', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 185000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 200, phaseName: 'SITEWORK', categoryNumber: 2, name: 'Curb and Gutter', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 25000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 200, phaseName: 'SITEWORK', categoryNumber: 3, name: 'Landscaping', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 10000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 300 - Concrete ($185,000)
  { phaseCode: 300, phaseName: 'CONCRETE', categoryNumber: 1, name: 'Concrete (Placeholder)', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 185000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 500 - Metals ($10,000)
  { phaseCode: 500, phaseName: 'METALS', categoryNumber: 1, name: 'Handrailing', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 10000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 600 - Woods & Plastics ($60,000)
  { phaseCode: 600, phaseName: 'WOODS & PLASTICS', categoryNumber: 1, name: 'Wood Blocking', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 10000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 600, phaseName: 'WOODS & PLASTICS', categoryNumber: 2, name: 'Casework', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 50000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 800 - Doors & Windows ($215,800)
  { phaseCode: 800, phaseName: 'DOORS & WINDOWS', categoryNumber: 1, name: 'Doors, Frames, & Hardware', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 200800, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 800, phaseName: 'DOORS & WINDOWS', categoryNumber: 2, name: 'Storefronts, Windows, & Glazing', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 15000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 900 - Interior Finishes ($307,000)
  { phaseCode: 900, phaseName: 'INTERIOR FINISHES', categoryNumber: 1, name: 'Interior Finishes', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 307000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 1000 - Specialties ($45,000)
  { phaseCode: 1000, phaseName: 'SPECIALTIES', categoryNumber: 1, name: 'Division 10 Items', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 45000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 1300 - Special Construction ($362,740)
  { phaseCode: 1300, phaseName: 'SPECIAL CONSTRUCTION', categoryNumber: 1, name: 'PEMB Building - Material', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 242740, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 1300, phaseName: 'SPECIAL CONSTRUCTION', categoryNumber: 2, name: 'PEMB Building - Erector', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 120000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 2300 - HVAC / Plumbing ($673,000)
  { phaseCode: 2300, phaseName: 'HVAC / PLUMBING', categoryNumber: 1, name: 'HVAC / Plumbing', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 628000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 2300, phaseName: 'HVAC / PLUMBING', categoryNumber: 2, name: 'Tap Fees', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 10000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 2300, phaseName: 'HVAC / PLUMBING', categoryNumber: 3, name: 'Site Utilities', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 35000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 2600 - Electrical ($300,000)
  { phaseCode: 2600, phaseName: 'ELECTRICAL', categoryNumber: 1, name: 'Electrical', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 300000, budgetedHours: 0, actualHours: 0 },
  
  // Phase 3000 - Design ($135,000)
  { phaseCode: 3000, phaseName: 'DESIGN', categoryNumber: 1, name: 'Architectural / Structural', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 75000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 3000, phaseName: 'DESIGN', categoryNumber: 2, name: 'Civil', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 30000, budgetedHours: 0, actualHours: 0 },
  { phaseCode: 3000, phaseName: 'DESIGN', categoryNumber: 3, name: 'Electrical', contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 30000, budgetedHours: 0, actualHours: 0 },
];

/**
 * Import the One Senior Care budget into a project
 */
export async function importOneSeniorCareBudget(projectSlug: string): Promise<{
  success: boolean;
  itemsCreated: number;
  totalBudget: number;
  error?: string;
}> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      return { success: false, itemsCreated: 0, totalBudget: 0, error: 'Project not found' };
    }

    // Check if budget exists
    let budget = await prisma.projectBudget.findFirst({
      where: { projectId: project.id },
      include: { BudgetItem: true },
    });

    // If budget has items, clear them for fresh import
    if (budget && budget.BudgetItem.length > 0) {
      await prisma.budgetItem.deleteMany({
        where: { budgetId: budget.id },
      });
      logger.info('BUDGET_IMPORTER', 'Cleared existing items', { count: budget.BudgetItem.length });
    }

    // Create budget if not exists
    if (!budget) {
      budget = await prisma.projectBudget.create({
        data: {
          projectId: project.id,
          totalBudget: 2985000, // Contract amount
          contingency: 50000,
          baselineDate: new Date(),
        },
        include: { BudgetItem: true },
      });
    }

    // Import all budget items
    let itemsCreated = 0;
    for (const item of ONE_SENIOR_CARE_BUDGET) {
      await prisma.budgetItem.create({
        data: {
          budgetId: budget.id,
          name: item.name,
          phaseCode: item.phaseCode,
          phaseName: item.phaseName,
          categoryNumber: item.categoryNumber,
          budgetedAmount: item.budgetedAmount,
          contractAmount: item.contractAmount,
          actualCost: item.actualCost,
          billedToDate: item.billedToDate,
          budgetedHours: item.budgetedHours,
          actualHours: item.actualHours,
        },
      });
      itemsCreated++;
    }

    // Calculate total
    const totalBudget = ONE_SENIOR_CARE_BUDGET.reduce((sum, i) => sum + i.budgetedAmount, 0);

    // Update budget total
    await prisma.projectBudget.update({
      where: { id: budget.id },
      data: {
        totalBudget,
      },
    });

    logger.info('BUDGET_IMPORTER', 'Budget import complete', { itemsCreated, totalBudget });

    return {
      success: true,
      itemsCreated,
      totalBudget,
    };

  } catch (error) {
    logger.error('BUDGET_IMPORTER', 'Import error', error instanceof Error ? error : undefined);
    return {
      success: false,
      itemsCreated: 0,
      totalBudget: 0,
      error: `${error}`,
    };
  }
}

/**
 * Get budget summary by phase
 */
export async function getBudgetSummaryByPhase(projectSlug: string): Promise<{
  phases: Array<{
    phaseCode: number;
    phaseName: string;
    budgeted: number;
    actual: number;
    variance: number;
    percentComplete: number;
  }>;
  totalBudgeted: number;
  totalActual: number;
}> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
  });

  if (!project) {
    return { phases: [], totalBudgeted: 0, totalActual: 0 };
  }

  const budget = await prisma.projectBudget.findFirst({
    where: { projectId: project.id },
    include: { BudgetItem: true },
  });

  if (!budget) {
    return { phases: [], totalBudgeted: 0, totalActual: 0 };
  }

  // Group by phase
  const phaseMap = new Map<number, {
    phaseName: string;
    budgeted: number;
    actual: number;
  }>();

  for (const item of budget.BudgetItem) {
    if (!item.phaseCode) continue;
    
    const existing = phaseMap.get(item.phaseCode) || {
      phaseName: item.phaseName || '',
      budgeted: 0,
      actual: 0,
    };

    existing.budgeted += item.budgetedAmount;
    existing.actual += item.actualCost;
    phaseMap.set(item.phaseCode, existing);
  }

  const phases = Array.from(phaseMap.entries())
    .map(([phaseCode, data]) => ({
      phaseCode,
      phaseName: data.phaseName,
      budgeted: data.budgeted,
      actual: data.actual,
      variance: data.budgeted - data.actual,
      percentComplete: data.budgeted > 0 ? Math.round((data.actual / data.budgeted) * 100) : 0,
    }))
    .sort((a, b) => a.phaseCode - b.phaseCode);

  return {
    phases,
    totalBudgeted: phases.reduce((sum, p) => sum + p.budgeted, 0),
    totalActual: phases.reduce((sum, p) => sum + p.actual, 0),
  };
}
