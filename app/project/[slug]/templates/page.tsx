import { getProject } from '@/lib/data/get-project';
import TemplatesPageContent from './templates-page-content';

export default async function TemplatesPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);
  return <TemplatesPageContent project={project} />;
}
