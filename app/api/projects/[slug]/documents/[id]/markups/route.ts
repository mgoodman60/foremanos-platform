import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import type { CreateMarkupRequest, BulkCreateMarkupRequest } from '@/lib/markup/markup-types';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
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

    const url = new URL(request.url);
    const pageNumber = url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : undefined;

    const markups = await prisma.markup.findMany({
      where: {
        documentId: ctx.documentId,
        deletedAt: null,
        ...(pageNumber !== undefined && { pageNumber }),
      },
      include: {
        Creator: {
          select: { id: true, username: true, email: true },
        },
        Layer: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ markups });
  } catch (error) {
    logger.error('MARKUPS_GET', 'Failed to fetch markups', error);
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
    if (!rateLimitCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const params = await context.params;
    const ctx = await resolveContext(params.slug, params.id, session.user.email);
    if (!ctx) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const body = await request.json();

    if ('markups' in body) {
      const bulkRequest = body as BulkCreateMarkupRequest;
      const markups = await Promise.all(
        bulkRequest.markups.map(async (markupData: CreateMarkupRequest) => {
          return await prisma.markup.create({
            data: {
              documentId: ctx.documentId,
              projectId: ctx.projectId,
              pageNumber: markupData.pageNumber,
              shapeType: markupData.shapeType,
              geometry: markupData.geometry as unknown as Record<string, string | number | boolean | string[] | null>,
              style: markupData.style as unknown as Record<string, string | number | boolean | string[] | null>,
              content: markupData.content,
              label: markupData.label,
              status: 'open',
              priority: 'medium',
              tags: [],
              layerId: markupData.layerId,
              measurementValue: markupData.measurementValue,
              measurementUnit: markupData.measurementUnit,
              calibrationId: markupData.calibrationId,
              symbolId: markupData.symbolId,
              createdBy: ctx.userId,
            },
            include: {
              Creator: { select: { id: true, username: true, email: true } },
              Layer: { select: { id: true, name: true, color: true } },
            },
          });
        })
      );

      return NextResponse.json({ markups }, { status: 201 });
    }

    const markupData = body as CreateMarkupRequest;
    const markup = await prisma.markup.create({
      data: {
        documentId: ctx.documentId,
        projectId: ctx.projectId,
        pageNumber: markupData.pageNumber,
        shapeType: markupData.shapeType,
        geometry: markupData.geometry as unknown as Record<string, string | number | boolean | string[] | null>,
        style: markupData.style as unknown as Record<string, string | number | boolean | string[] | null>,
        content: markupData.content,
        label: markupData.label,
        status: 'open',
        priority: 'medium',
        tags: [],
        layerId: markupData.layerId,
        measurementValue: markupData.measurementValue,
        measurementUnit: markupData.measurementUnit,
        calibrationId: markupData.calibrationId,
        symbolId: markupData.symbolId,
        createdBy: ctx.userId,
      },
      include: {
        Creator: { select: { id: true, username: true, email: true } },
        Layer: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ markup }, { status: 201 });
  } catch (error) {
    logger.error('MARKUPS_POST', 'Failed to create markup', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
