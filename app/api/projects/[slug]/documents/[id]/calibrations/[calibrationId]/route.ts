import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ slug: string; id: string; calibrationId: string }>;
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

    const calibration = await prisma.markupCalibration.findFirst({
      where: {
        id: params.calibrationId,
        documentId: ctx.documentId,
      },
    });

    if (!calibration) {
      return NextResponse.json({ error: 'Calibration not found' }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.point1X !== undefined) updateData.point1X = body.point1X;
    if (body.point1Y !== undefined) updateData.point1Y = body.point1Y;
    if (body.point2X !== undefined) updateData.point2X = body.point2X;
    if (body.point2Y !== undefined) updateData.point2Y = body.point2Y;
    if (body.realDistance !== undefined) updateData.realDistance = body.realDistance;
    if (body.realUnit !== undefined) updateData.realUnit = body.realUnit;
    if (body.pdfUnitsPerRealUnit !== undefined) updateData.pdfUnitsPerRealUnit = body.pdfUnitsPerRealUnit;
    if (body.confidence !== undefined) updateData.confidence = body.confidence;

    const updatedCalibration = await prisma.markupCalibration.update({
      where: { id: params.calibrationId },
      data: updateData,
    });

    return NextResponse.json({ calibration: updatedCalibration });
  } catch (error) {
    logger.error('CALIBRATION_PATCH', 'Failed to update calibration', error);
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

    const calibration = await prisma.markupCalibration.findFirst({
      where: {
        id: params.calibrationId,
        documentId: ctx.documentId,
      },
    });

    if (!calibration) {
      return NextResponse.json({ error: 'Calibration not found' }, { status: 404 });
    }

    await prisma.markupCalibration.delete({
      where: { id: params.calibrationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('CALIBRATION_DELETE', 'Failed to delete calibration', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
