/**
 * Photo Unlink API - Unlinks a photo from an entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PHOTOS_UNLINK');

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const { photoId, entityType, entityId } = body;

    if (!photoId || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'photoId, entityType, and entityId required' },
        { status: 400 }
      );
    }

    switch (entityType) {
      case 'daily_report': {
        const report = await prisma.dailyReport.findFirst({
          where: { id: entityId, projectId: project.id },
          select: { id: true, photoIds: true },
        });
        if (!report) {
          return NextResponse.json({ error: 'Daily report not found' }, { status: 404 });
        }
        await prisma.dailyReport.update({
          where: { id: entityId },
          data: {
            photoIds: (report.photoIds || []).filter((id: string) => id !== photoId),
          },
        });
        break;
      }

      case 'punch_item': {
        const item = await prisma.punchListItem.findFirst({
          where: { id: entityId, projectId: project.id },
          select: { id: true, photoIds: true, completionPhotoIds: true },
        });
        if (!item) {
          return NextResponse.json({ error: 'Punch item not found' }, { status: 404 });
        }
        await prisma.punchListItem.update({
          where: { id: entityId },
          data: {
            photoIds: (item.photoIds || []).filter((id: string) => id !== photoId),
            completionPhotoIds: (item.completionPhotoIds || []).filter((id: string) => id !== photoId),
          },
        });
        break;
      }

      case 'rfi': {
        // RFI model does not support photoIds - feature not available
        return NextResponse.json(
          { error: 'Photo unlinking from RFIs is not currently supported' },
          { status: 400 }
        );
      }

      case 'room': {
        // Remove roomId from photo
        await prisma.roomPhoto.update({
          where: { id: photoId },
          data: { roomId: null },
        });
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'UNLINK',
        resource: 'photo',
        resourceId: photoId,
        userId: session.user.id,
        details: {
          unlinkedFrom: entityType,
          entityId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error unlinking photo', error);
    return NextResponse.json(
      { error: 'Failed to unlink photo' },
      { status: 500 }
    );
  }
}
