import { getProject } from '@/lib/data/get-project';
import ProjectLayoutClient from './project-layout-client';

export default async function ProjectLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

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
