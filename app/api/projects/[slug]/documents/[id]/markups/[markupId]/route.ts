import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import type { UpdateMarkupRequest } from '@/lib/markup/markup-types';

interface RouteContext {
  params: Promise<{ slug: string; id: string; markupId: string }>;
}

async function resolveContext(slug: string, documentId: string, userEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: userEmail }, select: { id: true } });
  if (!user) return null;
  const document = await prisma.document.findFirst({
    where: { id: documentId, Project: { slug, OR: [{ ownerId: user.id }, { ProjectMember: { some: { userId: user.id } } }] } },
    select: { id: true, projectId: true, name: true, cloud_storage_path: true },
  });
  if (!document) return null;
  return { userId: user.id, documentId: document.id, projectId: document.projectId, documentName: document.name, storagePath: document.cloud_storage_path };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(session.user.email, RATE_LIMITS.API);
    if (!rateLimitCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const params = await context.params;
    const ctx = await resolveContext(params.slug, params.id, session.user.email);
    if (!ctx) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const markup = await prisma.markup.findFirst({
      where: {
        id: params.markupId,
        documentId: ctx.documentId,
        deletedAt: null,
      },
      include: {
        Creator: { select: { id: true, username: true, email: true } },
        Layer: { select: { id: true, name: true, color: true } },
        Replies: {
          where: { deletedAt: null },
          include: {
            Creator: { select: { id: true, username: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!markup) {
      return NextResponse.json({ error: 'Markup not found' }, { status: 404 });
    }

    return NextResponse.json({ markup });
  } catch (error) {
    logger.error('MARKUP_GET', 'Failed to fetch markup', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(session.user.email, RATE_LIMITS.API);
    if (!rateLimitCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const params = await context.params;
    const ctx = await resolveContext(params.slug, params.id, session.user.email);
    if (!ctx) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const existingMarkup = await prisma.markup.findFirst({
      where: {
        id: params.markupId,
        documentId: ctx.documentId,
        deletedAt: null,
      },
    });

    if (!existingMarkup) {
      return NextResponse.json({ error: 'Markup not found' }, { status: 404 });
    }

    const body: UpdateMarkupRequest = await request.json();

    if (body.expectedUpdatedAt) {
      const expectedDate = new Date(body.expectedUpdatedAt);
      if (existingMarkup.updatedAt.getTime() !== expectedDate.getTime()) {
        return NextResponse.json(
          { error: 'Markup has been modified by another user', currentUpdatedAt: existingMarkup.updatedAt },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (body.geometry !== undefined) {
      updateData.geometry = body.geometry as unknown as Record<string, string | number | boolean | string[] | null>;
    }
    if (body.style !== undefined) {
      updateData.style = body.style as unknown as Record<string, string | number | boolean | string[] | null>;
    }
    if (body.content !== undefined) updateData.content = body.content;
    if (body.label !== undefined) updateData.label = body.label;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.layerId !== undefined) updateData.layerId = body.layerId;
    if (body.measurementValue !== undefined) updateData.measurementValue = body.measurementValue;
    if (body.measurementUnit !== undefined) updateData.measurementUnit = body.measurementUnit;

    if (body.lockedBy !== undefined) {
      if (body.lockedBy === null) {
        updateData.lockedBy = null;
        updateData.lockedAt = null;
      } else {
        updateData.lockedBy = ctx.userId;
        updateData.lockedAt = new Date();
      }
    }

    const markup = await prisma.markup.update({
      where: { id: params.markupId },
      data: updateData,
      include: {
        Creator: { select: { id: true, username: true, email: true } },
        Layer: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ markup });
  } catch (error) {
    logger.error('MARKUP_PATCH', 'Failed to update markup', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(session.user.email, RATE_LIMITS.API);
    if (!rateLimitCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const params = await context.params;
    const ctx = await resolveContext(params.slug, params.id, session.user.email);
    if (!ctx) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const markup = await prisma.markup.findFirst({
      where: {
        id: params.markupId,
        documentId: ctx.documentId,
        deletedAt: null,
      },
    });

    if (!markup) {
      return NextResponse.json({ error: 'Markup not found' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.markup.update({
        where: { id: params.markupId },
        data: { deletedAt: new Date() },
      }),
      prisma.markupReply.updateMany({
        where: { markupId: params.markupId },
        data: { deletedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('MARKUP_DELETE', 'Failed to delete markup', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
