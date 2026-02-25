import { getProject } from '@/lib/data/get-project';
import TemplatesPageContent from './templates-page-content';

export default async function TemplatesPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);
  return <TemplatesPageContent project={project} />;
}
