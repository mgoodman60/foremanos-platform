/**
 * Room Photos API
 * Handles photo uploads and retrieval for project rooms
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  initializePhotoUpload,
  getProjectPhotos,
  PhotoMetadata,
} from '@/lib/photo-documentation';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PHOTOS');

/**
 * GET /api/projects/[slug]/photos
 * Get all photos for a project
 */
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId') || undefined;
    const tradeType = searchParams.get('tradeType') || undefined;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 50;
    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!)
      : 0;

    const { photos, total } = await getProjectPhotos(project.id, {
      roomId,
      tradeType,
      startDate,
      endDate,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      photos,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[slug]/photos
 * Initialize photo upload
 */
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      roomId,
      fileName,
      contentType,
      caption,
      tradeType,
      location,
      metadata,
    } = body;

    if (!roomId || !fileName || !contentType) {
      return NextResponse.json(
        { error: 'Missing required fields: roomId, fileName, contentType' },
        { status: 400 }
      );
    }

    // Verify room exists
    const room = await prisma.room.findFirst({
      where: { id: roomId, projectId: project.id },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Initialize upload
    const photoMetadata: PhotoMetadata = {
      latitude: metadata?.latitude,
      longitude: metadata?.longitude,
      altitude: metadata?.altitude,
      accuracy: metadata?.accuracy,
      heading: metadata?.heading,
      capturedAt: metadata?.capturedAt ? new Date(metadata.capturedAt) : undefined,
      deviceModel: metadata?.deviceModel,
      width: metadata?.width,
      height: metadata?.height,
      fileSize: metadata?.fileSize,
      mimeType: contentType,
    };

    const result = await initializePhotoUpload({
      projectId: project.id,
      roomId,
      fileName,
      contentType,
      metadata: photoMetadata,
      caption,
      tradeType,
      location,
      uploadedById: (session.user as any).id,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('POST error', error);
    return NextResponse.json(
      { error: 'Failed to initialize photo upload' },
      { status: 500 }
    );
  }
}
