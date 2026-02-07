import { Suspense } from 'react';
import MEPNavigation from '@/components/mep/MEPNavigation';

export default function MEPLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return (
    <div className="min-h-screen bg-dark-base">
      <header className="border-b border-gray-700 bg-dark-subtle px-6 py-4">
        <h1 className="text-xl font-semibold text-white">MEP Tracking</h1>
        <p className="text-sm text-gray-400">Mechanical, Electrical, Plumbing & Fire Protection</p>
      </header>
      <nav aria-label="MEP navigation">
        <MEPNavigation projectSlug={params.slug} />
      </nav>
      <main id="main-content">
        <Suspense fallback={
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-32 bg-gray-800 rounded-lg" />
              <div className="h-64 bg-gray-800 rounded-lg" />
            </div>
          </div>
        }>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
