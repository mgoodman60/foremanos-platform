import DocumentDetailPage from '@/components/documents/DocumentDetailPage';
import { AskForemanButton } from '@/components/shared/ask-foreman-button';

export default function DocumentPage({ params }: { params: { slug: string; id: string } }) {
  return (
    <>
      <DocumentDetailPage projectSlug={params.slug} documentId={params.id} />
      <AskForemanButton label="Ask the Foreman about this document" />
    </>
  );
}
