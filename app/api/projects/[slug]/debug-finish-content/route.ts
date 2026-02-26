import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { safeErrorMessage } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DEBUG_FINISH_CONTENT');

/**
 * GET /api/projects/[slug]/debug-finish-content
 * Debug endpoint to see what finish-related content exists in documents
 */
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        Room: {
          select: {
            id: true,
            roomNumber: true,
            name: true,
          },
          orderBy: {
            roomNumber: 'asc',
          },
        },
        Document: {
          where: {
            processed: true,
            deletedAt: null,
          },
          include: {
            DocumentChunk: {
              orderBy: {
                chunkIndex: 'asc',
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check user access
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isOwner = (project as any).ownerId === (user as any).id;
    const isAdmin = (user as any).role === 'admin' || (user as any).role === 'client';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get all document chunks
    const allChunks: any[] = [];
    for (const doc of (project as any).Document) {
      for (const chunk of doc.DocumentChunk || []) {
        allChunks.push({
          documentName: doc.name,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
        });
      }
    }

    logger.info('Total chunks found', { count: allChunks.length });

    // Search for finish-related keywords
    // Enhanced with construction abbreviations
    const finishKeywords = [
      // Table headers and general terms
      'finish schedule',
      'room finish',
      'flooring',
      'wall finish',
      'ceiling',
      'base',
      'carpet',
      'vinyl',
      'paint',
      'tile',
      'epoxy',
      'ceramic',
      'wood',
      'laminate',
      'drywall',
      'gypsum',
      'acoustic',
      'room no',
      'schedule',
      
      // Construction abbreviations (CRITICAL)
      'gwb',      // Gypsum Wall Board
      'cmw',      // Concrete Masonry Wall
      'act',      // Acoustic Ceiling Tile
      'vct',      // Vinyl Composition Tile
      'lvt',      // Luxury Vinyl Tile
      'cpt',      // Carpet
      'cer',      // Ceramic
      'por',      // Porcelain
      'gyp',      // Gypsum
      'cmu',      // Concrete Masonry Unit
      'fib',      // Fiberboard
      'sus',      // Suspended
      'arws',     // Wall system codes
      'conc',     // Concrete
      'rb-',      // Rubber Base codes
      
      // Common finish codes
      'r-1', 'r-2', 'r-3', 'r-4', 'r-5',
      't-1', 't-2', 't-3',
      
      // Directional indicators
      'north', 'south', 'east', 'west',
      "mat'l",    // Material column
    ];

    // Find chunks with finish keywords
    const finishChunks: any[] = [];
    const keywordMatches: Record<string, number> = {};

    for (const chunk of allChunks) {
      const content = chunk.content.toLowerCase();
      let matchCount = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of finishKeywords) {
        if (content.includes(keyword)) {
          matchCount++;
          matchedKeywords.push(keyword);
          keywordMatches[keyword] = (keywordMatches[keyword] || 0) + 1;
        }
      }

      // Check for room number patterns
      const roomNumberPattern = /\b(00[1-9]|0[1-9][0-9]|[1-9][0-9]{2})\b/g;
      const foundRoomNumbers = content.match(roomNumberPattern) || [];
      const hasRoomNumbers = foundRoomNumbers.length > 0;

      if (matchCount >= 1) {
        finishChunks.push({
          documentName: chunk.documentName,
          chunkIndex: chunk.chunkIndex,
          matchCount,
          keywords: matchedKeywords,
          hasRoomNumbers,
          foundRoomNumbers: [...new Set(foundRoomNumbers)].slice(0, 10), // First 10 unique
          contentPreview: chunk.content.substring(0, 500),
          contentLength: chunk.content.length,
        });
      }
    }

    // Sort by match count
    finishChunks.sort((a, b) => b.matchCount - a.matchCount);

    // Get room numbers from project
    const roomNumbers = (project as any).Room.map((r: any) => r.roomNumber).filter(Boolean);

    // Check which room numbers appear in finish chunks
    const roomNumbersInFinishChunks: Record<string, number> = {};
    for (const chunk of finishChunks) {
      for (const roomNum of chunk.foundRoomNumbers) {
        roomNumbersInFinishChunks[roomNum] = (roomNumbersInFinishChunks[roomNum] || 0) + 1;
      }
    }

    return NextResponse.json({
      summary: {
        totalChunks: allChunks.length,
        finishRelatedChunks: finishChunks.length,
        totalRooms: roomNumbers.length,
        roomNumbersFound: Object.keys(roomNumbersInFinishChunks).length,
      },
      keywordMatches,
      roomNumbersInFinishChunks,
      projectRoomNumbers: roomNumbers,
      topFinishChunks: finishChunks.slice(0, 5),
    });
  } catch (error: unknown) {
    logger.error('Error', error);
    return NextResponse.json(
      {
        error: 'Failed to debug finish content',
        details: safeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
