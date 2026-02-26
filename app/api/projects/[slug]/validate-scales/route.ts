/**
 * Scale Validation API Endpoint
 * POST /api/projects/[slug]/validate-scales
 * GET /api/projects/[slug]/validate-scales (get validation statistics)
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  validateProjectScales,
  getScaleStatistics
} from '@/lib/scale-detector';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_VALIDATE_SCALES');

/**
 * POST - Validate scales for project
 */
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Validate all scales in project
    const validation = await validateProjectScales(slug);

    return NextResponse.json({
      success: true,
      projectSlug: slug,
      validation
    });

  } catch (error) {
    logger.error('Scale validation error', error);
    return NextResponse.json(
      { error: 'Failed to validate scales', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get scale validation statistics for project
 */
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get statistics
    const stats = await getScaleStatistics(slug);

    return NextResponse.json({
      success: true,
      projectSlug: slug,
      statistics: stats
    });

  } catch (error) {
    logger.error('Scale statistics error', error);
    return NextResponse.json(
      { error: 'Failed to get scale statistics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
