import { Suspense } from 'react';
import { DailyReportsContent } from './daily-reports-content';

export default function DailyReportsPage({ params }: { params: { slug: string } }) {
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
