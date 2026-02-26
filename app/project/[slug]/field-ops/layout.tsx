import { ReactNode } from 'react';
import FieldOpsNavigation from '@/components/field-ops/FieldOpsNavigation';

export default async function FieldOpsLayout(
  props: {
    children: ReactNode;
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  return (
    <div className="min-h-screen bg-dark-base">
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-6">
        <nav aria-label="Field operations navigation" className="mb-6">
          <FieldOpsNavigation projectSlug={params.slug} />
        </nav>
        {children}
      </main>
    </div>
  );
}
