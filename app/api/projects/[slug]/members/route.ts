import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEMBERS');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project with members
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
        ProjectMember: {
          include: {
            User: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if current user has access to this project
    const currentUserMember = project.ProjectMember.find((m: any) => m.userId === session.user.id);
    const isOwner = project.ownerId === session.user.id;

    if (!isOwner && !currentUserMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      members: project.ProjectMember.map((member: any) => ({
        id: member.id,
        userId: member.User.id,
        username: member.User.username,
        email: member.User.email,
        userRole: member.User.role,
        projectRole: member.role,
        joinedAt: member.joinedAt,
        isOwner: member.userId === project.ownerId,
      })),
    });
  } catch (error) {
    logger.error('Error fetching project members', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
