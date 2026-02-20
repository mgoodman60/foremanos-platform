import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Get processing analytics for admin dashboard
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const now = new Date();
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get users who haven't been reset this month
    const usersNeedingReset = await prisma.user.count({
      where: {
        processingResetAt: {
          lt: firstOfCurrentMonth,
        },
      },
    });

    // Get total processing stats for this month
    const processingCosts = await prisma.processingCost.aggregate({
      where: {
        createdAt: {
          gte: firstOfCurrentMonth,
        },
      },
      _sum: {
        pages: true,
        cost: true,
      },
      _count: {
        id: true,
      },
    });

    // Get processor breakdown
    const visionStats = await prisma.processingCost.aggregate({
      where: {
        createdAt: { gte: firstOfCurrentMonth },
        processorType: 'vision',
      },
      _sum: { pages: true, cost: true },
      _count: { id: true },
    });

    const haikuStats = await prisma.processingCost.aggregate({
      where: {
        createdAt: { gte: firstOfCurrentMonth },
        processorType: 'haiku',
      },
      _sum: { pages: true, cost: true },
      _count: { id: true },
    });

    const ocrStats = await prisma.processingCost.aggregate({
      where: {
        createdAt: { gte: firstOfCurrentMonth },
        processorType: 'ocr',
      },
      _sum: { pages: true, cost: true },
      _count: { id: true },
    });

    // Get top users by processing usage
    const topUsers = await prisma.user.findMany({
      where: {
        pagesProcessedThisMonth: {
          gt: 0,
        },
      },
      select: {
        email: true,
        pagesProcessedThisMonth: true,
        totalProcessingCost: true,
        subscriptionTier: true,
      },
      orderBy: {
        pagesProcessedThisMonth: 'desc',
      },
      take: 10,
    });

    return NextResponse.json({
      currentMonth: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      nextResetDate: firstOfNextMonth.toISOString(),
      usersNeedingReset,
      monthlyStats: {
        totalDocuments: processingCosts._count.id || 0,
        totalPages: processingCosts._sum.pages || 0,
        totalCost: processingCosts._sum.cost || 0,
      },
      processorBreakdown: {
        vision: {
          documents: visionStats._count.id || 0,
          pages: visionStats._sum.pages || 0,
          cost: visionStats._sum.cost || 0,
        },
        haiku: {
          documents: haikuStats._count.id || 0,
          pages: haikuStats._sum.pages || 0,
          cost: haikuStats._sum.cost || 0,
        },
        ocr: {
          documents: ocrStats._count.id || 0,
          pages: ocrStats._sum.pages || 0,
          cost: ocrStats._sum.cost || 0,
        },
      },
      topUsers: topUsers.map((user: any) => ({
        email: user.email,
        pagesProcessed: user.pagesProcessedThisMonth,
        totalCost: user.totalProcessingCost || 0,
        tier: user.subscriptionTier,
      })),
    });
  } catch (error) {
    console.error('Error getting processing stats:', error);
    return NextResponse.json(
      { error: 'Failed to get processing stats' },
      { status: 500 }
    );
  }
}
