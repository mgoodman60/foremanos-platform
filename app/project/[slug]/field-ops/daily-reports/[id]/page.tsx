import DailyReportDetail from '@/components/daily-reports/DailyReportDetail';

export default function DailyReportDetailPage({
  params
}: {
  params: { slug: string; id: string }
}) {
  return <DailyReportDetail projectSlug={params.slug} reportId={params.id} />;
}
