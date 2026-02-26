import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_COST_ALERTS');

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where: Record<string, unknown> = {
      projectId: project.id,
      isDismissed: false
    };
    if (unreadOnly) {
      where.isRead = false;
    }

    const alerts = await prisma.costAlert.findMany({
      where,
      include: {
        BudgetItem: {
          select: { name: true, costCode: true }
        }
      },
      orderBy: { triggeredAt: 'desc' }
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    logger.error('Error fetching cost alerts', error);
    return NextResponse.json({ error: 'Failed to fetch cost alerts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const { alertType, severity, title, message, threshold, currentValue, budgetItemId } = body;

    const alert = await prisma.costAlert.create({
      data: {
        projectId: project.id,
        alertType,
        severity: severity || 'WARNING',
        title,
        message,
        threshold: threshold ? parseFloat(threshold) : null,
        currentValue: currentValue ? parseFloat(currentValue) : null,
        budgetItemId: budgetItemId || null
      }
    });

    return NextResponse.json(alert);
  } catch (error) {
    logger.error('Error creating cost alert', error);
    return NextResponse.json({ error: 'Failed to create cost alert' }, { status: 500 });
  }
}
