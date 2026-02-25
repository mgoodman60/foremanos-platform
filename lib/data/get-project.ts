import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { withDatabaseRetry } from '@/lib/retry-util';

export async function getProject(slug: string) {
  const session = await requireAuth();

  const project = await withDatabaseRetry(
    () => prisma.project.findUnique({
      where: { slug },
      include: { _count: { select: { Document: true } } },
    }),
    'Fetch project'
  );

  if (!project) redirect('/dashboard');

  // Access check (mirrors API route logic)
  const userId = session.user.id;
  if (session.user.role !== 'admin') {
    const memberCount = await withDatabaseRetry(
      () => prisma.projectMember.count({
        where: { userId, projectId: project.id },
      }),
      'Check project access'
    );
    if (project.ownerId !== userId && memberCount === 0) redirect('/dashboard');
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      documentCount: project._count.Document,
      ownerId: project.ownerId,
    },
    session,
    isOwner: session.user.id === project.ownerId,
    isAdmin: session.user.role === 'admin',
  };
}
