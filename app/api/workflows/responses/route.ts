import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth-options';
import { saveWorkflowResponse, updateReportingPattern } from '../../../../lib/workflow-service';
import { prisma } from '../../../../lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('WORKFLOWS_RESPONSES');

/**
 * POST /api/workflows/responses
 * Save workflow responses for a conversation
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const body = await req.json();
    const { workflowId, conversationId, responses, projectSlug } = body;

    if (!workflowId || !conversationId || !responses || !projectSlug) {
      return NextResponse.json(
        { error: 'Workflow ID, conversation ID, responses, and project slug required' },
        { status: 400 }
      );
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Save each response
    const savedResponses = [];
    const responsesObj = responses as Record<string, any>;
    for (const [stepId, response] of Object.entries(responsesObj)) {
      const saved = await saveWorkflowResponse(
        workflowId,
        stepId,
        conversationId,
        response,
        userId
      );
      savedResponses.push(saved);
    }

    // Update reporting pattern (learn user's style)
    await updateReportingPattern(userId, project.id, responsesObj);

    return NextResponse.json({ success: true, responses: savedResponses });
  } catch (error) {
    logger.error('Error saving workflow responses', error);
    return NextResponse.json(
      { error: 'Failed to save workflow responses' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workflows/responses?conversationId=xxx
 * Get workflow responses for a conversation
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID required' },
        { status: 400 }
      );
    }

    // Get responses
    const responses = await prisma.workflowResponse.findMany({
      where: { conversationId },
      include: {
        WorkflowStep: {
          select: {
            question: true,
            stepType: true,
            options: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ responses });
  } catch (error) {
    logger.error('Error fetching workflow responses', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow responses' },
      { status: 500 }
    );
  }
}
