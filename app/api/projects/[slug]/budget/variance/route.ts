/**
 * Budget Variance API
 * 
 * Returns real-time budget variance data with dynamic updates
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_VARIANCE');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get budget and items
    const budget = await prisma.projectBudget.findFirst({
      where: { projectId: project.id },
      include: {
        BudgetItem: {
          where: { isActive: true },
          orderBy: [{ phaseCode: 'asc' }, { categoryNumber: 'asc' }]
        }
      }
    });

    if (!budget) {
      return NextResponse.json({
        totalBudget: 0,
        actualCost: 0,
        committedCost: 0,
        remainingBudget: 0,
        variance: 0,
        variancePercent: 0,
        percentComplete: 0,
        percentSpent: 0,
        items: [],
        byPhase: [],
        lastUpdated: new Date().toISOString(),
        dataSource: 'derived'
      });
    }

    // Determine data source priority
    const dataSource = await prisma.projectDataSource.findFirst({
      where: {
        projectId: project.id,
        featureType: { in: ['PAY_APPLICATION', 'DAILY_REPORTS', 'BUDGET'] }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Calculate totals
    let totalBudget = 0;
    let actualCost = 0;
    let committedCost = 0;

    const phaseMap = new Map<number, {
      phaseCode: number;
      phaseName: string;
      budgeted: number;
      actual: number;
      itemCount: number;
    }>();

    const itemVariances: Array<{
      id: string;
      name: string;
      budgeted: number;
      actual: number;
      variance: number;
      variancePercent: number;
      status: 'on_track' | 'warning' | 'over_budget' | 'under_budget';
    }> = [];

    for (const item of budget.BudgetItem) {
      const budgeted = item.budgetedAmount || 0;
      const actual = item.actualCost || 0;
      const committed = item.committedCost || 0;

      totalBudget += budgeted;
      actualCost += actual;
      committedCost += committed;

      // Phase aggregation
      const phaseCode = item.phaseCode || 0;
      const phaseName = item.phaseName || 'General';
      
      if (!phaseMap.has(phaseCode)) {
        phaseMap.set(phaseCode, {
          phaseCode,
          phaseName,
          budgeted: 0,
          actual: 0,
          itemCount: 0
        });
      }
      
      const phase = phaseMap.get(phaseCode)!;
      phase.budgeted += budgeted;
      phase.actual += actual;
      phase.itemCount++;

      // Item variance
      const variance = budgeted - actual;
      const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0;
      
      let status: 'on_track' | 'warning' | 'over_budget' | 'under_budget' = 'on_track';
      if (variancePercent > 10) status = 'under_budget';
      else if (variancePercent < -10) status = 'over_budget';
      else if (variancePercent < 0) status = 'warning';

      itemVariances.push({
        id: item.id,
        name: item.name,
        budgeted,
        actual,
        variance,
        variancePercent,
        status
      });
    }

    // Calculate overall variance
    const variance = totalBudget - actualCost;
    const variancePercent = totalBudget > 0 ? (variance / totalBudget) * 100 : 0;
    const remainingBudget = totalBudget - actualCost - committedCost;
    const percentSpent = totalBudget > 0 ? (actualCost / totalBudget) * 100 : 0;

    // Get percent complete from schedule if available
    const schedule = await prisma.schedule.findFirst({
      where: { projectId: project.id },
      include: {
        ScheduleTask: {
          select: { percentComplete: true }
        }
      }
    });
    const tasks = schedule?.ScheduleTask || [];
    const percentComplete = tasks.length > 0 
      ? tasks.reduce((sum, t) => sum + t.percentComplete, 0) / tasks.length 
      : 0;

    // Convert phase map to array with variance calculations
    const byPhase = Array.from(phaseMap.values()).map(phase => ({
      ...phase,
      variance: phase.budgeted - phase.actual,
      variancePercent: phase.budgeted > 0 ? ((phase.budgeted - phase.actual) / phase.budgeted) * 100 : 0
    })).sort((a, b) => a.phaseCode - b.phaseCode);

    // Sort items by variance (worst first)
    itemVariances.sort((a, b) => a.variancePercent - b.variancePercent);

    return NextResponse.json({
      totalBudget,
      actualCost,
      committedCost,
      remainingBudget,
      variance,
      variancePercent,
      percentComplete,
      percentSpent,
      items: itemVariances,
      byPhase,
      lastUpdated: new Date().toISOString(),
      dataSource: dataSource?.sourceType?.toLowerCase() || 'derived'
    });

  } catch (error) {
    logger.error('[BudgetVariance API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget variance' },
      { status: 500 }
    );
  }
}
