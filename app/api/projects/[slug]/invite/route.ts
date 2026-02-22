import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_INVITE');

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { emailOrUsername, role } = body;

    // Validate role
    if (!['editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be "editor" or "viewer"' }, { status: 400 });
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: true,
        User_Project_ownerIdToUser: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if current user is owner or has editor role
    const currentUserMember = project.ProjectMember.find((m: any) => m.userId === session.user.id);
    const isOwner = project.ownerId === session.user.id;
    const canInvite = isOwner || currentUserMember?.role === 'owner' || currentUserMember?.role === 'editor';

    if (!canInvite) {
      return NextResponse.json({ error: 'Only project owners and editors can invite members' }, { status: 403 });
    }

    // Search for user by email or username (case-insensitive)
    const invitee = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: emailOrUsername, mode: 'insensitive' } },
          { username: { equals: emailOrUsername, mode: 'insensitive' } },
        ],
      },
    });

    // Check if user is already a member
    if (invitee) {
      const existingMember = project.ProjectMember.find((m: any) => m.userId === invitee.id);
      if (existingMember) {
        return NextResponse.json({ error: 'User is already a project member' }, { status: 400 });
      }

      // Check if there's already a pending invitation
      const existingInvitation = await prisma.projectInvitation.findFirst({
        where: {
          projectId: project.id,
          inviteeId: invitee.id,
          status: 'pending',
        },
      });

      if (existingInvitation) {
        return NextResponse.json({ error: 'User already has a pending invitation' }, { status: 400 });
      }
    }

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.projectInvitation.create({
      data: {
        projectId: project.id,
        inviterId: session.user.id,
        inviteeId: invitee?.id,
        inviteeEmail: invitee?.email || emailOrUsername,
        role,
        status: 'pending',
        expiresAt,
      },
      include: {
        Project: true,
        User_ProjectInvitation_inviterIdToUser: true,
        User_ProjectInvitation_inviteeIdToUser: true,
      },
    });

    // Create notification for invitee if they exist
    if (invitee) {
      await prisma.notification.create({
        data: {
          userId: invitee.id,
          type: 'project_invitation',
          subject: `Project Invitation: ${project.name}`,
          body: `${session.user.username || session.user?.email} has invited you to join "${project.name}" as a ${role}.`,
        },
      });
    }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'project_invite_sent',
      resource: 'project',
      resourceId: project.id,
      details: { inviteeEmail: invitee?.email || emailOrUsername, role },
      request,
    });

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        projectName: project.name,
        inviteeName: invitee?.username || emailOrUsername,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    logger.error('Error creating invitation', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
