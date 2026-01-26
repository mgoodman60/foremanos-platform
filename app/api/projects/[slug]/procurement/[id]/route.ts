import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { updateProcurementStatus } from '@/lib/cash-flow-service';

// GET /api/projects/[slug]/procurement/[id]
export async function GET(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const procurement = await prisma.procurement.findUnique({
      where: { id: params.id },
      include: {
        vendor: true,
        budgetItem: true,
        createdByUser: { select: { username: true } }
      }
    });

    if (!procurement) {
      return NextResponse.json({ error: 'Procurement item not found' }, { status: 404 });
    }

    return NextResponse.json(procurement);
  } catch (error) {
    console.error('[API] Get procurement error:', error);
    return NextResponse.json({ error: 'Failed to fetch procurement item' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/procurement/[id]
export async function PATCH(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      status,
      orderDate,
      expectedDelivery,
      actualDelivery,
      quotedCost,
      actualCost,
      purchaseOrder,
      trackingNumber,
      vendorId,
      vendorName,
      specifications,
      notes
    } = body;

    // If status update with additional data
    if (status) {
      const procurement = await updateProcurementStatus(params.id, status, {
        orderDate: orderDate ? new Date(orderDate) : undefined,
        expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : undefined,
        actualDelivery: actualDelivery ? new Date(actualDelivery) : undefined,
        quotedCost,
        actualCost,
        purchaseOrder,
        trackingNumber,
        vendorId
      });
      return NextResponse.json(procurement);
    }

    // General update
    const procurement = await prisma.procurement.update({
      where: { id: params.id },
      data: {
        ...(vendorName !== undefined && { vendorName }),
        ...(specifications !== undefined && { specifications }),
        ...(notes !== undefined && { notes }),
        ...(expectedDelivery && { expectedDelivery: new Date(expectedDelivery) }),
        ...(quotedCost !== undefined && { quotedCost }),
        ...(purchaseOrder !== undefined && { purchaseOrder }),
        ...(trackingNumber !== undefined && { trackingNumber })
      }
    });

    return NextResponse.json(procurement);
  } catch (error) {
    console.error('[API] Update procurement error:', error);
    return NextResponse.json({ error: 'Failed to update procurement item' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/procurement/[id]
export async function DELETE(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.procurement.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Delete procurement error:', error);
    return NextResponse.json({ error: 'Failed to delete procurement item' }, { status: 500 });
  }
}
