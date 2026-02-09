import DailyReportDetail from '@/components/daily-reports/DailyReportDetail';
import { AskAiButton } from '@/components/shared/ask-ai-button';

export default function DailyReportDetailPage({
  params
}: {
  params: { slug: string; id: string }
}) {
  return (
    <>
      <DailyReportDetail projectSlug={params.slug} reportId={params.id} />
      <AskAiButton label="Ask AI about this report" />
    </>
  );
}
