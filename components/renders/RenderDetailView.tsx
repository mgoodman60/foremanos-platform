'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RenderActionBar } from './RenderActionBar';
import type { ProjectRender } from './RenderGallery';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface RenderDetailViewProps {
  render: ProjectRender;
  onClose: () => void;
  onUpdate: (render: ProjectRender) => void;
  onDelete: (id: string) => void;
  projectSlug: string;
}

export function RenderDetailView({
  render,
  onClose,
  onUpdate,
  onDelete,
  projectSlug,
}: RenderDetailViewProps) {
  const [imageZoomed, setImageZoomed] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);

  const containerRef = useFocusTrap({ isActive: true, onEscape: onClose });

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/renders/${render.id}/download`
      );
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `render-${render.id}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      // Download failed silently
    }
  };

  const handleRegenerate = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/renders/${render.id}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        }
      );
      if (!response.ok) throw new Error('Regeneration failed');

      const data = await response.json();
      onUpdate({ ...render, ...data.render, status: 'generating' });
    } catch {
      // Regeneration failed silently
    }
  };

  const handleFavorite = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/renders/${render.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFavorite: !render.isFavorite }),
        }
      );
      if (!response.ok) throw new Error('Update failed');

      onUpdate({ ...render, isFavorite: !render.isFavorite });
    } catch {
      // Favorite toggle failed silently
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/renders/${render.id}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Delete failed');

      onDelete(render.id);
    } catch {
      // Delete failed silently
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-labelledby="render-detail-title"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-3xl bg-dark-subtle border-l border-gray-800 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <h2 id="render-detail-title" className="text-lg font-semibold text-white truncate">
            {render.title ||
              `${render.viewType} - ${render.style} Render`}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white shrink-0"
            aria-label="Close detail view"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Image */}
        <div className="p-4 shrink-0">
          <div
            className={`relative rounded-lg overflow-hidden bg-dark-base cursor-zoom-in ${
              imageZoomed ? 'fixed inset-4 z-60 cursor-zoom-out' : 'aspect-video'
            }`}
            onClick={() => setImageZoomed(!imageZoomed)}
            role="button"
            tabIndex={0}
            aria-label={imageZoomed ? 'Zoom out' : 'Zoom in'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setImageZoomed(!imageZoomed);
              }
              if (e.key === 'Escape' && imageZoomed) {
                setImageZoomed(false);
              }
            }}
          >
            {render.imageUrl || render.thumbnailUrl ? (
              <Image
                src={render.imageUrl || render.thumbnailUrl || ''}
                alt={render.title || 'Architectural render'}
                fill
                unoptimized
                className={imageZoomed ? 'object-contain' : 'object-cover'}
              />
            ) : (
              <div className="aspect-video flex items-center justify-center text-gray-400">
                No image available
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-600 mt-2 text-center">
            AI-generated conceptual visualization — for illustrative purposes only.
          </p>
        </div>

        {/* Action bar */}
        <div className="px-4 pb-4 shrink-0">
          <RenderActionBar
            render={render}
            onDownload={handleDownload}
            onRegenerate={handleRegenerate}
            onAdjust={() => {
              window.dispatchEvent(
                new CustomEvent('openRenderWizard', {
                  detail: { adjustFrom: render },
                })
              );
              onClose();
            }}
            onFavorite={handleFavorite}
            onDelete={handleDelete}
          />
        </div>

        {/* Collapsible panels */}
        <div className="flex-1 px-4 pb-4 space-y-2">
          {/* Metadata */}
          <CollapsiblePanel
            title="Metadata"
            open={metadataOpen}
            onToggle={() => setMetadataOpen(!metadataOpen)}
          >
            <div className="space-y-2 text-sm">
              <MetaRow
                label="Created by"
                value={render.createdBy?.name || render.createdBy?.email || 'Unknown'}
              />
              <MetaRow
                label="Date"
                value={new Date(render.createdAt).toLocaleString()}
              />
              {render.generationTime != null && (
                <MetaRow
                  label="Generation time"
                  value={`${(render.generationTime / 1000).toFixed(1)}s`}
                />
              )}
              {render.cost != null && (
                <MetaRow
                  label="Cost"
                  value={`$${render.cost.toFixed(4)}`}
                />
              )}
              {render.provider && (
                <MetaRow label="Provider" value={render.provider} />
              )}
              <MetaRow label="View type" value={render.viewType} />
              <MetaRow label="Style" value={render.style} />
              {render.cameraAngle && (
                <MetaRow label="Camera angle" value={render.cameraAngle} />
              )}
              {render.qualityTier && (
                <MetaRow label="Quality tier" value={render.qualityTier} />
              )}
            </div>
          </CollapsiblePanel>

          {/* Prompt */}
          <CollapsiblePanel
            title="Assembled Prompt"
            open={promptOpen}
            onToggle={() => setPromptOpen(!promptOpen)}
          >
            {render.assembledPrompt ? (
              <textarea
                readOnly
                value={render.assembledPrompt}
                className="w-full h-32 bg-dark-base border border-gray-700 rounded-md p-3 text-sm text-gray-300 resize-y"
                aria-label="Assembled prompt"
              />
            ) : (
              <p className="text-sm text-gray-400">No prompt data available</p>
            )}
            {render.revisedPrompt && (
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-1">Revised Prompt</p>
                <textarea
                  readOnly
                  value={render.revisedPrompt}
                  className="w-full h-24 bg-dark-base border border-gray-700 rounded-md p-3 text-sm text-gray-300 resize-y"
                  aria-label="Revised prompt"
                />
              </div>
            )}
          </CollapsiblePanel>

          {/* Data snapshot */}
          <CollapsiblePanel
            title="Data Snapshot"
            open={dataOpen}
            onToggle={() => setDataOpen(!dataOpen)}
          >
            {render.dataSnapshot ? (
              <pre className="w-full max-h-64 overflow-auto bg-dark-base border border-gray-700 rounded-md p-3 text-xs text-gray-300">
                {JSON.stringify(render.dataSnapshot, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-gray-400">No data snapshot available</p>
            )}
          </CollapsiblePanel>
        </div>
      </div>
    </div>
  );
}

function CollapsiblePanel({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:bg-dark-hover transition-colors"
        aria-expanded={open}
        style={{ minHeight: '44px' }}
      >
        {title}
        {open ? (
          <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
