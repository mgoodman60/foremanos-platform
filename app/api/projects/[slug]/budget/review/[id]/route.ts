/**
 * Update individual Labor/Material Entry API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_REVIEW');

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;
    const body = await request.json();
    const { type, updates } = body;

    if (!type || !updates) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let updated: any = null;

    if (type === 'labor') {
      // Verify entry belongs to project
      const entry = await prisma.laborEntry.findFirst({
        where: { id, projectId: project.id },
      });

      if (!entry) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }

      updated = await prisma.laborEntry.update({
        where: { id },
        data: {
          workerName: updates.workerName,
          hoursWorked: updates.hoursWorked,
          hourlyRate: updates.hourlyRate,
          totalCost: updates.totalCost,
          description: updates.description,
          budgetItemId: updates.budgetItemId,
        },
      });
    } else if (type === 'material') {
      // Verify entry belongs to project
      const entry = await prisma.procurement.findFirst({
        where: { id, projectId: project.id },
      });

      if (!entry) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }

      updated = await prisma.procurement.update({
        where: { id },
        data: {
          description: updates.description,
          quantity: updates.quantity,
          unit: updates.unit,
          actualCost: updates.actualCost,
          budgetItemId: updates.budgetItemId,
        },
      });
    }

    logger.info('Updated ${type} entry ${id}');

    return NextResponse.json({
      success: true,
      entry: updated,
    });
  } catch (error) {
    logger.error('Update error', error);
    return NextResponse.json(
      { error: 'Failed to update entry' },
      { status: 500 }
    );
  }
}
