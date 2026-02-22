import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_INVITATIONS_ACCEPT');

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get invitation
    const invitation = await prisma.projectInvitation.findUnique({
      where: { id },
      include: {
        Project: true,
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify the invitation is for the current user
    if (invitation.inviteeId !== session.user.id && invitation.inviteeEmail !== session.user?.email) {
      return NextResponse.json({ error: 'This invitation is not for you' }, { status: 403 });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 400 });
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      await prisma.projectInvitation.update({
        where: { id },
        data: { status: 'expired' },
      });
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Check if user is already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: invitation.projectId,
        },
      },
    });

    if (existingMember) {
      // Update invitation status
      await prisma.projectInvitation.update({
        where: { id },
        data: { status: 'accepted' },
      });
      return NextResponse.json({ error: 'You are already a member of this project' }, { status: 400 });
    }

    // Accept invitation - update status and create membership
    await prisma.$transaction(async (tx: any) => {
      // Update invitation status
      await tx.projectInvitation.update({
        where: { id },
        data: { status: 'accepted' },
      });

      // Create project member
      await tx.projectMember.create({
        data: {
          userId: session.user.id,
          projectId: invitation.projectId,
          role: invitation.role,
        },
      });

      // Create notification for inviter
      await tx.notification.create({
        data: {
          userId: invitation.inviterId,
          type: 'invitation_accepted',
          subject: `Invitation Accepted: ${invitation.Project.name}`,
          body: `${session.user.username || session.user?.email} has accepted your invitation to join "${invitation.Project.name}".`,
        },
      });
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'invitation_accepted',
      resource: 'project',
      resourceId: invitation.projectId,
      details: { invitationId: id, role: invitation.role },
      request,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted',
      projectSlug: invitation.Project.slug,
    });
  } catch (error) {
    logger.error('Error accepting invitation', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
