import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generateMasterSchedule, canGenerateSchedule } from '@/lib/master-schedule-generator';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_GENERATE');

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[slug]/schedule/generate
 * Generate a master schedule from project documents
 * 
 * Options:
 * - scheduleName: Custom name for the schedule
 * - startDate: Project start date (ISO string)
 * - detailLevel: 'basic' | 'standard' | 'detailed' (default: 'standard')
 *   - basic: ~30-50 tasks, major milestones only
 *   - standard: ~50-80 tasks, all phases
 *   - detailed: ~100-200 tasks, location breakdowns, all scope items
 * - useSOV: Use Schedule of Values/budget for task generation (default: true)
 * - matchSubcontractors: Match tasks to registered subs (default: true)
 */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { 
      scheduleName, 
      startDate, 
      detailLevel = 'standard',
      useSOV = true,
      matchSubcontractors = true 
    } = body;

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if we can generate a schedule
    const capability = await canGenerateSchedule(project.id);
    if (!capability.canGenerate) {
      return NextResponse.json({
        error: 'Cannot generate schedule',
        reason: capability.reason,
        documentCount: capability.documentCount,
        hasPlans: capability.hasPlans,
        hasSpecs: capability.hasSpecs
      }, { status: 400 });
    }

    // Generate the master schedule with enhanced options
    const result = await generateMasterSchedule(project.id, session.user.id, {
      scheduleName,
      projectStartDate: startDate ? new Date(startDate) : undefined,
      detailLevel: detailLevel as 'basic' | 'standard' | 'detailed',
      useSOV,
      matchSubcontractors
    });

    return NextResponse.json({
      success: true,
      schedule: {
        id: result.scheduleId,
        name: scheduleName || `Master Schedule - ${project.name}`,
        projectName: result.projectName,
        totalTasks: result.totalTasks,
        phases: result.phases,
        estimatedDuration: result.estimatedDuration,
        startDate: result.startDate.toISOString(),
        endDate: result.endDate.toISOString(),
        sourcesUsed: result.sourcesUsed,
        detailLevel: result.detailLevel
      }
    });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate schedule' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[slug]/schedule/generate
 * Check if schedule generation is available and what sources can be used
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const capability = await canGenerateSchedule(project.id);

    // Get additional data sources info
    const projectBudget = await prisma.projectBudget.findUnique({
      where: { projectId: project.id },
      include: { _count: { select: { BudgetItem: true } } }
    });
    const budgetCount = projectBudget?._count?.BudgetItem || 0;
    const subCount = await prisma.subcontractor.count({ where: { projectId: project.id } });

    // Determine recommended detail level based on available data
    let recommendedDetailLevel: 'basic' | 'standard' | 'detailed' = 'standard';
    if (budgetCount > 20 && capability.hasSpecs) {
      recommendedDetailLevel = 'detailed';
    } else if (capability.documentCount < 3 && budgetCount < 10) {
      recommendedDetailLevel = 'basic';
    }

    return NextResponse.json({
      canGenerate: capability.canGenerate,
      reason: capability.reason,
      sources: {
        documents: capability.documentCount,
        hasPlans: capability.hasPlans,
        hasSpecs: capability.hasSpecs,
        budgetItems: budgetCount,
        subcontractors: subCount
      },
      recommendedDetailLevel,
      detailLevels: [
        { level: 'basic', tasks: '30-50', description: 'Major milestones and phases only' },
        { level: 'standard', tasks: '50-80', description: 'All phases with key activities' },
        { level: 'detailed', tasks: '100-200', description: 'Full scope with location breakdowns' }
      ]
    });
  } catch (error) {
    logger.error('Check error', error);
    return NextResponse.json(
      { error: 'Failed to check schedule generation capability' },
      { status: 500 }
    );
  }
}
