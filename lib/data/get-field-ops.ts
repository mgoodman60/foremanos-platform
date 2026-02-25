import { cache } from 'react';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';

export const getRecentDailyReports = cache(async (projectId: string, limit = 5) => {
  return withDatabaseRetry(
    () =>
      prisma.dailyReport.findMany({
        where: { projectId, deletedAt: null },
        orderBy: { reportDate: 'desc' },
        take: limit,
        select: {
          id: true,
          reportDate: true,
          status: true,
          weatherCondition: true,
          createdBy: true,
        },
      }),
    'Fetch daily reports'
  );
});

export const getPunchListSummary = cache(async (projectId: string) => {
  const counts = await withDatabaseRetry(
    () =>
      prisma.punchListItem.groupBy({
        by: ['status'],
        where: { projectId },
        _count: true,
      }),
    'Punch list summary'
  );
  return counts;
});

export const getOpenRFIs = cache(async (projectId: string) => {
  return withDatabaseRetry(
    () =>
      prisma.rFI.count({
        where: {
          projectId,
          status: { in: ['OPEN', 'PENDING_RESPONSE'] },
        },
      }),
    'Count open RFIs'
  );
});
