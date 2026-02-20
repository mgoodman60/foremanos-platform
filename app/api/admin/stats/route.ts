import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
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

    // Get counts by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });

    // Get pending approvals count
    const pendingCount = await prisma.user.count({
      where: {
        role: 'pending',
        approved: false,
      },
    });

    // Get total projects
    const totalProjects = await prisma.project.count();

    // Get total documents
    const totalDocuments = await prisma.document.count();

    // Get recent signups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentSignups = await prisma.user.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Format users by role
    const roleStats = {
      admin: 0,
      client: 0,
      guest: 0,
      pending: 0,
    };

    usersByRole.forEach((item: any) => {
      roleStats[item.role as keyof typeof roleStats] = item._count;
    });

    return NextResponse.json({
      usersByRole: roleStats,
      pendingApprovals: pendingCount,
      totalProjects,
      totalDocuments,
      recentSignups,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
