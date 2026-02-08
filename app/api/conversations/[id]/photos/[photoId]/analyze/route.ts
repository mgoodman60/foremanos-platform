/**
 * On-Demand Photo Analysis API
 *
 * POST /api/conversations/[id]/photos/[photoId]/analyze
 * Triggers AI analysis for a specific photo in a conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { analyzePhoto } from '@/lib/photo-analyzer';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('PHOTO_ON_DEMAND_ANALYZE');

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId, photoId } = params;
    const body = await request.json().catch(() => ({}));
    const model = body.model || 'haiku'; // 'haiku' (cheap) or 'opus' (detailed)

    // Find conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true, photos: true, projectId: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // CRITICAL: Verify the requesting user owns this conversation
    if (conversation.userId !== session.user.id) {
      log.warn('Unauthorized photo analysis attempt', {
        userId: session.user.id,
        conversationOwnerId: conversation.userId,
        conversationId,
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the photo in the photos JSON array
    const photos = (conversation.photos as any[]) || [];
    const photoIndex = photos.findIndex(
      (p: any) => p.id === photoId || p.fileName === photoId
    );

    if (photoIndex === -1) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const photo = photos[photoIndex];
    const imagePath = photo.cloud_storage_path || photo.s3Key || photo.key;

    if (!imagePath) {
      return NextResponse.json({ error: 'Photo has no storage path' }, { status: 400 });
    }

    // Validate imagePath to prevent SSRF/path traversal
    // Only allow alphanumeric, dashes, underscores, dots, and forward slashes
    if (!/^[a-zA-Z0-9\-_./]+$/.test(imagePath)) {
      log.warn('Invalid photo path detected', { imagePath, conversationId });
      return NextResponse.json({ error: 'Invalid photo path' }, { status: 400 });
    }

    // Analyze the photo
    log.info('Analyzing photo on demand', { photoId, model, conversationId });

    const imageUrl = imagePath.startsWith('http')
      ? imagePath
      : `${process.env.NEXTAUTH_URL}/api/files/view?path=${encodeURIComponent(imagePath)}`;

    const analysis = await analyzePhoto(imageUrl, '', {});

    // Update the photo entry in conversation.photos
    photos[photoIndex] = {
      ...photo,
      aiDescription: analysis.description,
      aiTags: analysis.tags?.join(', ') || '',
      ocrText: analysis.ocrText || '',
      analyzedAt: new Date().toISOString(),
      analyzedModel: model,
    };

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { photos: photos as any },
    });

    return NextResponse.json({
      success: true,
      description: analysis.description,
      tags: analysis.tags,
      ocrText: analysis.ocrText,
      confidence: analysis.confidence,
      model,
    });
  } catch (error) {
    log.error('On-demand photo analysis failed', error as Error);
    return NextResponse.json({ error: 'Failed to analyze photo' }, { status: 500 });
  }
}
