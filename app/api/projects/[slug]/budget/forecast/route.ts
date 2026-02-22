/**
 * Cost Forecast API
 * 
 * Returns EAC, ETC, VAC projections using Earned Value Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { addDays, subDays, format, differenceInDays } from 'date-fns';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_FORECAST');

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
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

    // Get budget
    const budget = await prisma.projectBudget.findFirst({
      where: { projectId: project.id },
      include: {
        BudgetItem: {
          where: { isActive: true }
        }
      }
    });

    if (!budget) {
      return NextResponse.json({
        totalBudget: 0,
        actualCost: 0,
        percentComplete: 0,
        estimateAtCompletion: 0,
        estimateToComplete: 0,
        varianceAtCompletion: 0,
        costPerformanceIndex: 1,
        schedulePerformanceIndex: 1,
        toCompletePerformanceIndex: 1,
        projectionTrend: [],
        forecastConfidence: 'low',
        riskFactors: ['No budget data available'],
        daysVariance: 0
      });
    }

    // Calculate totals
    const totalBudget = budget.BudgetItem.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0);
    const actualCost = budget.BudgetItem.reduce((sum, item) => sum + (item.actualCost || 0), 0);
    const committedCost = budget.BudgetItem.reduce((sum, item) => sum + (item.committedCost || 0), 0);

    // Get percent complete and dates from schedule
    const schedule = await prisma.schedule.findFirst({
      where: { projectId: project.id },
      include: {
        ScheduleTask: {
          select: { percentComplete: true, startDate: true, endDate: true }
        }
      }
    });
    const scheduleTasks = schedule?.ScheduleTask || [];
    const percentComplete = Math.max(
      scheduleTasks.length > 0 
        ? scheduleTasks.reduce((sum, t) => sum + t.percentComplete, 0) / scheduleTasks.length 
        : 0,
      0.01
    ); // Avoid division by zero

    // Calculate EVM metrics
    const earnedValue = totalBudget * (percentComplete / 100);
    const plannedValue = totalBudget * (percentComplete / 100); // Simplified - would use schedule baseline
    
    // CPI = EV / AC (cost efficiency)
    const costPerformanceIndex = actualCost > 0 ? earnedValue / actualCost : 1;
    
    // SPI = EV / PV (schedule efficiency)
    const schedulePerformanceIndex = plannedValue > 0 ? earnedValue / plannedValue : 1;
    
    // EAC = AC + (BAC - EV) / CPI (Estimate at Completion)
    // Using typical forecast: EAC = BAC / CPI
    const estimateAtCompletion = costPerformanceIndex > 0 
      ? totalBudget / costPerformanceIndex 
      : actualCost + (totalBudget - earnedValue);
    
    // ETC = EAC - AC (Estimate to Complete)
    const estimateToComplete = Math.max(estimateAtCompletion - actualCost, 0);
    
    // VAC = BAC - EAC (Variance at Completion)
    const varianceAtCompletion = totalBudget - estimateAtCompletion;
    
    // TCPI = (BAC - EV) / (BAC - AC) (To Complete Performance Index)
    const remainingBudget = totalBudget - actualCost;
    const remainingWork = totalBudget - earnedValue;
    const toCompletePerformanceIndex = remainingBudget > 0 ? remainingWork / remainingBudget : 1;

    // Generate projection trend (last 12 weeks + 8 weeks projection)
    const projectionTrend: Array<{
      date: string;
      actual: number;
      planned: number;
      projected: number;
    }> = [];

    const today = new Date();
    
    // Get project dates from schedule tasks
    const taskDates = scheduleTasks.map(t => ({ start: t.startDate, end: t.endDate }));
    const projectStartDate = taskDates.length > 0 
      ? taskDates.reduce((min, t) => t.start < min ? t.start : min, taskDates[0].start)
      : subDays(today, 84);
    const projectEndDate = taskDates.length > 0
      ? taskDates.reduce((max, t) => t.end > max ? t.end : max, taskDates[0].end)
      : addDays(today, 56);
    
    const totalDays = differenceInDays(projectEndDate, projectStartDate);
    const dailyBudget = totalBudget / Math.max(totalDays, 1);
    const dailyActualRate = actualCost / Math.max(differenceInDays(today, projectStartDate), 1);

    // Historical data points
    for (let i = -12; i <= 8; i++) {
      const weekDate = addDays(today, i * 7);
      const daysFromStart = Math.max(differenceInDays(weekDate, projectStartDate), 0);
      
      const planned = Math.min(dailyBudget * daysFromStart, totalBudget);
      const actual = i <= 0 ? Math.min(dailyActualRate * daysFromStart, actualCost) : actualCost;
      const projected = i <= 0 
        ? actual 
        : actualCost + (dailyActualRate * (differenceInDays(weekDate, today)));

      projectionTrend.push({
        date: format(weekDate, 'yyyy-MM-dd'),
        actual: i <= 0 ? actual : 0, // Only show actual for past dates
        planned,
        projected: i > 0 ? projected : 0 // Only show projection for future
      });
    }

    // Determine forecast confidence
    let forecastConfidence: 'high' | 'medium' | 'low' = 'medium';
    if (percentComplete > 30 && costPerformanceIndex > 0.8 && costPerformanceIndex < 1.2) {
      forecastConfidence = 'high';
    } else if (percentComplete < 10 || Math.abs(costPerformanceIndex - 1) > 0.3) {
      forecastConfidence = 'low';
    }

    // Risk factors
    const riskFactors: string[] = [];
    if (costPerformanceIndex < 0.9) {
      riskFactors.push(`Cost overrun trend - CPI of ${costPerformanceIndex.toFixed(2)} indicates ${((1 - costPerformanceIndex) * 100).toFixed(0)}% cost inefficiency`);
    }
    if (schedulePerformanceIndex < 0.9) {
      riskFactors.push(`Schedule delay - SPI of ${schedulePerformanceIndex.toFixed(2)} indicates project is behind schedule`);
    }
    if (toCompletePerformanceIndex > 1.2) {
      riskFactors.push(`Recovery challenging - TCPI of ${toCompletePerformanceIndex.toFixed(2)} required to finish on budget`);
    }
    if (varianceAtCompletion < 0) {
      riskFactors.push(`Projected ${Math.abs(varianceAtCompletion).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} over budget at completion`);
    }
    if (committedCost > remainingBudget) {
      riskFactors.push(`Committed costs ($${committedCost.toLocaleString()}) exceed remaining budget`);
    }

    // Schedule variance
    let daysVariance = 0;
    let finalProjectedEndDate = projectEndDate;
    if (taskDates.length > 0 && schedulePerformanceIndex < 1) {
      const totalProjectDays = differenceInDays(projectEndDate, projectStartDate);
      const projectedDays = totalProjectDays / schedulePerformanceIndex;
      daysVariance = Math.round(projectedDays - totalProjectDays);
      finalProjectedEndDate = addDays(projectStartDate, projectedDays);
    }

    return NextResponse.json({
      totalBudget,
      actualCost,
      percentComplete,
      estimateAtCompletion,
      estimateToComplete,
      varianceAtCompletion,
      costPerformanceIndex,
      schedulePerformanceIndex,
      toCompletePerformanceIndex,
      projectionTrend,
      forecastConfidence,
      riskFactors,
      originalEndDate: taskDates.length > 0 ? projectEndDate.toISOString() : undefined,
      projectedEndDate: finalProjectedEndDate?.toISOString(),
      daysVariance
    });

  } catch (error) {
    logger.error('[CostForecast API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost forecast' },
      { status: 500 }
    );
  }
}
