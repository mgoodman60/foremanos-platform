import { SubmittalsPageContent } from './submittals-page-content';

export default async function SubmittalsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <SubmittalsPageContent projectSlug={params.slug} />;
}
