/**
 * Budget Review API
 * Fetches labor and material entries pending review
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_REVIEW');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get labor entries by status
    const laborPending = await prisma.laborEntry.findMany({
      where: {
        projectId: project.id,
        status: 'PENDING',
      },
      include: {
        BudgetItem: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const laborApproved = await prisma.laborEntry.findMany({
      where: {
        projectId: project.id,
        status: 'APPROVED',
      },
      include: {
        BudgetItem: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 50, // Limit approved entries
    });

    const laborRejected = await prisma.laborEntry.findMany({
      where: {
        projectId: project.id,
        status: 'REJECTED',
      },
      include: {
        BudgetItem: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 20,
    });

    // Get procurement/materials by status
    const materialsPending = await prisma.procurement.findMany({
      where: {
        projectId: project.id,
        status: { in: ['IDENTIFIED', 'SPEC_REVIEW', 'BIDDING', 'AWARDED', 'ORDERED', 'IN_TRANSIT'] },
      },
      include: {
        budgetItem: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const materialsReceived = await prisma.procurement.findMany({
      where: {
        projectId: project.id,
        status: 'RECEIVED',
      },
      include: {
        budgetItem: { select: { id: true, name: true } },
      },
      orderBy: { actualDelivery: 'desc' },
      take: 50,
    });

    // Get budget items for linking
    const budget = await prisma.projectBudget.findUnique({
      where: { projectId: project.id },
      include: {
        BudgetItem: {
          where: { isActive: true },
          select: { id: true, name: true, tradeType: true, phaseName: true },
          orderBy: { phaseCode: 'asc' },
        },
      },
    });

    const budgetItems = budget?.BudgetItem || [];

    // Map labor entries to response format
    const mapLabor = (entries: any[]) => entries.map(e => ({
      id: e.id,
      workerName: e.workerName,
      tradeType: e.tradeType,
      date: e.date.toISOString(),
      hoursWorked: e.hoursWorked,
      hourlyRate: e.hourlyRate,
      totalCost: e.totalCost,
      description: e.description,
      status: e.status,
      budgetItem: e.BudgetItem ? { id: e.BudgetItem.id, name: e.BudgetItem.name } : null,
      budgetItemId: e.budgetItemId,
    }));

    // Map material entries to response format
    const mapMaterials = (entries: any[]) => entries.map(e => ({
      id: e.id,
      procurementNumber: e.procurementNumber,
      description: e.description,
      itemType: e.itemType,
      vendorName: e.vendorName,
      quantity: e.quantity,
      unit: e.unit,
      actualCost: e.actualCost,
      actualDelivery: e.actualDelivery?.toISOString() || null,
      status: e.status,
      budgetItem: e.budgetItem ? { id: e.budgetItem.id, name: e.budgetItem.name } : null,
      budgetItemId: e.budgetItemId,
    }));

    return NextResponse.json({
      laborPending: mapLabor(laborPending),
      laborApproved: mapLabor(laborApproved),
      laborRejected: mapLabor(laborRejected),
      materialsPending: mapMaterials(materialsPending),
      materialsReceived: mapMaterials(materialsReceived),
      budgetItems,
    });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch review data' },
      { status: 500 }
    );
  }
}
