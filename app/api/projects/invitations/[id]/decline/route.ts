import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_INVITATIONS_DECLINE');

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    // Decline invitation
    await prisma.$transaction(async (tx: any) => {
      // Update invitation status
      await tx.projectInvitation.update({
        where: { id },
        data: { status: 'declined' },
      });

      // Create notification for inviter
      await tx.notification.create({
        data: {
          userId: invitation.inviterId,
          type: 'invitation_declined',
          subject: `Invitation Declined: ${invitation.Project.name}`,
          body: `${session.user.username || session.user?.email} has declined your invitation to join "${invitation.Project.name}".`,
        },
      });
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'invitation_declined',
      resource: 'project',
      resourceId: invitation.projectId,
      details: { invitationId: id },
      request,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation declined',
    });
  } catch (error) {
    logger.error('Error declining invitation', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
