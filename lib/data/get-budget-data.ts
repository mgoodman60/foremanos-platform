import { cache } from 'react';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';

export const getBudgetSummary = cache(async (projectId: string) => {
  const [budget, changeOrders, invoices] = await Promise.all([
    withDatabaseRetry(
      () =>
        prisma.projectBudget.findFirst({
          where: { projectId },
          select: {
            id: true,
            totalBudget: true,
            contingency: true,
            actualCost: true,
            committedCost: true,
          },
        }),
      'Fetch budget'
    ),
    withDatabaseRetry(
      () =>
        prisma.changeOrder.aggregate({
          where: { projectId, status: 'APPROVED' },
          _sum: { approvedAmount: true },
          _count: true,
        }),
      'Aggregate change orders'
    ),
    withDatabaseRetry(
      () =>
        prisma.invoice.aggregate({
          where: { projectId, status: 'APPROVED' },
          _sum: { amount: true },
          _count: true,
        }),
      'Aggregate invoices'
    ),
  ]);

  return { budget, changeOrders, invoices };
});
