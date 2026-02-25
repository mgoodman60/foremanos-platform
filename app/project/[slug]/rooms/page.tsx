import { getProject } from '@/lib/data/get-project';
import RoomsPageContent from './rooms-page-content';

export default async function RoomsPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);
  return <RoomsPageContent project={project} />;
}
