import { getProject } from '@/lib/data/get-project';
import EVMPageContent from './evm-page-content';

export default async function EVMPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);
  return <EVMPageContent project={project} />;
}
