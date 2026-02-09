import DocumentDetailPage from '@/components/documents/DocumentDetailPage';
import { AskAiButton } from '@/components/shared/ask-ai-button';

export default function DocumentPage({ params }: { params: { slug: string; id: string } }) {
  return (
    <>
      <DocumentDetailPage projectSlug={params.slug} documentId={params.id} />
      <AskAiButton label="Ask AI about this document" />
    </>
  );
}
