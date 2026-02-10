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

    const [byType, byPage, byStatus, total] = await Promise.all([
      prisma.markup.groupBy({
        by: ['shapeType'],
        where: { documentId: ctx.documentId, deletedAt: null },
        _count: { id: true },
      }),
      prisma.markup.groupBy({
        by: ['pageNumber'],
        where: { documentId: ctx.documentId, deletedAt: null },
        _count: { id: true },
      }),
      prisma.markup.groupBy({
        by: ['status'],
        where: { documentId: ctx.documentId, deletedAt: null },
        _count: { id: true },
      }),
      prisma.markup.count({
        where: { documentId: ctx.documentId, deletedAt: null },
      }),
    ]);

    const summary = {
      total,
      byType: Object.fromEntries(byType.map((item) => [item.shapeType, item._count.id])),
      byPage: Object.fromEntries(byPage.map((item) => [item.pageNumber.toString(), item._count.id])),
      byStatus: Object.fromEntries(byStatus.map((item) => [item.status, item._count.id])),
    };

    return NextResponse.json(summary);
  } catch (error) {
    logger.error('MARKUPS_SUMMARY', 'Failed to fetch summary', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
