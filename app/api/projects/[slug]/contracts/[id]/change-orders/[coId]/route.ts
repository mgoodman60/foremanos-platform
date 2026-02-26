/**
 * Individual Change Order API
 * GET: Get change order details
 * PATCH: Update change order (including status changes)
 * DELETE: Delete change order
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { applyChangeOrderToBudget, previewChangeOrderImpact } from '@/lib/change-order-budget-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_CONTRACTS_CHANGE_ORDERS');

export async function GET(
  request: Request,
  props: { params: Promise<{ slug: string; id: string; coId: string }> }
) {
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

    const changeOrder = await prisma.contractChangeOrder.findFirst({
      where: {
        id: params.coId,
        contractId: params.id,
        projectId: project.id,
      },
      include: {
        contract: {
          select: {
            contractNumber: true,
            title: true,
            subcontractor: {
              select: { companyName: true }
            }
          }
        },
        createdByUser: {
          select: { id: true, email: true, username: true }
        }
      }
    });

    if (!changeOrder) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
    }

    return NextResponse.json({ changeOrder });
  } catch (error) {
    logger.error('[Change Order GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch change order' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ slug: string; id: string; coId: string }> }
) {
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
      action,
      title,
      description,
      reason,
      originalAmount,
      approvedAmount,
      daysAdded,
      supportingDocs,
      rejectionReason,
    } = body;

    // Get existing change order
    const existing = await prisma.contractChangeOrder.findFirst({
      where: {
        id: params.coId,
        contractId: params.id,
        projectId: project.id,
      },
      include: {
        contract: true
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
    }

    // Handle status actions
    if (action === 'submit') {
      const changeOrder = await prisma.contractChangeOrder.update({
        where: { id: params.coId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          submittedBy: session.user.id,
        },
      });
      return NextResponse.json({ changeOrder, message: 'Change order submitted' });
    }

    if (action === 'review') {
      const changeOrder = await prisma.contractChangeOrder.update({
        where: { id: params.coId },
        data: {
          status: 'UNDER_REVIEW',
          reviewedAt: new Date(),
          reviewedBy: session.user.id,
        },
      });
      return NextResponse.json({ changeOrder, message: 'Change order under review' });
    }

    if (action === 'approve') {
      const approvedCOAmount = approvedAmount ?? existing.originalAmount;
      const useContingency = body.useContingency !== false; // default true
      const allocateToBudgetItems = body.allocateToBudgetItems;
      
      // Update change order
      const changeOrder = await prisma.contractChangeOrder.update({
        where: { id: params.coId },
        data: {
          status: 'APPROVED',
          approvedAmount: approvedCOAmount,
          approvedAt: new Date(),
          approvedBy: session.user.id,
        },
      });

      // Update contract current value and completion date
      const newCurrentValue = existing.contract.currentValue + approvedCOAmount;
      
      let newCompletionDate = existing.contract.completionDate;
      if (existing.daysAdded > 0) {
        newCompletionDate = new Date(existing.contract.completionDate);
        newCompletionDate.setDate(newCompletionDate.getDate() + existing.daysAdded);
      }

      await prisma.subcontractorContract.update({
        where: { id: params.id },
        data: {
          currentValue: newCurrentValue,
          completionDate: newCompletionDate,
        },
      });

      // Apply change order to budget system
      const budgetResult = await applyChangeOrderToBudget(
        project.id,
        params.coId,
        approvedCOAmount,
        {
          useContingency,
          allocateToBudgetItems,
          createIfMissing: true
        }
      );

      return NextResponse.json({ 
        changeOrder, 
        message: 'Change order approved',
        contractUpdated: true,
        newContractValue: newCurrentValue,
        budgetUpdates: {
          budgetItemsUpdated: budgetResult.budgetItemsUpdated,
          projectBudgetUpdated: budgetResult.projectBudgetUpdated,
          cashFlowsUpdated: budgetResult.cashFlowsUpdated,
          newBudgetItemId: budgetResult.newBudgetItemId
        }
      });
    }
    
    // Preview impact before approval
    if (action === 'preview-impact') {
      const previewAmount = body.previewAmount ?? existing.originalAmount;
      const impact = await previewChangeOrderImpact(project.id, params.coId, previewAmount);
      
      if (!impact) {
        return NextResponse.json({ error: 'Failed to generate impact preview' }, { status: 500 });
      }
      
      return NextResponse.json({ impact });
    }

    if (action === 'reject') {
      const changeOrder = await prisma.contractChangeOrder.update({
        where: { id: params.coId },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedBy: session.user.id,
          rejectionReason: rejectionReason || null,
        },
      });
      return NextResponse.json({ changeOrder, message: 'Change order rejected' });
    }

    if (action === 'void') {
      const changeOrder = await prisma.contractChangeOrder.update({
        where: { id: params.coId },
        data: { status: 'VOIDED' },
      });
      return NextResponse.json({ changeOrder, message: 'Change order voided' });
    }

    // General update (only for DRAFT status)
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft change orders can be edited' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (reason !== undefined) updateData.reason = reason;
    if (originalAmount !== undefined) updateData.originalAmount = originalAmount;
    if (daysAdded !== undefined) {
      updateData.daysAdded = daysAdded;
      // Recalculate new completion date
      if (daysAdded > 0) {
        const newDate = new Date(existing.contract.completionDate);
        newDate.setDate(newDate.getDate() + daysAdded);
        updateData.newCompletionDate = newDate;
      } else {
        updateData.newCompletionDate = null;
      }
    }
    if (supportingDocs !== undefined) updateData.supportingDocs = supportingDocs;

    const changeOrder = await prisma.contractChangeOrder.update({
      where: { id: params.coId },
      data: updateData,
    });

    return NextResponse.json({ changeOrder });
  } catch (error) {
    logger.error('[Change Order PATCH Error]', error);
    return NextResponse.json(
      { error: 'Failed to update change order' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ slug: string; id: string; coId: string }> }
) {
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

    const changeOrder = await prisma.contractChangeOrder.findFirst({
      where: {
        id: params.coId,
        contractId: params.id,
        projectId: project.id,
      },
    });

    if (!changeOrder) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
    }

    // Only allow deletion of draft change orders
    if (changeOrder.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft change orders can be deleted' },
        { status: 400 }
      );
    }

    await prisma.contractChangeOrder.delete({
      where: { id: params.coId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Change Order DELETE Error]', error);
    return NextResponse.json(
      { error: 'Failed to delete change order' },
      { status: 500 }
    );
  }
}
