/**
 * Approve Labor/Material Entries API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_REVIEW_APPROVE');

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
    const { type, ids } = body;

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
      // Approve labor entries
      const result = await prisma.laborEntry.updateMany({
        where: {
          id: { in: ids },
          projectId: project.id,
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED',
          approvedBy: session.user.id,
        },
      });
      updatedCount = result.count;

      // Update budget items with approved labor costs
      const approvedEntries = await prisma.laborEntry.findMany({
        where: {
          id: { in: ids },
          budgetItemId: { not: null },
        },
      });

      for (const entry of approvedEntries) {
        if (entry.budgetItemId) {
          await prisma.budgetItem.update({
            where: { id: entry.budgetItemId },
            data: {
              actualHours: { increment: entry.hoursWorked },
              actualCost: { increment: entry.totalCost },
            },
          });
        }
      }
    } else if (type === 'material') {
      // Approve material/procurement entries
      const result = await prisma.procurement.updateMany({
        where: {
          id: { in: ids },
          projectId: project.id,
          status: { in: ['IDENTIFIED', 'SPEC_REVIEW', 'BIDDING', 'AWARDED', 'ORDERED', 'IN_TRANSIT'] },
        },
        data: {
          status: 'RECEIVED',
          actualDelivery: new Date(),
        },
      });
      updatedCount = result.count;

      // Update budget items with received material costs
      const approvedMaterials = await prisma.procurement.findMany({
        where: {
          id: { in: ids },
          budgetItemId: { not: null },
        },
      });

      for (const material of approvedMaterials) {
        if (material.budgetItemId && material.actualCost) {
          await prisma.budgetItem.update({
            where: { id: material.budgetItemId },
            data: {
              actualCost: { increment: material.actualCost },
            },
          });
        }
      }
    }

    logger.info('Approved ${updatedCount} ${type} entries');

    return NextResponse.json({
      success: true,
      updatedCount,
    });
  } catch (error) {
    logger.error('Approve error', error);
    return NextResponse.json(
      { error: 'Failed to approve entries' },
      { status: 500 }
    );
  }
}
