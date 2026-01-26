import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { updateMilestoneStatus, getMilestoneTimeline } from '@/lib/schedule-budget-service';

// GET /api/projects/[slug]/milestones - List milestones
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Auto-update statuses
    await updateMilestoneStatus(project.id);

    const { milestones, timeline } = await getMilestoneTimeline(project.id);

    // Get stats
    const stats = {
      total: milestones.length,
      upcoming: milestones.filter((m: any) => m.status === 'UPCOMING').length,
      inProgress: milestones.filter((m: any) => m.status === 'IN_PROGRESS').length,
      completed: milestones.filter((m: any) => m.status === 'COMPLETED').length,
      atRisk: milestones.filter((m: any) => m.status === 'AT_RISK').length,
      delayed: milestones.filter((m: any) => ['DELAYED', 'MISSED'].includes(m.status)).length,
      critical: milestones.filter((m: any) => m.isCritical).length
    };

    return NextResponse.json({ milestones, timeline, stats });
  } catch (error) {
    console.error('[API] Milestones error:', error);
    return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/milestones - Create milestone
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      description,
      plannedDate,
      category = 'PROJECT',
      isCritical = false,
      paymentLinked = false,
      paymentAmount,
      linkedTaskIds = [],
      predecessorIds = []
    } = body;

    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name,
        description,
        plannedDate: new Date(plannedDate),
        baselineDate: new Date(plannedDate),
        category,
        isCritical,
        paymentLinked,
        paymentAmount,
        linkedTaskIds,
        predecessorIds,
        status: 'UPCOMING',
        createdBy: session.user.id
      }
    });

    return NextResponse.json(milestone);
  } catch (error) {
    console.error('[API] Create milestone error:', error);
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 });
  }
}
