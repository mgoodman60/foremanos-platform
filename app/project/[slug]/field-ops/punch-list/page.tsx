import { PunchListContent } from './punch-list-content';

export default function PunchListPage({ params }: { params: { slug: string } }) {
  return <PunchListContent projectSlug={params.slug} />;
}
