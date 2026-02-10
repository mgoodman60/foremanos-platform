import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { calculateProjectHealth, saveHealthSnapshot, getHealthHistory } from '@/lib/project-health-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';
    const historyDays = parseInt(searchParams.get('days') || '30');

    const health = await calculateProjectHealth(project.id);
    
    let history = null;
    if (includeHistory) {
      history = await getHealthHistory(project.id, historyDays);
    }

    return NextResponse.json({
      health,
      history,
    });
  } catch (error) {
    logger.error('HEALTH_API', 'Failed to calculate health score', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to calculate health score' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Save a health snapshot
    await saveHealthSnapshot(project.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('HEALTH_API', 'Failed to save health snapshot', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to save health snapshot' },
      { status: 500 }
    );
  }
}
