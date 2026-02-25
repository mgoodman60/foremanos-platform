import { getProject } from '@/lib/data/get-project';
import CalculationsPageContent from './calculations-page-content';

export default async function CalculationsPage({ params }: { params: { slug: string } }) {
  await getProject(params.slug); // Auth + access check
  return <CalculationsPageContent projectSlug={params.slug} />;
}
