import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ slug: string; id: string; layerId: string }>;
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
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

    const layer = await prisma.markupLayer.findFirst({
      where: {
        id: params.layerId,
        documentId: ctx.documentId,
      },
    });

    if (!layer) {
      return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.visible !== undefined) updateData.visible = body.visible;
    if (body.locked !== undefined) updateData.locked = body.locked;
    if (body.opacity !== undefined) updateData.opacity = body.opacity;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    const updatedLayer = await prisma.markupLayer.update({
      where: { id: params.layerId },
      data: updateData,
    });

    return NextResponse.json({ layer: updatedLayer });
  } catch (error) {
    logger.error('LAYER_PATCH', 'Failed to update layer', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth();
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

    const layer = await prisma.markupLayer.findFirst({
      where: {
        id: params.layerId,
        documentId: ctx.documentId,
      },
    });

    if (!layer) {
      return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.markup.updateMany({
        where: { layerId: params.layerId },
        data: { layerId: null },
      }),
      prisma.markupLayer.delete({
        where: { id: params.layerId },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('LAYER_DELETE', 'Failed to delete layer', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
