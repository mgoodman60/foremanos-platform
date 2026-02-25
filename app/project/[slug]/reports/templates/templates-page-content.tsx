'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import ReportTemplatesLibrary from '@/components/report-templates-library';

export function TemplatesPageContent({ projectSlug }: { projectSlug: string }) {
  const [projectName, setProjectName] = useState<string>('');

  useEffect(() => {
    fetch(`/api/projects/${projectSlug}`)
      .then(res => res.json())
      .then(data => setProjectName(data.project?.name || ''))
      .catch(() => {});
  }, [projectSlug]);

  return (
    <div className="min-h-screen bg-dark-base">
      {/* Header */}
      <div className="border-b border-gray-800 bg-dark-subtle">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link
            href={`/project/${projectSlug}/reports`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <ReportTemplatesLibrary projectSlug={projectSlug} projectName={projectName} />
      </div>
    </div>
  );
}
