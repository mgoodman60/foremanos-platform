import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { safeErrorMessage } from '@/lib/api-error';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { createLogger } from '@/lib/logger';
const logger = createLogger('TAKEOFF_LINE_ITEMS');

// POST /api/takeoff/[id]/line-items - Add a new line item to a takeoff
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(`api:${session.user.email}`, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = params;
    const body = await request.json();
    const {
      category,
      itemName,
      description,
      quantity,
      unit,
      unitCost,
      location,
      sheetNumber,
      gridLocation,
      notes,
      confidence,
      extractedFrom
    } = body;

    // Accept either itemName or description as the primary name field
    const finalItemName = itemName || description;
    
    if (!category || !finalItemName || !quantity || !unit) {
      return NextResponse.json(
        { error: 'Category, itemName (or description), quantity, and unit are required' },
        { status: 400 }
      );
    }

    // Get takeoff with project info
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id },
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
    });

    if (!takeoff) {
      return NextResponse.json({ error: 'Takeoff not found' }, { status: 404 });
    }

    // Verify user has access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = takeoff.Project.ownerId === user.id;
    const isMember = takeoff.Project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Calculate total cost if unit cost is provided
    const totalCost = unitCost ? parseFloat(quantity) * parseFloat(unitCost) : null;

    // Create line item
    const lineItem = await prisma.takeoffLineItem.create({
      data: {
        takeoffId: id,
        category,
        itemName: finalItemName,
        description: description || finalItemName,
        quantity: parseFloat(quantity),
        unit,
        unitCost: unitCost ? parseFloat(unitCost) : null,
        totalCost,
        location,
        sheetNumber,
        gridLocation,
        notes,
        confidence: confidence !== undefined ? parseFloat(confidence) : 1.0,
        verified: body.verified !== undefined ? body.verified : true, // Manual entries are verified by default
        verificationStatus: body.verified !== false ? 'auto_approved' : 'needs_review',
        extractedFrom: extractedFrom || 'Manual Entry'
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

    return NextResponse.json({ item: lineItem }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error creating line item', error);
    return NextResponse.json(
      { error: 'Failed to create line item', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
