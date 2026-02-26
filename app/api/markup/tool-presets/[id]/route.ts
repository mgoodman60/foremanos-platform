import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(session.user.email, RATE_LIMITS.API);
    if (!rateLimitCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const userId = session.user.id;

    const params = await context.params;
    const preset = await prisma.markupToolPreset.findFirst({
      where: { id: params.id, userId },
    });

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.shapeType !== undefined) updateData.shapeType = body.shapeType;
    if (body.style !== undefined) {
      updateData.style = body.style as Record<string, string | number | boolean | string[] | null>;
    }

    const updatedPreset = await prisma.markupToolPreset.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ preset: updatedPreset });
  } catch (error) {
    logger.error('TOOL_PRESET_PATCH', 'Failed to update tool preset', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(session.user.email, RATE_LIMITS.API);
    if (!rateLimitCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const userId = session.user.id;

    const params = await context.params;
    const preset = await prisma.markupToolPreset.findFirst({
      where: { id: params.id, userId },
    });

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    await prisma.markupToolPreset.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('TOOL_PRESET_DELETE', 'Failed to delete tool preset', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
