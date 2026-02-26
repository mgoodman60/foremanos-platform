/**
 * Single Project Render API
 * Get, update, or delete an individual render.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import { getFileUrl, deleteFile } from '@/lib/s3';

const log = createScopedLogger('RENDER_API');

async function getProjectAndCheckAccess(slug: string, userId: string, userRole?: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      ownerId: true,
      ProjectMember: { select: { userId: true } },
    },
  });

  if (!project) return { project: null, hasAccess: false };

  const isOwner = project.ownerId === userId;
  const isMember = project.ProjectMember.some(
    (m: { userId: string }) => m.userId === userId
  );
  const isAdmin = userRole === 'admin';

  return { project, hasAccess: isOwner || isMember || isAdmin };
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project, hasAccess } = await getProjectAndCheckAccess(
      params.slug, session.user.id, session.user.role
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const render = await prisma.projectRender.findUnique({
      where: { id: params.id },
      include: {
        Room: { select: { id: true, name: true } },
        User: { select: { id: true, username: true } },
      },
    });

    if (!render || render.projectId !== project.id) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 });
    }

    // Generate signed URL for the image if available
    let imageUrl: string | undefined;
    if (render.imageKey) {
      try {
        imageUrl = await getFileUrl(render.imageKey, false, 3600);
      } catch (err) {
        log.warn('Failed to generate signed URL for render image', { renderId: render.id, error: err });
      }
    }

    let thumbnailUrl: string | undefined;
    if (render.thumbnailKey) {
      try {
        thumbnailUrl = await getFileUrl(render.thumbnailKey, false, 3600);
      } catch (err) {
        log.warn('Failed to generate signed URL for thumbnail', { renderId: render.id, error: err });
      }
    }

    return NextResponse.json({
      render: {
        ...render,
        imageUrl,
        thumbnailUrl,
      },
    });
  } catch (error) {
    log.error('Failed to fetch render', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch render' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project, hasAccess } = await getProjectAndCheckAccess(
      params.slug, session.user.id, session.user.role
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const existing = await prisma.projectRender.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true },
    });

    if (!existing || existing.projectId !== project.id) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.isFavorite !== undefined) updateData.isFavorite = body.isFavorite;

    const render = await prisma.projectRender.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ render });
  } catch (error) {
    log.error('Failed to update render', error as Error);
    return NextResponse.json(
      { error: 'Failed to update render' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project, hasAccess } = await getProjectAndCheckAccess(
      params.slug, session.user.id, session.user.role
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const existing = await prisma.projectRender.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        projectId: true,
        createdBy: true,
        imageKey: true,
        thumbnailKey: true,
      },
    });

    if (!existing || existing.projectId !== project.id) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 });
    }

    // Only the creator or project owner can delete
    if (existing.createdBy !== session.user.id && project.ownerId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Clean up R2 files
    if (existing.imageKey) {
      try {
        await deleteFile(existing.imageKey);
      } catch (err) {
        log.warn('Failed to delete image from R2', { key: existing.imageKey, error: err });
      }
    }
    if (existing.thumbnailKey) {
      try {
        await deleteFile(existing.thumbnailKey);
      } catch (err) {
        log.warn('Failed to delete thumbnail from R2', { key: existing.thumbnailKey, error: err });
      }
    }

    await prisma.projectRender.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to delete render', error as Error);
    return NextResponse.json(
      { error: 'Failed to delete render' },
      { status: 500 }
    );
  }
}
