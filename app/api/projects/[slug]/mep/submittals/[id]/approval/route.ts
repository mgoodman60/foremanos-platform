import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  getApprovalHistory,
  getAvailableActions,
  performApprovalAction,
  ApprovalAction,
} from '@/lib/submittal-approval-service';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS_APPROVAL');

// GET: Fetch approval history and available actions
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const submittal = await prisma.mEPSubmittal.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, submittalNumber: true, title: true },
    });

    if (!submittal) {
      return NextResponse.json({ error: 'Submittal not found' }, { status: 404 });
    }

    const history = await getApprovalHistory(params.id);
    const availableActions = getAvailableActions(submittal.status);

    return NextResponse.json({
      submittal: {
        id: submittal.id,
        submittalNumber: submittal.submittalNumber,
        title: submittal.title,
        currentStatus: submittal.status,
      },
      history,
      availableActions,
    });
  } catch (error) {
    logger.error('Error fetching approval history', error);
    return NextResponse.json({ error: 'Failed to fetch approval data' }, { status: 500 });
  }
}

// POST: Perform an approval action
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, comments } = body as { action: ApprovalAction; comments?: string };

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const result = await performApprovalAction(
      params.id,
      action,
      session.user.id,
      session.user.username || 'Unknown',
      comments
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Fetch updated data
    const history = await getApprovalHistory(params.id);
    const availableActions = getAvailableActions(result.newStatus);

    return NextResponse.json({
      success: true,
      newStatus: result.newStatus,
      history,
      availableActions,
    });
  } catch (error) {
    logger.error('Error performing approval action', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}
