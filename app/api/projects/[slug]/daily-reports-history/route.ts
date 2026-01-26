/**
 * Daily Reports History API
 * 
 * GET /api/projects/[slug]/daily-reports-history
 * Retrieve all daily report conversations for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        dailyReportEnabled: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (!project.dailyReportEnabled) {
      return NextResponse.json(
        { error: 'Daily reports are not enabled for this project' },
        { status: 400 }
      );
    }

    // Get all daily report conversations for this project
    const reports = await prisma.conversation.findMany({
      where: {
        projectId: project.id,
        conversationType: 'daily_report',
      },
      select: {
        id: true,
        title: true,
        dailyReportDate: true,
        finalized: true,
        finalizedAt: true,
        finalizedBy: true,
        finalizationMethod: true,
        documentId: true,
        lastActivityAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { ChatMessage: true },
        },
        User: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        dailyReportDate: 'desc',
      },
    });

    // Get document info for finalized reports
    const reportsWithDocuments = await Promise.all(
      reports.map(async (report: any) => {
        let documentUrl = null;
        let documentName = null;

        if (report.finalized && report.documentId) {
          try {
            const document = await prisma.document.findUnique({
              where: { id: report.documentId },
              select: {
                name: true,
                cloud_storage_path: true,
                isPublic: true,
              },
            });

            if (document?.cloud_storage_path) {
              documentUrl = await getFileUrl(document.cloud_storage_path, document.isPublic || false);
              documentName = document.name;
            }
          } catch (error) {
            console.error(`[DAILY_REPORTS_HISTORY] Error getting document for report ${report.id}:`, error);
          }
        }

        return {
          id: report.id,
          title: report.title,
          dailyReportDate: report.dailyReportDate,
          finalized: report.finalized,
          finalizedAt: report.finalizedAt,
          finalizedBy: report.finalizedBy,
          finalizationMethod: report.finalizationMethod,
          documentId: report.documentId,
          documentUrl,
          documentName,
          lastActivityAt: report.lastActivityAt,
          messageCount: report._count.ChatMessage,
          createdBy: report.user?.email || 'Unknown',
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
        };
      })
    );

    // Group reports by month for easier viewing
    const groupedReports = reportsWithDocuments.reduce((acc, report) => {
      if (!report.dailyReportDate) return acc;

      const date = new Date(report.dailyReportDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      if (!acc[monthKey]) {
        acc[monthKey] = {
          monthKey,
          monthLabel,
          reports: [],
        };
      }

      acc[monthKey].reports.push(report);
      return acc;
    }, {} as Record<string, { monthKey: string; monthLabel: string; reports: any[] }>);

    // Convert to array and sort by month descending
    const groupedArray = Object.values(groupedReports).sort((a: any, b: any) => 
      b.monthKey.localeCompare(a.monthKey)
    );

    // Calculate statistics
    const stats = {
      total: reports.length,
      finalized: reports.filter((r: any) => r.finalized).length,
      inProgress: reports.filter((r: any) => !r.finalized).length,
    };

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
      },
      stats,
      groupedReports: groupedArray,
      reports: reportsWithDocuments,
    });
  } catch (error) {
    console.error('[DAILY_REPORTS_HISTORY] Error fetching history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily reports history' },
      { status: 500 }
    );
  }
}
