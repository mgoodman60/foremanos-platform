'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import CrewManagement from '@/components/crew-management';
import { Button } from '@/components/ui/button';

interface Project {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

export default function CrewsPage() {
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

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface">
      {/* Header */}
      <header className="bg-dark-surface border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <nav className="flex items-center text-sm text-gray-400 min-w-0 flex-1">
              <button
                onClick={() => router.push('/dashboard')}
                className="hover:text-gray-200 transition-colors flex-shrink-0"
              >
                <Home className="w-4 h-4" />
              </button>
              <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
              <button
                onClick={() => router.push(`/project/${project.slug}`)}
                className="hover:text-gray-200 transition-colors truncate"
              >
                {project.name}
              </button>
              <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
              <span className="text-[#F8FAFC] font-medium">Crews</span>
            </nav>

            {/* Back Button */}
            <Button
              onClick={() => router.push(`/project/${project.slug}`)}
              variant="outline"
              className="ml-4 border-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Project
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CrewManagement />
      </main>
    </div>
  );
}
