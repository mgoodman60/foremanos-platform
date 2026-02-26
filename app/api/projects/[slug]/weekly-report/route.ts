import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startOfWeek, endOfWeek } from 'date-fns';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_WEEKLY_REPORT');

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const weeksBack = parseInt(searchParams.get('weeks') || '4');

    const reports = await prisma.weeklyCostReport.findMany({
      where: { projectId: project.id },
      orderBy: { weekStartDate: 'desc' },
      take: weeksBack
    });

    return NextResponse.json({ reports });
  } catch (error) {
    logger.error('Error fetching weekly reports', error);
    return NextResponse.json({ error: 'Failed to fetch weekly reports' }, { status: 500 });
  }
}

// Generate a new weekly report
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const budget = await prisma.projectBudget.findUnique({
      where: { projectId: project.id }
    });

    if (!budget) {
      return NextResponse.json({ error: 'Budget not configured' }, { status: 404 });
    }

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    // Check if report already exists for this week
    const existing = await prisma.weeklyCostReport.findUnique({
      where: {
        projectId_weekStartDate: {
          projectId: project.id,
          weekStartDate: weekStart
        }
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'Report already exists for this week', report: existing }, { status: 409 });
    }

    // Gather data for the report
    const changeOrders = await prisma.changeOrder.findMany({
      where: {
        projectId: project.id,
        approvedDate: { gte: weekStart, lte: weekEnd }
      }
    });

    const laborEntries = await prisma.laborEntry.findMany({
      where: {
        projectId: project.id,
        date: { gte: weekStart, lte: weekEnd }
      }
    });

    const invoices = await prisma.invoice.findMany({
      where: {
        projectId: project.id,
        paidDate: { gte: weekStart, lte: weekEnd }
      }
    });

    const contingencyUsages = await prisma.contingencyUsage.findMany({
      where: { projectId: project.id }
    });

    // Calculate metrics
    type LaborRecord = typeof laborEntries[number];
    type InvoiceRecord = typeof invoices[number];
    const laborCost = laborEntries.reduce((sum: number, e: LaborRecord) => sum + e.totalCost, 0);
    const materialsCost = invoices.reduce((sum: number, i: InvoiceRecord) => sum + i.materialsAmount, 0);
    type ContingencyRecord = typeof contingencyUsages[number];
    const contingencyUsed = contingencyUsages.reduce((sum: number, u: ContingencyRecord) => sum + u.amount, 0);

    // Get latest EVM data
    const latestEVM = await prisma.earnedValue.findFirst({
      where: { budgetId: budget.id },
      orderBy: { periodDate: 'desc' }
    });

    const cpi = latestEVM ? latestEVM.earnedValue / latestEVM.actualCost : null;
    const spi = latestEVM ? latestEVM.earnedValue / latestEVM.plannedValue : null;
    const eac = cpi ? budget.totalBudget / cpi : null;

    const report = await prisma.weeklyCostReport.create({
      data: {
        projectId: project.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        totalBudget: budget.totalBudget,
        actualCost: budget.actualCost,
        committedCost: budget.committedCost,
        cpi,
        spi,
        eac,
        contingencyUsed,
        contingencyRemaining: budget.contingency - contingencyUsed,
        changeOrdersApproved: changeOrders.length,
        changeOrdersValue: changeOrders.reduce((sum: number, co: { approvedAmount?: number | null }) => sum + (co.approvedAmount || 0), 0),
        laborCost,
        materialsCost,
        generatedBy: session.user.username
      }
    });

    return NextResponse.json(report);
  } catch (error) {
    logger.error('Error generating weekly report', error);
    return NextResponse.json({ error: 'Failed to generate weekly report' }, { status: 500 });
  }
}
