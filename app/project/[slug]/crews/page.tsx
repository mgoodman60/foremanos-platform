import { getProject } from '@/lib/data/get-project';
import CrewsPageContent from './crews-page-content';

export default async function CrewsPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);
  return <CrewsPageContent project={project} />;
}
