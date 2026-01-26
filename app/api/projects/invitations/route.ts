import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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
    console.error('Error fetching invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
