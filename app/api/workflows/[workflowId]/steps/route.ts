import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth-options';
import { getNextStepsForWorkflow } from '../../../../../lib/workflow-service';
import { prisma } from '../../../../../lib/db';
import { 
  findScheduleCandidates, 
  parseScheduleActivities, 
  formatScheduleSuggestions 
} from '../../../../../lib/schedule-parser';
import { createLogger } from '../../../../../lib/logger';

const logger = createLogger('workflow-steps');

/**
 * POST /api/workflows/[workflowId]/steps
 * Get next 3-5 steps based on current responses
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflowId } = params;
    const body = await req.json();
    const { projectSlug, conversationId, currentResponses = {} } = body;

    if (!workflowId || !projectSlug) {
      return NextResponse.json(
        { error: 'Workflow ID and project slug required' },
        { status: 400 }
      );
    }

    // Get project with subcontractors
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: {
        id: true,
        Subcontractor: {
          where: { isActive: true },
          orderBy: [{ tradeType: 'asc' }, { companyName: 'asc' }]
        }
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get schedule context if available
    let scheduleContext = null;
    if (conversationId) {
      try {
        // Fetch schedule context from project documents
        scheduleContext = await fetchScheduleContextForWorkflow(project.id, projectSlug);
      } catch (error) {
        logger.error('Error fetching schedule context', error as Error);
        scheduleContext = { todayTasks: [], hasSchedule: false, error: 'Failed to load schedule' };
      }
    }

    // Get next steps
    const nextSteps = await getNextStepsForWorkflow(workflowId, currentResponses, scheduleContext);

    // Dynamically populate subcontractor options for the subcontractor selection step
    if (project.Subcontractor.length > 0) {
      for (const step of nextSteps) {
        if (step.question.toLowerCase().includes('subcontractors were on site')) {
          step.options = project.Subcontractor.map((sub: any) => sub.companyName);
        }
      }
    }

    return NextResponse.json({ steps: nextSteps, scheduleContext });
  } catch (error) {
    logger.error('Error fetching next steps', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch next steps' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Fetch schedule context for workflow steps
 * Returns schedule information for today to help users with daily report workflows
 */
async function fetchScheduleContextForWorkflow(
  projectId: string,
  projectSlug: string
): Promise<any> {
  try {
    logger.info('Fetching schedule context', { projectId });

    // Find schedule documents in the project
    const scheduleCandidates = await findScheduleCandidates(projectId);

    if (scheduleCandidates.length === 0) {
      logger.info('No schedule documents found');
      return {
        hasSchedule: false,
        todayTasks: [],
        message: 'No schedule documents found in project'
      };
    }

    // Use the highest-scoring schedule document
    const bestSchedule = scheduleCandidates[0];
    logger.info('Using schedule', { documentName: bestSchedule.documentName });

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse scheduled activities for today
    const activities = await parseScheduleActivities(
      projectSlug,
      bestSchedule.documentId,
      today
    );

    logger.info('Found activities for today', { count: activities.length });

    // Format activities for display
    const formattedSuggestions = activities.length > 0 
      ? formatScheduleSuggestions(activities)
      : '';

    return {
      hasSchedule: true,
      todayTasks: activities,
      scheduleName: bestSchedule.documentName,
      scheduleConfidence: bestSchedule.confidence,
      taskCount: activities.length,
      formattedSuggestions,
      date: today.toISOString()
    };
  } catch (error) {
    logger.error('Error in fetchScheduleContextForWorkflow', error as Error);
    throw error;
  }
}
