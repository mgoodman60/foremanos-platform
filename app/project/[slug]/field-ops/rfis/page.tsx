import { RFIsPageContent } from './rfis-page-content';

export default function RFIsPage({ params }: { params: { slug: string } }) {
  return <RFIsPageContent projectSlug={params.slug} />;
}
