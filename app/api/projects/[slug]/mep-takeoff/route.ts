/**
 * MEP Takeoff API
 * POST /api/projects/[slug]/mep-takeoff - Manually trigger MEP extraction
 * GET /api/projects/[slug]/mep-takeoff - Get MEP takeoff status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { extractMEPTakeoffs } from '@/lib/mep-takeoff-generator';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_TAKEOFF');

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    logger.info('[MEP Takeoff API] Starting extraction for project', { slug });

    const result = await extractMEPTakeoffs(slug);

    return NextResponse.json({
      success: result.success,
      electrical: {
        itemCount: result.electrical.length,
        items: result.electrical,
        total: result.electrical.reduce((sum, i) => sum + i.totalCost, 0),
      },
      plumbing: {
        itemCount: result.plumbing.length,
        items: result.plumbing,
        total: result.plumbing.reduce((sum, i) => sum + i.totalCost, 0),
      },
      hvac: {
        itemCount: result.hvac.length,
        items: result.hvac,
        total: result.hvac.reduce((sum, i) => sum + i.totalCost, 0),
      },
      totalCost: result.totalCost,
      itemsCreated: result.itemsCreated,
      errors: result.errors,
    });

  } catch (error) {
    logger.error('[MEP Takeoff API] Error', error);
    return NextResponse.json(
      { error: `MEP extraction failed: ${error}` },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get MEP takeoff items
    const mepTakeoff = await prisma.materialTakeoff.findFirst({
      where: {
        projectId: project.id,
        name: 'MEP Auto-Extracted Takeoff',
      },
      include: {
        TakeoffLineItem: true,
      },
    });

    if (!mepTakeoff) {
      return NextResponse.json({
        exists: false,
        message: 'No MEP takeoff found. Run POST to extract.',
        electrical: { itemCount: 0, items: [], total: 0 },
        plumbing: { itemCount: 0, items: [], total: 0 },
        hvac: { itemCount: 0, items: [], total: 0 },
        totalCost: 0,
      });
    }

    // Group by category
    const electrical = mepTakeoff.TakeoffLineItem.filter(i => i.category === 'Electrical');
    const plumbing = mepTakeoff.TakeoffLineItem.filter(i => i.category === 'Plumbing');
    const hvac = mepTakeoff.TakeoffLineItem.filter(i => i.category === 'HVAC');

    return NextResponse.json({
      exists: true,
      takeoffId: mepTakeoff.id,
      electrical: {
        itemCount: electrical.length,
        items: electrical.map(i => ({
          id: i.id,
          name: i.itemName,
          quantity: i.quantity,
          unit: i.unit,
          unitCost: i.unitCost,
          totalCost: i.totalCost,
          confidence: i.confidence,
        })),
        total: electrical.reduce((sum, i) => sum + (i.totalCost || 0), 0),
      },
      plumbing: {
        itemCount: plumbing.length,
        items: plumbing.map(i => ({
          id: i.id,
          name: i.itemName,
          quantity: i.quantity,
          unit: i.unit,
          unitCost: i.unitCost,
          totalCost: i.totalCost,
          confidence: i.confidence,
        })),
        total: plumbing.reduce((sum, i) => sum + (i.totalCost || 0), 0),
      },
      hvac: {
        itemCount: hvac.length,
        items: hvac.map(i => ({
          id: i.id,
          name: i.itemName,
          quantity: i.quantity,
          unit: i.unit,
          unitCost: i.unitCost,
          totalCost: i.totalCost,
          confidence: i.confidence,
        })),
        total: hvac.reduce((sum, i) => sum + (i.totalCost || 0), 0),
      },
      totalCost: mepTakeoff.totalCost || 0,
      updatedAt: mepTakeoff.updatedAt,
    });

  } catch (error) {
    logger.error('[MEP Takeoff API] Error', error);
    return NextResponse.json(
      { error: `Failed to get MEP takeoff: ${error}` },
      { status: 500 }
    );
  }
}
