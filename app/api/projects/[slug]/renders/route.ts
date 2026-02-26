/**
 * Project Renders API
 * List and create architectural visualization renders for a project.
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
import { assembleRenderPrompt } from '@/lib/render-prompt-assembler';
import crypto from 'crypto';

const log = createScopedLogger('RENDER_API');

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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const viewType = searchParams.get('viewType');
    const style = searchParams.get('style');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { projectId: project.id };
    if (viewType) where.viewType = viewType;
    if (style) where.style = style;
    if (status) where.status = status;

    const [renders, total] = await Promise.all([
      prisma.projectRender.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          Room: { select: { id: true, name: true } },
          User: { select: { id: true, username: true } },
        },
      }),
      prisma.projectRender.count({ where }),
    ]);

    return NextResponse.json({ renders, total, page, limit });
  } catch (error) {
    log.error('Failed to list renders', error as Error);
    return NextResponse.json(
      { error: 'Failed to list renders' },
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

    // Rate limiting
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
    const {
      viewType,
      style,
      cameraAngle,
      qualityTier,
      userNotes,
      roomId,
      referencePhotoKeys,
      userOverrides,
      saveToProject,
    } = body;

    if (!viewType || !style) {
      return NextResponse.json(
        { error: 'viewType and style are required' },
        { status: 400 }
      );
    }

    // Assemble the prompt
    const assembled = await assembleRenderPrompt({
      projectId: project.id,
      viewType,
      style,
      cameraAngle,
      roomId,
      userNotes,
      userOverrides,
    });

    const promptHash = crypto
      .createHash('sha256')
      .update(assembled.prompt)
      .digest('hex');

    // If saveToProject is true, update project design-intent fields
    if (saveToProject && userOverrides) {
      const projectUpdate: Record<string, unknown> = {};
      if (userOverrides.architecturalStyle) projectUpdate.architecturalStyle = userOverrides.architecturalStyle;
      if (userOverrides.buildingUse) projectUpdate.buildingUse = userOverrides.buildingUse;
      if (userOverrides.roofType) projectUpdate.roofType = userOverrides.roofType;
      if (userOverrides.roofMaterial) projectUpdate.roofMaterial = userOverrides.roofMaterial;
      if (userOverrides.landscapingNotes) projectUpdate.landscapingNotes = userOverrides.landscapingNotes;
      if (userOverrides.siteContext) projectUpdate.siteContext = userOverrides.siteContext;

      if (Object.keys(projectUpdate).length > 0) {
        await prisma.project.update({
          where: { id: project.id },
          data: projectUpdate,
        });
      }
    }

    const render = await prisma.projectRender.create({
      data: {
        projectId: project.id,
        createdBy: session.user.id,
        viewType,
        style,
        cameraAngle: cameraAngle || null,
        qualityTier: qualityTier || 'high',
        assembledPrompt: assembled.prompt,
        promptHash,
        userNotes: userNotes || null,
        dataSnapshot: assembled.dataSnapshot as any,
        referencePhotoKeys: referencePhotoKeys || [],
        roomId: roomId || null,
        status: 'pending',
      },
    });

    log.info('Render created', { renderId: render.id, viewType, style });

    return NextResponse.json({ render });
  } catch (error) {
    log.error('Failed to create render', error as Error);
    return NextResponse.json(
      { error: 'Failed to create render' },
      { status: 500 }
    );
  }
}
