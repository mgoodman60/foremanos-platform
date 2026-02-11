/**
 * Calendar Export API Route - iCal feeds
 * GET /api/projects/[slug]/calendar/[type]
 * Requires a signed share token (?token=...) for access.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS, getClientIp, getRateLimitIdentifier } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { verifyCalendarToken } from '@/lib/calendar-share-token';
import {
  exportMilestonesAsICal,
  exportScheduleAsICal,
  exportDeadlinesAsICal,
  exportProjectCalendar
} from '@/lib/calendar-export';

export async function GET(
  request: Request,
  { params }: { params: { slug: string; type: string } }
) {
  try {
    // 1. Rate limit by IP (unauthenticated endpoint)
    const ip = getClientIp(request);
    const rateLimitId = getRateLimitIdentifier(null, ip);
    const rateLimitResult = await checkRateLimit(rateLimitId, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 2. Require and verify token
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Calendar token required' }, { status: 401 });
    }

    let tokenPayload: { projectId: string; calendarType: string; expiresAt: Date };
    try {
      tokenPayload = verifyCalendarToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired calendar token' }, { status: 401 });
    }

    // 3. Verify project exists by slug
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true, name: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 4. Verify token projectId matches
    if (tokenPayload.projectId !== project.id) {
      return NextResponse.json({ error: 'Invalid or expired calendar token' }, { status: 401 });
    }

    // 5. Generate iCal feed
    const calendarType = params.type.replace('.ics', '');

    let icalContent: string;
    let filename: string;

    switch (calendarType) {
      case 'milestones':
        icalContent = await exportMilestonesAsICal(project.id);
        filename = `${project.name}-milestones.ics`;
        break;

      case 'schedule':
        icalContent = await exportScheduleAsICal(project.id, false);
        filename = `${project.name}-schedule.ics`;
        break;

      case 'critical-path':
        icalContent = await exportScheduleAsICal(project.id, true);
        filename = `${project.name}-critical-path.ics`;
        break;

      case 'deadlines':
        icalContent = await exportDeadlinesAsICal(project.id);
        filename = `${project.name}-deadlines.ics`;
        break;

      case 'all':
      case 'combined':
        icalContent = await exportProjectCalendar(project.id);
        filename = `${project.name}-calendar.ics`;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid calendar type. Options: milestones, schedule, critical-path, deadlines, all' },
          { status: 400 }
        );
    }

    return new NextResponse(icalContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    logger.error('CALENDAR_API', 'Failed to generate calendar', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to generate calendar' },
      { status: 500 }
    );
  }
}
