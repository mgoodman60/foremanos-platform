import { getProject } from '@/lib/data/get-project';
import EVMPageContent from './evm-page-content';

export default async function EVMPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);
  return <EVMPageContent project={project} />;
}
