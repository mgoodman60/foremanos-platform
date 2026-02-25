import { getProject } from '@/lib/data/get-project';
import { ReportsPageContent } from './reports-page-content';

export default async function ReportsPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);

  return (
    <ReportsPageContent
      projectSlug={params.slug}
      projectId={project.id}
      projectName={project.name}
    />
  );
}
