import { getProject } from '@/lib/data/get-project';
import CalculationsPageContent from './calculations-page-content';

export default async function CalculationsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  await getProject(params.slug); // Auth + access check
  return <CalculationsPageContent projectSlug={params.slug} />;
}
