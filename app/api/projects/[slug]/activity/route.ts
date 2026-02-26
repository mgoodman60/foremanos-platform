/**
 * Project Activity Feed API
 * Aggregates recent activity from Documents, DailyReports, and ChangeOrders
 * since ActivityLog has no projectId field.
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  actor: {
    name: string;
    email: string;
  };
  href?: string;
}

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(
      `activity:${session.user.id}`,
      RATE_LIMITS.API
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const typeFilter = searchParams.get('type')?.split(',').filter(Boolean) || [];

    // Fetch project and verify access
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        ownerId: true,
        ProjectMember: {
          select: { userId: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.some(
      (m: { userId: string }) => m.userId === session.user.id
    );
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const activities: ActivityItem[] = [];

    // Build queries in parallel based on type filter
    const includeDocuments = typeFilter.length === 0 || typeFilter.includes('document_upload');
    const includeDailyReports = typeFilter.length === 0 || typeFilter.includes('daily_report');
    const includeChangeOrders = typeFilter.length === 0 || typeFilter.includes('change_order');

    const queries: Promise<void>[] = [];

    // Documents (recent uploads)
    if (includeDocuments) {
      queries.push(
        prisma.document.findMany({
          where: { projectId: project.id },
          orderBy: { createdAt: 'desc' },
          take: limit + offset,
          select: {
            id: true,
            name: true,
            category: true,
            createdAt: true,
            updatedBy: true,
          },
        }).then((docs) => {
          for (const doc of docs) {
            activities.push({
              id: `doc-${doc.id}`,
              type: 'document_upload',
              title: 'Document uploaded',
              description: doc.name,
              timestamp: doc.createdAt.toISOString(),
              actor: {
                name: doc.updatedBy || 'System',
                email: '',
              },
              href: `/project/${slug}/documents/${doc.id}`,
            });
          }
        })
      );
    }

    // Daily Reports
    if (includeDailyReports) {
      queries.push(
        prisma.dailyReport.findMany({
          where: {
            projectId: project.id,
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
          take: limit + offset,
          select: {
            id: true,
            reportNumber: true,
            reportDate: true,
            status: true,
            createdAt: true,
            createdByUser: {
              select: {
                username: true,
                email: true,
              },
            },
          },
        }).then((reports) => {
          for (const report of reports) {
            const statusLabel = report.status === 'SUBMITTED'
              ? 'submitted'
              : report.status === 'APPROVED'
                ? 'approved'
                : report.status === 'REJECTED'
                  ? 'rejected'
                  : 'created';

            activities.push({
              id: `dr-${report.id}`,
              type: 'daily_report',
              title: `Daily report #${report.reportNumber} ${statusLabel}`,
              description: `Report for ${report.reportDate.toISOString().split('T')[0]}`,
              timestamp: report.createdAt.toISOString(),
              actor: {
                name: report.createdByUser.username || 'Unknown',
                email: report.createdByUser.email,
              },
              href: `/project/${slug}/field-ops/daily-reports/${report.id}`,
            });
          }
        })
      );
    }

    // Change Orders
    if (includeChangeOrders) {
      queries.push(
        prisma.changeOrder.findMany({
          where: { projectId: project.id },
          orderBy: { submittedDate: 'desc' },
          take: limit + offset,
          select: {
            id: true,
            orderNumber: true,
            title: true,
            status: true,
            requestedBy: true,
            submittedDate: true,
          },
        }).then((orders) => {
          for (const order of orders) {
            activities.push({
              id: `co-${order.id}`,
              type: 'change_order',
              title: `Change order ${order.orderNumber}: ${order.status.toLowerCase()}`,
              description: order.title,
              timestamp: order.submittedDate.toISOString(),
              actor: {
                name: order.requestedBy || 'Unknown',
                email: '',
              },
            });
          }
        })
      );
    }

    await Promise.all(queries);

    // Sort all activities by timestamp descending
    activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    const total = activities.length;
    const paginatedActivities = activities.slice(offset, offset + limit);

    return NextResponse.json({
      activities: paginatedActivities,
      total,
      hasMore: offset + limit < total,
    });
  } catch (error: unknown) {
    logger.error('ACTIVITY_API', 'Error fetching project activity', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
