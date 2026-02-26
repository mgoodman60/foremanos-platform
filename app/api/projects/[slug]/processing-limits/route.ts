import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getUsageStats, getProjectProcessingLimits } from '@/lib/processing-limits';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PROCESSING_LIMITS');

// GET /api/projects/[slug]/processing-limits - Get usage stats and limits
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: { include: { User: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get usage stats and limits
    const stats = await getUsageStats(project.id);
    const limits = await getProjectProcessingLimits(project.id);

    // Get queued document count
    const queuedCount = await prisma.document.count({
      where: {
        projectId: project.id,
        queueStatus: 'queued',
      },
    });

    return NextResponse.json({
      stats,
      limits,
      queuedCount,
    });
  } catch (error: unknown) {
    logger.error('Error', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to get processing limits', details: errMsg },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[slug]/processing-limits - Update processing limits (admin/owner only)
export async function PUT(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: { User_Project_ownerIdToUser: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify access (admin or owner only)
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    if (!isOwner && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update limits
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        dailyPageLimit: body.dailyPageLimit,
        monthlyPageLimit: body.monthlyPageLimit,
        queueEnabled: body.queueEnabled,
        autoProcessPlans: body.autoProcessPlans,
        autoProcessSchedules: body.autoProcessSchedules,
        autoProcessSpecs: body.autoProcessSpecs,
        autoProcessInvoices: body.autoProcessInvoices,
        emailOnLimitReached: body.emailOnLimitReached,
        alertThreshold: body.alertThreshold,
      },
    });

    logger.info('Updated limits for project', { project: project.name });

    return NextResponse.json({
      message: 'Processing limits updated successfully',
      project: updatedProject,
    });
  } catch (error: unknown) {
    logger.error('Error', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to update processing limits', details: errMsg },
      { status: 500 }
    );
  }
}
