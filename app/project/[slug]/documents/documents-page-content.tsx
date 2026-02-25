'use client';

import { useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { DocumentLibrary } from '@/components/document-library';

interface Project {
  id: string;
  name: string;
  slug: string;
  documentCount: number;
}

interface DocumentsPageContentProps {
  project: Project;
  userRole: string;
}

export default function DocumentsPageContent({ project, userRole }: DocumentsPageContentProps) {
  const [documentCount, setDocumentCount] = useState(project.documentCount);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      const found = data.projects?.find(
        (p: { slug: string; documentCount: number }) => p.slug === project.slug
      );
      if (found) {
        setDocumentCount(found.documentCount);
      }
    } catch {
      // Count stays at current value on error
    }
  }, [project.slug]);

  return (
    <div className="min-h-screen bg-dark-surface">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <FileText className="h-6 w-6 text-orange-500" aria-hidden="true" />
            Documents
          </h1>
          <p className="text-gray-400 mt-1">
            {documentCount} document{documentCount !== 1 ? 's' : ''} in {project.name}
          </p>
        </div>

        {/* Document Library */}
        <DocumentLibrary
          userRole={userRole}
          projectId={project.id}
          onDocumentsChange={fetchProject}
        />
      </div>
    </div>
  );
}
