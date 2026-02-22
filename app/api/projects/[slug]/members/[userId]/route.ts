import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEMBERS');

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, userId } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions: only owners can remove members
    const currentUserMember = project.ProjectMember.find((m: any) => m.userId === session.user.id);
    const isOwner = project.ownerId === session.user.id || currentUserMember?.role === 'owner';
    const isSelf = userId === session.user.id;

    if (!isOwner && !isSelf) {
      return NextResponse.json(
        { error: 'Only project owners can remove members. You can only leave projects yourself.' },
        { status: 403 }
      );
    }

    // Prevent removing the project owner
    if (userId === project.ownerId) {
      return NextResponse.json(
        { error: 'Cannot remove the project owner' },
        { status: 400 }
      );
    }

    // Find and delete the membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId: project.id,
        },
      },
      include: {
        User: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Delete the membership
    await prisma.projectMember.delete({
      where: {
        userId_projectId: {
          userId,
          projectId: project.id,
        },
      },
    });

    // Create notification for removed user (if not removing self)
    if (!isSelf) {
      await prisma.notification.create({
        data: {
          userId,
          type: 'removed_from_project',
          subject: `Removed from Project: ${project.name}`,
          body: `You have been removed from the project "${project.name}".`,
        },
      });
    }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: isSelf ? 'left_project' : 'removed_member',
      resource: 'project',
      resourceId: project.id,
      details: { removedUserId: userId, removedUsername: membership.User.username },
      request,
    });

    return NextResponse.json({
      success: true,
      message: isSelf ? 'You have left the project' : 'Member removed successfully',
    });
  } catch (error) {
    logger.error('Error removing project member', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
