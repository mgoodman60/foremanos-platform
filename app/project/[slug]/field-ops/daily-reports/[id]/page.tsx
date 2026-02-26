import DailyReportDetail from '@/components/daily-reports/DailyReportDetail';
import { AskForemanButton } from '@/components/shared/ask-foreman-button';

export default async function DailyReportDetailPage(
  props: {
    params: Promise<{ slug: string; id: string }>
  }
) {
  const params = await props.params;
  return (
    <>
      <DailyReportDetail projectSlug={params.slug} reportId={params.id} />
      <AskForemanButton label="Ask the Foreman about this report" />
    </>
  );
}
