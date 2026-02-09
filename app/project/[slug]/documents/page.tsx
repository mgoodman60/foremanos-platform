'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FileText, Loader2 } from 'lucide-react';
import { DocumentLibrary } from '@/components/document-library';

interface Project {
  id: string;
  name: string;
  slug: string;
  documentCount: number;
}

export default function DocumentsPage() {
  const params = useParams();
  const { data: session } = useSession();
  const slug = params?.slug as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      const found = data.projects?.find(
        (p: { slug: string }) => p.slug === slug
      );
      if (found) {
        setProject(found);
      }
    } catch {
      // Project data will be null, page shows error state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      fetchProject();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (!project || !session?.user) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Project not found or not authorized.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <FileText className="h-6 w-6 text-orange-500" />
            Documents
          </h1>
          <p className="text-gray-400 mt-1">
            {project.documentCount} document{project.documentCount !== 1 ? 's' : ''} in {project.name}
          </p>
        </div>

        {/* Document Library */}
        <DocumentLibrary
          userRole={session.user.role || 'guest'}
          projectId={project.id}
          onDocumentsChange={fetchProject}
        />
      </div>
    </div>
  );
}
