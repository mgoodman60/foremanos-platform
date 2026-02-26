import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowById } from '../../../../lib/workflow-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('WORKFLOWS');

/**
 * GET /api/workflows/[workflowId]
 * Get a specific workflow template with all steps
 */
export async function GET(req: NextRequest, props: { params: Promise<{ workflowId: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflowId } = params;

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
    }

    // Get workflow template
    const workflow = await getWorkflowById(workflowId);

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    logger.error('Error fetching workflow', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow' },
      { status: 500 }
    );
  }
}
