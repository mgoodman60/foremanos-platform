/**
 * Submittal Line Items API
 * GET: List all line items for a submittal
 * POST: Add new line item
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS_LINE_ITEMS');

export async function GET(
  request: Request,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lineItems = await prisma.submittalLineItem.findMany({
      where: { submittalId: params.id },
      include: {
        hardwareSet: {
          select: {
            setNumber: true,
            setName: true,
            doorCount: true,
            components: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate stats
    const stats = {
      total: lineItems.length,
      sufficient: lineItems.filter((li: any) => li.complianceStatus === 'SUFFICIENT').length,
      insufficient: lineItems.filter((li: any) => li.complianceStatus === 'INSUFFICIENT').length,
      excess: lineItems.filter((li: any) => li.complianceStatus === 'EXCESS').length,
      unverified: lineItems.filter((li: any) => li.complianceStatus === 'UNVERIFIED' || li.complianceStatus === 'NO_REQUIREMENT').length,
    };

    return NextResponse.json({ lineItems, stats });
  } catch (error) {
    logger.error('[Submittal Line Items GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch line items' },
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

    // Verify submittal exists
    const submittal = await prisma.mEPSubmittal.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true }
    });

    if (!submittal) {
      return NextResponse.json({ error: 'Submittal not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      productName,
      manufacturer,
      modelNumber,
      partNumber,
      submittedQty,
      unit,
      unitPrice,
      csiDivision,
      csiTitle,
      specSection,
      tradeCategory,
      hardwareSetId,
      notes,
    } = body;

    if (!productName || submittedQty === undefined || !unit) {
      return NextResponse.json(
        { error: 'Product name, quantity, and unit are required' },
        { status: 400 }
      );
    }

    const lineItem = await prisma.submittalLineItem.create({
      data: {
        submittalId: params.id,
        productName,
        manufacturer,
        modelNumber,
        partNumber,
        submittedQty: parseFloat(submittedQty),
        unit,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        csiDivision,
        csiTitle,
        specSection,
        tradeCategory,
        hardwareSetId,
        notes,
        complianceStatus: 'UNVERIFIED',
      },
      include: {
        hardwareSet: {
          select: {
            setNumber: true,
            setName: true,
            doorCount: true
          }
        }
      }
    });

    return NextResponse.json({ lineItem }, { status: 201 });
  } catch (error) {
    logger.error('[Submittal Line Items POST Error]', error);
    return NextResponse.json(
      { error: 'Failed to create line item' },
      { status: 500 }
    );
  }
}
