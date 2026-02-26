/**
 * Render Generation API
 * Triggers image generation for a pending render.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitIdentifier,
  createRateLimitHeaders,
} from '@/lib/rate-limiter';
import { generateImage } from '@/lib/render-provider';
import { uploadFile } from '@/lib/s3';
import type { RenderQualityTier } from '@/lib/render-provider';

const log = createScopedLogger('RENDER_API');

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
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

    const render = await prisma.projectRender.findUnique({
      where: { id: params.id },
    });

    if (!render || render.projectId !== project.id) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 });
    }

    // Double-click prevention
    if (render.status === 'generating') {
      return NextResponse.json(
        { error: 'Generation already in progress' },
        { status: 409 }
      );
    }

    // Parse request body for force flag
    let force = false;
    try {
      const body = await request.json();
      force = body.force === true;
    } catch {
      // No body or invalid JSON — that's fine
    }

    // Dedup check
    if (render.promptHash) {
      const duplicate = await prisma.projectRender.findFirst({
        where: {
          projectId: project.id,
          promptHash: render.promptHash,
          status: 'completed',
          id: { not: render.id },
        },
        select: { id: true },
      });

      if (duplicate && !force) {
        return NextResponse.json({
          warning: 'duplicate',
          existingRenderId: duplicate.id,
        });
      }
    }

    // Update status to generating
    await prisma.projectRender.update({
      where: { id: render.id },
      data: { status: 'generating' },
    });

    log.info('Starting image generation', {
      renderId: render.id,
      qualityTier: render.qualityTier,
    });

    const result = await generateImage({
      prompt: render.assembledPrompt,
      qualityTier: render.qualityTier as RenderQualityTier,
    });

    if (result.success && result.imageBase64) {
      const imageBuffer = Buffer.from(result.imageBase64, 'base64');
      const imageKey = `renders/${project.id}/${render.id}.png`;

      // Upload to R2
      await uploadFile(imageBuffer, `${render.id}.png`);

      // Attempt thumbnail generation
      let thumbnailKey: string | undefined;
      try {
        const sharp = (await import('sharp')).default;
        const thumbBuffer = await sharp(imageBuffer)
          .resize(400)
          .png()
          .toBuffer();
        thumbnailKey = `renders/${project.id}/${render.id}-thumb.png`;
        await uploadFile(thumbBuffer, `${render.id}-thumb.png`);
      } catch {
        log.info('Thumbnail generation skipped (sharp not available)');
      }

      // Parse dimensions from generated image
      let imageWidth: number | undefined;
      let imageHeight: number | undefined;
      try {
        const sharp = (await import('sharp')).default;
        const metadata = await sharp(imageBuffer).metadata();
        imageWidth = metadata.width;
        imageHeight = metadata.height;
      } catch {
        // sharp not available — skip dimension detection
      }

      const updated = await prisma.projectRender.update({
        where: { id: render.id },
        data: {
          status: 'completed',
          imageKey,
          thumbnailKey: thumbnailKey || null,
          provider: result.provider,
          generationTimeMs: result.durationMs,
          estimatedCostUsd: result.estimatedCostUsd,
          revisedPrompt: result.revisedPrompt || null,
          imageWidth: imageWidth || null,
          imageHeight: imageHeight || null,
          fileSizeBytes: imageBuffer.length,
        },
      });

      log.info('Render completed', {
        renderId: render.id,
        provider: result.provider,
        durationMs: result.durationMs,
      });

      return NextResponse.json({ render: updated });
    } else {
      // Generation failed
      const updated = await prisma.projectRender.update({
        where: { id: render.id },
        data: {
          status: 'failed',
          errorMessage: result.error || 'Unknown generation error',
          retryCount: { increment: 1 },
        },
      });

      log.warn('Render generation failed', {
        renderId: render.id,
        error: result.error,
        errorCode: result.errorCode,
      });

      return NextResponse.json({ render: updated }, { status: 502 });
    }
  } catch (error) {
    log.error('Failed to generate render', error as Error);

    // Attempt to reset status on unexpected error
    try {
      await prisma.projectRender.update({
        where: { id: params.id },
        data: {
          status: 'failed',
          errorMessage: (error as Error).message || 'Unexpected error',
          retryCount: { increment: 1 },
        },
      });
    } catch {
      // Best effort
    }

    return NextResponse.json(
      { error: 'Failed to generate render' },
      { status: 500 }
    );
  }
}
