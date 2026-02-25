import { getProject } from '@/lib/data/get-project';
import SubcontractorsPageContent from './subcontractors-page-content';

export default async function SubcontractorsPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);
  return <SubcontractorsPageContent project={project} />;
}
