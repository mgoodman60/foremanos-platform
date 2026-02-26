import { Suspense } from 'react';
import { DailyReportsContent } from './daily-reports-content';

export default async function DailyReportsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <DailyReportsContent projectSlug={params.slug} />
    </Suspense>
  );
}
