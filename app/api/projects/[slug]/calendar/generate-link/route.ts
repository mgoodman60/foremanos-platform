/**
 * Calendar Generate Link API
 * POST /api/projects/[slug]/calendar/generate-link
 * Generates a signed share URL for calendar feeds.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS, getClientIp, getRateLimitIdentifier } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { generateCalendarToken } from '@/lib/calendar-share-token';

const VALID_CALENDAR_TYPES = ['milestones', 'schedule', 'critical-path', 'deadlines', 'all', 'combined'];

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limit
    const rateLimitId = getRateLimitIdentifier(session.user.id, getClientIp(request));
    const rateLimitResult = await checkRateLimit(rateLimitId, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 3. Project membership check
    const project = await prisma.project.findFirst({
      where: {
        slug: params.slug,
        OR: [
          { ownerId: session.user.id },
          { ProjectMember: { some: { userId: session.user.id } } }
        ]
      },
      select: { id: true, name: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 4. Parse body
    let body: { calendarType?: string; expiresInDays?: number };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { calendarType = 'all', expiresInDays = 365 } = body;

    // 5. Validate calendarType
    if (!VALID_CALENDAR_TYPES.includes(calendarType)) {
      return NextResponse.json({ error: 'Invalid calendar type' }, { status: 400 });
    }

    // 6. Validate expiresInDays
    const days = Math.min(Math.max(Math.floor(expiresInDays), 1), 730);

    // 7. Generate token and URL
    const token = generateCalendarToken(project.id, calendarType, days);
    const baseUrl = process.env.NEXTAUTH_URL || 'https://foremanos.vercel.app';
    const shareUrl = `${baseUrl}/api/projects/${params.slug}/calendar/${calendarType}?token=${token}`;

    logger.info('CALENDAR_API', 'Generated calendar share link', {
      projectId: project.id,
      calendarType,
      expiresInDays: days,
    });

    return NextResponse.json({ url: shareUrl, expiresInDays: days });
  } catch (error) {
    logger.error('CALENDAR_API', 'Failed to generate calendar link', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to generate calendar link' },
      { status: 500 }
    );
  }
}
