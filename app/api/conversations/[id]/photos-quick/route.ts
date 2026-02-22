import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('CONVERSATIONS_PHOTOS_QUICK');

// POST - Quick capture photo upload (mobile optimized)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = params.id;
    const body = await req.json();
    const { cloud_storage_path, location, trade, caption } = body;

    if (!cloud_storage_path) {
      return NextResponse.json(
        { error: 'Missing cloud_storage_path' },
        { status: 400 }
      );
    }

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        photos: true,
        photoCount: true,
        photoSequence: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Default description (analysis is now on-demand via /photos/[photoId]/analyze)
    const aiDescription = caption || 'Construction progress photo';

    // Prepare photo data
    const photoId = `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newPhoto = {
      id: photoId,
      cloud_storage_path,
      location: location || undefined,
      trade: trade || undefined,
      caption: caption || undefined,
      aiDescription: aiDescription,
      aiConfidence: 80, // Default confidence
      uploadedAt: new Date().toISOString(),
    };

    // Add to photos array
    const existingPhotos = (conversation.photos as any[]) || [];
    const updatedPhotos = [...existingPhotos, newPhoto];

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        photos: updatedPhotos,
        photoCount: updatedPhotos.length,
        photoSequence: conversation.photoSequence + 1,
      },
    });

    return NextResponse.json({
      success: true,
      photo: newPhoto,
    });
  } catch (error) {
    logger.error('Error in quick photo upload', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
