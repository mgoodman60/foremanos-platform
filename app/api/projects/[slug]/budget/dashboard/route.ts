/**
 * Budget Dashboard API
 * Returns comprehensive budget performance data including EVM metrics,
 * cost breakdowns, and daily cost trends
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = subDays(new Date(), days);
    const endDate = new Date();

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch all data in parallel to minimize database round trips
    const [budget, schedule, snapshots, laborByDate, materialsByDate, invoicesByDate] = await Promise.all([
      prisma.projectBudget.findUnique({
        where: { projectId: project.id },
        include: {
          BudgetItem: {
            where: { isActive: true },
          },
        },
      }),
      prisma.schedule.findFirst({
        where: { projectId: project.id },
        include: {
          ScheduleTask: true,
        },
      }),
      prisma.budgetSnapshot.findMany({
        where: {
          projectId: project.id,
          snapshotDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { snapshotDate: 'asc' },
      }),
      prisma.laborEntry.groupBy({
        by: ['date'],
        where: {
          projectId: project.id,
          status: 'APPROVED',
          date: { gte: startDate, lte: endDate },
        },
        _sum: { totalCost: true },
      }),
      prisma.procurement.groupBy({
        by: ['actualDelivery'],
        where: {
          projectId: project.id,
          status: 'RECEIVED',
          actualDelivery: { gte: startDate, lte: endDate },
        },
        _sum: { actualCost: true },
      }),
      prisma.invoice.groupBy({
        by: ['invoiceDate'],
        where: {
          projectId: project.id,
          status: 'APPROVED',
          invoiceDate: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),
    ]);

    if (!budget) {
      return NextResponse.json({ error: 'Budget not configured' }, { status: 404 });
    }

    // Calculate EVM metrics
    const totalBudget = budget.totalBudget;
    const contingency = budget.contingency || 0;

    // Get total actual costs from budget items
    const actualCost = budget.BudgetItem.reduce((sum, item) => sum + item.actualCost, 0);
    const committedCost = budget.BudgetItem.reduce((sum, item) => sum + (item.contractAmount || item.budgetedAmount), 0);

    // Get schedule tasks for percent complete
    const tasks = schedule?.ScheduleTask || [];

    const totalTaskWeight = tasks.reduce((sum, t) => sum + 1, 0);
    const completedWeight = tasks.reduce((sum, t) => sum + ((t.percentComplete || 0) / 100), 0);
    const percentComplete = totalTaskWeight > 0 ? (completedWeight / totalTaskWeight) * 100 : 0;

    // Calculate Planned Value (PV) from baseline schedule
    // PV = What work SHOULD be done by today according to baseline schedule
    const today = new Date();
    const projectStart = schedule?.startDate ? new Date(schedule.startDate) : null;
    const projectEnd = schedule?.endDate ? new Date(schedule.endDate) : null;

    let plannedPercentComplete = 0;
    if (projectStart && projectEnd && today >= projectStart) {
      const totalDuration = projectEnd.getTime() - projectStart.getTime();
      const elapsedDuration = Math.min(today.getTime() - projectStart.getTime(), totalDuration);
      plannedPercentComplete = totalDuration > 0 ? (elapsedDuration / totalDuration) * 100 : 0;
    }

    // EVM Calculations
    // PV = Work that should be done by now (time-based from baseline)
    // EV = Work actually completed (actual progress)
    const plannedValue = totalBudget * (plannedPercentComplete / 100);
    const earnedValue = totalBudget * (percentComplete / 100);
    const costVariance = earnedValue - actualCost;
    const scheduleVariance = earnedValue - plannedValue;
    const costPerformanceIndex = actualCost > 0 ? earnedValue / actualCost : 1;
    const schedulePerformanceIndex = plannedValue > 0 ? earnedValue / plannedValue : 1;
    const estimateAtCompletion = costPerformanceIndex > 0 ? totalBudget / costPerformanceIndex : totalBudget;
    const estimateToComplete = estimateAtCompletion - actualCost;
    const varianceAtCompletion = totalBudget - estimateAtCompletion;
    const percentSpent = totalBudget > 0 ? (actualCost / totalBudget) * 100 : 0;

    // Get cost breakdown by trade/category
    const costBreakdown = budget.BudgetItem.reduce((acc, item) => {
      const category = item.phaseName || (item.tradeType as string) || 'Other';
      if (!acc[category]) {
        acc[category] = { budgeted: 0, actual: 0 };
      }
      acc[category].budgeted += item.budgetedAmount;
      acc[category].actual += item.actualCost;
      return acc;
    }, {} as Record<string, { budgeted: number; actual: number }>);

    const costBreakdownArray = Object.entries(costBreakdown).map(([category, data]: [string, { budgeted: number; actual: number }]) => ({
      category,
      budgeted: data.budgeted,
      actual: data.actual,
      variance: data.budgeted - data.actual,
      percentUsed: data.budgeted > 0 ? (data.actual / data.budgeted) * 100 : 0,
    })).sort((a, b) => b.budgeted - a.budgeted);

    // Build daily cost array
    const dailyCostsMap = new Map<string, {
      labor: number;
      material: number;
      equipment: number;
      subcontractor: number;
    }>();

    // Initialize all dates with zeros
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = format(d, 'yyyy-MM-dd');
      dailyCostsMap.set(dateKey, { labor: 0, material: 0, equipment: 0, subcontractor: 0 });
    }

    // Fill in labor costs
    laborByDate.forEach((entry) => {
      const dateKey = format(entry.date, 'yyyy-MM-dd');
      const existing = dailyCostsMap.get(dateKey);
      if (existing) {
        existing.labor = entry._sum.totalCost || 0;
      }
    });

    // Fill in material costs
    materialsByDate.forEach((entry) => {
      if (entry.actualDelivery) {
        const dateKey = format(entry.actualDelivery, 'yyyy-MM-dd');
        const existing = dailyCostsMap.get(dateKey);
        if (existing) {
          existing.material = entry._sum.actualCost || 0;
        }
      }
    });

    // Fill in subcontractor costs from invoices
    invoicesByDate.forEach((entry) => {
      const dateKey = format(entry.invoiceDate, 'yyyy-MM-dd');
      const existing = dailyCostsMap.get(dateKey);
      if (existing) {
        existing.subcontractor = entry._sum.amount || 0;
      }
    });

    // Convert map to array with cumulative totals
    let cumulative = 0;
    const dailyCosts = Array.from(dailyCostsMap.entries()).map(([date, costs]) => {
      const total = costs.labor + costs.material + costs.equipment + costs.subcontractor;
      cumulative += total;
      return {
        date,
        labor: costs.labor,
        material: costs.material,
        equipment: costs.equipment,
        subcontractor: costs.subcontractor,
        total,
        cumulative,
      };
    });

    return NextResponse.json({
      evm: {
        plannedValue,
        earnedValue,
        actualCost,
        costVariance,
        scheduleVariance,
        costPerformanceIndex,
        schedulePerformanceIndex,
        estimateAtCompletion,
        estimateToComplete,
        varianceAtCompletion,
        percentComplete,
        percentSpent,
      },
      costBreakdown: costBreakdownArray,
      dailyCosts,
      budget: {
        total: totalBudget + contingency,
        contingency,
        actualCost,
        committedCost,
      },
    });
  } catch (error) {
    console.error('[BudgetDashboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
