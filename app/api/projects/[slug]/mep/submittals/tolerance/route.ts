import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getToleranceSettings, saveToleranceSettings } from '@/lib/tolerance-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS_TOLERANCE');

/**
 * GET: Retrieve tolerance settings for a project
 */
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const settings = await getToleranceSettings(project.id);

    return NextResponse.json(settings);
  } catch (error) {
    logger.error('[Tolerance GET] Error', error);
    return NextResponse.json({ error: 'Failed to fetch tolerance settings' }, { status: 500 });
  }
}

/**
 * PUT: Update tolerance settings for a project
 */
export async function PUT(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await req.json();

    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Validate input
    const {
      shortagePercent,
      shortageAbsolute,
      excessPercent,
      excessAbsolute,
      autoReverifyEnabled,
      reverifyOnRequirementChange,
      reverifyOnSubmittalChange,
      tradeTolerances
    } = body;

    // Basic validation
    if (shortagePercent !== undefined && (shortagePercent < 0 || shortagePercent > 100)) {
      return NextResponse.json({ error: 'Shortage percent must be between 0 and 100' }, { status: 400 });
    }

    if (excessPercent !== undefined && excessPercent < 0) {
      return NextResponse.json({ error: 'Excess percent must be non-negative' }, { status: 400 });
    }

    await saveToleranceSettings(
      project.id,
      {
        shortagePercent,
        shortageAbsolute,
        excessPercent,
        excessAbsolute,
        autoReverifyEnabled,
        reverifyOnRequirementChange,
        reverifyOnSubmittalChange,
        tradeTolerances
      },
      (session.user as any).id
    );

    const updatedSettings = await getToleranceSettings(project.id);

    return NextResponse.json({
      message: 'Tolerance settings updated',
      settings: updatedSettings
    });
  } catch (error) {
    logger.error('[Tolerance PUT] Error', error);
    return NextResponse.json({ error: 'Failed to update tolerance settings' }, { status: 500 });
  }
}
