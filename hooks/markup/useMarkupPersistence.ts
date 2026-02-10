'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMarkupState } from './useMarkupState';
import type { MarkupRecord, CreateMarkupRequest, UpdateMarkupRequest } from '@/lib/markup/markup-types';

interface UsePersistenceOptions {
  projectSlug: string;
  autoSaveDelay?: number; // milliseconds, default 2000
}

export function useMarkupPersistence({ projectSlug, autoSaveDelay = 2000 }: UsePersistenceOptions) {
  const { documentId, pageNumber, shapesById, shapeIds } = useMarkupState();

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousShapesRef = useRef<Map<string, MarkupRecord>>(new Map());

  // Load markups on mount
  useEffect(() => {
    if (!documentId) return;

    const loadMarkups = async () => {
      try {
        const response = await fetch(`/api/projects/${projectSlug}/documents/${documentId}/markups`);

        if (!response.ok) {
          throw new Error(`Failed to load markups: ${response.statusText}`);
        }

        const data = await response.json();
        const markups = data.markups as MarkupRecord[];

        // Filter by current page and set in store
        const pageMarkups = markups.filter((m) => m.pageNumber === pageNumber);
        useMarkupState.getState().setShapes(pageMarkups);

        previousShapesRef.current = new Map(pageMarkups.map((s) => [s.id, s]));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load markups');
      }
    };

    loadMarkups();
  }, [documentId, pageNumber, projectSlug]);

  // Auto-save changes with debounce
  useEffect(() => {
    if (!documentId) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule save
    saveTimeoutRef.current = setTimeout(() => {
      saveChanges();
    }, autoSaveDelay);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [shapesById, documentId, autoSaveDelay]);

  const saveChanges = useCallback(async () => {
    if (!documentId || isSaving) return;

    const currentShapes = shapesById;
    const previousShapes = previousShapesRef.current;

    // Detect changes
    const toCreate: MarkupRecord[] = [];
    const toUpdate: { id: string; shape: MarkupRecord }[] = [];
    const toDelete: string[] = [];

    // Find new and updated shapes
    currentShapes.forEach((shape, id) => {
      const prev = previousShapes.get(id);
      if (!prev) {
        toCreate.push(shape);
      } else if (JSON.stringify(prev) !== JSON.stringify(shape)) {
        toUpdate.push({ id, shape });
      }
    });

    // Find deleted shapes
    previousShapes.forEach((_, id) => {
      if (!currentShapes.has(id)) {
        toDelete.push(id);
      }
    });

    // No changes
    if (toCreate.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Create new shapes
      for (const shape of toCreate) {
        const request: CreateMarkupRequest = {
          pageNumber: shape.pageNumber,
          shapeType: shape.shapeType,
          geometry: shape.geometry,
          style: shape.style,
          content: shape.content,
          label: shape.label,
          layerId: shape.layerId,
          measurementValue: shape.measurementValue,
          measurementUnit: shape.measurementUnit,
          calibrationId: shape.calibrationId,
          symbolId: shape.symbolId,
        };

        const response = await fetch(`/api/projects/${projectSlug}/documents/${documentId}/markups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`Failed to create markup: ${response.statusText}`);
        }
      }

      // Update existing shapes
      for (const { id, shape } of toUpdate) {
        const request: UpdateMarkupRequest = {
          geometry: shape.geometry,
          style: shape.style,
          content: shape.content,
          label: shape.label,
          status: shape.status,
          priority: shape.priority,
          tags: shape.tags,
          layerId: shape.layerId,
          measurementValue: shape.measurementValue,
          measurementUnit: shape.measurementUnit,
        };

        const response = await fetch(`/api/projects/${projectSlug}/documents/${documentId}/markups/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`Failed to update markup: ${response.statusText}`);
        }
      }

      // Delete removed shapes
      for (const id of toDelete) {
        const response = await fetch(`/api/projects/${projectSlug}/documents/${documentId}/markups/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error(`Failed to delete markup: ${response.statusText}`);
        }
      }

      // Update reference
      previousShapesRef.current = new Map(currentShapes);
      setLastSaved(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save markups');
    } finally {
      setIsSaving(false);
    }
  }, [documentId, projectSlug, shapesById, isSaving]);

  const forceSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveChanges();
  }, [saveChanges]);

  return {
    isSaving,
    lastSaved,
    error,
    forceSave,
  };
}
