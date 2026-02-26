import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

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

    const replies = await prisma.markupReply.findMany({
      where: {
        markupId: params.markupId,
        deletedAt: null,
      },
      include: {
        Creator: {
          select: { id: true, username: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ replies });
  } catch (error) {
    logger.error('MARKUP_REPLIES_GET', 'Failed to fetch replies', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
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

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const reply = await prisma.markupReply.create({
      data: {
        markupId: params.markupId,
        documentId: ctx.documentId,
        content: content.trim(),
        createdBy: ctx.userId,
      },
      include: {
        Creator: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    return NextResponse.json({ reply }, { status: 201 });
  } catch (error) {
    logger.error('MARKUP_REPLIES_POST', 'Failed to create reply', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
