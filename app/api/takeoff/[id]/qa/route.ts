import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { safeErrorMessage } from '@/lib/api-error';
import {
  getTakeoffQAMetrics,
  identifyQAIssues,
  verifyLineItem,
  bulkAutoApprove,
  recalculateConfidenceScores,
  analyzeItemConfidence
} from '@/lib/takeoff-qa-service';

/**
 * GET /api/takeoff/[id]/qa
 * Get QA metrics and issues for a takeoff
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: takeoffId } = params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'metrics';

    // Verify takeoff exists and user has access
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id: takeoffId },
      include: {
        Project: {
          include: {
            ProjectMember: true
          }
        }
      }
    });

    if (!takeoff) {
      return NextResponse.json({ error: 'Takeoff not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = takeoff.Project.ownerId === user.id;
    const isMember = takeoff.Project.ProjectMember.some((m: { userId: string }) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    switch (action) {
      case 'metrics': {
        const metrics = await getTakeoffQAMetrics(takeoffId);
        return NextResponse.json({ metrics });
      }

      case 'issues': {
        const issues = await identifyQAIssues(takeoffId);
        return NextResponse.json({ issues });
      }

      case 'full': {
        const [metrics, issues] = await Promise.all([
          getTakeoffQAMetrics(takeoffId),
          identifyQAIssues(takeoffId)
        ]);
        return NextResponse.json({ metrics, issues });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Error in QA GET:', error);
    return NextResponse.json(
      { error: 'Failed to get QA data', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/takeoff/[id]/qa
 * Perform QA actions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: takeoffId } = params;
    const body = await request.json();
    const { action, ...data } = body;

    // Verify access
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id: takeoffId },
      include: {
        Project: {
          include: {
            ProjectMember: true
          }
        }
      }
    });

    if (!takeoff) {
      return NextResponse.json({ error: 'Takeoff not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = takeoff.Project.ownerId === user.id;
    const isMember = takeoff.Project.ProjectMember.some((m: { userId: string }) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    switch (action) {
      case 'verify': {
        const { itemId, approved, adjustedQuantity, adjustedUnit, notes } = data;
        if (!itemId) {
          return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
        }
        if (approved === undefined) {
          return NextResponse.json({ error: 'approved is required' }, { status: 400 });
        }

        const result = await verifyLineItem(itemId, user.id, {
          approved,
          adjustedQuantity,
          adjustedUnit,
          notes
        });
        return NextResponse.json({ result });
      }

      case 'bulk-approve': {
        const { confidenceThreshold = 85 } = data;
        const result = await bulkAutoApprove(takeoffId, confidenceThreshold);
        return NextResponse.json({ result });
      }

      case 'recalculate': {
        const result = await recalculateConfidenceScores(takeoffId);
        return NextResponse.json({ result });
      }

      case 'analyze-item': {
        const { category, quantity, unit, itemName, extractedFrom, calculationMethod } = data;
        if (!category || !quantity || !unit || !itemName) {
          return NextResponse.json({ error: 'category, quantity, unit, and itemName are required' }, { status: 400 });
        }

        const analysis = analyzeItemConfidence({
          category,
          quantity,
          unit,
          itemName,
          extractedFrom,
          calculationMethod
        });
        return NextResponse.json({ analysis });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Error in QA POST:', error);
    return NextResponse.json(
      { error: 'Failed to perform QA action', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
