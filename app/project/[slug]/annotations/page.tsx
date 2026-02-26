import { getProject } from '@/lib/data/get-project';
import AnnotationsPageContent from './annotations-page-content';

export default async function AnnotationsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);
  return <AnnotationsPageContent project={project} />;
}
