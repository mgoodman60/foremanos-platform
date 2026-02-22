import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SETTINGS');

// GET /api/projects/[slug]/settings - Retrieve project settings
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Fetch project with owner and member details
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerId: true,
        scheduleAutoUpdateEnabled: true,
        scheduleAutoApplyThreshold: true,
        scheduleRequireManualReview: true,
        scheduleNotifyOnAutoUpdate: true,
        ProjectMember: {
          select: {
            userId: true,
            role: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is admin, owner, or project member
    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === session.user.id);
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Return settings
    return NextResponse.json({
      projectId: project.id,
      projectName: project.name,
      scheduleAutoUpdateEnabled: project.scheduleAutoUpdateEnabled,
      scheduleAutoApplyThreshold: project.scheduleAutoApplyThreshold,
      scheduleRequireManualReview: project.scheduleRequireManualReview,
      scheduleNotifyOnAutoUpdate: project.scheduleNotifyOnAutoUpdate,
      canEdit: isOwner || isAdmin, // Only owners and admins can edit settings
    });
  } catch (error: unknown) {
    logger.error('Error fetching project settings', error);
    return NextResponse.json(
      { error: 'Failed to fetch project settings' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[slug]/settings - Update project settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();

    // Fetch project with owner details
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only owners and admins can update settings
    const isOwner = project.ownerId === session.user.id;
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only project owners and admins can update settings' },
        { status: 403 }
      );
    }

    // Validate and extract settings
    const updateData: {
      scheduleAutoUpdateEnabled?: boolean;
      scheduleAutoApplyThreshold?: number;
      scheduleRequireManualReview?: boolean;
      scheduleNotifyOnAutoUpdate?: boolean;
    } = {};

    if (typeof body.scheduleAutoUpdateEnabled === 'boolean') {
      updateData.scheduleAutoUpdateEnabled = body.scheduleAutoUpdateEnabled;
    }

    if (typeof body.scheduleAutoApplyThreshold === 'number') {
      // Validate threshold is between 0 and 100
      if (body.scheduleAutoApplyThreshold < 0 || body.scheduleAutoApplyThreshold > 100) {
        return NextResponse.json(
          { error: 'Confidence threshold must be between 0 and 100' },
          { status: 400 }
        );
      }
      updateData.scheduleAutoApplyThreshold = body.scheduleAutoApplyThreshold;
    }

    if (typeof body.scheduleRequireManualReview === 'boolean') {
      updateData.scheduleRequireManualReview = body.scheduleRequireManualReview;
    }

    if (typeof body.scheduleNotifyOnAutoUpdate === 'boolean') {
      updateData.scheduleNotifyOnAutoUpdate = body.scheduleNotifyOnAutoUpdate;
    }

    // Update project settings
    const updatedProject = await prisma.project.update({
      where: { slug },
      data: updateData,
      select: {
        scheduleAutoUpdateEnabled: true,
        scheduleAutoApplyThreshold: true,
        scheduleRequireManualReview: true,
        scheduleNotifyOnAutoUpdate: true,
      },
    });

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: updatedProject,
    });
  } catch (error: unknown) {
    logger.error('Error updating project settings', error);
    return NextResponse.json(
      { error: 'Failed to update project settings' },
      { status: 500 }
    );
  }
}
