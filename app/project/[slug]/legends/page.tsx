'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronRight, Home, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import LegendBrowser from '@/components/legend-browser';

interface Project {
  id: string;
  name: string;
  slug: string;
}

export default function LegendsPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && slug) {
      fetchProject();
    }
  }, [status, slug, router]);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
      } else if (res.status === 403) {
        toast.error('You do not have access to this project');
        router.push('/dashboard');
      } else {
        toast.error('Project not found');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316] mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Breadcrumbs */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumbs */}
            <nav className="flex items-center text-sm text-gray-600">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center hover:text-blue-600 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="ml-2">Dashboard</span>
              </button>
              <ChevronRight className="w-4 h-4 mx-2" />
              <button
                onClick={() => router.push(`/project/${project.slug}`)}
                className="hover:text-blue-600 transition-colors"
              >
                {project.name}
              </button>
              <ChevronRight className="w-4 h-4 mx-2" />
              <span className="text-gray-900 font-medium flex items-center">
                <BookOpen className="w-4 h-4 mr-2" />
                Legend Library
              </span>
            </nav>

            {/* Back Button */}
            <button
              onClick={() => router.push(`/project/${project.slug}`)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Project
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LegendBrowser
          projectSlug={slug}
          onSymbolSelect={(symbol, description) => {
            console.log('Selected symbol:', symbol, description);
            toast.success(`Selected: ${symbol}`);
          }}
        />
      </main>
    </div>
  );
}
