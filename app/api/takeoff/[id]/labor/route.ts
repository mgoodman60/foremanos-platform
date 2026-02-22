import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { safeErrorMessage } from '@/lib/api-error';
import {
  calculateLaborRequirements,
  getLaborSummary,
  findMatchingScheduleTasks,
  suggestScheduleAdjustments,
  exportLaborPlan
} from '@/lib/takeoff-labor-schedule-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('TAKEOFF_LABOR');

/**
 * GET /api/takeoff/[id]/labor
 * Get labor requirements and schedule links
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
    const action = searchParams.get('action') || 'summary';

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
      case 'summary': {
        const summary = await getLaborSummary(takeoffId);
        return NextResponse.json({ summary });
      }

      case 'requirements': {
        const requirements = await calculateLaborRequirements(takeoffId);
        return NextResponse.json({ requirements });
      }

      case 'schedule-links': {
        const links = await findMatchingScheduleTasks(takeoffId, takeoff.projectId);
        return NextResponse.json({ links });
      }

      case 'suggestions': {
        const suggestions = await suggestScheduleAdjustments(takeoffId, takeoff.projectId);
        return NextResponse.json({ suggestions });
      }

      case 'export': {
        const plan = await exportLaborPlan(takeoffId);
        return NextResponse.json({ plan });
      }

      case 'full': {
        const [summary, requirements, links, suggestions] = await Promise.all([
          getLaborSummary(takeoffId),
          calculateLaborRequirements(takeoffId),
          findMatchingScheduleTasks(takeoffId, takeoff.projectId),
          suggestScheduleAdjustments(takeoffId, takeoff.projectId)
        ]);
        return NextResponse.json({ summary, requirements, links, suggestions });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    logger.error('Error in labor GET', error);
    return NextResponse.json(
      { error: 'Failed to get labor data', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
