/**
 * Change Orders API
 * 
 * CRUD operations for change orders with budget impact
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_CHANGE_ORDERS');

// GET - List all change orders
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const changeOrders = await prisma.changeOrder.findMany({
      where: { projectId: project.id },
      include: {
        BudgetItem: {
          select: {
            id: true,
            name: true,
            costCode: true
          }
        }
      },
      orderBy: [{ submittedDate: 'desc' }]
    });

    // Calculate summary
    const summary = {
      total: changeOrders.length,
      pending: changeOrders.filter(co => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(co.status)).length,
      approved: changeOrders.filter(co => co.status === 'APPROVED').length,
      rejected: changeOrders.filter(co => co.status === 'REJECTED').length,
      totalApprovedValue: changeOrders
        .filter(co => co.status === 'APPROVED')
        .reduce((sum, co) => sum + (co.approvedAmount || co.proposedAmount), 0),
      totalPendingValue: changeOrders
        .filter(co => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(co.status))
        .reduce((sum, co) => sum + co.proposedAmount, 0),
      netBudgetImpact: changeOrders
        .filter(co => co.status === 'APPROVED')
        .reduce((sum, co) => sum + (co.approvedAmount || co.proposedAmount), 0)
    };

    // Transform response
    const formattedOrders = changeOrders.map(co => ({
      id: co.id,
      orderNumber: co.orderNumber,
      title: co.title,
      description: co.description,
      requestedBy: co.requestedBy,
      status: co.status,
      originalAmount: co.originalAmount,
      proposedAmount: co.proposedAmount,
      approvedAmount: co.approvedAmount,
      scheduleImpactDays: co.scheduleImpactDays,
      submittedDate: co.submittedDate.toISOString(),
      reviewedDate: co.reviewedDate?.toISOString(),
      approvedDate: co.approvedDate?.toISOString(),
      approvedBy: co.approvedBy,
      notes: co.notes,
      budgetItem: co.BudgetItem
    }));

    return NextResponse.json({
      changeOrders: formattedOrders,
      summary
    });

  } catch (error) {
    logger.error('[ChangeOrders GET] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch change orders' },
      { status: 500 }
    );
  }
}

// POST - Create new change order
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      description,
      requestedBy,
      proposedAmount,
      scheduleImpactDays,
      budgetItemId,
      notes
    } = body;

    // Get next CO number
    const lastCO = await prisma.changeOrder.findFirst({
      where: { projectId: project.id },
      orderBy: { orderNumber: 'desc' }
    });
    
    const coNumber = lastCO ? parseInt(lastCO.orderNumber.replace('CO-', '')) + 1 : 1;
    const orderNumber = `CO-${coNumber.toString().padStart(4, '0')}`;

    const changeOrder = await prisma.changeOrder.create({
      data: {
        projectId: project.id,
        orderNumber,
        title,
        description,
        requestedBy,
        proposedAmount: proposedAmount || 0,
        scheduleImpactDays,
        budgetItemId,
        notes,
        status: 'DRAFT'
      }
    });

    return NextResponse.json(changeOrder, { status: 201 });

  } catch (error) {
    logger.error('[ChangeOrders POST] Error', error);
    return NextResponse.json(
      { error: 'Failed to create change order' },
      { status: 500 }
    );
  }
}
