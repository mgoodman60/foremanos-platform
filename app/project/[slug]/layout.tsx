import { getProject } from '@/lib/data/get-project';
import ProjectLayoutClient from './project-layout-client';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const data = await getProject(params.slug);

  return (
    <ProjectLayoutClient
      project={data.project}
      session={data.session}
      isOwner={data.isOwner}
      isAdmin={data.isAdmin}
    >
      {children}
    </ProjectLayoutClient>
  );
}
