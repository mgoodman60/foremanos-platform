import { ReactNode } from 'react';
import FieldOpsNavigation from '@/components/field-ops/FieldOpsNavigation';

export default function FieldOpsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { slug: string };
}) {
  return (
    <div className="min-h-screen bg-[#0D1117]">
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-6">
        <nav aria-label="Field operations navigation" className="mb-6">
          <FieldOpsNavigation projectSlug={params.slug} />
        </nav>
        {children}
      </main>
    </div>
  );
}
