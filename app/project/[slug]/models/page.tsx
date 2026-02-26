import { getProject } from '@/lib/data/get-project';
import { ModelsPageContent } from './models-page-content';

export default async function ModelsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);

  return (
    <ModelsPageContent
      projectSlug={params.slug}
      projectName={project.name}
    />
  );
}
