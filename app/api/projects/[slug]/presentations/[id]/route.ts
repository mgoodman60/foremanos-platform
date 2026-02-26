/**
 * Single Presentation Board API
 * Get, update, or delete an individual presentation board.
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import { getFileUrl } from '@/lib/s3';

const log = createScopedLogger('PRESENTATION_API');

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
    const session = await auth();
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

    const board = await prisma.presentationBoard.findUnique({
      where: { id: params.id },
    });

    if (!board || board.projectId !== project.id) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Generate signed URLs for logo keys
    const logoFields = [
      { key: 'companyLogoKey', urlField: 'companyLogoUrl' },
      { key: 'clientLogoKey', urlField: 'clientLogoUrl' },
      { key: 'partnerLogo1Key', urlField: 'partnerLogo1Url' },
      { key: 'partnerLogo2Key', urlField: 'partnerLogo2Url' },
      { key: 'sitePhotoKey', urlField: 'sitePhotoUrl' },
    ] as const;

    const urls: Record<string, string | undefined> = {};

    for (const { key, urlField } of logoFields) {
      const keyValue = board[key as keyof typeof board] as string | null;
      if (keyValue) {
        try {
          urls[urlField] = await getFileUrl(keyValue, false, 3600);
        } catch (err) {
          log.warn('Failed to generate signed URL', { field: key, error: err });
        }
      }
    }

    // Fetch renders with signed URLs
    let renders: Array<Record<string, unknown>> = [];
    if (board.renderIds.length > 0) {
      const renderRecords = await prisma.projectRender.findMany({
        where: { id: { in: board.renderIds } },
      });

      renders = await Promise.all(
        renderRecords.map(async (render) => {
          let imageUrl: string | undefined;
          let thumbnailUrl: string | undefined;

          if (render.imageKey) {
            try {
              imageUrl = await getFileUrl(render.imageKey, false, 3600);
            } catch (err) {
              log.warn('Failed to generate render image URL', { renderId: render.id, error: err });
            }
          }
          if (render.thumbnailKey) {
            try {
              thumbnailUrl = await getFileUrl(render.thumbnailKey, false, 3600);
            } catch (err) {
              log.warn('Failed to generate render thumbnail URL', { renderId: render.id, error: err });
            }
          }

          return { ...render, imageUrl, thumbnailUrl };
        })
      );
    }

    return NextResponse.json({
      board: {
        ...board,
        ...urls,
        renders,
      },
    });
  } catch (error) {
    log.error('Failed to fetch presentation board', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch presentation board' },
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
    const session = await auth();
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

    const existing = await prisma.presentationBoard.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true },
    });

    if (!existing || existing.projectId !== project.id) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = [
      'title', 'templateId', 'projectName', 'companyName', 'tagline',
      'contactInfo', 'dateText', 'primaryColor', 'accentColor',
      'companyLogoKey', 'clientLogoKey', 'partnerLogo1Key', 'partnerLogo2Key',
      'renderIds', 'sitePhotoKey', 'lastExportedAt', 'lastExportFormat',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const board = await prisma.presentationBoard.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ board });
  } catch (error) {
    log.error('Failed to update presentation board', error as Error);
    return NextResponse.json(
      { error: 'Failed to update presentation board' },
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
    const session = await auth();
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

    const existing = await prisma.presentationBoard.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true, createdBy: true },
    });

    if (!existing || existing.projectId !== project.id) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Only the creator, project owner, or admin can delete
    if (
      existing.createdBy !== session.user.id &&
      project.ownerId !== session.user.id &&
      session.user.role !== 'admin'
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.presentationBoard.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to delete presentation board', error as Error);
    return NextResponse.json(
      { error: 'Failed to delete presentation board' },
      { status: 500 }
    );
  }
}
