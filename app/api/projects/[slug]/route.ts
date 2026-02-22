import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS');

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // Use retry mechanism for session validation
    const session = await withDatabaseRetry(
      () => getServerSession(authOptions),
      'Get server session'
    );

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Use retry mechanism for database queries
    const project: any = await withDatabaseRetry(
      () => prisma.project.findUnique({
        where: { slug },
        include: {
          _count: {
            select: { Document: true },
          },
        },
      }),
      'Fetch project'
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check access
    const userId = session.user.id;
    const userRole = session.user.role;

    if (userRole !== 'admin') {
      // Check if user is owner or member with retry
      const memberCount: number = await withDatabaseRetry(
        () => prisma.projectMember.count({
          where: {
            userId,
            projectId: project.id,
          },
        }),
        'Check project access'
      );

      const hasAccess = project.ownerId === userId || memberCount > 0;

      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        documentCount: project._count.Document,
        ownerId: project.ownerId,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching project', error);
    
    // Return more specific error messages
    if (error?.code?.startsWith('P1')) {
      return NextResponse.json({ 
        error: 'Database connection error. Please try again.' 
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
