import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractFinishSchedules } from '@/lib/finish-schedule-extractor';
import { safeErrorMessage } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_EXTRACT_FINISH_SCHEDULES');

/**
 * POST /api/projects/[slug]/extract-finish-schedules
 * Extract finish schedule data and correlate with existing rooms
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: {
          include: {
            User: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check user access
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isOwner = (project as any).ownerId === (user as any).id;
    const isAdmin = (user as any).role === 'admin' || (user as any).role === 'client';
    const isMember = project.ProjectMember.some(
      (member: any) => member.userId === (user as any).id
    );

    if (!isOwner && !isAdmin && !isMember) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    logger.info('Extracting finish schedules for project', { project: project.name, slug });

    // Extract finish schedules
    const result = await extractFinishSchedules(slug);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Finish schedule extraction failed',
          details: result.errors
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully extracted finish data for ${result.matchedRooms} rooms`,
      matchedRooms: result.matchedRooms,
      totalFinishes: result.totalFinishes
    });
  } catch (error: unknown) {
    logger.error('Error extracting finish schedules', error);
    return NextResponse.json(
      {
        error: 'Failed to extract finish schedules',
        details: safeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
