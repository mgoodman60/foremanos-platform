'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Paintbrush } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RenderGalleryCard } from './RenderGalleryCard';
import { RenderGalleryFilters } from './RenderGalleryFilters';
import { RenderDetailView } from './RenderDetailView';

export interface ProjectRender {
  id: string;
  title: string | null;
  viewType: string;
  style: string;
  status: string;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  imageKey: string | null;
  imageUrl: string | null;
  isFavorite: boolean;
  cameraAngle: string | null;
  qualityTier: string | null;
  provider: string | null;
  assembledPrompt: string | null;
  revisedPrompt: string | null;
  dataSnapshot: Record<string, unknown> | null;
  generationTime: number | null;
  cost: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string | null; email: string } | null;
}

interface RenderGalleryProps {
  projectSlug: string;
}

interface Filters {
  viewType: string;
  style: string;
  status: string;
}

export function RenderGallery({ projectSlug }: RenderGalleryProps) {
  const [renders, setRenders] = useState<ProjectRender[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    viewType: 'all',
    style: 'all',
    status: 'all',
  });
  const [selectedRender, setSelectedRender] = useState<ProjectRender | null>(null);

  const fetchRenders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (filters.viewType !== 'all') params.set('viewType', filters.viewType);
      if (filters.style !== 'all') params.set('style', filters.style);
      if (filters.status !== 'all') params.set('status', filters.status);

      const response = await fetch(`/api/projects/${projectSlug}/renders?${params}`);
      if (!response.ok) throw new Error('Failed to fetch renders');

      const data = await response.json();
      setRenders(data.renders || []);
    } catch {
      setRenders([]);
    } finally {
      setLoading(false);
    }
  }, [projectSlug, filters]);

  useEffect(() => {
    fetchRenders();
  }, [fetchRenders]);

  // Listen for refresh event from wizard
  useEffect(() => {
    const handleRefresh = () => {
      fetchRenders();
    };

    window.addEventListener('refreshRenderGallery', handleRefresh);
    return () => window.removeEventListener('refreshRenderGallery', handleRefresh);
  }, [fetchRenders]);

  const handleRenderUpdate = (updated: ProjectRender) => {
    setRenders((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
    setSelectedRender(updated);
  };

  const handleRenderDelete = (id: string) => {
    setRenders((prev) => prev.filter((r) => r.id !== id));
    setSelectedRender(null);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (renders.length === 0 && filters.viewType === 'all' && filters.style === 'all' && filters.status === 'all') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
          <Paintbrush className="h-8 w-8 text-orange-400" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No renders yet</h2>
        <p className="text-sm text-gray-400 max-w-md mb-6">
          Create your first architectural rendering. AI will generate a visualization based on your project data and uploaded plans.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          AI-generated conceptual visualization — for illustrative purposes only.
        </p>
        <Button
          className="bg-orange-600 hover:bg-orange-700"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('openRenderWizard'));
          }}
        >
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          New Render
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 space-y-4">
      <div className="flex items-center justify-between">
        <RenderGalleryFilters
          filters={filters}
          onFiltersChange={setFilters}
          renderCount={renders.length}
        />
        <Button
          className="bg-orange-600 hover:bg-orange-700 ml-4 shrink-0"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('openRenderWizard'));
          }}
        >
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          New Render
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {renders.map((render) => (
          <RenderGalleryCard
            key={render.id}
            render={render}
            onClick={() => setSelectedRender(render)}
          />
        ))}
      </div>

      {renders.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Paintbrush className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
          <p>No renders match your filters</p>
        </div>
      )}

      {selectedRender && (
        <RenderDetailView
          render={selectedRender}
          onClose={() => setSelectedRender(null)}
          onUpdate={handleRenderUpdate}
          onDelete={handleRenderDelete}
          projectSlug={projectSlug}
        />
      )}
    </div>
  );
}
