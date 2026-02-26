/**
 * Render Download API
 * Serves the full-resolution render image as a file download.
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import { downloadFile } from '@/lib/s3';

const log = createScopedLogger('RENDER_API');

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        ownerId: true,
        ProjectMember: { select: { userId: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.some(
      (m: { userId: string }) => m.userId === session.user.id
    );
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const render = await prisma.projectRender.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        projectId: true,
        imageKey: true,
        title: true,
      },
    });

    if (!render || render.projectId !== project.id) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 });
    }

    if (!render.imageKey) {
      return NextResponse.json(
        { error: 'Image not yet generated' },
        { status: 404 }
      );
    }

    const imageBuffer = await downloadFile(render.imageKey);
    const filename = render.title
      ? `${render.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`
      : `render-${render.id}.png`;

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': imageBuffer.length.toString(),
      },
    });
  } catch (error) {
    log.error('Failed to download render', error as Error);
    return NextResponse.json(
      { error: 'Failed to download render' },
      { status: 500 }
    );
  }
}
