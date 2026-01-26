import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth-options';
import { getAvailableWorkflows } from '../../../../lib/workflow-service';
import { prisma } from '../../../../lib/db';

// Force dynamic rendering (required for authentication)
export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows/available
 * Get available workflows for a project
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectSlug = searchParams.get('projectSlug');

    if (!projectSlug) {
      return NextResponse.json({ error: 'Project slug required' }, { status: 400 });
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: {
        id: true,
        projectType: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.projectType) {
      return NextResponse.json(
        { error: 'Project type not set. Please set project type in project settings.' },
        { status: 400 }
      );
    }

    // Get available workflows
    const workflows = await getAvailableWorkflows(project.projectType);

    return NextResponse.json({ workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}
