import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DASHBOARD');

interface ProjectWithCounts {
  id: string;
  name: string;
  slug: string;
  guestUsername: string | null;
  ownerId: string;
  status: string;
  createdAt: Date;
  _count: {
    Document: number;
    ProjectMember: number;
  };
  User_Project_ownerIdToUser: {
    username: string;
  } | null;
  ProjectMember?: Array<{
    role: string;
  }>;
}

interface PrismaError extends Error {
  code?: string;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await withDatabaseRetry(
      () => auth(),
      'Get server session (dashboard)'
    );

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    // Fetch owned projects (where user is the owner)
    const ownedProjects: ProjectWithCounts[] = await withDatabaseRetry(
      () => prisma.project.findMany({
        where: { ownerId: userId },
        include: {
          _count: {
            select: { 
              Document: true,
              ProjectMember: true,
            },
          },
          User_Project_ownerIdToUser: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      'Fetch owned projects'
    );

    // Fetch shared projects (where user is a member but not owner)
    const sharedProjects: ProjectWithCounts[] = await withDatabaseRetry(
      () => prisma.project.findMany({
        where: {
          ProjectMember: {
            some: { 
              userId,
              role: { in: ['editor', 'viewer'] }
            },
          },
        },
        include: {
          _count: {
            select: { 
              Document: true,
              ProjectMember: true,
            },
          },
          User_Project_ownerIdToUser: {
            select: { username: true },
          },
          ProjectMember: {
            where: { userId },
            select: { role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      'Fetch shared projects'
    );

    // If admin, also fetch all projects
    let allProjects: ProjectWithCounts[] = [];
    if (userRole === 'admin') {
      allProjects = await withDatabaseRetry(
        () => prisma.project.findMany({
          include: {
            _count: {
              select: { 
                Document: true,
                ProjectMember: true,
              },
            },
            User_Project_ownerIdToUser: {
              select: { username: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        'Fetch all projects (admin)'
      );
    }

    const formatProject = (project: ProjectWithCounts, userMemberRole?: string) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      guestUsername: project.guestUsername,
      documentCount: project._count.Document,
      memberCount: project._count.ProjectMember,
      ownerName: project.User_Project_ownerIdToUser?.username || 'Unknown',
      isOwner: project.ownerId === userId,
      memberRole: userMemberRole,
      createdAt: project.createdAt.toISOString(),
      status: project.status,
    });

    const formattedOwnedProjects = ownedProjects.map((p) => formatProject(p, 'owner'));
    const formattedSharedProjects = sharedProjects.map((p) =>
      formatProject(p, p.ProjectMember?.[0]?.role)
    );

    const totalDocuments = await withDatabaseRetry(
      () => prisma.document.count({
        where:
          userRole === 'admin'
            ? {}
            : {
                Project: {
                  OR: [
                    { ownerId: userId },
                    {
                      ProjectMember: {
                        some: { userId },
                      },
                    },
                  ],
                },
              },
      }),
      'Count total documents'
    );

    return NextResponse.json({
      ownedProjects: formattedOwnedProjects,
      sharedProjects: formattedSharedProjects,
      projects: userRole === 'admin' ? allProjects.map((p) => formatProject(p)) : 
                [...formattedOwnedProjects, ...formattedSharedProjects], // backward compatibility
      stats: {
        totalProjects: formattedOwnedProjects.length + formattedSharedProjects.length,
        totalDocuments,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch dashboard data', error);

    // Return more specific error messages
    const prismaError = error as PrismaError;
    if (prismaError?.code?.startsWith('P1')) {
      return NextResponse.json({
        error: 'Database connection error. Please try again.'
      }, { status: 503 });
    }

    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
