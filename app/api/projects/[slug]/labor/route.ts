import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = { projectId: project.id };
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const laborEntries = await prisma.laborEntry.findMany({
      where,
      include: {
        BudgetItem: {
          select: { name: true, costCode: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    // Group by trade for summary
    type LaborRecord = typeof laborEntries[number];
    type TradeBreakdown = Record<string, { hours: number; cost: number; entries: number }>;
    const byTrade = laborEntries.reduce((acc: TradeBreakdown, entry: LaborRecord) => {
      const trade = entry.tradeType || 'unassigned';
      if (!acc[trade]) {
        acc[trade] = { hours: 0, cost: 0, entries: 0 };
      }
      acc[trade].hours += entry.hoursWorked + entry.overtimeHours;
      acc[trade].cost += entry.totalCost;
      acc[trade].entries += 1;
      return acc;
    }, {} as TradeBreakdown);

    const summary = {
      totalEntries: laborEntries.length,
      totalHours: laborEntries.reduce((sum: number, e: LaborRecord) => sum + e.hoursWorked + e.overtimeHours, 0),
      totalCost: laborEntries.reduce((sum: number, e: LaborRecord) => sum + e.totalCost, 0),
      avgHourlyRate: laborEntries.length > 0
        ? laborEntries.reduce((sum: number, e: LaborRecord) => sum + e.hourlyRate, 0) / laborEntries.length
        : 0,
      byTrade
    };

    return NextResponse.json({ laborEntries, summary });
  } catch (error) {
    console.error('[API] Error fetching labor entries:', error);
    return NextResponse.json({ error: 'Failed to fetch labor entries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
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

    const body = await req.json();
    const {
      workerName, tradeType, date, hoursWorked, hourlyRate,
      overtimeHours, overtimeRate, budgetItemId, description
    } = body;

    const hours = parseFloat(hoursWorked);
    const rate = parseFloat(hourlyRate);
    const otHours = overtimeHours ? parseFloat(overtimeHours) : 0;
    const otRate = overtimeRate ? parseFloat(overtimeRate) : rate * 1.5;

    const totalCost = (hours * rate) + (otHours * otRate);

    const laborEntry = await prisma.laborEntry.create({
      data: {
        projectId: project.id,
        workerName,
        tradeType: tradeType || null,
        date: new Date(date),
        hoursWorked: hours,
        hourlyRate: rate,
        overtimeHours: otHours,
        overtimeRate: otRate,
        totalCost,
        budgetItemId: budgetItemId || null,
        description,
        status: 'PENDING'
      },
      include: {
        BudgetItem: {
          select: { name: true, costCode: true }
        }
      }
    });

    return NextResponse.json(laborEntry);
  } catch (error) {
    console.error('[API] Error creating labor entry:', error);
    return NextResponse.json({ error: 'Failed to create labor entry' }, { status: 500 });
  }
}
