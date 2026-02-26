import { getProject } from '@/lib/data/get-project';
import ContractsPageContent from './contracts-page-content';

export default async function ContractsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);
  return <ContractsPageContent project={project} />;
}
