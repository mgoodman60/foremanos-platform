/**
 * Change Orders API for Contracts
 * GET: List change orders
 * POST: Create change order
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

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const changeOrders = await prisma.contractChangeOrder.findMany({
      where: {
        contractId: params.id,
        projectId: project.id,
      },
      include: {
        createdByUser: {
          select: { id: true, email: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Summary stats
    const stats = {
      total: changeOrders.length,
      draft: changeOrders.filter(co => co.status === 'DRAFT').length,
      pending: changeOrders.filter(co => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(co.status)).length,
      approved: changeOrders.filter(co => co.status === 'APPROVED').length,
      rejected: changeOrders.filter(co => co.status === 'REJECTED').length,
      totalRequested: changeOrders.reduce((sum, co) => sum + co.originalAmount, 0),
      totalApproved: changeOrders
        .filter(co => co.status === 'APPROVED')
        .reduce((sum, co) => sum + (co.approvedAmount || 0), 0),
      totalDaysAdded: changeOrders
        .filter(co => co.status === 'APPROVED')
        .reduce((sum, co) => sum + co.daysAdded, 0),
    };

    return NextResponse.json({ changeOrders, stats });
  } catch (error) {
    console.error('[Change Orders GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch change orders' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string; id: string } }
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

    // Verify contract exists
    const contract = await prisma.subcontractorContract.findFirst({
      where: {
        id: params.id,
        projectId: project.id,
      },
      select: { id: true, completionDate: true }
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      description,
      reason,
      originalAmount,
      daysAdded,
      supportingDocs,
    } = body;

    if (!title || !reason || originalAmount === undefined) {
      return NextResponse.json(
        { error: 'title, reason, and originalAmount are required' },
        { status: 400 }
      );
    }

    // Generate CO number
    const count = await prisma.contractChangeOrder.count({
      where: { contractId: params.id }
    });
    const coNumber = `CO-${String(count + 1).padStart(3, '0')}`;

    // Calculate new completion date if days added
    let newCompletionDate = null;
    if (daysAdded && daysAdded > 0) {
      newCompletionDate = new Date(contract.completionDate);
      newCompletionDate.setDate(newCompletionDate.getDate() + daysAdded);
    }

    const changeOrder = await prisma.contractChangeOrder.create({
      data: {
        projectId: project.id,
        contractId: params.id,
        coNumber,
        title,
        description: description || null,
        reason: reason as any,
        originalAmount,
        daysAdded: daysAdded || 0,
        newCompletionDate,
        supportingDocs: supportingDocs || [],
        status: 'DRAFT',
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({ changeOrder }, { status: 201 });
  } catch (error) {
    console.error('[Change Orders POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create change order' },
      { status: 500 }
    );
  }
}
