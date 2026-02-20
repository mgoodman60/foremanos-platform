'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Undo, Redo } from 'lucide-react';
import type { MarkupRecord, MarkupStyle } from '@/lib/markup/markup-types';
import { MarkupToolbar } from './tools/MarkupToolbar';
import { ColorStrokePanel } from './tools/ColorStrokePanel';

export interface MarkupViewerProps {
  documentId: string;
  slug?: string;
  projectId?: string;
  onSelectionChange?: (markups: MarkupRecord[]) => void;
  refreshKey?: number;
}

export function MarkupViewer({
  documentId,
  slug,
  onSelectionChange,
  refreshKey,
}: MarkupViewerProps) {
  const [activeTool, setActiveTool] = useState('select');
  const [scale, setScale] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageHeight, _setPageHeight] = useState(792); // Default letter size
  const [markups, setMarkups] = useState<MarkupRecord[]>([]);
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);
  const [currentStyle, setCurrentStyle] = useState<MarkupStyle>({
    color: '#FF0000',
    strokeWidth: 2,
    opacity: 1,
    lineStyle: 'solid',
  });
  const [history, setHistory] = useState<MarkupRecord[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic imports for heavy components
  const [KonvaStage, setKonvaStage] = useState<any>(null);
  const [PDFRenderer, setPDFRenderer] = useState<any>(null);

  useEffect(() => {
    import('./KonvaOverlayStage').then((mod) => setKonvaStage(() => mod.KonvaOverlayStage));
    import('./PDFPageRenderer').then((mod) => setPDFRenderer(() => mod.PDFPageRenderer));
  }, []);

  // Fetch document info (page count)
  useEffect(() => {
    const fetchDocInfo = async () => {
      try {
        const basePath = slug
          ? `/api/projects/${slug}/documents/${documentId}/markups/summary`
          : `/api/documents/${documentId}`;
        const response = await fetch(basePath);
        if (response.ok) {
          const data = await response.json();
          if (data.totalPages) setTotalPages(data.totalPages);
        }
      } catch {
        // Default to 1 page
      }
    };
    fetchDocInfo();
  }, [documentId, slug]);

  // Load markups for current page
  useEffect(() => {
    const loadMarkups = async () => {
      try {
        const basePath = slug
          ? `/api/projects/${slug}/documents/${documentId}/markups`
          : `/api/documents/${documentId}/markups`;
        const response = await fetch(`${basePath}?pageNumber=${pageNumber}`);
        if (response.ok) {
          const data = await response.json();
          setMarkups(data.markups || []);
        }
      } catch {
        // Silently fail
      }
    };
    loadMarkups();
  }, [documentId, slug, pageNumber, refreshKey]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setScale(1);
  }, []);

  // Page navigation
  const handlePrevPage = useCallback(() => {
    if (pageNumber > 1) setPageNumber((p) => p - 1);
  }, [pageNumber]);

  const handleNextPage = useCallback(() => {
    if (pageNumber < totalPages) setPageNumber((p) => p + 1);
  }, [pageNumber, totalPages]);

  // History management
  const saveToHistory = useCallback((newMarkups: MarkupRecord[]) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newMarkups);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setMarkups(history[historyIndex - 1]);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setMarkups(history[historyIndex + 1]);
    }
  }, [historyIndex, history]);

  // Store the user's "normal" style so we can restore it after highlighter
  const normalStyleRef = useRef<MarkupStyle>({
    color: '#FF0000',
    strokeWidth: 2,
    opacity: 1,
    lineStyle: 'solid' as const,
  });

  // Tool change handler — auto-set style defaults per tool
  const handleToolChange = useCallback((toolId: string) => {
    setActiveTool((prevTool) => {
      // Save current style when leaving non-highlighter tools
      if (prevTool !== 'highlighter') {
        setCurrentStyle((s) => {
          normalStyleRef.current = { ...s };
          return s;
        });
      }
      return toolId;
    });
    setSelectedMarkupId(null);

    // Apply tool-specific style defaults
    if (toolId === 'highlighter') {
      setCurrentStyle((prev) => ({
        ...prev,
        color: '#FFFF00',       // Yellow default for highlighting
        strokeWidth: 4,         // Will be rendered at 5x (20px effective)
        opacity: 0.3,           // Semi-transparent
        lineStyle: 'solid' as const,
      }));
    } else if (toolId === 'line' || toolId === 'arrow' || toolId === 'freehand') {
      // Restore normal style when switching to line-type tools
      setCurrentStyle((prev) => ({
        ...normalStyleRef.current,
        // Keep any fill settings the user may have set
        fillColor: prev.fillColor,
        fillOpacity: prev.fillOpacity,
      }));
    }
  }, []);

  // Style change handler
  const handleStyleChange = useCallback((updates: Partial<MarkupStyle>) => {
    setCurrentStyle((prev) => ({ ...prev, ...updates }));
  }, []);

  // Markup selection handler
  const handleMarkupSelect = useCallback((id: string) => {
    setSelectedMarkupId(id);
    setActiveTool('select');
    const selected = markups.filter((m) => m.id === id);
    onSelectionChange?.(selected);
  }, [markups, onSelectionChange]);

  // Ctrl+scroll zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) handleZoomIn();
        else handleZoomOut();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleZoomIn, handleZoomOut]);

  const showArrowheads = activeTool === 'arrow';
  const showFill = ['rectangle', 'ellipse', 'polygon', 'cloud'].includes(activeTool);
  const showFont = activeTool === 'text';
  const isHighlighter = activeTool === 'highlighter';

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top toolbar */}
      <div className="h-14 bg-white border-b border-gray-300 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button onClick={handleZoomOut} className="p-2 rounded hover:bg-gray-100" title="Zoom Out" aria-label="Zoom Out">
            <ZoomOut size={20} />
          </button>
          <span className="text-sm font-medium min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="p-2 rounded hover:bg-gray-100" title="Zoom In" aria-label="Zoom In">
            <ZoomIn size={20} />
          </button>
          <button onClick={handleZoomReset} className="p-2 rounded hover:bg-gray-100" title="Reset Zoom" aria-label="Reset Zoom">
            <RotateCcw size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handlePrevPage} disabled={pageNumber === 1} className="p-2 rounded hover:bg-gray-100 disabled:opacity-50" title="Previous Page" aria-label="Previous Page">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium min-w-[80px] text-center">{pageNumber} / {totalPages}</span>
          <button onClick={handleNextPage} disabled={pageNumber === totalPages} className="p-2 rounded hover:bg-gray-100 disabled:opacity-50" title="Next Page" aria-label="Next Page">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 rounded hover:bg-gray-100 disabled:opacity-50" title="Undo" aria-label="Undo">
            <Undo size={20} />
          </button>
          <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 rounded hover:bg-gray-100 disabled:opacity-50" title="Redo" aria-label="Redo">
            <Redo size={20} />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        <MarkupToolbar activeTool={activeTool} onToolChange={handleToolChange} />

        <div ref={containerRef} className="flex-1 overflow-auto bg-gray-200 relative">
          <div className="inline-block min-w-full min-h-full p-8">
            {PDFRenderer && (
              <PDFRenderer documentId={documentId} pageNumber={pageNumber} scale={scale} />
            )}
            {KonvaStage && (
              <KonvaStage
                markups={markups}
                selectedMarkupId={selectedMarkupId}
                onMarkupSelect={handleMarkupSelect}
                pageHeight={pageHeight}
                scale={scale}
                activeTool={activeTool}
                currentStyle={currentStyle}
                onMarkupsChange={(newMarkups: MarkupRecord[]) => {
                  setMarkups(newMarkups);
                  saveToHistory(newMarkups);
                }}
              />
            )}
          </div>
        </div>

        <ColorStrokePanel
          style={currentStyle}
          onStyleChange={handleStyleChange}
          showArrowheads={showArrowheads}
          showFill={showFill}
          showFont={showFont}
          isHighlighter={isHighlighter}
        />
      </div>
    </div>
  );
}
