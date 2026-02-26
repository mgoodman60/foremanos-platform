import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ADD_GUEST');

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guestUsername } = await request.json();

    if (!guestUsername) {
      return NextResponse.json({ error: 'Guest username is required' }, { status: 400 });
    }

    // Find project by guest username (supports namespaced PINs)
    const projects = await prisma.project.findMany({
      where: { guestUsername: { endsWith: `_${guestUsername}` } },
      select: {
        id: true,
        name: true,
      },
    });

    let project: { id: string; name: string } | null = null;

    if (projects.length === 0) {
      // Also try exact match for legacy un-namespaced PINs
      const legacyProject = await prisma.project.findUnique({
        where: { guestUsername },
        select: {
          id: true,
          name: true,
        },
      });
      if (!legacyProject) {
        return NextResponse.json(
          { error: 'No project found with this guest username' },
          { status: 404 }
        );
      }
      project = legacyProject;
    } else if (projects.length > 1) {
      return NextResponse.json(
        { error: 'Multiple projects use this PIN. Ask your PM for the project code.' },
        { status: 409 }
      );
    } else {
      project = projects[0];
    }

    // Check if user already has access
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: project.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'You already have access to this project' },
        { status: 400 }
      );
    }

    // Add user as guest member
    await prisma.projectMember.create({
      data: {
        userId: session.user.id,
        projectId: project.id,
        role: 'guest',
      },
    });

    return NextResponse.json({
      projectName: project.name,
      message: 'Guest access granted',
    });
  } catch (error) {
    logger.error('Error adding guest access', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
