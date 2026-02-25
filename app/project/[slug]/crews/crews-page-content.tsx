'use client';

import Link from 'next/link';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';
import CrewManagement from '@/components/crew-management';
import { Button } from '@/components/ui/button';

interface Project {
  id: string;
  name: string;
  slug: string;
  documentCount: number;
  ownerId: string;
}

interface CrewsPageContentProps {
  project: Project;
}

export default function CrewsPageContent({ project }: CrewsPageContentProps) {
  return (
    <div className="min-h-screen bg-dark-surface">
      {/* Header */}
      <header className="bg-dark-surface border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <nav className="flex items-center text-sm text-gray-400 min-w-0 flex-1">
              <Link
                href="/dashboard"
                className="hover:text-gray-200 transition-colors flex-shrink-0"
              >
                <Home className="w-4 h-4" />
              </Link>
              <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
              <Link
                href={`/project/${project.slug}`}
                className="hover:text-gray-200 transition-colors truncate"
              >
                {project.name}
              </Link>
              <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
              <span className="text-slate-50 font-medium">Crews</span>
            </nav>

            {/* Back Button */}
            <Button
              asChild
              variant="outline"
              className="ml-4 border-gray-700"
            >
              <Link href={`/project/${project.slug}`}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Project
              </Link>
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
