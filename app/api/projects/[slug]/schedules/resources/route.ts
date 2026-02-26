import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULES_RESOURCES');

// GET /api/projects/[slug]/schedules/resources - Get resource histogram and earned value data
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project with budget
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { slug },
          { id: slug }
        ]
      },
      select: {
        id: true,
        name: true,
        ProjectBudget: {
          select: {
            totalBudget: true
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get schedule tasks with budget and actual cost data
    const scheduleTasks = await prisma.scheduleTask.findMany({
      where: {
        Schedule: { projectId: project.id }
      },
      select: {
        id: true,
        taskId: true,
        name: true,
        startDate: true,
        endDate: true,
        duration: true,
        percentComplete: true,
        budgetedCost: true,
        actualCost: true,
        baselineStartDate: true,
        baselineEndDate: true,
        tradeType: true,
        inferredTradeType: true,
        subcontractorId: true
      },
      orderBy: { startDate: 'asc' }
    });

    // Get subcontractors for trade names
    const subcontractorIds = scheduleTasks
      .map(t => t.subcontractorId)
      .filter((id): id is string => id !== null);
    
    const subcontractors = subcontractorIds.length > 0 
      ? await prisma.subcontractor.findMany({
          where: { id: { in: subcontractorIds } },
          select: { id: true, companyName: true, tradeType: true }
        })
      : [];
    
    const subcontractorMap = new Map(subcontractors.map(s => [s.id, s]));

    // Get daily report labor entries for actual resource data
    const laborEntries = await prisma.dailyReportLabor.findMany({
      where: {
        report: { projectId: project.id }
      },
      select: {
        id: true,
        tradeName: true,
        workerCount: true,
        regularHours: true,
        overtimeHours: true,
        hourlyRate: true,
        overtimeRate: true,
        totalCost: true,
        description: true,
        report: {
          select: {
            reportDate: true
          }
        }
      },
      orderBy: {
        report: { reportDate: 'asc' }
      }
    });

    // Get equipment entries
    const equipmentEntries = await prisma.dailyReportEquipment.findMany({
      where: {
        report: { projectId: project.id }
      },
      select: {
        id: true,
        equipmentName: true,
        equipmentType: true,
        hours: true,
        dailyRate: true,
        totalCost: true,
        report: {
          select: {
            reportDate: true
          }
        }
      },
      orderBy: {
        report: { reportDate: 'asc' }
      }
    });

    // Get cost entries from budget items (actual costs)
    const budgetItems = project.ProjectBudget 
      ? await prisma.budgetItem.findMany({
          where: {
            budgetId: project.ProjectBudget.totalBudget ? undefined : undefined,
            ProjectBudget: { projectId: project.id },
            actualCost: { gt: 0 }
          },
          select: {
            id: true,
            name: true,
            tradeType: true,
            actualCost: true,
            updatedAt: true
          }
        })
      : [];

    // Transform labor entries for the histogram
    const laborData = laborEntries.map(entry => ({
      date: entry.report.reportDate,
      tradeName: entry.tradeName,
      workerCount: entry.workerCount,
      regularHours: entry.regularHours,
      overtimeHours: entry.overtimeHours,
      totalCost: entry.totalCost
    }));

    // Transform equipment entries
    const equipmentData = equipmentEntries.map(entry => ({
      date: entry.report.reportDate,
      equipmentName: entry.equipmentName,
      equipmentType: entry.equipmentType || entry.equipmentName,
      hoursUsed: entry.hours,
      dailyRate: entry.dailyRate || 0,
      totalCost: entry.totalCost || 0
    }));

    // Transform tasks for resource planning
    const taskResources = scheduleTasks.map(task => {
      // Determine trade name from various sources
      let tradeName = task.tradeType || task.inferredTradeType || 'General Labor';
      if (task.subcontractorId) {
        const sub = subcontractorMap.get(task.subcontractorId);
        if (sub?.tradeType) {
          tradeName = sub.tradeType
            .split('_')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
      }
      
      // Estimate planned workers based on task duration and budget
      const duration = task.duration || 1;
      const budgetedCost = task.budgetedCost || 0;
      // Assume average hourly rate of $45 and 8-hour days
      const estimatedManDays = budgetedCost / (45 * 8);
      const plannedWorkers = Math.max(1, Math.ceil(estimatedManDays / duration));
      
      return {
        taskId: task.taskId,
        taskName: task.name,
        startDate: task.startDate,
        endDate: task.endDate,
        tradeName,
        plannedWorkers,
        budgetedCost
      };
    });

    // Transform tasks for earned value analysis
    const evTasks = scheduleTasks.map(task => ({
      id: task.id,
      name: task.name,
      startDate: task.startDate,
      endDate: task.endDate,
      duration: task.duration,
      percentComplete: task.percentComplete,
      budgetedCost: task.budgetedCost || 0,
      actualCost: task.actualCost || 0,
      baselineStartDate: task.baselineStartDate,
      baselineEndDate: task.baselineEndDate
    }));

    // Transform cost entries
    const costData = budgetItems.map(item => ({
      date: item.updatedAt,
      category: item.tradeType || 'General',
      amount: item.actualCost || 0,
      description: item.name
    }));

    // Calculate project totals
    const totalBudgetedCost = scheduleTasks.reduce((sum, t) => sum + (t.budgetedCost || 0), 0);
    const totalActualCost = scheduleTasks.reduce((sum, t) => sum + (t.actualCost || 0), 0);
    const projectBudget = project.ProjectBudget?.totalBudget || totalBudgetedCost || 1000000;

    // Calculate date range from tasks
    const taskDates = scheduleTasks.map(t => new Date(t.startDate).getTime());
    const taskEndDates = scheduleTasks.map(t => new Date(t.endDate).getTime());
    
    const projectStartDate = taskDates.length > 0 ? new Date(Math.min(...taskDates)) : new Date();
    const projectEndDate = taskEndDates.length > 0 ? new Date(Math.max(...taskEndDates)) : new Date();

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        startDate: projectStartDate,
        endDate: projectEndDate,
        budget: projectBudget,
        totalBudgetedCost,
        totalActualCost
      },
      histogram: {
        laborEntries: laborData,
        equipmentEntries: equipmentData,
        taskResources
      },
      earnedValue: {
        tasks: evTasks,
        costEntries: costData
      },
      summary: {
        totalTasks: scheduleTasks.length,
        totalLaborDays: laborEntries.length,
        totalEquipmentDays: equipmentEntries.length,
        uniqueTrades: [...new Set([
          ...laborData.map(l => l.tradeName),
          ...taskResources.map(t => t.tradeName)
        ])].filter(Boolean)
      }
    });
  } catch (error) {
    logger.error('Error fetching resource data', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource data' },
      { status: 500 }
    );
  }
}
