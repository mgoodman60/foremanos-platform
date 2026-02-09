import DailyReportDetail from '@/components/daily-reports/DailyReportDetail';
import { AskForemanButton } from '@/components/shared/ask-foreman-button';

export default function DailyReportDetailPage({
  params
}: {
  params: { slug: string; id: string }
}) {
  return (
    <>
      <DailyReportDetail projectSlug={params.slug} reportId={params.id} />
      <AskForemanButton label="Ask the Foreman about this report" />
    </>
  );
}
