import { cache } from 'react';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';

export const getScheduleSummary = cache(async (projectId: string) => {
  const [schedule, milestones] = await Promise.all([
    withDatabaseRetry(
      () =>
        prisma.schedule.findFirst({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            _count: { select: { ScheduleTask: true } },
          },
        }),
      'Fetch schedule'
    ),
    withDatabaseRetry(
      () =>
        prisma.milestone.findMany({
          where: { projectId },
          orderBy: { plannedDate: 'asc' },
          select: {
            id: true,
            name: true,
            plannedDate: true,
            status: true,
          },
        }),
      'Fetch milestones'
    ),
  ]);

  return { schedule, milestones };
});
