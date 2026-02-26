import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { DrawingClassificationBrowser } from '@/components/drawing-classification-browser';

export default async function DrawingTypesPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return (
    <div className="min-h-screen bg-dark-surface">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link
            href={`/project/${params.slug}`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Project
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <DrawingClassificationBrowser projectSlug={params.slug} />
      </div>
    </div>
  );
}
