import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
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

    // Get chat message counts grouped by project using a single aggregation query
    const messageCountsByProject = await prisma.chatMessage.groupBy({
      by: ['conversationId'],
      _count: {
        id: true,
      },
    });

    // Get conversation-to-project mapping
    const conversationIds = messageCountsByProject.map(mc => mc.conversationId);
    const conversations = await prisma.conversation.findMany({
      where: {
        id: { in: conversationIds },
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    // Build project ID to message count map
    const projectMessageCounts = new Map<string, number>();
    const convToProjectMap = new Map(conversations.map(c => [c.id, c.projectId]));

    messageCountsByProject.forEach(mc => {
      const projectId = convToProjectMap.get(mc.conversationId);
      if (projectId) {
        projectMessageCounts.set(
          projectId,
          (projectMessageCounts.get(projectId) || 0) + mc._count.id
        );
      }
    });

    // Combine project data with message counts
    const analytics = projects.map((project: any) => ({
      ...project,
      messageCount: projectMessageCounts.get(project.id) || 0,
    }));

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
