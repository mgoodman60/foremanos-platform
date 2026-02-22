import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  extractTakeoffsWithVision,
  saveEnhancedTakeoff,
} from '@/lib/enhanced-takeoff-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_TAKEOFFS_ENHANCED');

interface RouteContext {
  params: {
    slug: string;
  };
}

/**
 * POST /api/projects/[slug]/takeoffs/enhanced
 * Extract takeoffs with enhanced vision AI and confidence scoring
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { params } = context;
    const { slug } = params;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check authorization
    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: { userId: string }) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to generate takeoffs' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      documentId,
      name,
      useVision = true,
      crossValidate = true,
      includeSchedules = true,
      saveToDatabase = true,
    } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    // Verify document belongs to project
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        projectId: project.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or does not belong to this project' },
        { status: 404 }
      );
    }

    logger.info('[ENHANCED-TAKEOFF-API] Starting extraction for document', { documentId });

    // Extract with enhanced vision
    const items = await extractTakeoffsWithVision(
      project.id,
      documentId,
      user.id,
      { useVision, crossValidate, includeSchedules }
    );

    // Calculate summary statistics
    const summary = {
      totalItems: items.length,
      autoApproved: items.filter(i => i.verificationStatus === 'auto_approved').length,
      needsReview: items.filter(i => i.verificationStatus === 'needs_review').length,
      lowConfidence: items.filter(i => i.verificationStatus === 'low_confidence').length,
      rejected: items.filter(i => i.verificationStatus === 'rejected').length,
      averageConfidence: items.length > 0
        ? Math.round(items.reduce((sum, i) => sum + i.confidence, 0) / items.length)
        : 0,
      categories: [...new Set(items.map(i => i.category))],
    };

    // Save to database if requested
    let takeoffId: string | null = null;
    if (saveToDatabase && items.length > 0) {
      takeoffId = await saveEnhancedTakeoff(
        project.id,
        documentId,
        user.id,
        items,
        name
      );
    }

    return NextResponse.json({
      success: true,
      takeoffId,
      summary,
      items: items.map(item => ({
        ...item,
        // Include confidence breakdown details
        confidenceFactors: item.confidenceBreakdown.factors,
        warnings: item.confidenceBreakdown.warnings,
        suggestions: item.confidenceBreakdown.suggestions,
      })),
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[ENHANCED-TAKEOFF-API] Error', errorMessage);
    return NextResponse.json(
      { error: 'Failed to extract takeoffs', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[slug]/takeoffs/enhanced
 * Get takeoff items with confidence breakdown
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { params } = context;
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const takeoffId = searchParams.get('takeoffId');
    const status = searchParams.get('status'); // Filter by verification status
    const minConfidence = searchParams.get('minConfidence');
    const maxConfidence = searchParams.get('maxConfidence');

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {};

    if (takeoffId) {
      whereClause.takeoffId = takeoffId;
    } else {
      // Get all takeoffs for project
      const takeoffs = await prisma.materialTakeoff.findMany({
        where: { projectId: project.id },
        select: { id: true },
      });
      whereClause.takeoffId = { in: takeoffs.map((t: { id: string }) => t.id) };
    }

    if (status) {
      whereClause.verificationStatus = status;
    }

    if (minConfidence) {
      whereClause.confidence = {
        ...(whereClause.confidence as Record<string, number> || {}),
        gte: parseFloat(minConfidence),
      };
    }

    if (maxConfidence) {
      whereClause.confidence = {
        ...(whereClause.confidence as Record<string, number> || {}),
        lte: parseFloat(maxConfidence),
      };
    }

    // Get line items
    const items = await prisma.takeoffLineItem.findMany({
      where: whereClause,
      orderBy: [
        { verificationStatus: 'asc' },
        { confidence: 'asc' },
      ],
      include: {
        MaterialTakeoff: {
          select: {
            id: true,
            name: true,
            Document: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Calculate statistics
    type TakeoffItem = typeof items[0];
    const stats = {
      total: items.length,
      byStatus: {
        auto_approved: items.filter((i: TakeoffItem) => i.verificationStatus === 'auto_approved').length,
        needs_review: items.filter((i: TakeoffItem) => i.verificationStatus === 'needs_review').length,
        low_confidence: items.filter((i: TakeoffItem) => i.verificationStatus === 'low_confidence').length,
        rejected: items.filter((i: TakeoffItem) => i.verificationStatus === 'rejected').length,
      },
      averageConfidence: items.length > 0
        ? Math.round(items.reduce((sum: number, i: TakeoffItem) => sum + (i.confidence || 0), 0) / items.length)
        : 0,
      confidenceDistribution: {
        high: items.filter((i: TakeoffItem) => (i.confidence || 0) >= 90).length,
        medium: items.filter((i: TakeoffItem) => (i.confidence || 0) >= 70 && (i.confidence || 0) < 90).length,
        low: items.filter((i: TakeoffItem) => (i.confidence || 0) >= 50 && (i.confidence || 0) < 70).length,
        veryLow: items.filter((i: TakeoffItem) => (i.confidence || 0) < 50).length,
      },
    };

    return NextResponse.json({
      items: items.map((item: TakeoffItem) => ({
        ...item,
        confidenceBreakdown: item.confidenceBreakdown as object,
        sources: item.sources as object[],
      })),
      stats,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[ENHANCED-TAKEOFF-API] Error', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch takeoffs', details: errorMessage },
      { status: 500 }
    );
  }
}
