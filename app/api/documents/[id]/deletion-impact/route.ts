/**
 * Document Deletion Impact API
 * Returns counts of extracted/derived data that would be affected by deleting a document
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, createRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = await checkRateLimit(ip, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const documentId = params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        projectId: true,
        Project: {
          select: { id: true, ownerId: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const userId = session.user.id;
    const userRole = (session.user as Record<string, unknown>).role;
    const isAdmin = userRole === 'admin';
    const isProjectOwner = document.Project?.ownerId === userId;

    if (!isAdmin && !isProjectOwner) {
      const projectAccess = await prisma.project.findFirst({
        where: {
          id: document.projectId,
          ProjectMember: { some: { userId } },
        },
        select: { id: true },
      });

      if (!projectAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const [rooms, doors, windows, finishes, floorPlans, hardware, takeoffs, chunks] = await Promise.all([
      prisma.room.count({ where: { sourceDocumentId: documentId } }),
      prisma.doorScheduleItem.count({ where: { sourceDocumentId: documentId } }),
      prisma.windowScheduleItem.count({ where: { sourceDocumentId: documentId } }),
      prisma.finishScheduleItem.count({ where: { sourceDocumentId: documentId } }),
      prisma.floorPlan.count({ where: { sourceDocumentId: documentId } }),
      prisma.hardwareSetDefinition.count({ where: { sourceDocumentId: documentId } }),
      prisma.materialTakeoff.count({ where: { documentId } }),
      prisma.documentChunk.count({ where: { documentId } }),
    ]);

    logger.info('DOCUMENT_DELETE', 'Deletion impact queried', {
      documentId,
      rooms, doors, windows, finishes, floorPlans, hardware, takeoffs, chunks,
    });

    return NextResponse.json({
      impact: { rooms, doors, windows, finishes, floorPlans, hardware, takeoffs, chunks },
      hasExtractedData: rooms + doors + windows + finishes + floorPlans + hardware > 0,
    });
  } catch (error) {
    logger.error('DOCUMENT_DELETE', 'Error fetching deletion impact', error instanceof Error ? error : new Error(String(error)), {
      documentId: params.id,
    });
    return NextResponse.json(
      { error: 'Failed to fetch deletion impact' },
      { status: 500 }
    );
  }
}
