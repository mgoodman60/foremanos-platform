import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function resolveContext(slug: string, documentId: string, userEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: userEmail }, select: { id: true } });
  if (!user) return null;
  const document = await prisma.document.findFirst({
    where: { id: documentId, Project: { slug, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] } },
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
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const params = await context.params;
    const ctx = await resolveContext(params.slug, params.id, session.user.email);
    if (!ctx) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const layers = await prisma.markupLayer.findMany({
      where: {
        documentId: ctx.documentId,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ layers });
  } catch (error) {
    logger.error('LAYERS_GET', 'Failed to fetch layers', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(session.user.email, RATE_LIMITS.API);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const params = await context.params;
    const ctx = await resolveContext(params.slug, params.id, session.user.email);
    if (!ctx) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, color, scope } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const existing = await prisma.markupLayer.findFirst({
      where: {
        documentId: ctx.documentId,
        name: name.trim(),
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Layer with this name already exists' }, { status: 409 });
    }

    const maxSortOrder = await prisma.markupLayer.findFirst({
      where: { documentId: ctx.documentId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const layer = await prisma.markupLayer.create({
      data: {
        documentId: ctx.documentId,
        projectId: ctx.projectId,
        name: name.trim(),
        color: color || '#3B82F6',
        visible: true,
        locked: false,
        opacity: 1.0,
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1,
        scope: scope || 'document',
        createdBy: ctx.userId,
      },
    });

    return NextResponse.json({ layer }, { status: 201 });
  } catch (error) {
    logger.error('LAYERS_POST', 'Failed to create layer', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
