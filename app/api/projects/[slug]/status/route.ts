import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_STATUS');

export async function PATCH(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await request.json();

    // Validate status
    if (!['active', 'archived', 'draft'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: active, archived, or draft' },
        { status: 400 }
      );
    }

    // Find the project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions: only owner or admin can update status
    const isOwner = project.ownerId === session.user.id;
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update project status
    const updatedProject = await prisma.project.update({
      where: { slug: params.slug },
      data: { status },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'project.status.update',
      resource: 'Project',
      resourceId: project.id,
      details: { status, projectSlug: params.slug },
      request,
    });

    return NextResponse.json({
      success: true,
      project: updatedProject,
    });
  } catch (error) {
    logger.error('Error updating project status', error);
    return NextResponse.json(
      { error: 'Failed to update project status' },
      { status: 500 }
    );
  }
}
