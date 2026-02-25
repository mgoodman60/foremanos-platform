'use client';

import Link from 'next/link';
import { ChevronRight, Home, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import LegendBrowser from '@/components/legend-browser';
import { logger } from '@/lib/logger';

interface Project {
  id: string;
  name: string;
  slug: string;
  documentCount: number;
  ownerId: string;
}

interface LegendsPageContentProps {
  project: Project;
}

export default function LegendsPageContent({ project }: LegendsPageContentProps) {
  return (
    <div className="min-h-screen bg-dark-surface">
      {/* Header with Breadcrumbs */}
      <header className="bg-dark-surface border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumbs */}
            <nav className="flex items-center text-sm text-gray-400">
              <Link
                href="/dashboard"
                className="flex items-center text-gray-200 hover:text-orange-400 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="ml-2">Dashboard</span>
              </Link>
              <ChevronRight className="w-4 h-4 mx-2" />
              <Link
                href={`/project/${project.slug}`}
                className="text-gray-200 hover:text-orange-400 transition-colors"
              >
                {project.name}
              </Link>
              <ChevronRight className="w-4 h-4 mx-2" />
              <span className="text-slate-50 font-medium flex items-center">
                <BookOpen className="w-4 h-4 mr-2" />
                Legend Library
              </span>
            </nav>

            {/* Back Button */}
            <Link
              href={`/project/${project.slug}`}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-dark-card border border-gray-600 rounded-lg hover:bg-dark-surface transition-colors"
            >
              Back to Project
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LegendBrowser
          projectSlug={project.slug}
          onSymbolSelect={(symbol, description) => {
            logger.info('LEGENDS_PAGE', 'Symbol selected', { symbol, description });
            toast.success(`Selected: ${symbol}`);
          }}
        />
      </main>
    </div>
  );
}
