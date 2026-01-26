import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { startOfDay, subDays, format, differenceInDays } from 'date-fns';

/**
 * Calculate Earned Value Management (EVM) metrics
 * Uses a hybrid approach: task-level budgets when available, 
 * otherwise distributes overall budget proportionally across schedule
 */
async function calculateEVM(projectId: string, date: Date) {
  // Get budget with items
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: {
      BudgetItem: true,
    },
  });

  if (!budget) {
    throw new Error('Project budget not found');
  }

  // Get all schedule tasks
  const schedules = await prisma.schedule.findMany({
    where: {
      projectId,
      isActive: true,
    },
    include: {
      ScheduleTask: {
        orderBy: { startDate: 'asc' }
      },
    },
  });

  if (schedules.length === 0) {
    throw new Error('No active schedule found');
  }

  const tasks = schedules[0].ScheduleTask;
  const totalBudget = budget.totalBudget || 0;
  
  // Get actual costs from budget items
  const budgetItemTotals = await prisma.budgetItem.aggregate({
    where: { budgetId: budget.id },
    _sum: { actualCost: true, committedCost: true, revisedBudget: true }
  });
  
  const budgetItemActualCost = budgetItemTotals._sum.actualCost || 0;
  
  // Check if tasks have budgeted costs
  const tasksHaveBudgets = tasks.some(t => t.budgetedCost && t.budgetedCost > 0);
  
  let plannedValue = 0;
  let earnedValue = 0;
  let actualCost = budgetItemActualCost; // Start with actual costs from budget items
  let totalPlannedPercent = 0;
  let totalEarnedPercent = 0;

  if (tasksHaveBudgets) {
    // Original logic - use task-level budgets
    for (const task of tasks) {
      const taskBudget = task.budgetedCost || 0;
      
      if (task.endDate <= date) {
        plannedValue += taskBudget;
        totalPlannedPercent += 100;
      } else if (task.startDate <= date && task.endDate > date) {
        const duration = task.duration || 1;
        const daysElapsed = Math.floor((date.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24));
        const plannedPercent = Math.min((daysElapsed / duration) * 100, 100);
        plannedValue += (taskBudget * plannedPercent) / 100;
        totalPlannedPercent += plannedPercent;
      }

      earnedValue += (taskBudget * task.percentComplete) / 100;
      totalEarnedPercent += task.percentComplete;
      actualCost += task.actualCost || 0;
    }
  } else if (tasks.length > 0) {
    // Distribute budget proportionally across schedule based on duration
    // Find project date range
    const projectStart = tasks.reduce((min, t) => t.startDate < min ? t.startDate : min, tasks[0].startDate);
    const projectEnd = tasks.reduce((max, t) => t.endDate > max ? t.endDate : max, tasks[0].endDate);
    const totalProjectDays = Math.max(differenceInDays(projectEnd, projectStart), 1);
    
    // Calculate total task-days (weighted by duration)
    const totalTaskDays = tasks.reduce((sum, t) => sum + (t.duration || 1), 0);
    
    for (const task of tasks) {
      // Distribute budget proportionally by task duration
      const taskWeight = (task.duration || 1) / totalTaskDays;
      const taskBudget = totalBudget * taskWeight;
      
      // Calculate planned value based on schedule
      if (task.endDate <= date) {
        plannedValue += taskBudget;
        totalPlannedPercent += 100;
      } else if (task.startDate <= date && task.endDate > date) {
        const duration = task.duration || 1;
        const daysElapsed = Math.max(0, differenceInDays(date, task.startDate));
        const plannedPercent = Math.min((daysElapsed / duration) * 100, 100);
        plannedValue += (taskBudget * plannedPercent) / 100;
        totalPlannedPercent += plannedPercent;
      }

      // Calculate earned value based on task completion
      earnedValue += (taskBudget * (task.percentComplete || 0)) / 100;
      totalEarnedPercent += task.percentComplete || 0;
    }
  }

  // Calculate variance and indices
  const costVariance = earnedValue - actualCost; // CV = EV - AC
  const scheduleVariance = earnedValue - plannedValue; // SV = EV - PV
  const costPerformanceIndex = actualCost > 0 ? earnedValue / actualCost : (earnedValue > 0 ? 1 : 1); // CPI = EV / AC
  const schedulePerformanceIndex = plannedValue > 0 ? earnedValue / plannedValue : (earnedValue > 0 ? 1 : 1); // SPI = EV / PV

  // Calculate forecast metrics
  const budgetAtCompletion = totalBudget;
  const estimateAtCompletion = costPerformanceIndex > 0 && costPerformanceIndex !== 1
    ? budgetAtCompletion / costPerformanceIndex
    : budgetAtCompletion;
  const estimateToComplete = Math.max(0, estimateAtCompletion - actualCost);
  const varianceAtCompletion = budgetAtCompletion - estimateAtCompletion;

  // Calculate progress percentages
  const percentComplete = tasks.length > 0
    ? totalEarnedPercent / tasks.length
    : 0;
  const percentSpent = totalBudget > 0
    ? (actualCost / totalBudget) * 100
    : 0;

  return {
    plannedValue: Math.round(plannedValue * 100) / 100,
    earnedValue: Math.round(earnedValue * 100) / 100,
    actualCost: Math.round(actualCost * 100) / 100,
    costVariance: Math.round(costVariance * 100) / 100,
    scheduleVariance: Math.round(scheduleVariance * 100) / 100,
    costPerformanceIndex: Math.round(costPerformanceIndex * 100) / 100,
    schedulePerformanceIndex: Math.round(schedulePerformanceIndex * 100) / 100,
    estimateAtCompletion: Math.round(estimateAtCompletion * 100) / 100,
    estimateToComplete: Math.round(estimateToComplete * 100) / 100,
    varianceAtCompletion: Math.round(varianceAtCompletion * 100) / 100,
    percentComplete: Math.round(percentComplete * 100) / 100,
    percentSpent: Math.round(percentSpent * 100) / 100,
    dataSource: tasksHaveBudgets ? 'task-level' : 'distributed',
  };
}

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
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectBudget: {
          include: {
            EarnedValue: {
              where: {
                periodDate: {
                  gte: subDays(new Date(), days),
                },
              },
              orderBy: {
                periodDate: 'asc',
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.ProjectBudget) {
      return NextResponse.json(
        { error: 'Project budget not configured' },
        { status: 404 }
      );
    }

    // Calculate current EVM metrics
    const currentMetrics = await calculateEVM(project.id, new Date());

    // Get historical data
    const historicalData = project.ProjectBudget.EarnedValue;

    return NextResponse.json({
      current: currentMetrics,
      history: historicalData,
      budget: {
        total: project.ProjectBudget.totalBudget,
        contingency: project.ProjectBudget.contingency,
        actualCost: project.ProjectBudget.actualCost,
        committedCost: project.ProjectBudget.committedCost,
      },
    });
  } catch (error: any) {
    console.error('Error calculating EVM:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate EVM metrics' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectBudget: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.ProjectBudget) {
      return NextResponse.json({ error: 'Project budget not configured' }, { status: 404 });
    }

    // Check permissions
    const user = session.user as any;
    const canEdit = project.ownerId === user.id || user.role === 'admin';

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Only project owners and admins can record EVM data' },
        { status: 403 }
      );
    }

    // Calculate or use provided metrics
    const date = body.periodDate ? new Date(body.periodDate) : new Date();
    const metrics = body.autoCalculate
      ? await calculateEVM(project.id, date)
      : body.metrics;

    if (!metrics) {
      return NextResponse.json(
        { error: 'EVM metrics are required' },
        { status: 400 }
      );
    }

    // Create EVM record
    const evmRecord = await prisma.earnedValue.create({
      data: {
        budgetId: project.ProjectBudget.id,
        periodDate: startOfDay(date),
        periodType: body.periodType || 'daily',
        plannedValue: metrics.plannedValue,
        earnedValue: metrics.earnedValue,
        actualCost: metrics.actualCost,
        costVariance: metrics.costVariance,
        scheduleVariance: metrics.scheduleVariance,
        costPerformanceIndex: metrics.costPerformanceIndex,
        schedulePerformanceIndex: metrics.schedulePerformanceIndex,
        estimateAtCompletion: metrics.estimateAtCompletion,
        estimateToComplete: metrics.estimateToComplete,
        varianceAtCompletion: metrics.varianceAtCompletion,
        percentComplete: metrics.percentComplete,
        percentSpent: metrics.percentSpent,
        calculatedBy: user.id,
        notes: body.notes,
      },
    });

    return NextResponse.json({ evmRecord }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating EVM record:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'EVM record already exists for this date and period type' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create EVM record' },
      { status: 500 }
    );
  }
}
