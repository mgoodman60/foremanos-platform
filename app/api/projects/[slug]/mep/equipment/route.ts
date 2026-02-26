/**
 * MEP Equipment API
 * GET: List all equipment for a project
 * POST: Create new equipment
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getNextEquipmentTag, createDefaultMaintenanceSchedules } from '@/lib/mep-tracking-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_EQUIPMENT');

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
    const equipmentType = searchParams.get('type');
    const status = searchParams.get('status');
    const fromBIM = searchParams.get('fromBIM');

    const equipment = await prisma.mEPEquipment.findMany({
      where: {
        projectId: project.id,
        ...(systemId && { systemId }),
        ...(equipmentType && { equipmentType: equipmentType as any }),
        ...(status && { status: status as any }),
        ...(fromBIM === 'true' && { extractedFromBIM: true }),
      },
      include: {
        system: {
          select: { systemNumber: true, name: true, systemType: true }
        },
        _count: {
          select: {
            submittals: true,
            maintenanceSchedules: true,
          }
        },
      },
      orderBy: { equipmentTag: 'asc' }
    });

    return NextResponse.json({ equipment });
  } catch (error) {
    logger.error('[MEP Equipment GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
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
      equipmentType,
      manufacturer,
      model,
      serialNumber,
      capacity,
      specifications,
      level,
      room,
      gridLocation,
      estimatedCost,
      submittalDue,
      deliveryDate,
      installationDate,
      notes,
      createMaintenanceSchedules = true,
    } = body;

    if (!name || !equipmentType) {
      return NextResponse.json(
        { error: 'Name and equipment type are required' },
        { status: 400 }
      );
    }

    const equipmentTag = await getNextEquipmentTag(project.id, equipmentType);

    const equipment = await prisma.mEPEquipment.create({
      data: {
        projectId: project.id,
        systemId: systemId || null,
        equipmentTag,
        name,
        equipmentType,
        manufacturer,
        model,
        serialNumber,
        capacity,
        specifications: specifications || {},
        level,
        room,
        gridLocation,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        submittalDue: submittalDue ? new Date(submittalDue) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        installationDate: installationDate ? new Date(installationDate) : null,
        notes,
        status: 'SPECIFIED',
        createdBy: session.user.id,
      },
      include: {
        system: {
          select: { systemNumber: true, name: true }
        }
      }
    });

    // Optionally create default maintenance schedules
    let schedulesCreated = 0;
    if (createMaintenanceSchedules) {
      schedulesCreated = await createDefaultMaintenanceSchedules(
        project.id,
        equipment.id,
        equipmentType,
        session.user.id
      );
    }

    return NextResponse.json({ equipment, schedulesCreated }, { status: 201 });
  } catch (error) {
    logger.error('[MEP Equipment POST Error]', error);
    return NextResponse.json(
      { error: 'Failed to create equipment' },
      { status: 500 }
    );
  }
}
