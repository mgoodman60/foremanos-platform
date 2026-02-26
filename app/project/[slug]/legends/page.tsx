import { getProject } from '@/lib/data/get-project';
import LegendsPageContent from './legends-page-content';

export const revalidate = 300;

export default async function LegendsPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);
  return <LegendsPageContent project={project} />;
}
