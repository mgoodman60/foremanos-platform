import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ASSIGNED');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.assignedProjectId) {
      return NextResponse.json({ error: 'No assigned project' }, { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id: session.user.assignedProjectId },
      select: { slug: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ slug: project.slug });
  } catch (error) {
    logger.error('Error fetching assigned project', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
