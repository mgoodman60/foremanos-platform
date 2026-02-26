import { getProject } from '@/lib/data/get-project';
import { IntegrationsPageContent } from './integrations-page-content';

export default async function IntegrationsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);

  return (
    <IntegrationsPageContent
      projectSlug={params.slug}
      projectName={project.name}
    />
  );
}
