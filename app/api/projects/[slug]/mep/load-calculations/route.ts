/**
 * MEP Load Calculations API
 * GET: List all load calculations
 * POST: Create new load calculation
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_LOAD_CALCULATIONS');

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
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

    const { searchParams } = new URL(request.url);
    const systemId = searchParams.get('systemId');
    const calcType = searchParams.get('calcType');
    const status = searchParams.get('status');

    const calculations = await prisma.mEPLoadCalculation.findMany({
      where: {
        projectId: project.id,
        ...(systemId && { systemId }),
        ...(calcType && { calcType: calcType as any }),
        ...(status && { status: status as any }),
      },
      include: {
        system: {
          select: { systemNumber: true, name: true, systemType: true }
        },
        createdByUser: {
          select: { username: true }
        }
      },
      orderBy: [{ calcType: 'asc' }, { calcNumber: 'asc' }]
    });

    // Group by type for summary
    const byType = calculations.reduce((acc, calc) => {
      acc[calc.calcType] = (acc[calc.calcType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({ 
      calculations,
      summary: {
        total: calculations.length,
        byType,
        approved: calculations.filter(c => c.status === 'APPROVED').length,
        pending: calculations.filter(c => c.status === 'FOR_REVIEW').length,
        draft: calculations.filter(c => c.status === 'DRAFT').length,
      }
    });
  } catch (error) {
    logger.error('[MEP Load Calculations GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch load calculations' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
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

    const body = await request.json();
    const {
      systemId,
      name,
      calcType,
      connectedLoad,
      demandFactor,
      diversityFactor,
      safetyFactor,
      breakdown,
      assumptions,
      unit,
    } = body;

    // Generate calc number based on type
    const typePrefix: Record<string, string> = {
      ELECTRICAL_DEMAND: 'CALC-E',
      ELECTRICAL_PANEL_SCHEDULE: 'CALC-EP',
      HVAC_HEATING_LOAD: 'CALC-H',
      HVAC_COOLING_LOAD: 'CALC-C',
      PLUMBING_FIXTURE_UNITS: 'CALC-PF',
      PLUMBING_WATER_DEMAND: 'CALC-PW',
      FIRE_WATER_DEMAND: 'CALC-FW',
    };
    
    const prefix = typePrefix[calcType] || 'CALC';
    const count = await prisma.mEPLoadCalculation.count({
      where: { projectId: project.id, calcType }
    });
    const calcNumber = `${prefix}-${String(count + 1).padStart(3, '0')}`;

    // Calculate design load
    let designLoad = connectedLoad || 0;
    if (demandFactor) designLoad *= demandFactor;
    if (diversityFactor) designLoad *= diversityFactor;
    if (safetyFactor) designLoad *= safetyFactor;

    // Auto-detect unit based on calc type if not provided
    const defaultUnits: Record<string, string> = {
      ELECTRICAL_DEMAND: 'kW',
      ELECTRICAL_PANEL_SCHEDULE: 'A',
      HVAC_HEATING_LOAD: 'BTU/hr',
      HVAC_COOLING_LOAD: 'tons',
      PLUMBING_FIXTURE_UNITS: 'FU',
      PLUMBING_WATER_DEMAND: 'GPM',
      FIRE_WATER_DEMAND: 'GPM',
    };

    const calculation = await prisma.mEPLoadCalculation.create({
      data: {
        projectId: project.id,
        systemId: systemId || null,
        calcNumber,
        name,
        calcType,
        connectedLoad: connectedLoad || null,
        demandFactor: demandFactor || null,
        diversityFactor: diversityFactor || null,
        safetyFactor: safetyFactor || 1.15,
        designLoad: designLoad || null,
        unit: unit || defaultUnits[calcType] || null,
        breakdown: breakdown || null,
        assumptions: assumptions || null,
        status: 'DRAFT',
        createdBy: session.user.id,
        preparedBy: (session.user as any).username || session.user.email,
      },
      include: {
        system: { select: { systemNumber: true, name: true } },
        createdByUser: { select: { username: true } },
      }
    });

    return NextResponse.json({ calculation }, { status: 201 });
  } catch (error) {
    logger.error('[MEP Load Calculations POST Error]', error);
    return NextResponse.json(
      { error: 'Failed to create load calculation' },
      { status: 500 }
    );
  }
}
