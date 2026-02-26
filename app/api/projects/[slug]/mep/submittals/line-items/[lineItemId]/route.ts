import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { triggerAutoReverify } from '@/lib/tolerance-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS_LINE_ITEMS');

/**
 * PATCH: Update a line item's quantities
 */
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ slug: string; lineItemId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, lineItemId } = params;
    const body = await req.json();

    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify line item exists and belongs to this project
    const lineItem = await prisma.submittalLineItem.findFirst({
      where: {
        id: lineItemId,
        submittal: { projectId: project.id }
      },
      include: {
        submittal: { select: { id: true } }
      }
    });

    if (!lineItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    }

    // Extract allowed fields
    const { submittedQty, requiredQty, notes, complianceStatus } = body;

    // Build update data
    const updateData: any = {};
    if (submittedQty !== undefined) {
      updateData.submittedQty = parseFloat(submittedQty);
    }
    if (requiredQty !== undefined) {
      updateData.requiredQty = parseFloat(requiredQty);
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (complianceStatus !== undefined) {
      updateData.complianceStatus = complianceStatus;
    }

    // Update the line item
    const updated = await prisma.submittalLineItem.update({
      where: { id: lineItemId },
      data: updateData
    });

    // Trigger auto-reverify if enabled
    const quantityChanged = submittedQty !== undefined || requiredQty !== undefined;
    if (quantityChanged) {
      try {
        await triggerAutoReverify(project.id, lineItem.submittal.id, 'submittal_change');
      } catch (error) {
        logger.info('[LineItem PATCH] Auto-reverify skipped', { error });
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'LINE_ITEM_UPDATED',
        resource: 'SubmittalLineItem',
        resourceId: lineItemId,
        userId: (session.user as any).id,
        details: {
          projectId: project.id,
          changes: updateData,
          submittalId: lineItem.submittal.id
        }
      }
    });

    return NextResponse.json({
      message: 'Line item updated',
      lineItem: updated
    });
  } catch (error) {
    logger.error('[LineItem PATCH] Error', error);
    return NextResponse.json({ error: 'Failed to update line item' }, { status: 500 });
  }
}

/**
 * DELETE: Remove a line item
 */
export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ slug: string; lineItemId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, lineItemId } = params;

    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify line item exists and belongs to this project
    const lineItem = await prisma.submittalLineItem.findFirst({
      where: {
        id: lineItemId,
        submittal: { projectId: project.id }
      },
      include: {
        submittal: { select: { id: true } }
      }
    });

    if (!lineItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    }

    // Delete the line item
    await prisma.submittalLineItem.delete({
      where: { id: lineItemId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'LINE_ITEM_DELETED',
        resource: 'SubmittalLineItem',
        resourceId: lineItemId,
        userId: (session.user as any).id,
        details: {
          projectId: project.id,
          productName: lineItem.productName,
          submittalId: lineItem.submittal.id
        }
      }
    });

    return NextResponse.json({ message: 'Line item deleted' });
  } catch (error) {
    logger.error('[LineItem DELETE] Error', error);
    return NextResponse.json({ error: 'Failed to delete line item' }, { status: 500 });
  }
}
