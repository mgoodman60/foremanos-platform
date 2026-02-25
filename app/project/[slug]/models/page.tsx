import { getProject } from '@/lib/data/get-project';
import { ModelsPageContent } from './models-page-content';

export default async function ModelsPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);

  return (
    <ModelsPageContent
      projectSlug={params.slug}
      projectName={project.name}
    />
  );
}
