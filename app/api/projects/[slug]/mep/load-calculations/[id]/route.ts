/**
 * MEP Load Calculation Detail API
 * GET: Get single calculation
 * PATCH: Update calculation
 * DELETE: Delete calculation
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const calculation = await prisma.mEPLoadCalculation.findUnique({
      where: { id: params.id },
      include: {
        system: { select: { systemNumber: true, name: true, systemType: true } },
        createdByUser: { select: { username: true } },
      }
    });

    if (!calculation) {
      return NextResponse.json({ error: 'Calculation not found' }, { status: 404 });
    }

    return NextResponse.json({ calculation });
  } catch (error) {
    console.error('[MEP Load Calculation GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch load calculation' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      connectedLoad,
      demandFactor,
      diversityFactor,
      safetyFactor,
      breakdown,
      assumptions,
      unit,
      status,
      reviewedBy,
    } = body;

    // Get current calculation
    const current = await prisma.mEPLoadCalculation.findUnique({
      where: { id: params.id }
    });

    if (!current) {
      return NextResponse.json({ error: 'Calculation not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (connectedLoad !== undefined) updateData.connectedLoad = connectedLoad;
    if (demandFactor !== undefined) updateData.demandFactor = demandFactor;
    if (diversityFactor !== undefined) updateData.diversityFactor = diversityFactor;
    if (safetyFactor !== undefined) updateData.safetyFactor = safetyFactor;
    if (breakdown !== undefined) updateData.breakdown = breakdown;
    if (assumptions !== undefined) updateData.assumptions = assumptions;
    if (unit !== undefined) updateData.unit = unit;
    if (status !== undefined) updateData.status = status;
    if (reviewedBy !== undefined) updateData.reviewedBy = reviewedBy;

    // Recalculate design load if factors changed
    const newConnectedLoad = connectedLoad ?? current.connectedLoad ?? 0;
    const newDemandFactor = demandFactor ?? current.demandFactor ?? 1;
    const newDiversityFactor = diversityFactor ?? current.diversityFactor ?? 1;
    const newSafetyFactor = safetyFactor ?? current.safetyFactor ?? 1.15;

    updateData.designLoad = newConnectedLoad * newDemandFactor * newDiversityFactor * newSafetyFactor;

    // Handle approval
    if (status === 'APPROVED') {
      updateData.approvedDate = new Date();
    }

    const calculation = await prisma.mEPLoadCalculation.update({
      where: { id: params.id },
      data: updateData,
      include: {
        system: { select: { systemNumber: true, name: true } },
        createdByUser: { select: { username: true } },
      }
    });

    return NextResponse.json({ calculation });
  } catch (error) {
    console.error('[MEP Load Calculation PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update load calculation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.mEPLoadCalculation.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MEP Load Calculation DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Failed to delete load calculation' },
      { status: 500 }
    );
  }
}
