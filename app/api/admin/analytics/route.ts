import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get project analytics
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        User_Project_ownerIdToUser: {
          select: {
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            Document: true,
            ProjectMember: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Get document counts by project
    const analytics = await Promise.all(
      projects.map(async (project: any) => {
        // Get chat message count for this project
        const messageCount = await prisma.chatMessage.count({
          where: {
            Conversation: {
              projectId: project.id,
            },
          },
        });

        return {
          ...project,
          messageCount,
        };
      })
    );

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
