/**
 * Individual MEP Equipment API
 * GET: Fetch single equipment
 * PATCH: Update equipment
 * DELETE: Delete equipment
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_EQUIPMENT');

export async function GET(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const equipment = await prisma.mEPEquipment.findUnique({
      where: { id: params.id },
      include: {
        system: true,
        submittals: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        maintenanceSchedules: {
          where: { isActive: true },
          include: {
            logs: {
              orderBy: { completedDate: 'desc' },
              take: 3
            }
          }
        },
        createdByUser: {
          select: { username: true }
        }
      }
    });

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    return NextResponse.json({ equipment });
  } catch (error) {
    logger.error('[MEP Equipment GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      systemId,
      name,
      manufacturer,
      model,
      serialNumber,
      capacity,
      specifications,
      level,
      room,
      gridLocation,
      status,
      estimatedCost,
      actualCost,
      submittalDue,
      submittalApproved,
      deliveryDate,
      installationDate,
      startupDate,
      warrantyExpires,
      warrantyNotes,
      installedBy,
      notes,
    } = body;

    const equipment = await prisma.mEPEquipment.update({
      where: { id: params.id },
      data: {
        ...(systemId !== undefined && { systemId }),
        ...(name && { name }),
        ...(manufacturer !== undefined && { manufacturer }),
        ...(model !== undefined && { model }),
        ...(serialNumber !== undefined && { serialNumber }),
        ...(capacity !== undefined && { capacity }),
        ...(specifications !== undefined && { specifications }),
        ...(level !== undefined && { level }),
        ...(room !== undefined && { room }),
        ...(gridLocation !== undefined && { gridLocation }),
        ...(status && { status }),
        ...(estimatedCost !== undefined && { estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null }),
        ...(actualCost !== undefined && { actualCost: actualCost ? parseFloat(actualCost) : null }),
        ...(submittalDue !== undefined && { submittalDue: submittalDue ? new Date(submittalDue) : null }),
        ...(submittalApproved !== undefined && { submittalApproved: submittalApproved ? new Date(submittalApproved) : null }),
        ...(deliveryDate !== undefined && { deliveryDate: deliveryDate ? new Date(deliveryDate) : null }),
        ...(installationDate !== undefined && { installationDate: installationDate ? new Date(installationDate) : null }),
        ...(startupDate !== undefined && { startupDate: startupDate ? new Date(startupDate) : null }),
        ...(warrantyExpires !== undefined && { warrantyExpires: warrantyExpires ? new Date(warrantyExpires) : null }),
        ...(warrantyNotes !== undefined && { warrantyNotes }),
        ...(installedBy !== undefined && { installedBy }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        system: { select: { systemNumber: true, name: true } }
      }
    });

    return NextResponse.json({ equipment });
  } catch (error) {
    logger.error('[MEP Equipment PATCH Error]', error);
    return NextResponse.json(
      { error: 'Failed to update equipment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.mEPEquipment.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[MEP Equipment DELETE Error]', error);
    return NextResponse.json(
      { error: 'Failed to delete equipment' },
      { status: 500 }
    );
  }
}
