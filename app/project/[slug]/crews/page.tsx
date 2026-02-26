import { getProject } from '@/lib/data/get-project';
import CrewsPageContent from './crews-page-content';

export default async function CrewsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);
  return <CrewsPageContent project={project} />;
}
