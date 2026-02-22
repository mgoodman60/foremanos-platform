import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_RENAME');

export const dynamic = 'force-dynamic';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    // Fetch the project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        User_Project_ownerIdToUser: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Permission check: Admin or project owner (client who owns the project)
    const isAdmin = session.user.role === 'admin';
    const isProjectOwner = project.ownerId === session.user.id;

    if (!isAdmin && !isProjectOwner) {
      return NextResponse.json(
        { error: 'You do not have permission to rename this project' },
        { status: 403 }
      );
    }

    // Generate new slug from the new name
    const newSlug = generateSlug(name.trim());

    // Check if the new slug already exists (but not on this project)
    const existingProject = await prisma.project.findUnique({
      where: { slug: newSlug },
    });

    if (existingProject && existingProject.id !== project.id) {
      return NextResponse.json(
        { error: 'A project with this name already exists. Please choose a different name.' },
        { status: 409 }
      );
    }

    // Rename the project
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        name: name.trim(),
        slug: newSlug,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'PROJECT_RENAMED',
        resource: 'project',
        resourceId: project.id,
        details: `Renamed project from "${project.name}" to "${name.trim()}"`,
      },
    });

    return NextResponse.json({ 
      success: true, 
      project: updatedProject 
    });
  } catch (error) {
    logger.error('Error renaming project', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
