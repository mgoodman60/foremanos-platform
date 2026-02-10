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

    const calibrations = await prisma.markupCalibration.findMany({
      where: {
        documentId: ctx.documentId,
      },
      orderBy: { pageNumber: 'asc' },
    });

    return NextResponse.json({ calibrations });
  } catch (error) {
    logger.error('CALIBRATIONS_GET', 'Failed to fetch calibrations', error);
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
    const {
      pageNumber,
      point1X,
      point1Y,
      point2X,
      point2Y,
      realDistance,
      realUnit,
      pdfUnitsPerRealUnit,
      confidence,
    } = body;

    if (
      pageNumber === undefined ||
      point1X === undefined ||
      point1Y === undefined ||
      point2X === undefined ||
      point2Y === undefined ||
      !realDistance ||
      !realUnit ||
      !pdfUnitsPerRealUnit
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await prisma.markupCalibration.findFirst({
      where: {
        documentId: ctx.documentId,
        pageNumber,
      },
    });

    if (existing) {
      const calibration = await prisma.markupCalibration.update({
        where: { id: existing.id },
        data: {
          point1X,
          point1Y,
          point2X,
          point2Y,
          realDistance,
          realUnit,
          pdfUnitsPerRealUnit,
          confidence: confidence || 1.0,
          createdBy: ctx.userId,
        },
      });

      return NextResponse.json({ calibration });
    }

    const calibration = await prisma.markupCalibration.create({
      data: {
        documentId: ctx.documentId,
        projectId: ctx.projectId,
        pageNumber,
        point1X,
        point1Y,
        point2X,
        point2Y,
        realDistance,
        realUnit,
        pdfUnitsPerRealUnit,
        confidence: confidence || 1.0,
        createdBy: ctx.userId,
      },
    });

    return NextResponse.json({ calibration }, { status: 201 });
  } catch (error) {
    logger.error('CALIBRATIONS_POST', 'Failed to create calibration', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
