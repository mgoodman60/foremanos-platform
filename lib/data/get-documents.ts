import { cache } from 'react';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';

export const getDocuments = cache(async (projectId: string) => {
  return withDatabaseRetry(
    () =>
      prisma.document.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          category: true,
          createdAt: true,
          cloud_storage_path: true,
          _count: { select: { DocumentChunk: true } },
        },
      }),
    'Fetch documents'
  );
});

export const getDocumentCount = cache(async (projectId: string) => {
  return withDatabaseRetry(
    () => prisma.document.count({ where: { projectId } }),
    'Count documents'
  );
});
