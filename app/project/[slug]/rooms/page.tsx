import { getProject } from '@/lib/data/get-project';
import RoomsPageContent from './rooms-page-content';

export default async function RoomsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);
  return <RoomsPageContent project={project} />;
}
