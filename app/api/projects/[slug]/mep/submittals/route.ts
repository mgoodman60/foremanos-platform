/**
 * MEP Submittals API
 * GET: List all submittals
 * POST: Create new submittal
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getNextSubmittalNumber } from '@/lib/mep-tracking-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS');

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
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
    const status = searchParams.get('status');
    const systemId = searchParams.get('systemId');
    const equipmentId = searchParams.get('equipmentId');

    const submittals = await prisma.mEPSubmittal.findMany({
      where: {
        projectId: project.id,
        ...(status && { status: status as any }),
        ...(systemId && { systemId }),
        ...(equipmentId && { equipmentId }),
      },
      include: {
        system: {
          select: { systemNumber: true, name: true }
        },
        equipment: {
          select: { equipmentTag: true, name: true }
        },
        createdByUser: {
          select: { username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate stats
    const stats = {
      total: submittals.length,
      pending: submittals.filter((s: any) => s.status === 'PENDING').length,
      underReview: submittals.filter((s: any) => s.status === 'UNDER_REVIEW').length,
      approved: submittals.filter((s: any) => ['APPROVED', 'APPROVED_AS_NOTED'].includes(s.status)).length,
      reviseResubmit: submittals.filter((s: any) => s.status === 'REVISE_RESUBMIT').length,
      overdue: submittals.filter((s: any) => 
        s.dueDate && new Date(s.dueDate) < new Date() && 
        !['APPROVED', 'APPROVED_AS_NOTED', 'VOID'].includes(s.status)
      ).length,
    };

    return NextResponse.json({ submittals, stats });
  } catch (error) {
    logger.error('[MEP Submittals GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch submittals' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
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
      systemId,
      equipmentId,
      title,
      submittalType,
      specSection,
      dueDate,
      submittedBy,
      contactEmail,
      documentIds,
    } = body;

    if (!title || !submittalType) {
      return NextResponse.json(
        { error: 'Title and submittal type are required' },
        { status: 400 }
      );
    }

    const submittalNumber = await getNextSubmittalNumber(project.id);

    const submittal = await prisma.mEPSubmittal.create({
      data: {
        projectId: project.id,
        systemId: systemId || null,
        equipmentId: equipmentId || null,
        submittalNumber,
        title,
        submittalType,
        specSection,
        status: 'PENDING',
        dueDate: dueDate ? new Date(dueDate) : null,
        submittedBy,
        contactEmail,
        documentIds: documentIds || [],
        revision: 0,
        createdBy: session.user.id,
      },
      include: {
        system: { select: { name: true } },
        equipment: { select: { name: true } },
      }
    });

    return NextResponse.json({ submittal }, { status: 201 });
  } catch (error) {
    logger.error('[MEP Submittals POST Error]', error);
    return NextResponse.json(
      { error: 'Failed to create submittal' },
      { status: 500 }
    );
  }
}
