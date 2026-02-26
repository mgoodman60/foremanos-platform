import { PunchListContent } from './punch-list-content';

export default async function PunchListPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <PunchListContent projectSlug={params.slug} />;
}
