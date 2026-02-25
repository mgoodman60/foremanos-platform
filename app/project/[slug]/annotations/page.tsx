import { getProject } from '@/lib/data/get-project';
import AnnotationsPageContent from './annotations-page-content';

export default async function AnnotationsPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);
  return <AnnotationsPageContent project={project} />;
}
