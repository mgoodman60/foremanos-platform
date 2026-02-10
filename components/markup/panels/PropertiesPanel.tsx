'use client';

import { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MarkupRecord, AnnotationStatus, AnnotationPriority } from '@/lib/markup/markup-types';
import { logger } from '@/lib/logger';

interface PropertiesPanelProps {
  slug: string;
  documentId: string;
  selectedMarkups: MarkupRecord[];
  onUpdate?: () => void;
}

const STATUS_OPTIONS: AnnotationStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS: AnnotationPriority[] = ['low', 'medium', 'high', 'critical'];

export function PropertiesPanel({ slug, documentId, selectedMarkups, onUpdate }: PropertiesPanelProps) {
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<AnnotationStatus>('open');
  const [priority, setPriority] = useState<AnnotationPriority>('medium');
  const [tags, setTags] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (selectedMarkups.length === 1) {
      const markup = selectedMarkups[0];
      setLabel(markup.label || '');
      setStatus(markup.status);
      setPriority(markup.priority);
      setTags(markup.tags.join(', '));
      setIsLocked(!!markup.lockedBy);
    } else if (selectedMarkups.length > 1) {
      setLabel('');
      setTags('');
    }
  }, [selectedMarkups]);

  const handleUpdate = async (field: string, value: unknown) => {
    if (selectedMarkups.length === 0) return;

    try {
      for (const markup of selectedMarkups) {
        const res = await fetch(`/api/projects/${slug}/documents/${documentId}/markups/${markup.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) throw new Error(`Failed to update ${field}`);
      }
      onUpdate?.();
    } catch (error) {
      logger.error('PROPERTIES_PANEL', `Failed to update ${field}`, error);
    }
  };

  const handleToggleLock = async () => {
    if (selectedMarkups.length === 0) return;

    try {
      for (const markup of selectedMarkups) {
        const res = await fetch(`/api/projects/${slug}/documents/${documentId}/markups/${markup.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lockedBy: markup.lockedBy ? null : 'current' }),
        });
        if (!res.ok) throw new Error('Failed to toggle lock');
      }
      onUpdate?.();
    } catch (error) {
      logger.error('PROPERTIES_PANEL', 'Failed to toggle lock', error);
    }
  };

  const handleBatchStatusUpdate = async (newStatus: AnnotationStatus) => {
    setStatus(newStatus);
    await handleUpdate('status', newStatus);
  };

  const handleBatchPriorityUpdate = async (newPriority: AnnotationPriority) => {
    setPriority(newPriority);
    await handleUpdate('priority', newPriority);
  };

  if (selectedMarkups.length === 0) {
    return (
      <div className="border-t bg-white p-4 h-[200px] flex items-center justify-center">
        <p className="text-sm text-gray-500">Select a markup to view properties</p>
      </div>
    );
  }

  const singleMarkup = selectedMarkups.length === 1 ? selectedMarkups[0] : null;

  return (
    <div className="border-t bg-white p-4 h-[200px] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">
          {selectedMarkups.length === 1 ? 'Properties' : `${selectedMarkups.length} markups selected`}
        </h3>
        <Button size="sm" variant="ghost" onClick={handleToggleLock}>
          {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid gap-4">
        {singleMarkup && (
          <>
            <div>
              <Label className="text-xs text-gray-600">Type</Label>
              <p className="text-sm font-medium">{singleMarkup.shapeType.replace(/_/g, ' ')}</p>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Position</Label>
              <p className="text-sm">
                x: {singleMarkup.geometry.x?.toFixed(1) || 'N/A'}, y: {singleMarkup.geometry.y?.toFixed(1) || 'N/A'}
              </p>
            </div>

            {(singleMarkup.geometry.width || singleMarkup.geometry.height) && (
              <div>
                <Label className="text-xs text-gray-600">Dimensions</Label>
                <p className="text-sm">
                  {singleMarkup.geometry.width?.toFixed(1)} × {singleMarkup.geometry.height?.toFixed(1)}
                </p>
              </div>
            )}
          </>
        )}

        {selectedMarkups.length === 1 && (
          <div>
            <Label htmlFor="label" className="text-xs text-gray-600">
              Label
            </Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => handleUpdate('label', label)}
              className="h-8 text-sm"
            />
          </div>
        )}

        <div>
          <Label htmlFor="status" className="text-xs text-gray-600">
            Status
          </Label>
          <Select value={status} onValueChange={handleBatchStatusUpdate}>
            <SelectTrigger id="status" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="priority" className="text-xs text-gray-600">
            Priority
          </Label>
          <Select value={priority} onValueChange={handleBatchPriorityUpdate}>
            <SelectTrigger id="priority" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedMarkups.length === 1 && (
          <div>
            <Label htmlFor="tags" className="text-xs text-gray-600">
              Tags (comma-separated)
            </Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              onBlur={() => handleUpdate('tags', tags.split(',').map((t) => t.trim()).filter(Boolean))}
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
