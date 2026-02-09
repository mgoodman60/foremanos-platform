/**
 * Document Search API
 * GET /api/documents/search
 * Full-text search on DocumentChunk content with discipline and drawing type filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const query = searchParams.get('q');
    const discipline = searchParams.get('discipline');
    const drawingType = searchParams.get('drawingType');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      Document: {
        projectId,
        deletedAt: null,
      },
    };

    if (query && query.trim().length >= 2) {
      where.content = { contains: query.trim(), mode: 'insensitive' };
    }

    if (discipline) {
      where.discipline = discipline;
    }

    // Get total count
    const total = await prisma.documentChunk.count({ where });

    // Get results
    const chunks = await prisma.documentChunk.findMany({
      where,
      select: {
        id: true,
        sheetNumber: true,
        discipline: true,
        content: true,
        pageNumber: true,
        documentId: true,
        Document: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: { pageNumber: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // If drawingType filter, post-filter (DrawingType is a separate model)
    let filteredChunks = chunks;
    if (drawingType) {
      const docIds = chunks.map(c => c.documentId).filter((id): id is string => id !== null);
      const typeSheets = await prisma.drawingType.findMany({
        where: { documentId: { in: docIds }, type: drawingType },
        select: { sheetNumber: true },
      });
      const typeSheetSet = new Set(typeSheets.map(t => t.sheetNumber));
      filteredChunks = chunks.filter(c => c.sheetNumber && typeSheetSet.has(c.sheetNumber));
    }

    // Extract match excerpts
    const results = filteredChunks.map(chunk => {
      let matchedContent = '';
      if (query) {
        const idx = chunk.content.toLowerCase().indexOf(query.toLowerCase());
        if (idx >= 0) {
          const start = Math.max(0, idx - 100);
          const end = Math.min(chunk.content.length, idx + query.length + 100);
          matchedContent = (start > 0 ? '...' : '') + chunk.content.substring(start, end) + (end < chunk.content.length ? '...' : '');
        }
      }

      return {
        documentId: chunk.documentId,
        documentName: chunk.Document?.name || null,
        sheetNumber: chunk.sheetNumber,
        discipline: chunk.discipline,
        matchedContent: matchedContent || chunk.content.substring(0, 200),
        pageNumber: chunk.pageNumber,
      };
    });

    // Get available filter values for the project
    const [disciplineValues, drawingTypeValues, categoryValues] = await Promise.all([
      prisma.documentChunk.findMany({
        where: { Document: { projectId, deletedAt: null }, discipline: { not: null } },
        select: { discipline: true },
        distinct: ['discipline'],
      }),
      prisma.drawingType.findMany({
        where: { Document: { projectId, deletedAt: null } },
        select: { type: true },
        distinct: ['type'],
      }),
      prisma.document.findMany({
        where: { projectId, deletedAt: null },
        select: { category: true },
        distinct: ['category'],
      }),
    ]);

    return NextResponse.json({
      results,
      total,
      page,
      limit,
      filters: {
        disciplines: disciplineValues.map(d => d.discipline).filter(Boolean),
        drawingTypes: drawingTypeValues.map(d => d.type),
        categories: categoryValues.map(c => c.category),
      },
    });
  } catch (error) {
    logger.error('DOC_SEARCH', 'Search failed', error as Error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
