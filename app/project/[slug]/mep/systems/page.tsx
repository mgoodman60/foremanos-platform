import { getProject } from '@/lib/data/get-project';
import SystemsPageContent from './systems-page-content';

export default async function SystemsPage({ params }: { params: { slug: string } }) {
  await getProject(params.slug); // Auth + access check
  return <SystemsPageContent projectSlug={params.slug} />;
}
