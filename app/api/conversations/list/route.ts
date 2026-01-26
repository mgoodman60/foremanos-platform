import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get('projectSlug');

    // Get user with subscription tier
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has Pro+ tier for Daily Report Chat access
    const eligibleTiers = ['pro', 'team', 'business', 'enterprise'];
    const hasProTier = eligibleTiers.includes(user.subscriptionTier);

    // Build query
    const where: any = {
      userId: session.user.id,
    };

    // If projectSlug is provided, filter by project
    let projectData = null;
    if (projectSlug) {
      projectData = await prisma.project.findUnique({
        where: { slug: projectSlug },
        select: { 
          id: true,
          dailyReportEnabled: true,
        },
      });

      if (projectData) {
        where.projectId = projectData.id;
      }
    }

    // Fetch conversations
    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        _count: {
          select: { ChatMessage: true },
        },
        Project: {
          select: {
            name: true,
            slug: true,
            dailyReportEnabled: true,
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' }, // Pinned chats first
        { updatedAt: 'desc' },
      ],
      take: 50, // Limit to 50 most recent conversations
    });

    // Filter out Daily Report Chats if user is not eligible or feature is disabled
    const filteredConversations = conversations.filter((conv: any) => {
      // Always show regular conversations
      if (conv.conversationType !== 'daily_report') {
        return true;
      }
      
      // For Daily Report Chats, check eligibility
      // User must have Pro+ tier AND project must have feature enabled
      return hasProTier && conv.Project?.dailyReportEnabled === true;
    });

    return NextResponse.json({
      conversations: filteredConversations.map((conv: any) => ({
        id: conv.id,
        title: conv.title,
        messageCount: conv._count.ChatMessage,
        projectName: conv.Project?.name,
        projectSlug: conv.Project?.slug,
        conversationType: conv.conversationType,
        isSystemManaged: conv.isSystemManaged,
        isPinned: conv.isPinned,
        dailyReportDate: conv.dailyReportDate,
        isReadOnly: conv.isReadOnly,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        // Finalization fields for daily reports
        finalized: conv.finalized,
        finalizedAt: conv.finalizedAt,
        lastActivityAt: conv.lastActivityAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
