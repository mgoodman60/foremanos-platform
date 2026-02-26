import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectBudget: {
          include: {
            BudgetItem: {
              orderBy: {
                name: 'asc',
              },
            },
            EarnedValue: {
              orderBy: {
                periodDate: 'desc',
              },
              take: 30, // Last 30 records
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ budget: project.ProjectBudget });
  } catch (error) {
    logger.error('Error fetching budget', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();

    // Validate required fields
    if (!body.totalBudget || body.totalBudget <= 0) {
      return NextResponse.json(
        { error: 'Total budget is required and must be greater than 0' },
        { status: 400 }
      );
    }

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectBudget: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if budget already exists
    if (project.ProjectBudget) {
      return NextResponse.json(
        { error: 'Budget already exists for this project. Use PUT to update.' },
        { status: 409 }
      );
    }

    // Check permissions
    const user = session.user as any;
    const canEdit = project.ownerId === user.id || user.role === 'admin';

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Only project owners and admins can create budgets' },
        { status: 403 }
      );
    }

    // Create budget
    const budget = await prisma.projectBudget.create({
      data: {
        projectId: project.id,
        totalBudget: body.totalBudget,
        contingency: body.contingency || 0,
        baselineDate: body.baselineDate ? new Date(body.baselineDate) : new Date(),
        currency: body.currency || 'USD',
      },
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error creating budget', error);
    return NextResponse.json(
      { error: 'Failed to create budget' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectBudget: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.ProjectBudget) {
      return NextResponse.json(
        { error: 'Budget not found. Use POST to create.' },
        { status: 404 }
      );
    }

    // Check permissions
    const user = session.user as any;
    const canEdit = project.ownerId === user.id || user.role === 'admin';

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Only project owners and admins can update budgets' },
        { status: 403 }
      );
    }

    // Update budget
    const budget = await prisma.projectBudget.update({
      where: { id: project.ProjectBudget.id },
      data: {
        totalBudget: body.totalBudget,
        contingency: body.contingency,
        actualCost: body.actualCost,
        committedCost: body.committedCost,
        lastUpdated: new Date(),
      },
      include: {
        BudgetItem: true,
        EarnedValue: {
          orderBy: {
            periodDate: 'desc',
          },
          take: 30,
        },
      },
    });

    return NextResponse.json({ budget });
  } catch (error: unknown) {
    logger.error('Error updating budget', error);
    return NextResponse.json(
      { error: 'Failed to update budget' },
      { status: 500 }
    );
  }
}
