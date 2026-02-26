import { RFIsPageContent } from './rfis-page-content';

export default async function RFIsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <RFIsPageContent projectSlug={params.slug} />;
}
