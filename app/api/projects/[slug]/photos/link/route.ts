/**
 * Photo Link API - Links photos to entities (daily reports, punch items, RFIs, rooms)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

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
    const { photoIds, entityType, entityId } = body;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json({ error: 'photoIds required' }, { status: 400 });
    }

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId required' }, { status: 400 });
    }

    let updatedCount = 0;

    switch (entityType) {
      case 'daily_report': {
        const report = await prisma.dailyReport.findFirst({
          where: { id: entityId, projectId: project.id },
          select: { id: true, photoIds: true },
        });
        if (!report) {
          return NextResponse.json({ error: 'Daily report not found' }, { status: 404 });
        }
        const existingIds = new Set(report.photoIds || []);
        const newIds = photoIds.filter((id: string) => !existingIds.has(id));
        await prisma.dailyReport.update({
          where: { id: entityId },
          data: { photoIds: [...(report.photoIds || []), ...newIds] },
        });
        updatedCount = newIds.length;
        break;
      }

      case 'punch_item': {
        const item = await prisma.punchListItem.findFirst({
          where: { id: entityId, projectId: project.id },
          select: { id: true, photoIds: true },
        });
        if (!item) {
          return NextResponse.json({ error: 'Punch item not found' }, { status: 404 });
        }
        const existingIds = new Set(item.photoIds || []);
        const newIds = photoIds.filter((id: string) => !existingIds.has(id));
        await prisma.punchListItem.update({
          where: { id: entityId },
          data: { photoIds: [...(item.photoIds || []), ...newIds] },
        });
        updatedCount = newIds.length;
        break;
      }

      case 'rfi': {
        // RFI model does not support photoIds - feature not available
        return NextResponse.json(
          { error: 'Photo linking to RFIs is not currently supported' },
          { status: 400 }
        );
      }

      case 'room': {
        const room = await prisma.room.findFirst({
          where: { id: entityId, projectId: project.id },
          select: { id: true },
        });
        if (!room) {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }
        // Update roomId on the photos
        await prisma.roomPhoto.updateMany({
          where: { id: { in: photoIds } },
          data: { roomId: entityId },
        });
        updatedCount = photoIds.length;
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'LINK',
        resource: 'photo',
        resourceId: photoIds.join(','),
        userId: session.user.id,
        details: {
          linkedTo: entityType,
          entityId,
          count: updatedCount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      linkedCount: updatedCount,
    });
  } catch (error) {
    console.error('Error linking photos:', error);
    return NextResponse.json(
      { error: 'Failed to link photos' },
      { status: 500 }
    );
  }
}
