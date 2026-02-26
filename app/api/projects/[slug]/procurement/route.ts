import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createProcurement, getProcurementDashboard } from '@/lib/cash-flow-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PROCUREMENT');

// GET /api/projects/[slug]/procurement
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const dashboard = await getProcurementDashboard(project.id);

    return NextResponse.json(dashboard);
  } catch (error) {
    logger.error('Procurement error', error);
    return NextResponse.json({ error: 'Failed to fetch procurement data' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/procurement
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const procurement = await createProcurement(project.id, body, session.user.id);

    return NextResponse.json(procurement);
  } catch (error) {
    logger.error('Create procurement error', error);
    return NextResponse.json({ error: 'Failed to create procurement item' }, { status: 500 });
  }
}
