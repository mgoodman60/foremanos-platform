import { SubmittalsPageContent } from './submittals-page-content';

export default function SubmittalsPage({ params }: { params: { slug: string } }) {
  return <SubmittalsPageContent projectSlug={params.slug} />;
}
