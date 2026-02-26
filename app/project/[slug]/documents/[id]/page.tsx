import DocumentDetailPage from '@/components/documents/DocumentDetailPage';
import { AskForemanButton } from '@/components/shared/ask-foreman-button';

export default async function DocumentPage(props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  return (
    <>
      <DocumentDetailPage projectSlug={params.slug} documentId={params.id} />
      <AskForemanButton label="Ask the Foreman about this document" />
    </>
  );
}
