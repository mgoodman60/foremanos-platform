import { TemplatesPageContent } from './templates-page-content';

export default async function ReportTemplatesPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <TemplatesPageContent projectSlug={params.slug} />;
}
