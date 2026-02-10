'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import type { MarkupLayerRecord } from '@/lib/markup/markup-types';
import { logger } from '@/lib/logger';

interface LayerPanelProps {
  slug: string;
  documentId: string;
  onLayerChange?: () => void;
}

export function LayerPanel({ slug, documentId, onLayerChange }: LayerPanelProps) {
  const [layers, setLayers] = useState<MarkupLayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    fetchLayers();
  }, [slug, documentId]);

  const fetchLayers = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/layers`);
      if (!res.ok) throw new Error('Failed to fetch layers');
      const data = await res.json();
      setLayers(data.layers || []);
    } catch (error) {
      logger.error('LAYER_PANEL', 'Failed to fetch layers', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (layerId: string, visible: boolean) => {
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/layers/${layerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !visible }),
      });
      if (!res.ok) throw new Error('Failed to update visibility');
      await fetchLayers();
      onLayerChange?.();
    } catch (error) {
      logger.error('LAYER_PANEL', 'Failed to toggle visibility', error);
    }
  };

  const handleToggleLock = async (layerId: string, locked: boolean) => {
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/layers/${layerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: !locked }),
      });
      if (!res.ok) throw new Error('Failed to update lock');
      await fetchLayers();
      onLayerChange?.();
    } catch (error) {
      logger.error('LAYER_PANEL', 'Failed to toggle lock', error);
    }
  };

  const handleOpacityChange = async (layerId: string, opacity: number) => {
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/layers/${layerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opacity }),
      });
      if (!res.ok) throw new Error('Failed to update opacity');
      setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, opacity } : l)));
      onLayerChange?.();
    } catch (error) {
      logger.error('LAYER_PANEL', 'Failed to update opacity', error);
    }
  };

  const handleRename = async (layerId: string) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/layers/${layerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to rename layer');
      await fetchLayers();
      setEditingId(null);
      onLayerChange?.();
    } catch (error) {
      logger.error('LAYER_PANEL', 'Failed to rename layer', error);
    }
  };

  const handleDelete = async (layerId: string) => {
    if (!confirm('Delete this layer? Markups on this layer will be moved to the default layer.')) return;
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/layers/${layerId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete layer');
      await fetchLayers();
      onLayerChange?.();
    } catch (error) {
      logger.error('LAYER_PANEL', 'Failed to delete layer', error);
    }
  };

  const handleAddLayer = async () => {
    const name = prompt('Layer name:');
    if (!name?.trim()) return;
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color: '#3B82F6' }),
      });
      if (!res.ok) {
        const error = await res.json();
        if (res.status === 409) {
          alert('A layer with this name already exists');
        } else {
          throw new Error(error.error || 'Failed to create layer');
        }
        return;
      }
      await fetchLayers();
      onLayerChange?.();
    } catch (error) {
      logger.error('LAYER_PANEL', 'Failed to create layer', error);
    }
  };

  if (loading) {
    return (
      <div className="w-[260px] border-l bg-white p-4">
        <div className="text-sm text-gray-500">Loading layers...</div>
      </div>
    );
  }

  return (
    <div className="w-[260px] border-l bg-white flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Layers</h3>
        <Button size="sm" variant="ghost" onClick={handleAddLayer}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {layers.map((layer) => (
          <div key={layer.id} className="mb-3 p-2 border rounded hover:bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => handleToggleVisibility(layer.id, layer.visible)}>
                {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
              </button>
              <button onClick={() => handleToggleLock(layer.id, layer.locked)}>
                {layer.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-gray-400" />}
              </button>
              <div className="w-4 h-4 rounded" style={{ backgroundColor: layer.color }} />
              {editingId === layer.id ? (
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRename(layer.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(layer.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="h-6 text-sm flex-1"
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 text-sm cursor-pointer"
                  onClick={() => {
                    setEditingId(layer.id);
                    setEditingName(layer.name);
                  }}
                >
                  {layer.name}
                </span>
              )}
              <button onClick={() => handleDelete(layer.id)} className="text-gray-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16">Opacity</span>
              <Slider
                value={[layer.opacity * 100]}
                onValueChange={(values) => handleOpacityChange(layer.id, values[0] / 100)}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 w-8">{Math.round(layer.opacity * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
