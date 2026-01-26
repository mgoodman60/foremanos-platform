import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  getAggregation,
  deleteAggregation,
  updateAggregationStatus,
  enhanceAggregationWithAI,
  exportAggregationToCSV
} from '@/lib/takeoff-aggregation-service';

/**
 * GET /api/projects/[slug]/takeoffs/aggregations/[id]
 * Get a specific aggregation with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    const aggregation = await getAggregation(id);

    if (!aggregation) {
      return NextResponse.json({ error: 'Aggregation not found' }, { status: 404 });
    }

    // Export as CSV if requested
    if (format === 'csv') {
      const csv = exportAggregationToCSV(aggregation);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${aggregation.name.replace(/[^a-z0-9]/gi, '_')}_takeoff.csv"`
        }
      });
    }

    return NextResponse.json({ aggregation });
  } catch (error: unknown) {
    console.error('Error fetching aggregation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aggregation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[slug]/takeoffs/aggregations/[id]
 * Update aggregation (status, enhance with AI, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { action, status } = body;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Handle different actions
    if (action === 'enhance') {
      // AI enhancement
      const result = await enhanceAggregationWithAI(id);
      return NextResponse.json({
        message: 'AI enhancement complete',
        ...result
      });
    }

    if (action === 'finalize') {
      const updated = await updateAggregationStatus(id, 'finalized');
      return NextResponse.json({ aggregation: updated });
    }

    if (action === 'approve') {
      const updated = await updateAggregationStatus(id, 'approved', user.id);
      return NextResponse.json({ aggregation: updated });
    }

    if (status) {
      const updated = await updateAggregationStatus(id, status, user.id);
      return NextResponse.json({ aggregation: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error updating aggregation:', error);
    return NextResponse.json(
      { error: 'Failed to update aggregation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[slug]/takeoffs/aggregations/[id]
 * Delete an aggregation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    await deleteAggregation(id);

    return NextResponse.json({ message: 'Aggregation deleted' });
  } catch (error: unknown) {
    console.error('Error deleting aggregation:', error);
    return NextResponse.json(
      { error: 'Failed to delete aggregation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
