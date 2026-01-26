import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all submittals with line items
    const submittals = await prisma.mEPSubmittal.findMany({
      where: { projectId: project.id },
      include: {
        lineItems: {
          select: { complianceStatus: true },
        },
      },
    });

    const total = submittals.length;
    const byStatus: Record<string, number> = {};
    let pendingReview = 0;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let recentlyApproved = 0;
    let recentlyRejected = 0;

    const verificationStats = {
      sufficient: 0,
      insufficient: 0,
      excess: 0,
      unverified: 0,
    };

    for (const s of submittals) {
      const status = s.status.toLowerCase();
      byStatus[status] = (byStatus[status] || 0) + 1;

      if (status === 'submitted' || status === 'reviewed') {
        pendingReview++;
      }
      if (status === 'approved' && s.updatedAt >= weekAgo) {
        recentlyApproved++;
      }
      if (status === 'rejected' && s.updatedAt >= weekAgo) {
        recentlyRejected++;
      }

      // Count verification statuses from line items
      for (const item of s.lineItems) {
        const vStatus = item.complianceStatus?.toUpperCase() || 'UNVERIFIED';
        if (vStatus === 'SUFFICIENT') verificationStats.sufficient++;
        else if (vStatus === 'INSUFFICIENT') verificationStats.insufficient++;
        else if (vStatus === 'EXCESS') verificationStats.excess++;
        else verificationStats.unverified++;
      }
    }

    return NextResponse.json({
      total,
      byStatus,
      pendingReview,
      recentlyApproved,
      recentlyRejected,
      verificationStats,
    });
  } catch (error) {
    console.error('Error fetching submittal stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
