/**
 * Single Change Order API
 * 
 * Update, delete operations for individual change orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Get single change order
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const changeOrder = await prisma.changeOrder.findUnique({
      where: { id: params.id },
      include: {
        BudgetItem: true,
        Project: {
          select: { slug: true }
        }
      }
    });

    if (!changeOrder || changeOrder.Project.slug !== params.slug) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
    }

    return NextResponse.json(changeOrder);

  } catch (error) {
    console.error('[ChangeOrder GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch change order' },
      { status: 500 }
    );
  }
}

// PATCH - Update change order
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      status,
      approvedAmount,
      approvedDate,
      rejectedDate,
      reviewedDate,
      notes,
      title,
      description,
      proposedAmount,
      scheduleImpactDays,
      budgetItemId
    } = body;

    // Get current change order
    const currentCO = await prisma.changeOrder.findUnique({
      where: { id: params.id },
      include: {
        Project: { select: { id: true, slug: true } },
        BudgetItem: true
      }
    });

    if (!currentCO || currentCO.Project.slug !== params.slug) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (status !== undefined) updateData.status = status;
    if (approvedAmount !== undefined) updateData.approvedAmount = approvedAmount;
    if (approvedDate !== undefined) updateData.approvedDate = new Date(approvedDate);
    if (rejectedDate !== undefined) updateData.rejectedDate = new Date(rejectedDate);
    if (reviewedDate !== undefined) updateData.reviewedDate = new Date(reviewedDate);
    if (notes !== undefined) updateData.notes = notes;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (proposedAmount !== undefined) updateData.proposedAmount = proposedAmount;
    if (scheduleImpactDays !== undefined) updateData.scheduleImpactDays = scheduleImpactDays;
    if (budgetItemId !== undefined) updateData.budgetItemId = budgetItemId;

    // If approving, update budget item
    if (status === 'APPROVED') {
      updateData.approvedBy = session.user.id;
      updateData.approvedDate = new Date();
      
      // Update linked budget item's revised budget
      if (currentCO.budgetItemId) {
        const amountToAdd = approvedAmount || currentCO.proposedAmount;
        await prisma.budgetItem.update({
          where: { id: currentCO.budgetItemId },
          data: {
            revisedBudget: {
              increment: amountToAdd
            }
          }
        });
      }
    }

    const updatedCO = await prisma.changeOrder.update({
      where: { id: params.id },
      data: updateData
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: `CHANGE_ORDER_${status || 'UPDATED'}`,
        resource: 'ChangeOrder',
        resourceId: params.id,
        details: {
          orderNumber: currentCO.orderNumber,
          previousStatus: currentCO.status,
          newStatus: status || currentCO.status,
          approvedAmount
        }
      }
    });

    return NextResponse.json(updatedCO);

  } catch (error) {
    console.error('[ChangeOrder PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update change order' },
      { status: 500 }
    );
  }
}

// DELETE - Delete change order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const changeOrder = await prisma.changeOrder.findUnique({
      where: { id: params.id },
      include: {
        Project: { select: { slug: true } }
      }
    });

    if (!changeOrder || changeOrder.Project.slug !== params.slug) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
    }

    // Only allow deletion of draft change orders
    if (changeOrder.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft change orders can be deleted' },
        { status: 400 }
      );
    }

    await prisma.changeOrder.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[ChangeOrder DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete change order' },
      { status: 500 }
    );
  }
}
