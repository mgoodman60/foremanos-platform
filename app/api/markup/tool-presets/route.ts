import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function GET(_request: Request) {
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

    const presets = await prisma.markupToolPreset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ presets });
  } catch (error) {
    logger.error('TOOL_PRESETS_GET', 'Failed to fetch tool presets', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { name, shapeType, style } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!shapeType || typeof shapeType !== 'string') {
      return NextResponse.json({ error: 'shapeType is required' }, { status: 400 });
    }

    if (!style || typeof style !== 'object') {
      return NextResponse.json({ error: 'Style is required' }, { status: 400 });
    }

    const existing = await prisma.markupToolPreset.findFirst({
      where: { userId, name: name.trim() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Preset with this name already exists' }, { status: 409 });
    }

    const preset = await prisma.markupToolPreset.create({
      data: {
        User: { connect: { id: userId } },
        name: name.trim(),
        shapeType,
        style: style as Record<string, string | number | boolean | string[] | null>,
      },
    });

    return NextResponse.json({ preset }, { status: 201 });
  } catch (error) {
    logger.error('TOOL_PRESETS_POST', 'Failed to create tool preset', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
