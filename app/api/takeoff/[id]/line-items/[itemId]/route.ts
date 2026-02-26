import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { safeErrorMessage } from '@/lib/api-error';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { createLogger } from '@/lib/logger';
const logger = createLogger('TAKEOFF_LINE_ITEMS');

// PUT /api/takeoff/[id]/line-items/[itemId] - Update a line item
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; itemId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(`api:${session.user.email}`, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id, itemId } = params;
    const body = await request.json();

    // Get line item with takeoff and project info
    const lineItem = await prisma.takeoffLineItem.findUnique({
      where: { id: itemId },
      include: {
        MaterialTakeoff: {
          include: {
            Project: {
              include: {
                User_Project_ownerIdToUser: true,
                ProjectMember: {
                  include: { User: true }
                }
              }
            }
          }
        }
      }
    });

    if (!lineItem || lineItem.takeoffId !== id) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    }

    // Verify user has access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = lineItem.MaterialTakeoff.Project.ownerId === user.id;
    const isMember = lineItem.MaterialTakeoff.Project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Calculate new total cost if quantity or unit cost changed
    const quantity = body.quantity !== undefined ? parseFloat(body.quantity) : lineItem.quantity;
    const unitCost = body.unitCost !== undefined
      ? (body.unitCost ? parseFloat(body.unitCost) : null)
      : lineItem.unitCost;
    const totalCost = unitCost ? quantity * unitCost : null;

    // Update line item
    const updated = await prisma.takeoffLineItem.update({
      where: { id: itemId },
      data: {
        category: body.category || undefined,
        itemName: body.itemName || undefined,
        description: body.description !== undefined ? body.description : undefined,
        quantity: body.quantity !== undefined ? parseFloat(body.quantity) : undefined,
        unit: body.unit || undefined,
        unitCost: body.unitCost !== undefined ? (body.unitCost ? parseFloat(body.unitCost) : null) : undefined,
        totalCost,
        location: body.location !== undefined ? body.location : undefined,
        sheetNumber: body.sheetNumber !== undefined ? body.sheetNumber : undefined,
        gridLocation: body.gridLocation !== undefined ? body.gridLocation : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        verified: body.verified !== undefined ? body.verified : undefined,
        confidence: body.confidence !== undefined ? (body.confidence ? parseFloat(body.confidence) : null) : undefined,
        extractedFrom: body.extractedFrom !== undefined ? body.extractedFrom : undefined
      }
    });

    // Recalculate takeoff total cost
    const allLineItems = await prisma.takeoffLineItem.findMany({
      where: { takeoffId: id }
    });

    const newTotalCost = allLineItems.reduce((sum: number, item: any) => sum + (item.totalCost || 0), 0);

    await prisma.materialTakeoff.update({
      where: { id },
      data: { totalCost: newTotalCost }
    });

    return NextResponse.json({ lineItem: updated });
  } catch (error: unknown) {
    logger.error('Error updating line item', error);
    return NextResponse.json(
      { error: 'Failed to update line item', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/takeoff/[id]/line-items/[itemId] - Delete a line item
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; itemId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deleteRateLimitResult = await checkRateLimit(`api:${session.user.email}`, RATE_LIMITS.API);
    if (!deleteRateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id, itemId } = params;

    // Get line item with takeoff and project info
    const lineItem = await prisma.takeoffLineItem.findUnique({
      where: { id: itemId },
      include: {
        MaterialTakeoff: {
          include: {
            Project: {
              include: {
                User_Project_ownerIdToUser: true,
                ProjectMember: {
                  include: { User: true }
                }
              }
            }
          }
        }
      }
    });

    if (!lineItem || lineItem.takeoffId !== id) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    }

    // Verify user has access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = lineItem.MaterialTakeoff.Project.ownerId === user.id;
    const isMember = lineItem.MaterialTakeoff.Project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete line item
    await prisma.takeoffLineItem.delete({
      where: { id: itemId }
    });

    // Recalculate takeoff total cost
    const allLineItems = await prisma.takeoffLineItem.findMany({
      where: { takeoffId: id }
    });

    const newTotalCost = allLineItems.reduce((sum: number, item: any) => sum + (item.totalCost || 0), 0);

    await prisma.materialTakeoff.update({
      where: { id },
      data: { totalCost: newTotalCost }
    });

    return NextResponse.json({ message: 'Line item deleted successfully' });
  } catch (error: unknown) {
    logger.error('Error deleting line item', error);
    return NextResponse.json(
      { error: 'Failed to delete line item', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
