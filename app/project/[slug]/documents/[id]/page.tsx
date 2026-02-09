import DocumentDetailPage from '@/components/documents/DocumentDetailPage';

export default function DocumentPage({ params }: { params: { slug: string; id: string } }) {
  return <DocumentDetailPage projectSlug={params.slug} documentId={params.id} />;
}
