'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RenderItem {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
}

interface RenderPickerProps {
  projectSlug: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxSelections?: number;
}

export function RenderPicker({
  projectSlug,
  selectedIds,
  onSelectionChange,
  maxSelections = 4,
}: RenderPickerProps) {
  const [renders, setRenders] = useState<RenderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRenders() {
      try {
        const params = new URLSearchParams({ status: 'completed', limit: '50' });
        const response = await fetch(`/api/projects/${projectSlug}/renders?${params}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setRenders(data.renders || []);
      } catch {
        setRenders([]);
      } finally {
        setLoading(false);
      }
    }
    fetchRenders();
  }, [projectSlug]);

  const handleToggle = (id: string) => {
    const idx = selectedIds.indexOf(id);
    if (idx >= 0) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else if (selectedIds.length < maxSelections) {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (renders.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No completed renders yet
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {renders.map((render) => {
        const selIndex = selectedIds.indexOf(render.id);
        const isSelected = selIndex >= 0;
        const imgSrc = render.thumbnailUrl || render.imageUrl;

        return (
          <button
            key={render.id}
            type="button"
            onClick={() => handleToggle(render.id)}
            className={cn(
              'relative aspect-square rounded border-2 overflow-hidden transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected
                ? 'border-primary'
                : 'border-border hover:border-muted-foreground/50'
            )}
            aria-label={`${isSelected ? 'Deselect' : 'Select'} render ${render.title || render.id}`}
            aria-pressed={isSelected}
          >
            {imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc}
                alt={render.title || 'Render'}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-muted flex items-center justify-center text-muted-foreground text-xs">
                No image
              </div>
            )}

            {isSelected && (
              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                {selIndex + 1}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
