import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getScheduleProgress } from '@/lib/schedule-parser';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULES');

// GET /api/projects/[slug]/schedules - List all schedules for a project
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: { include: { User: true } }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all schedules
    const schedules = await prisma.schedule.findMany({
      where: { projectId: project.id },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        Document: {
          select: {
            id: true,
            name: true,
            fileName: true
          }
        },
        _count: {
          select: { ScheduleTask: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get progress for each schedule and map response
    const schedulesWithProgress = await Promise.all(
      schedules.map(async (schedule: any) => {
        const progress = await getScheduleProgress(schedule.id);
        return {
          ...schedule,
          // Map User to creator for frontend compatibility
          creator: schedule.User || { username: 'Unknown' },
          // Map Document to document
          document: schedule.Document,
          // Map _count
          _count: {
            tasks: schedule._count?.ScheduleTask || 0
          },
          progress
        };
      })
    );

    return NextResponse.json({ schedules: schedulesWithProgress });
  } catch (error: unknown) {
    logger.error('Error fetching schedules', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules', details: errMsg },
      { status: 500 }
    );
  }
}
