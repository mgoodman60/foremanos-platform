import { cache } from 'react';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';

export const getIntelligenceSummary = cache(async (projectId: string) => {
  const [documentCount, chunkCount, drawingTypes] = await Promise.all([
    withDatabaseRetry(
      () => prisma.document.count({ where: { projectId } }),
      'Count documents'
    ),
    withDatabaseRetry(
      () => prisma.documentChunk.count({
        where: { Document: { projectId } },
      }),
      'Count chunks'
    ),
    withDatabaseRetry(
      () => prisma.$queryRaw<Array<{ classification: string; _count: number }>>`
        SELECT classification, COUNT(*)::int as "_count"
        FROM "DrawingType"
        WHERE "projectId" = ${projectId}
        GROUP BY classification
      `,
      'Drawing type summary'
    ),
  ]);

  return { documentCount, chunkCount, drawingTypes };
});
