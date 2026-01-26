import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  getAvailableSheets,
  aggregateTakeoffs,
  listAggregations,
  exportAggregationToCSV
} from '@/lib/takeoff-aggregation-service';

/**
 * GET /api/projects/[slug]/takeoffs/aggregations
 * List all aggregations for a project or get available sheets
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: true
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify access
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: { userId: string }) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Return available sheets if requested
    if (action === 'available-sheets' || action === 'available') {
      const { sheets, takeoffs } = await getAvailableSheets(project.id);
      return NextResponse.json({ sheets, takeoffs });
    }

    // List all aggregations
    const aggregations = await listAggregations(project.id);

    return NextResponse.json({
      aggregations: aggregations.map((agg: {
        id: string;
        name: string;
        description: string | null;
        status: string;
        sourceSheets: unknown;
        sourceTakeoffs: unknown;
        totalItems: number;
        totalCost: number | null;
        duplicatesMerged: number;
        createdAt: Date;
        User: { id: string; username: string };
      }) => ({
        id: agg.id,
        name: agg.name,
        description: agg.description,
        status: agg.status,
        sourceSheets: agg.sourceSheets,
        sourceTakeoffs: agg.sourceTakeoffs,
        totalItems: agg.totalItems,
        totalCost: agg.totalCost,
        duplicatesMerged: agg.duplicatesMerged,
        createdAt: agg.createdAt,
        creator: agg.User
      }))
    });
  } catch (error: unknown) {
    console.error('Error in aggregations GET:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aggregations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[slug]/takeoffs/aggregations
 * Create a new aggregation from multiple sheets/takeoffs
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
      name,
      description,
      sheetNumbers,
      takeoffIds,
      mergeStrategy = 'smart',
      includeUnverified = false
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: true
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify access
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: { userId: string }) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Create aggregation
    const result = await aggregateTakeoffs(project.id, user.id, {
      name,
      description,
      sheetNumbers,
      takeoffIds,
      mergeStrategy,
      includeUnverified
    });

    return NextResponse.json({ aggregation: result }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating aggregation:', error);
    return NextResponse.json(
      { error: 'Failed to create aggregation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
