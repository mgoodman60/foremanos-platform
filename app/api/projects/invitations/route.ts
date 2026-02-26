import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_INVITATIONS');

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all pending invitations for the current user
    const invitations = await prisma.projectInvitation.findMany({
      where: {
        OR: [
          { inviteeId: session.user.id },
          { inviteeEmail: session.user?.email || undefined },
        ],
        status: 'pending',
        expiresAt: {
          gt: new Date(), // Only show non-expired invitations
        },
      },
      include: {
        Project: true,
        User_ProjectInvitation_inviterIdToUser: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      invitations: invitations.map((inv: any) => ({
        id: inv.id,
        projectId: inv.projectId,
        projectName: inv.Project.name,
        projectSlug: inv.Project.slug,
        role: inv.role,
        inviterName: inv.User_ProjectInvitation_inviterIdToUser.username,
        inviterEmail: inv.User_ProjectInvitation_inviterIdToUser.email,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching invitations', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
