'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import ReportTemplatesLibrary from '@/components/report-templates-library';

export default function ReportTemplatesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [projectName, setProjectName] = useState<string>('');

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then(res => res.json())
      .then(data => setProjectName(data.project?.name || ''))
      .catch(() => {});
  }, [slug]);

  return (
    <div className="min-h-screen bg-dark-base">
      {/* Header */}
      <div className="border-b border-gray-800 bg-dark-subtle">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link
            href={`/project/${slug}/reports`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <ReportTemplatesLibrary projectSlug={slug} projectName={projectName} />
      </div>
    </div>
  );
}
