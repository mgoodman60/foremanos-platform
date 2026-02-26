import { getProject } from '@/lib/data/get-project';
import { ReportsPageContent } from './reports-page-content';

export default async function ReportsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);

  return (
    <ReportsPageContent
      projectSlug={params.slug}
      projectId={project.id}
      projectName={project.name}
    />
  );
}
