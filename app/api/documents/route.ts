import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await withDatabaseRetry(
      () => getServerSession(authOptions),
      'Get server session (documents)'
    );
    const userRole = session?.user?.role || 'guest';
    
    // Get projectId from query params
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Fetch documents based on user's access level and project
    let accessLevelFilter: any;
    if (userRole === 'admin') {
      // Admin can see all documents (no filter)
      accessLevelFilter = {};
    } else if (userRole === 'client') {
      // Clients can see 'client' and 'guest' documents
      accessLevelFilter = { accessLevel: { in: ['client', 'guest'] } };
    } else {
      // Guests can only see 'guest' documents
      accessLevelFilter = { accessLevel: 'guest' };
    }

    const documents = await withDatabaseRetry(
      () => prisma.document.findMany({
        where: {
          projectId,
          deletedAt: null,
          ...accessLevelFilter
        },
        select: {
          id: true,
          name: true,
          fileName: true,
          fileType: true,
          accessLevel: true,
          category: true,
          filePath: true,
          fileSize: true,
          lastModified: true,
          updatedAt: true,
          queueStatus: true,
          processed: true,
        },
        orderBy: {
          name: 'asc'
        }
      }),
      'Fetch project documents'
    );

    // Also fetch all documents for the project to show counts
    const allDocuments = await withDatabaseRetry(
      () => prisma.document.findMany({
        where: {
          projectId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          fileName: true,
          fileType: true,
          accessLevel: true,
          category: true,
          filePath: true,
          fileSize: true,
          lastModified: true,
          updatedAt: true,
          queueStatus: true,
          processed: true,
        },
        orderBy: {
          name: 'asc'
        }
      }),
      'Fetch all project documents'
    );

    // Optional intelligence enrichment
    const includeIntelligence = searchParams.get('include') === 'intelligence';
    const intelligenceMap: Record<string, {
      sheetCount: number;
      disciplines: string[];
      drawingTypes: Record<string, number>;
      averageConfidence: number | null;
      lowConfidenceCount: number;
      dimensionCount: number;
    }> = {};

    if (includeIntelligence && allDocuments.length > 0) {
      const docIds = allDocuments.map((d) => d.id);

      const [sheetCounts, drawingTypeCounts, dimensionCounts, disciplineChunks] = await Promise.all([
        prisma.documentChunk.groupBy({
          by: ['documentId'],
          where: { documentId: { in: docIds }, sheetNumber: { not: null } },
          _count: { sheetNumber: true },
        }),
        prisma.drawingType.groupBy({
          by: ['documentId', 'type'],
          where: { documentId: { in: docIds } },
          _count: true,
          _avg: { confidence: true },
        }),
        prisma.dimensionAnnotation.groupBy({
          by: ['documentId'],
          where: { documentId: { in: docIds } },
          _count: true,
        }),
        prisma.documentChunk.findMany({
          where: { documentId: { in: docIds }, discipline: { not: null } },
          select: { documentId: true, discipline: true },
          distinct: ['documentId', 'discipline'],
        }),
      ]);

      for (const docId of docIds) {
        const sheetCount = sheetCounts.find((s) => s.documentId === docId)?._count?.sheetNumber || 0;
        const typesForDoc = drawingTypeCounts.filter((d) => d.documentId === docId);
        const drawingTypes: Record<string, number> = {};
        let totalConfidence = 0;
        let confidenceCount = 0;
        for (const dt of typesForDoc) {
          drawingTypes[dt.type] = dt._count;
          if (dt._avg?.confidence) {
            totalConfidence += dt._avg.confidence * dt._count;
            confidenceCount += dt._count;
          }
        }
        const dimensionCount = dimensionCounts.find((d) => d.documentId === docId)?._count || 0;
        const docDisciplines = disciplineChunks
          .filter((c) => c.documentId === docId)
          .map((c) => c.discipline!)
          .filter(Boolean);

        intelligenceMap[docId] = {
          sheetCount,
          disciplines: docDisciplines,
          drawingTypes,
          averageConfidence: confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) / 100 : null,
          lowConfidenceCount: typesForDoc.filter((d) => d._avg?.confidence != null && d._avg.confidence < 0.6).length,
          dimensionCount,
        };
      }
    }

    // Build response - add intelligence per document when requested
    const responseDocuments = includeIntelligence
      ? allDocuments.map((doc) => ({ ...doc, intelligence: intelligenceMap[doc.id] || null }))
      : allDocuments;

    const responseAccessible = includeIntelligence
      ? documents.map((doc) => ({ ...doc, intelligence: intelligenceMap[doc.id] || null }))
      : documents;

    return NextResponse.json({
      documents: responseDocuments,
      accessible: responseAccessible,
      userRole
    });
  } catch (error: any) {
    logger.error('DOC_LIST', 'Error fetching documents', error);
    
    // Return more specific error messages
    if (error?.code?.startsWith('P1')) {
      return NextResponse.json({ 
        error: 'Database connection error. Please try again.' 
      }, { status: 503 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}