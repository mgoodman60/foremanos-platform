'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Layers, ChevronRight, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { getDisciplineColor } from '@/lib/discipline-colors';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface DisciplineSheet {
  discipline: string;
  sheetNumber: string;
  documentId: string;
  chunkId: string;
  pageIndex: number;
  scaleRatio: number;
  scaleFactor: number;
}

interface DisciplineOverlayPanelProps {
  projectSlug: string;
  baseSheetNumber: string | null;
  panZoomTransform: { transform: string; transformOrigin: string };
  containerRef: React.RefObject<HTMLDivElement>;
  visible: boolean;
  onToggle: () => void;
}

interface DisciplineLayerState {
  sheet: DisciplineSheet;
  imageUrl: string | null;
  loading: boolean;
  visible: boolean;
  opacity: number;
  lineEmphasis: boolean;
}

export function DisciplineOverlayPanel({
  projectSlug,
  baseSheetNumber,
  panZoomTransform,
  containerRef,
  visible,
  onToggle,
}: DisciplineOverlayPanelProps) {
  const [layers, setLayers] = useState<Map<string, DisciplineLayerState>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseScaleRatio, setBaseScaleRatio] = useState<number>(48.0);

  // Fetch available discipline sheets
  const fetchDisciplineSheets = useCallback(async () => {
    if (!baseSheetNumber) {
      setError('No base sheet selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/floor-plans/discipline-sheets?baseSheet=${baseSheetNumber}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch discipline sheets');
      }

      const data = await response.json();
      setBaseScaleRatio(data.baseScaleRatio || 48.0);

      // Initialize layer states
      const newLayers = new Map<string, DisciplineLayerState>();
      for (const sheet of data.sheets) {
        newLayers.set(sheet.discipline, {
          sheet,
          imageUrl: null,
          loading: false,
          visible: false,
          opacity: 40,
          lineEmphasis: false,
        });
      }

      setLayers(newLayers);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load discipline sheets';
      setError(message);
      logger.error('DISCIPLINE_OVERLAY', 'Failed to fetch discipline sheets', err as Error, {
        projectSlug,
        baseSheetNumber,
      });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [projectSlug, baseSheetNumber]);

  // Fetch image for a specific discipline
  const fetchImage = useCallback(async (discipline: string) => {
    const layer = layers.get(discipline);
    if (!layer || layer.imageUrl || layer.loading) return;

    setLayers((prev) => {
      const next = new Map(prev);
      const current = next.get(discipline);
      if (current) {
        next.set(discipline, { ...current, loading: true });
      }
      return next;
    });

    try {
      const { documentId, pageIndex } = layer.sheet;
      const response = await fetch(
        `/api/documents/${documentId}/page-image?page=${pageIndex + 1}&format=png&maxWidth=2000`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch image for ${discipline}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      setLayers((prev) => {
        const next = new Map(prev);
        const current = next.get(discipline);
        if (current) {
          next.set(discipline, { ...current, imageUrl: blobUrl, loading: false });
        }
        return next;
      });
    } catch (err) {
      logger.error('DISCIPLINE_OVERLAY', `Failed to fetch image for ${discipline}`, err as Error);
      toast.error(`Failed to load ${discipline} overlay`);

      setLayers((prev) => {
        const next = new Map(prev);
        const current = next.get(discipline);
        if (current) {
          next.set(discipline, { ...current, loading: false });
        }
        return next;
      });
    }
  }, [layers]);

  // Load discipline sheets on mount or when base sheet changes
  useEffect(() => {
    if (baseSheetNumber) {
      fetchDisciplineSheets();
    }
  }, [fetchDisciplineSheets, baseSheetNumber]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      layers.forEach((layer) => {
        if (layer.imageUrl) {
          URL.revokeObjectURL(layer.imageUrl);
        }
      });
    };
  }, [layers]);

  // Toggle visibility for a discipline
  const toggleVisibility = (discipline: string) => {
    const layer = layers.get(discipline);
    if (!layer) return;

    const willBeVisible = !layer.visible;

    setLayers((prev) => {
      const next = new Map(prev);
      const current = next.get(discipline);
      if (current) {
        next.set(discipline, { ...current, visible: willBeVisible });
      }
      return next;
    });

    // Fetch image if toggling on and not yet loaded
    if (willBeVisible && !layer.imageUrl && !layer.loading) {
      fetchImage(discipline);
    }
  };

  // Update opacity for a discipline
  const updateOpacity = (discipline: string, opacity: number) => {
    setLayers((prev) => {
      const next = new Map(prev);
      const current = next.get(discipline);
      if (current) {
        next.set(discipline, { ...current, opacity });
      }
      return next;
    });
  };

  // Toggle line emphasis
  const toggleLineEmphasis = (discipline: string) => {
    setLayers((prev) => {
      const next = new Map(prev);
      const current = next.get(discipline);
      if (current) {
        next.set(discipline, { ...current, lineEmphasis: !current.lineEmphasis });
      }
      return next;
    });
  };

  // Show all layers
  const showAll = () => {
    setLayers((prev) => {
      const next = new Map(prev);
      next.forEach((layer, discipline) => {
        next.set(discipline, { ...layer, visible: true });
        if (!layer.imageUrl && !layer.loading) {
          fetchImage(discipline);
        }
      });
      return next;
    });
  };

  // Hide all layers
  const hideAll = () => {
    setLayers((prev) => {
      const next = new Map(prev);
      next.forEach((layer, discipline) => {
        next.set(discipline, { ...layer, visible: false });
      });
      return next;
    });
  };

  const sortedLayers = Array.from(layers.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <>
      {/* Overlay images rendered in the floor plan container */}
      {containerRef.current &&
        sortedLayers.map(([discipline, layer]) => {
          if (!layer.visible || !layer.imageUrl) return null;

          const colors = getDisciplineColor(discipline);
          const hasScaleMismatch = Math.abs(layer.sheet.scaleFactor - 1.0) > 0.01;

          const imageStyle: React.CSSProperties = {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            opacity: layer.opacity / 100,
            mixBlendMode: 'multiply',
            transform: panZoomTransform.transform,
            transformOrigin: panZoomTransform.transformOrigin,
            filter: layer.lineEmphasis ? 'contrast(1.5)' : 'none',
          };

          // Apply scale normalization if needed
          if (hasScaleMismatch) {
            const additionalTransform = `scale(${layer.sheet.scaleFactor})`;
            imageStyle.transform = `${panZoomTransform.transform} ${additionalTransform}`;
          }

          return (
            <img
              key={discipline}
              src={layer.imageUrl}
              alt={`${discipline} overlay`}
              style={imageStyle}
            />
          );
        })}

      {/* Control panel */}
      <div
        className={`fixed top-20 right-4 z-40 transition-transform duration-300 ${
          visible ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        }`}
      >
        <div className="bg-dark-surface border border-gray-700 rounded-lg shadow-lg w-80 max-h-[calc(100vh-6rem)] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-500" aria-hidden="true" />
              <h3 className="font-semibold text-white">MEP Layers</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && layers.size === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                No MEP sheets found for this floor
              </div>
            )}

            {sortedLayers.map(([discipline, layer]) => {
              const colors = getDisciplineColor(discipline);
              const hasScaleMismatch = Math.abs(layer.sheet.scaleFactor - 1.0) > 0.01;

              return (
                <div
                  key={discipline}
                  className="p-3 bg-dark-base border border-gray-700 rounded-lg space-y-2"
                >
                  {/* Discipline header with visibility toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colors.dot }}
                      />
                      <span className="text-sm font-medium text-white">
                        {discipline}
                      </span>
                      {hasScaleMismatch && (
                        <Badge
                          variant="outline"
                          className="text-xs border-yellow-700 text-yellow-400"
                        >
                          Scale mismatch
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleVisibility(discipline)}
                      className="h-7 w-7 p-0"
                    >
                      {layer.visible ? (
                        <Eye className="w-4 h-4 text-orange-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                  </div>

                  {/* Sheet number */}
                  <div className="text-xs text-gray-400">
                    Sheet: {layer.sheet.sheetNumber}
                  </div>

                  {layer.visible && (
                    <>
                      {/* Opacity slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">Opacity</span>
                          <span className="text-gray-300">{layer.opacity}%</span>
                        </div>
                        <Slider
                          value={[layer.opacity]}
                          onValueChange={([value]) => updateOpacity(discipline, value)}
                          min={0}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                      </div>

                      {/* Line emphasis toggle */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={layer.lineEmphasis}
                          onChange={() => toggleLineEmphasis(discipline)}
                          className="w-4 h-4 rounded border-gray-600 bg-dark-base text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-300">Line emphasis</span>
                      </label>
                    </>
                  )}

                  {layer.loading && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                      <span>Loading overlay...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer with bulk actions */}
          {!loading && layers.size > 0 && (
            <div className="p-4 border-t border-gray-700 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={showAll}
                className="flex-1 border-gray-600 hover:bg-dark-hover"
              >
                Show All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={hideAll}
                className="flex-1 border-gray-600 hover:bg-dark-hover"
              >
                Hide All
              </Button>
            </div>
          )}
        </div>

        {/* Floating toggle button when panel is closed */}
        {!visible && (
          <Button
            onClick={onToggle}
            className="absolute -left-12 top-0 bg-dark-surface border border-gray-700 hover:bg-dark-hover"
            size="sm"
          >
            <Layers className="w-4 h-4" />
          </Button>
        )}
      </div>
    </>
  );
}
