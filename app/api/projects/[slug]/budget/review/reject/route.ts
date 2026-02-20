/**
 * Reject Labor/Material Entries API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { type, ids, reason: _reason } = body;

    if (!type || !ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let updatedCount = 0;

    if (type === 'labor') {
      // Reject labor entries
      const result = await prisma.laborEntry.updateMany({
        where: {
          id: { in: ids },
          projectId: project.id,
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
        },
      });
      updatedCount = result.count;
    } else if (type === 'material') {
      // Reject/cancel material entries
      const result = await prisma.procurement.updateMany({
        where: {
          id: { in: ids },
          projectId: project.id,
          status: { in: ['IDENTIFIED', 'SPEC_REVIEW', 'BIDDING', 'AWARDED', 'ORDERED', 'IN_TRANSIT'] },
        },
        data: {
          status: 'CANCELLED',
        },
      });
      updatedCount = result.count;
    }

    console.log(`[BudgetReview] Rejected ${updatedCount} ${type} entries`);

    return NextResponse.json({
      success: true,
      updatedCount,
    });
  } catch (error) {
    console.error('[BudgetReview] Reject error:', error);
    return NextResponse.json(
      { error: 'Failed to reject entries' },
      { status: 500 }
    );
  }
}
