import { getProject } from '@/lib/data/get-project';
import ContractsPageContent from './contracts-page-content';

export default async function ContractsPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);
  return <ContractsPageContent project={project} />;
}
