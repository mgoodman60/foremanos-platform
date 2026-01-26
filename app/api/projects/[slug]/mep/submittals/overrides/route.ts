/**
 * Manual Override API
 * GET - List overrides (pending or all)
 * POST - Create new override
 * PATCH - Approve/reject override
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { 
  createManualOverride,
  reviewManualOverride,
  getPendingOverrides,
  getLineItemOverrideHistory
} from '@/lib/verification-audit-service';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
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

    const url = new URL(request.url);
    const lineItemId = url.searchParams.get('lineItemId');
    const pendingOnly = url.searchParams.get('pending') === 'true';

    // If specific line item requested
    if (lineItemId) {
      const history = await getLineItemOverrideHistory(lineItemId);
      return NextResponse.json({ overrides: history });
    }

    // Get pending overrides for project
    if (pendingOnly) {
      const pending = await getPendingOverrides(project.id);
      return NextResponse.json({ overrides: pending, count: pending.length });
    }

    // Get all overrides for project
    const overrides = await prisma.manualOverride.findMany({
      where: { projectId: project.id },
      include: {
        lineItem: {
          select: { productName: true, submittalId: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({ 
      overrides: overrides.map(o => ({
        id: o.id,
        lineItemId: o.lineItemId,
        productName: o.lineItem?.productName,
        submittalId: o.lineItem?.submittalId,
        overrideType: o.overrideType,
        previousStatus: o.previousStatus,
        newStatus: o.newStatus,
        previousQty: o.previousQty,
        newQty: o.newQty,
        overriddenByName: o.overriddenByName,
        justification: o.justification,
        approved: o.approved,
        approvedByName: o.approvedByName,
        approvedAt: o.approvedAt,
        createdAt: o.createdAt
      }))
    });
  } catch (error) {
    console.error('[Override API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overrides' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
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
      lineItemId, 
      overrideType, 
      newStatus, 
      newQty, 
      justification,
      documentIds,
      verificationLogId
    } = body;

    if (!lineItemId || !overrideType || !newStatus || !justification) {
      return NextResponse.json(
        { error: 'Missing required fields: lineItemId, overrideType, newStatus, justification' },
        { status: 400 }
      );
    }

    const overrideId = await createManualOverride(
      project.id,
      lineItemId,
      session.user.id,
      session.user.username || session.user.email || 'Unknown',
      {
        overrideType,
        newStatus,
        newQty,
        justification,
        documentIds,
        verificationLogId
      }
    );

    return NextResponse.json({ 
      success: true, 
      overrideId,
      message: 'Override created successfully'
    });
  } catch (error) {
    console.error('[Override API] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create override' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role for approvals
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can approve/reject overrides' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { overrideId, approved, notes } = body;

    if (!overrideId || typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: overrideId, approved' },
        { status: 400 }
      );
    }

    await reviewManualOverride(
      overrideId,
      session.user.id,
      session.user.username || session.user.email || 'Unknown',
      approved,
      notes
    );

    return NextResponse.json({ 
      success: true,
      message: approved ? 'Override approved' : 'Override rejected'
    });
  } catch (error) {
    console.error('[Override API] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to review override' },
      { status: 500 }
    );
  }
}
