/**
 * Hardware Sets API
 * GET: Get all hardware sets for a project
 * POST: Extract and sync hardware sets from project data
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { 
  getProjectHardwareSets, 
  calculateHardwareRequirements,
  extractAndSyncAllHardwareSets 
} from '@/lib/hardware-set-extractor';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_HARDWARE_SETS');

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const includeRequirements = searchParams.get('requirements') === 'true';

    if (includeRequirements) {
      const data = await calculateHardwareRequirements(project.id);
      return NextResponse.json(data);
    } else {
      const sets = await getProjectHardwareSets(project.id);
      return NextResponse.json({ sets });
    }
  } catch (error) {
    logger.error('[Hardware Sets GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch hardware sets' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const stats = await extractAndSyncAllHardwareSets(project.id);

    return NextResponse.json({
      success: true,
      extracted: stats
    });
  } catch (error) {
    logger.error('[Hardware Sets POST Error]', error);
    return NextResponse.json(
      { error: 'Failed to extract hardware sets' },
      { status: 500 }
    );
  }
}
