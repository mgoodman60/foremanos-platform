/**
 * Project Presentation Boards API
 * List and create presentation boards for a project.
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitIdentifier,
  createRateLimitHeaders,
} from '@/lib/rate-limiter';

const log = createScopedLogger('PRESENTATION_API');

const VALID_TEMPLATE_IDS = [
  'hero_sign',
  'portfolio_sheet',
  'before_after',
  'presentation_cover',
];

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        ownerId: true,
        ProjectMember: { select: { userId: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.some(
      (m: { userId: string }) => m.userId === session.user.id
    );
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const boards = await prisma.presentationBoard.findMany({
      where: { projectId: project.id },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ boards, total: boards.length });
  } catch (error) {
    log.error('Failed to list presentation boards', error as Error);
    return NextResponse.json(
      { error: 'Failed to list presentation boards' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(
      getRateLimitIdentifier(session.user.id, null),
      RATE_LIMITS.RENDER
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        ownerId: true,
        ProjectMember: { select: { userId: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.some(
      (m: { userId: string }) => m.userId === session.user.id
    );
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { title, templateId } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    if (!templateId || !VALID_TEMPLATE_IDS.includes(templateId)) {
      return NextResponse.json(
        { error: 'Invalid templateId. Must be one of: ' + VALID_TEMPLATE_IDS.join(', ') },
        { status: 400 }
      );
    }

    const board = await prisma.presentationBoard.create({
      data: {
        projectId: project.id,
        createdBy: session.user.id,
        title,
        templateId,
        projectName: body.projectName || null,
        companyName: body.companyName || null,
        tagline: body.tagline || null,
        contactInfo: body.contactInfo || null,
        dateText: body.dateText || null,
        primaryColor: body.primaryColor || undefined,
        accentColor: body.accentColor || undefined,
        renderIds: body.renderIds || [],
        sitePhotoKey: body.sitePhotoKey || null,
      },
    });

    log.info('Presentation board created', { boardId: board.id, templateId });

    return NextResponse.json({ board }, { status: 201 });
  } catch (error) {
    log.error('Failed to create presentation board', error as Error);
    return NextResponse.json(
      { error: 'Failed to create presentation board' },
      { status: 500 }
    );
  }
}
