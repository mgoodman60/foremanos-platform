import { getProject } from '@/lib/data/get-project';
import SystemsPageContent from './systems-page-content';

export default async function SystemsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  await getProject(params.slug); // Auth + access check
  return <SystemsPageContent projectSlug={params.slug} />;
}
