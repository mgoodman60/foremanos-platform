'use client';

import { useState, useRef, useCallback } from 'react';

interface PanState {
  x: number;
  y: number;
}

interface UseFloorPlanCanvasReturn {
  zoom: number;
  pan: PanState;
  isDragging: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  handleWheel: (e: React.WheelEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  getTransformStyle: () => {
    transform: string;
    transformOrigin: string;
  };
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

export function useFloorPlanCanvas(): UseFloorPlanCanvasReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<PanState>({ x: 0, y: 0 });

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Only zoom when ctrl key is pressed
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const getTransformStyle = useCallback(() => {
    return {
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: 'center',
    };
  }, [pan, zoom]);

  return {
    zoom,
    pan,
    isDragging,
    containerRef,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    getTransformStyle,
  };
}
