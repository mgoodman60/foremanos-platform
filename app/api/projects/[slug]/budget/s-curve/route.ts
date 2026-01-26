import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { startOfWeek, addWeeks, format, isBefore, isAfter } from 'date-fns';

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

    const budget = await prisma.projectBudget.findUnique({
      where: { projectId: project.id }
    });

    if (!budget) {
      return NextResponse.json({ error: 'Budget not configured' }, { status: 404 });
    }

    // Get historical snapshots
    const snapshots = await prisma.budgetSnapshot.findMany({
      where: { projectId: project.id },
      orderBy: { snapshotDate: 'asc' }
    });

    // If no snapshots, generate projected curve
    if (snapshots.length === 0) {
      // Generate a simple S-curve projection
      const startDate = budget.baselineDate;
      const totalBudget = budget.totalBudget;
      const projectDuration = 52; // weeks (assuming 1 year project)
      
      const projectedCurve = [];
      for (let week = 0; week <= projectDuration; week++) {
        const weekDate = addWeeks(startDate, week);
        // S-curve formula: slow start, ramp up, slow finish
        const progress = week / projectDuration;
        const sCurveProgress = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
        
        projectedCurve.push({
          date: format(weekDate, 'yyyy-MM-dd'),
          week,
          plannedValue: totalBudget * sCurveProgress,
          earnedValue: null,
          actualCost: null,
          percentComplete: sCurveProgress * 100
        });
      }

      return NextResponse.json({
        hasHistoricalData: false,
        totalBudget,
        curve: projectedCurve,
        currentWeek: Math.floor((Date.now() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
      });
    }

    // Format snapshots for chart
    type SnapshotRecord = typeof snapshots[number];
    const curve = snapshots.map((s: SnapshotRecord, index: number) => ({
      date: format(s.snapshotDate, 'yyyy-MM-dd'),
      week: index,
      plannedValue: s.plannedValue,
      earnedValue: s.earnedValue,
      actualCost: s.actualCost,
      cpi: s.cpi,
      spi: s.spi,
      percentComplete: s.percentComplete
    }));

    return NextResponse.json({
      hasHistoricalData: true,
      totalBudget: budget.totalBudget,
      curve,
      latestSnapshot: snapshots[snapshots.length - 1]
    });
  } catch (error) {
    console.error('[API] Error fetching S-curve data:', error);
    return NextResponse.json({ error: 'Failed to fetch S-curve data' }, { status: 500 });
  }
}

// POST to create a new snapshot
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
    const { plannedValue, earnedValue, actualCost, percentComplete } = body;

    const pv = parseFloat(plannedValue);
    const ev = parseFloat(earnedValue);
    const ac = parseFloat(actualCost);

    const snapshot = await prisma.budgetSnapshot.create({
      data: {
        projectId: project.id,
        snapshotDate: new Date(),
        plannedValue: pv,
        earnedValue: ev,
        actualCost: ac,
        cpi: ac > 0 ? ev / ac : null,
        spi: pv > 0 ? ev / pv : null,
        percentComplete: parseFloat(percentComplete)
      }
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('[API] Error creating snapshot:', error);
    return NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 });
  }
}
