import { TemplatesPageContent } from './templates-page-content';

export default function ReportTemplatesPage({ params }: { params: { slug: string } }) {
  return <TemplatesPageContent projectSlug={params.slug} />;
}
