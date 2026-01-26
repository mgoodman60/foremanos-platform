/**
 * Photo All API - Fetches all photos with linked entity information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';
import { format } from 'date-fns';

export async function GET(
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

    // Fetch all room photos
    const roomPhotos = await prisma.roomPhoto.findMany({
      where: {
        Room: { projectId: project.id },
      },
      include: {
        Room: { select: { id: true, roomNumber: true, name: true } },
      },
    });

    // Fetch daily reports with photos
    const dailyReports = await prisma.dailyReport.findMany({
      where: {
        projectId: project.id,
        NOT: { photoIds: { equals: [] } },
      },
      select: {
        id: true,
        reportDate: true,
        photoIds: true,
      },
    });

    // Fetch punch items with photos
    const punchItems = await prisma.punchListItem.findMany({
      where: {
        projectId: project.id,
        OR: [
          { NOT: { photoIds: { equals: [] } } },
          { NOT: { completionPhotoIds: { equals: [] } } },
        ],
      },
      select: {
        id: true,
        title: true,
        photoIds: true,
        completionPhotoIds: true,
      },
    });

    // Fetch RFIs - note: RFI model doesn't have photoIds, we skip this for now
    const rfis: { id: string; rfiNumber: number; title: string }[] = [];

    // Build photo-to-links mapping
    const photoLinks: Record<string, { type: string; id: string; label: string; date?: string }[]> = {};

    // Map daily report photos
    dailyReports.forEach(dr => {
      (dr.photoIds || []).forEach(photoId => {
        if (!photoLinks[photoId]) photoLinks[photoId] = [];
        photoLinks[photoId].push({
          type: 'daily_report',
          id: dr.id,
          label: `Daily Report - ${format(new Date(dr.reportDate), 'MMM d, yyyy')}`,
          date: dr.reportDate.toISOString(),
        });
      });
    });

    // Map punch item photos
    punchItems.forEach(pi => {
      [...(pi.photoIds || []), ...(pi.completionPhotoIds || [])].forEach(photoId => {
        if (!photoLinks[photoId]) photoLinks[photoId] = [];
        if (!photoLinks[photoId].some(l => l.type === 'punch_item' && l.id === pi.id)) {
          photoLinks[photoId].push({
            type: 'punch_item',
            id: pi.id,
            label: pi.title,
          });
        }
      });
    });

    // Map RFI photos (currently not supported as RFI doesn't have photoIds)
    // This section is a placeholder for future implementation

    // Format photos with signed URLs and linked info
    const formattedPhotos = await Promise.all(
      roomPhotos.map(async (photo) => {
        const links = photoLinks[photo.id] || [];
        
        // Add room link
        if (photo.Room) {
          links.push({
            type: 'room',
            id: photo.Room.id,
            label: `Room ${photo.Room.roomNumber || ''}${photo.Room.name ? ` - ${photo.Room.name}` : ''}`,
          });
        }

        const url = photo.cloud_storage_path
          ? await getFileUrl(photo.cloud_storage_path, false)
          : null;

        return {
          id: photo.id,
          url: url || '',
          thumbnailUrl: url, // Could generate thumbnails in future
          caption: photo.caption || photo.aiDescription,
          location: photo.location,
          trade: photo.tradeType,
          takenAt: photo.capturedAt?.toISOString() || photo.createdAt.toISOString(),
          uploadedAt: photo.createdAt.toISOString(),
          linkedTo: links,
          aiDescription: photo.aiDescription,
          gpsCoords: photo.latitude && photo.longitude
            ? { lat: photo.latitude, lng: photo.longitude }
            : undefined,
          roomNumber: photo.Room?.roomNumber,
        };
      })
    );

    // Sort by date (newest first)
    formattedPhotos.sort((a, b) => 
      new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()
    );

    return NextResponse.json({ photos: formattedPhotos });
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}
