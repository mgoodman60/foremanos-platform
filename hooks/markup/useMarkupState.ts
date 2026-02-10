'use client';

import { create } from 'zustand';
import type {
  MarkupRecord,
  MarkupShapeType,
  MarkupStyle,
  MarkupGeometry,
  MarkupLayerRecord,
  AnnotationStatus,
  AnnotationPriority,
} from '@/lib/markup/markup-types';

export interface MarkupState {
  // Normalized shape storage
  shapesById: Map<string, MarkupRecord>;
  shapeIds: string[];
  selectedIds: Set<string>;

  // Document context
  documentId: string | null;
  projectId: string | null;
  pageNumber: number;
  totalPages: number;

  // Canvas state
  pageWidth: number;
  pageHeight: number;
  zoom: number; // 0.25 - 5
  panX: number;
  panY: number;

  // Drawing state
  activeTool: 'select' | 'line' | 'arrow' | 'polyline' | 'polygon' | 'rectangle' | 'ellipse' | 'freehand' | 'highlighter' | 'text' | 'eraser' | 'pan' | 'cloud' | 'distance' | 'area' | 'stamp';
  activeStyle: MarkupStyle;
  isDrawing: boolean;
  drawingPoints: number[];

  // Layers
  layers: MarkupLayerRecord[];
  activeLayerId: string | null;

  // Actions
  setDocumentContext: (documentId: string, projectId: string, totalPages: number) => void;
  setPageDimensions: (width: number, height: number) => void;
  setPageNumber: (pageNumber: number) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setActiveTool: (tool: MarkupState['activeTool']) => void;
  setActiveStyle: (style: Partial<MarkupStyle>) => void;
  setActiveLayer: (layerId: string | null) => void;

  // Shape CRUD
  addShape: (shape: MarkupRecord) => void;
  updateShape: (id: string, updates: Partial<MarkupRecord>) => void;
  deleteShape: (id: string) => void;
  deleteShapes: (ids: string[]) => void;
  setShapes: (shapes: MarkupRecord[]) => void;

  // Selection
  selectShape: (id: string, multi?: boolean) => void;
  deselectShape: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // Drawing state
  startDrawing: (points: number[]) => void;
  updateDrawingPoints: (points: number[]) => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;

  // Layers
  setLayers: (layers: MarkupLayerRecord[]) => void;
  addLayer: (layer: MarkupLayerRecord) => void;
  updateLayer: (id: string, updates: Partial<MarkupLayerRecord>) => void;
  deleteLayer: (id: string) => void;

  // Utilities
  reset: () => void;
}

const DEFAULT_STYLE: MarkupStyle = {
  color: '#FF0000',
  strokeWidth: 2,
  opacity: 1,
  lineStyle: 'solid',
  fillOpacity: 0,
};

export const useMarkupState = create<MarkupState>((set, get) => ({
  // Initial state
  shapesById: new Map(),
  shapeIds: [],
  selectedIds: new Set(),

  documentId: null,
  projectId: null,
  pageNumber: 1,
  totalPages: 1,

  pageWidth: 612, // Default letter size
  pageHeight: 792,
  zoom: 1,
  panX: 0,
  panY: 0,

  activeTool: 'select',
  activeStyle: { ...DEFAULT_STYLE },
  isDrawing: false,
  drawingPoints: [],

  layers: [],
  activeLayerId: null,

  // Actions
  setDocumentContext: (documentId, projectId, totalPages) =>
    set({ documentId, projectId, totalPages }),

  setPageDimensions: (width, height) =>
    set({ pageWidth: width, pageHeight: height }),

  setPageNumber: (pageNumber) =>
    set({ pageNumber }),

  setZoom: (zoom) =>
    set({ zoom: Math.max(0.25, Math.min(5, zoom)) }),

  setPan: (x, y) =>
    set({ panX: x, panY: y }),

  setActiveTool: (tool) =>
    set({ activeTool: tool, isDrawing: false, drawingPoints: [] }),

  setActiveStyle: (style) =>
    set((state) => ({ activeStyle: { ...state.activeStyle, ...style } })),

  setActiveLayer: (layerId) =>
    set({ activeLayerId: layerId }),

  // Shape CRUD
  addShape: (shape) =>
    set((state) => {
      const newShapesById = new Map(state.shapesById);
      newShapesById.set(shape.id, shape);
      return {
        shapesById: newShapesById,
        shapeIds: [...state.shapeIds, shape.id],
      };
    }),

  updateShape: (id, updates) =>
    set((state) => {
      const existing = state.shapesById.get(id);
      if (!existing) return state;

      const newShapesById = new Map(state.shapesById);
      newShapesById.set(id, { ...existing, ...updates });
      return { shapesById: newShapesById };
    }),

  deleteShape: (id) =>
    set((state) => {
      const newShapesById = new Map(state.shapesById);
      newShapesById.delete(id);
      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(id);
      return {
        shapesById: newShapesById,
        shapeIds: state.shapeIds.filter((sid) => sid !== id),
        selectedIds: newSelectedIds,
      };
    }),

  deleteShapes: (ids) =>
    set((state) => {
      const newShapesById = new Map(state.shapesById);
      const newSelectedIds = new Set(state.selectedIds);
      ids.forEach((id) => {
        newShapesById.delete(id);
        newSelectedIds.delete(id);
      });
      return {
        shapesById: newShapesById,
        shapeIds: state.shapeIds.filter((id) => !ids.includes(id)),
        selectedIds: newSelectedIds,
      };
    }),

  setShapes: (shapes) =>
    set({
      shapesById: new Map(shapes.map((s) => [s.id, s])),
      shapeIds: shapes.map((s) => s.id),
    }),

  // Selection
  selectShape: (id, multi = false) =>
    set((state) => {
      const newSelectedIds = new Set(multi ? state.selectedIds : []);
      newSelectedIds.add(id);
      return { selectedIds: newSelectedIds };
    }),

  deselectShape: (id) =>
    set((state) => {
      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(id);
      return { selectedIds: newSelectedIds };
    }),

  clearSelection: () =>
    set({ selectedIds: new Set() }),

  selectAll: () =>
    set((state) => ({ selectedIds: new Set(state.shapeIds) })),

  // Drawing state
  startDrawing: (points) =>
    set({ isDrawing: true, drawingPoints: points }),

  updateDrawingPoints: (points) =>
    set({ drawingPoints: points }),

  finishDrawing: () =>
    set({ isDrawing: false, drawingPoints: [] }),

  cancelDrawing: () =>
    set({ isDrawing: false, drawingPoints: [] }),

  // Layers
  setLayers: (layers) =>
    set({ layers }),

  addLayer: (layer) =>
    set((state) => ({ layers: [...state.layers, layer] })),

  updateLayer: (id, updates) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, ...updates } : layer
      ),
    })),

  deleteLayer: (id) =>
    set((state) => ({
      layers: state.layers.filter((layer) => layer.id !== id),
      activeLayerId: state.activeLayerId === id ? null : state.activeLayerId,
    })),

  // Utilities
  reset: () =>
    set({
      shapesById: new Map(),
      shapeIds: [],
      selectedIds: new Set(),
      documentId: null,
      projectId: null,
      pageNumber: 1,
      totalPages: 1,
      pageWidth: 612,
      pageHeight: 792,
      zoom: 1,
      panX: 0,
      panY: 0,
      activeTool: 'select',
      activeStyle: { ...DEFAULT_STYLE },
      isDrawing: false,
      drawingPoints: [],
      layers: [],
      activeLayerId: null,
    }),
}));
