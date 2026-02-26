import { getProject } from '@/lib/data/get-project';
import SubcontractorsPageContent from './subcontractors-page-content';

export default async function SubcontractorsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);
  return <SubcontractorsPageContent project={project} />;
}
