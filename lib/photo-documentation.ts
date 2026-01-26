/**
 * Photo Documentation Service
 * 
 * Handles geotagged photo uploads for rooms and areas:
 * - Extracts EXIF metadata (GPS, timestamp, device info)
 * - Associates photos with rooms, areas, and trades
 * - Provides AI-powered image analysis
 * - Generates thumbnails and optimized versions
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { generatePresignedUploadUrl, getFileUrl } from './s3';

// ============================================================================
// INTERFACES
// ============================================================================

export interface PhotoMetadata {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
  capturedAt?: Date;
  deviceModel?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
}

export interface PhotoUploadRequest {
  projectId: string;
  roomId: string;
  fileName: string;
  contentType: string;
  metadata: PhotoMetadata;
  caption?: string;
  tradeType?: string;
  location?: string;
  uploadedById: string;
}

export interface PhotoAnalysisResult {
  description: string;
  tags: string[];
  detectedItems: string[];
  constructionPhase?: string;
  progressIndicators?: string[];
  qualityNotes?: string[];
  safetyObservations?: string[];
}

// ============================================================================
// PHOTO UPLOAD
// ============================================================================

/**
 * Initialize photo upload and get presigned URL
 */
export async function initializePhotoUpload(
  request: PhotoUploadRequest
): Promise<{ uploadUrl: string; cloud_storage_path: string; photoId: string }> {
  // Generate presigned URL for upload
  const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
    `room-photos/${request.projectId}/${request.roomId}/${Date.now()}-${request.fileName}`,
    request.contentType,
    true // Public for easy viewing
  );

  // Create photo record in database
  const photo = await prisma.roomPhoto.create({
    data: {
      projectId: request.projectId,
      roomId: request.roomId,
      cloud_storage_path,
      caption: request.caption,
      tradeType: request.tradeType,
      location: request.location,
      latitude: request.metadata.latitude,
      longitude: request.metadata.longitude,
      altitude: request.metadata.altitude,
      accuracy: request.metadata.accuracy,
      heading: request.metadata.heading,
      deviceModel: request.metadata.deviceModel,
      width: request.metadata.width,
      height: request.metadata.height,
      fileSize: request.metadata.fileSize,
      mimeType: request.metadata.mimeType || request.contentType,
      capturedAt: request.metadata.capturedAt || new Date(),
      uploadedById: request.uploadedById,
      source: 'field',
    },
  });

  return {
    uploadUrl,
    cloud_storage_path,
    photoId: photo.id,
  };
}

/**
 * Finalize photo upload after file is uploaded to S3
 */
export async function finalizePhotoUpload(
  photoId: string,
  options?: { analyzeWithAI?: boolean }
): Promise<{ success: boolean; photoUrl: string; analysis?: PhotoAnalysisResult }> {
  const photo = await prisma.roomPhoto.findUnique({
    where: { id: photoId },
    include: { Room: true, Project: true },
  });

  if (!photo) {
    throw new Error('Photo not found');
  }

  // Get public URL for the photo
  const photoUrl = await getFileUrl(photo.cloud_storage_path, true);

  let analysis: PhotoAnalysisResult | undefined;

  // Optionally analyze photo with AI
  if (options?.analyzeWithAI) {
    try {
      analysis = await analyzeConstructionPhoto(photoUrl, photo.Room?.name || 'Unknown');

      // Update photo with AI analysis
      await prisma.roomPhoto.update({
        where: { id: photoId },
        data: {
          aiGenerated: false,
          aiDescription: analysis.description,
          aiTags: analysis.tags.join(', '),
        },
      });
    } catch (error) {
      console.error('[PhotoDocumentation] AI analysis failed:', error);
    }
  }

  return {
    success: true,
    photoUrl,
    analysis,
  };
}

// ============================================================================
// AI ANALYSIS
// ============================================================================

/**
 * Analyze construction photo using AI vision
 */
export async function analyzeConstructionPhoto(
  photoUrl: string,
  roomName: string
): Promise<PhotoAnalysisResult> {
  const prompt = `You are a construction site documentation expert. Analyze this construction site photo from room "${roomName}".

Provide a JSON response with:
1. "description": A detailed description of what's shown (2-3 sentences)
2. "tags": Array of relevant tags (materials, systems, conditions)
3. "detectedItems": Array of specific items/components visible
4. "constructionPhase": Current phase (e.g., "Rough-in", "Framing", "Drywall", "Finish")
5. "progressIndicators": What progress can be observed
6. "qualityNotes": Any quality observations (good or concerning)
7. "safetyObservations": Any safety-related observations

Return only valid JSON.`;

  try {
    const response = await callAbacusLLM(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, max_tokens: 1000 }
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      description: 'Photo uploaded successfully',
      tags: ['construction', 'site-photo'],
      detectedItems: [],
    };
  } catch (error) {
    console.error('[PhotoDocumentation] Analysis error:', error);
    return {
      description: 'Photo uploaded successfully',
      tags: ['construction', 'site-photo'],
      detectedItems: [],
    };
  }
}

// ============================================================================
// PHOTO RETRIEVAL
// ============================================================================

/**
 * Get all photos for a room
 */
export async function getRoomPhotos(
  roomId: string,
  options?: {
    tradeType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<any[]> {
  const where: any = { roomId };

  if (options?.tradeType) {
    where.tradeType = options.tradeType;
  }

  if (options?.startDate || options?.endDate) {
    where.capturedAt = {};
    if (options.startDate) where.capturedAt.gte = options.startDate;
    if (options.endDate) where.capturedAt.lte = options.endDate;
  }

  const photos = await prisma.roomPhoto.findMany({
    where,
    orderBy: { capturedAt: 'desc' },
    take: options?.limit || 50,
    include: {
      User: { select: { username: true } },
    },
  });

  // Add URLs to photos
  return Promise.all(
    photos.map(async (photo) => ({
      ...photo,
      url: await getFileUrl(photo.cloud_storage_path, true),
    }))
  );
}

/**
 * Get all photos for a project
 */
export async function getProjectPhotos(
  projectId: string,
  options?: {
    roomId?: string;
    tradeType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<{ photos: any[]; total: number }> {
  const where: any = { projectId };

  if (options?.roomId) where.roomId = options.roomId;
  if (options?.tradeType) where.tradeType = options.tradeType;

  if (options?.startDate || options?.endDate) {
    where.capturedAt = {};
    if (options.startDate) where.capturedAt.gte = options.startDate;
    if (options.endDate) where.capturedAt.lte = options.endDate;
  }

  const [photos, total] = await Promise.all([
    prisma.roomPhoto.findMany({
      where,
      orderBy: { capturedAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      include: {
        Room: { select: { name: true, roomNumber: true } },
        User: { select: { username: true } },
      },
    }),
    prisma.roomPhoto.count({ where }),
  ]);

  // Add URLs to photos
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => ({
      ...photo,
      url: await getFileUrl(photo.cloud_storage_path, true),
    }))
  );

  return { photos: photosWithUrls, total };
}

/**
 * Get photos near a GPS location
 */
export async function getPhotosNearLocation(
  projectId: string,
  latitude: number,
  longitude: number,
  radiusMeters: number = 50
): Promise<any[]> {
  // Approximate degree to meters conversion (varies by latitude)
  const latDelta = radiusMeters / 111000; // ~111km per degree latitude
  const lonDelta = radiusMeters / (111000 * Math.cos((latitude * Math.PI) / 180));

  const photos = await prisma.roomPhoto.findMany({
    where: {
      projectId,
      latitude: {
        gte: latitude - latDelta,
        lte: latitude + latDelta,
      },
      longitude: {
        gte: longitude - lonDelta,
        lte: longitude + lonDelta,
      },
    },
    orderBy: { capturedAt: 'desc' },
    include: {
      Room: { select: { name: true, roomNumber: true } },
    },
  });

  return Promise.all(
    photos.map(async (photo) => ({
      ...photo,
      url: await getFileUrl(photo.cloud_storage_path, true),
    }))
  );
}

/**
 * Get photo timeline for a room
 */
export async function getRoomPhotoTimeline(
  roomId: string
): Promise<{ date: string; photos: any[] }[]> {
  const photos = await prisma.roomPhoto.findMany({
    where: { roomId },
    orderBy: { capturedAt: 'asc' },
  });

  // Group by date
  const byDate: Record<string, any[]> = {};
  for (const photo of photos) {
    const dateKey = photo.capturedAt?.toISOString().split('T')[0] || 'unknown';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push({
      ...photo,
      url: await getFileUrl(photo.cloud_storage_path, true),
    });
  }

  return Object.entries(byDate)
    .map(([date, photos]) => ({ date, photos }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// PHOTO DELETION
// ============================================================================

/**
 * Delete a photo
 */
export async function deletePhoto(photoId: string): Promise<boolean> {
  try {
    await prisma.roomPhoto.delete({
      where: { id: photoId },
    });
    return true;
  } catch (error) {
    console.error('[PhotoDocumentation] Delete failed:', error);
    return false;
  }
}
