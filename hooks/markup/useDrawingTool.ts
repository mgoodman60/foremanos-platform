'use client';

import { useCallback, useState } from 'react';
import { useMarkupState } from './useMarkupState';
import { konvaToPdf } from '@/lib/markup/geometry-utils';
import type { MarkupRecord, MarkupGeometry } from '@/lib/markup/markup-types';

interface MousePosition {
  x: number;
  y: number;
}

export function useDrawingTool() {
  const {
    activeTool,
    pageHeight,
    zoom,
    isDrawing,
    drawingPoints,
    activeStyle,
    documentId,
    projectId,
    pageNumber,
    activeLayerId,
    selectedIds,
    shapesById,
    startDrawing,
    updateDrawingPoints,
    finishDrawing,
    cancelDrawing,
    addShape,
    selectShape,
    clearSelection,
    setPan,
    panX,
    panY,
  } = useMarkupState();

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<MousePosition | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert to PDF coordinates
      const pdfCoords = konvaToPdf(x, y, pageHeight, zoom);

      if (activeTool === 'select') {
        // Click to select shape
        let found = false;
        for (const id of Array.from(selectedIds)) {
          const shape = shapesById.get(id);
          if (shape && isPointInShape(pdfCoords, shape)) {
            found = true;
            break;
          }
        }

        if (!found) {
          clearSelection();
        }

        // Start drag-select
        setIsDragging(true);
        setDragStartPos({ x, y });
        return;
      }

      if (activeTool === 'pan') {
        setIsDragging(true);
        setDragStartPos({ x, y });
        return;
      }

      // Start drawing
      if (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'rectangle' || activeTool === 'ellipse') {
        startDrawing([pdfCoords.x, pdfCoords.y]);
      } else if (activeTool === 'freehand' || activeTool === 'highlighter') {
        startDrawing([pdfCoords.x, pdfCoords.y]);
      } else if (activeTool === 'polyline') {
        if (!isDrawing) {
          startDrawing([pdfCoords.x, pdfCoords.y]);
        } else {
          // Add point
          updateDrawingPoints([...drawingPoints, pdfCoords.x, pdfCoords.y]);
        }
      } else if (activeTool === 'text') {
        // Place text box
        if (!documentId || !projectId) return;

        const textShape: MarkupRecord = {
          id: crypto.randomUUID(),
          documentId,
          projectId,
          pageNumber,
          shapeType: 'text_box',
          geometry: {
            x: pdfCoords.x,
            y: pdfCoords.y,
            width: 200,
            height: 100,
          },
          style: { ...activeStyle },
          content: '',
          status: 'open',
          priority: 'medium',
          tags: [],
          layerId: activeLayerId || undefined,
          createdBy: 'current-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        addShape(textShape);
        selectShape(textShape.id);
      }
    },
    [
      activeTool,
      pageHeight,
      zoom,
      isDrawing,
      drawingPoints,
      activeStyle,
      documentId,
      projectId,
      pageNumber,
      activeLayerId,
      selectedIds,
      shapesById,
      startDrawing,
      updateDrawingPoints,
      addShape,
      selectShape,
      clearSelection,
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDrawing) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const pdfCoords = konvaToPdf(x, y, pageHeight, zoom);

      if (activeTool === 'freehand' || activeTool === 'highlighter') {
        updateDrawingPoints([...drawingPoints, pdfCoords.x, pdfCoords.y]);
      } else if (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'rectangle' || activeTool === 'ellipse') {
        // Update end point
        if (drawingPoints.length >= 2) {
          updateDrawingPoints([drawingPoints[0], drawingPoints[1], pdfCoords.x, pdfCoords.y]);
        }
      }
    },
    [isDrawing, activeTool, pageHeight, zoom, drawingPoints, updateDrawingPoints]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDrawing || !documentId || !projectId) {
        finishDrawing();
        return;
      }

      // Finish shape
      let geometry: MarkupGeometry = {};

      if (activeTool === 'line') {
        geometry = { points: drawingPoints };
      } else if (activeTool === 'arrow') {
        geometry = { points: drawingPoints, arrowEnd: 'closed' };
      } else if (activeTool === 'rectangle' && drawingPoints.length >= 4) {
        const [x1, y1, x2, y2] = drawingPoints;
        geometry = {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
        };
      } else if (activeTool === 'ellipse' && drawingPoints.length >= 4) {
        const [x1, y1, x2, y2] = drawingPoints;
        geometry = {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
        };
      } else if (activeTool === 'freehand' || activeTool === 'highlighter') {
        geometry = { points: drawingPoints };
      }

      const shape: MarkupRecord = {
        id: crypto.randomUUID(),
        documentId,
        projectId,
        pageNumber,
        shapeType: activeTool as MarkupRecord['shapeType'],
        geometry,
        style: { ...activeStyle },
        status: 'open',
        priority: 'medium',
        tags: [],
        layerId: activeLayerId || undefined,
        createdBy: 'current-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addShape(shape);
      selectShape(shape.id);
      finishDrawing();
    },
    [
      isDrawing,
      activeTool,
      drawingPoints,
      activeStyle,
      documentId,
      projectId,
      pageNumber,
      activeLayerId,
      addShape,
      selectShape,
      finishDrawing,
    ]
  );

  const handleDoubleClick = useCallback(() => {
    if (activeTool === 'polyline' && isDrawing && drawingPoints.length >= 4) {
      // Finish polyline
      if (!documentId || !projectId) {
        cancelDrawing();
        return;
      }

      const shape: MarkupRecord = {
        id: crypto.randomUUID(),
        documentId,
        projectId,
        pageNumber,
        shapeType: 'polyline',
        geometry: { points: drawingPoints },
        style: { ...activeStyle },
        status: 'open',
        priority: 'medium',
        tags: [],
        layerId: activeLayerId || undefined,
        createdBy: 'current-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addShape(shape);
      selectShape(shape.id);
      finishDrawing();
    }
  }, [
    activeTool,
    isDrawing,
    drawingPoints,
    activeStyle,
    documentId,
    projectId,
    pageNumber,
    activeLayerId,
    addShape,
    selectShape,
    finishDrawing,
    cancelDrawing,
  ]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
  };
}

function isPointInShape(point: { x: number; y: number }, shape: MarkupRecord): boolean {
  const { geometry } = shape;

  if (geometry.x != null && geometry.y != null && geometry.width != null && geometry.height != null) {
    return (
      point.x >= geometry.x &&
      point.x <= geometry.x + geometry.width &&
      point.y >= geometry.y &&
      point.y <= geometry.y + geometry.height
    );
  }

  return false;
}
