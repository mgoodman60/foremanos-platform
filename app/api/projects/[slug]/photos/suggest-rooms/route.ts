import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getRoomSuggestionsForPhoto, getRoomSuggestionsFromText } from '@/lib/room-suggester';

/**
 * POST /api/projects/[slug]/photos/suggest-rooms
 * 
 * Get AI-powered room suggestions for a photo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();

    const {
      photoId,
      imageUrl,
      caption,
      aiDescription,
      aiTags,
      tradeType,
      location,
    } = body;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let suggestions;

    // If photoId provided, get the photo details
    if (photoId) {
      const photo = await prisma.roomPhoto.findUnique({
        where: { id: photoId },
      });

      if (!photo || photo.projectId !== project.id) {
        return NextResponse.json(
          { error: 'Photo not found' },
          { status: 404 }
        );
      }

      const photoImageUrl = imageUrl || `/api/files/view?path=${photo.cloud_storage_path}`;
      const fullImageUrl = `${process.env.NEXTAUTH_URL}${photoImageUrl}`;

      // Use vision-based suggestions
      suggestions = await getRoomSuggestionsForPhoto(
        fullImageUrl,
        slug,
        {
          caption: photo.caption || caption,
          aiDescription: photo.aiDescription || aiDescription,
          aiTags: photo.aiTags || aiTags,
        }
      );
    } else if (imageUrl) {
      // Use vision-based suggestions with provided URL
      const fullImageUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `${process.env.NEXTAUTH_URL}${imageUrl}`;

      suggestions = await getRoomSuggestionsForPhoto(
        fullImageUrl,
        slug,
        {
          caption,
          aiDescription,
          aiTags,
        }
      );
    } else {
      // Use text-based suggestions
      suggestions = await getRoomSuggestionsFromText(
        slug,
        {
          description: caption || aiDescription,
          tags: aiTags,
          location,
          tradeType,
        }
      );
    }

    console.log(`[Room Suggestions] Generated ${suggestions.length} suggestions for project ${slug}`);

    return NextResponse.json({
      success: true,
      suggestions,
      count: suggestions.length,
    });
  } catch (error: any) {
    console.error('[Room Suggestions] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate room suggestions',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
