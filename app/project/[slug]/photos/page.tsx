import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import PhotoDocumentationHub from '@/components/photo-documentation-hub';

export default function PhotoDocumentationPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-dark-base">
      {/* Header */}
      <div className="border-b border-gray-800 bg-dark-subtle">
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
        <PhotoDocumentationHub projectSlug={params.slug} />
      </div>
    </div>
  );
}
