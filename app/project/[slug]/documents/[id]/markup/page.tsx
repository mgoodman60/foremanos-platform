import { auth } from '@/auth';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { MarkupPage } from './MarkupPage';

interface PageProps {
  params: Promise<{
    slug: string;
    id: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const resolvedParams = await params;
  const { slug, id } = resolvedParams;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    redirect('/login');
  }

  const document = await prisma.document.findFirst({
    where: {
      id,
      Project: {
        slug,
        OR: [
          { ownerId: user.id },
          { ProjectMember: { some: { userId: user.id } } },
        ],
      },
    },
    select: {
      id: true,
      name: true,
      Project: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!document) {
    redirect(`/project/${slug}`);
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <MarkupPage
        slug={slug}
        documentId={id}
        documentName={document.name}
        // @ts-expect-error strictNullChecks migration
        projectName={document.Project.name}
        userId={user.id}
      />
    </Suspense>
  );
}
