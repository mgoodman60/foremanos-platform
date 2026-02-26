/**
 * 3-Week Lookahead API
 * GET - Generate lookahead from master schedule
 * POST - Sync lookahead changes back to schedule
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  generateLookahead,
  suggestWeatherAdjustments,
  syncLookaheadToSchedule,
} from '@/lib/lookahead-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_LOOKAHEAD');

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
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

    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const includeAdjustments = searchParams.get('includeAdjustments') === 'true';

    const startDate = startDateStr ? new Date(startDateStr) : new Date();

    // Generate lookahead
    const lookahead = await generateLookahead(project.id, startDate);

    // Optionally include weather adjustment suggestions
    let weatherAdjustments: Awaited<ReturnType<typeof suggestWeatherAdjustments>> | null = null;
    if (includeAdjustments) {
      weatherAdjustments = await suggestWeatherAdjustments(project.id, lookahead);
    }

    return NextResponse.json({
      ...lookahead,
      weatherAdjustments,
    });
  } catch (error) {
    logger.error('Lookahead generation error', error);
    return NextResponse.json(
      { error: 'Failed to generate lookahead' },
      { status: 500 }
    );
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
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const { tasks } = body;

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'tasks array required' }, { status: 400 });
    }

    // Sync lookahead to master schedule
    const result = await syncLookaheadToSchedule(project.id, tasks);

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'SYNC',
        resource: 'lookahead',
        resourceId: project.id,
        userId: session.user.id,
        details: {
          synced: result.synced,
          created: result.created,
          errors: result.errors.length,
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Lookahead sync error', error);
    return NextResponse.json(
      { error: 'Failed to sync lookahead' },
      { status: 500 }
    );
  }
}
