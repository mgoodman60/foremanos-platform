/**
 * 3-Week Lookahead API
 * GET - Generate lookahead from master schedule
 * POST - Sync lookahead changes back to schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  generateLookahead,
  suggestWeatherAdjustments,
  syncLookaheadToSchedule,
} from '@/lib/lookahead-service';

export async function GET(
  req: NextRequest,
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

    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const includeAdjustments = searchParams.get('includeAdjustments') === 'true';

    const startDate = startDateStr ? new Date(startDateStr) : new Date();

    // Generate lookahead
    const lookahead = await generateLookahead(project.id, startDate);

    // Optionally include weather adjustment suggestions
    let weatherAdjustments = null;
    if (includeAdjustments) {
      weatherAdjustments = await suggestWeatherAdjustments(project.id, lookahead);
    }

    return NextResponse.json({
      ...lookahead,
      weatherAdjustments,
    });
  } catch (error) {
    console.error('Lookahead generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate lookahead' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
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
    console.error('Lookahead sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync lookahead' },
      { status: 500 }
    );
  }
}
