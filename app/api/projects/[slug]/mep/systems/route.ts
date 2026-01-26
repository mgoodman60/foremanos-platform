/**
 * MEP Systems API
 * GET: List all systems for a project
 * POST: Create a new system
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getNextSystemNumber } from '@/lib/mep-tracking-service';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
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

    const { searchParams } = new URL(request.url);
    const systemType = searchParams.get('type');
    const status = searchParams.get('status');

    const systems = await prisma.mEPSystem.findMany({
      where: {
        projectId: project.id,
        ...(systemType && { systemType: systemType as any }),
        ...(status && { status: status as any }),
      },
      include: {
        _count: {
          select: {
            equipment: true,
            submittals: true,
            maintenanceSchedules: true,
          }
        },
        createdByUser: {
          select: { username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ systems });
  } catch (error) {
    console.error('[MEP Systems GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch systems' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
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

    const body = await request.json();
    const {
      name,
      systemType,
      description,
      designCapacity,
      servingArea,
      mainLocation,
      installingContractor,
      contractorContact,
      plannedInstallStart,
      plannedInstallEnd,
    } = body;

    if (!name || !systemType) {
      return NextResponse.json(
        { error: 'Name and system type are required' },
        { status: 400 }
      );
    }

    const systemNumber = await getNextSystemNumber(project.id, systemType);

    const system = await prisma.mEPSystem.create({
      data: {
        projectId: project.id,
        systemNumber,
        name,
        systemType,
        description,
        designCapacity,
        servingArea,
        mainLocation,
        installingContractor,
        contractorContact,
        plannedInstallStart: plannedInstallStart ? new Date(plannedInstallStart) : null,
        plannedInstallEnd: plannedInstallEnd ? new Date(plannedInstallEnd) : null,
        createdBy: session.user.id,
      },
      include: {
        _count: {
          select: { equipment: true }
        }
      }
    });

    return NextResponse.json({ system }, { status: 201 });
  } catch (error) {
    console.error('[MEP Systems POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create system' },
      { status: 500 }
    );
  }
}
