"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Pencil,
  Square,
  Circle,
  Type,
  Eraser,
  Undo2,
  Redo2,
  Download,
  Save,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Highlighter,
  MessageSquare,
  ArrowRight,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { semanticColors, primaryColors, secondaryColors, chartColors, backgroundColors } from '@/lib/design-tokens';

type Tool = 'select' | 'pen' | 'highlighter' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'comment' | 'eraser';

interface Annotation {
  id: string;
  type: Tool;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  author?: string;
  timestamp?: string;
}

interface MarkupAnnotationProps {
  documentUrl: string;
  documentId: string;
  documentName: string;
  onSave?: (annotations: Annotation[]) => Promise<void>;
  initialAnnotations?: Annotation[];
  readOnly?: boolean;
}

const COLORS = [
  semanticColors.error[500],   // red
  primaryColors.orange[500],   // orange
  semanticColors.warning[500], // yellow
  semanticColors.success[500], // green
  secondaryColors.blue[500],   // blue
  chartColors.palette[4],      // purple
  '#000000',                   // black
];

const STROKE_WIDTHS = [2, 4, 6, 8];

export default function MarkupAnnotation({
  documentUrl,
  documentId: _documentId,
  documentName,
  onSave,
  initialAnnotations = [],
  readOnly = false
}: MarkupAnnotationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [currentColor, setCurrentColor] = useState<string>(semanticColors.error[500]);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentPosition, setCommentPosition] = useState({ x: 0, y: 0 });
  const [commentText, setCommentText] = useState('');
  const [textInputPosition, setTextInputPosition] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load document image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      redrawCanvas();
    };
    img.onerror = () => {
      console.error('Failed to load document image');
      toast.error('Failed to load document for markup');
    };
    img.src = documentUrl;
  }, [documentUrl]);

  // Redraw canvas when annotations change
  useEffect(() => {
    redrawCanvas();
  }, [annotations, zoom, pan, imageLoaded]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageRef.current) return;

    // Set canvas size
    canvas.width = containerRef.current?.clientWidth || 800;
    canvas.height = containerRef.current?.clientHeight || 600;

    // Clear canvas
    ctx.fillStyle = backgroundColors.dark.card;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw image
    const img = imageRef.current;
    const scale = Math.min(
      (canvas.width / zoom) / img.width,
      (canvas.height / zoom) / img.height
    ) * 0.9;
    const imgWidth = img.width * scale;
    const imgHeight = img.height * scale;
    const imgX = ((canvas.width / zoom) - imgWidth) / 2;
    const imgY = ((canvas.height / zoom) - imgHeight) / 2;
    
    ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);

    // Draw annotations
    annotations.forEach(annotation => {
      drawAnnotation(ctx, annotation);
    });

    // Draw current annotation being created
    if (currentAnnotation) {
      drawAnnotation(ctx, currentAnnotation);
    }

    ctx.restore();
  }, [annotations, currentAnnotation, zoom, pan, imageLoaded]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    ctx.strokeStyle = annotation.color;
    ctx.fillStyle = annotation.color;
    ctx.lineWidth = annotation.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (annotation.type) {
      case 'pen':
        if (annotation.points && annotation.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
          annotation.points.forEach(point => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        }
        break;

      case 'highlighter':
        if (annotation.points && annotation.points.length > 1) {
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = annotation.strokeWidth * 4;
          ctx.beginPath();
          ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
          annotation.points.forEach(point => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        break;

      case 'rectangle':
        if (annotation.x !== undefined && annotation.y !== undefined && 
            annotation.width !== undefined && annotation.height !== undefined) {
          ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
        }
        break;

      case 'circle':
        if (annotation.x !== undefined && annotation.y !== undefined && 
            annotation.width !== undefined && annotation.height !== undefined) {
          ctx.beginPath();
          const centerX = annotation.x + annotation.width / 2;
          const centerY = annotation.y + annotation.height / 2;
          const radiusX = Math.abs(annotation.width / 2);
          const radiusY = Math.abs(annotation.height / 2);
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
        break;

      case 'arrow':
        if (annotation.points && annotation.points.length >= 2) {
          const start = annotation.points[0];
          const end = annotation.points[annotation.points.length - 1];
          
          // Draw line
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          
          // Draw arrowhead
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const headLength = 15;
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - headLength * Math.cos(angle - Math.PI / 6),
            end.y - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - headLength * Math.cos(angle + Math.PI / 6),
            end.y - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        }
        break;

      case 'text':
        if (annotation.x !== undefined && annotation.y !== undefined && annotation.text) {
          ctx.font = `${annotation.strokeWidth * 4}px sans-serif`;
          ctx.fillText(annotation.text, annotation.x, annotation.y);
        }
        break;

      case 'comment':
        if (annotation.x !== undefined && annotation.y !== undefined) {
          // Draw comment marker
          ctx.fillStyle = annotation.color;
          ctx.beginPath();
          ctx.arc(annotation.x, annotation.y, 12, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = backgroundColors.light.base;
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', annotation.x, annotation.y);
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
        }
        break;
    }
  };

  const getCanvasCoords = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return;
    
    const coords = getCanvasCoords(e);

    if (currentTool === 'select') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (currentTool === 'text') {
      setTextInputPosition(coords);
      return;
    }

    if (currentTool === 'comment') {
      setCommentPosition(coords);
      setShowCommentInput(true);
      return;
    }

    setIsDrawing(true);
    setUndoStack(prev => [...prev, annotations]);
    setRedoStack([]);

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      type: currentTool,
      color: currentColor,
      strokeWidth,
      points: currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'arrow' 
        ? [coords] 
        : undefined,
      x: currentTool === 'rectangle' || currentTool === 'circle' ? coords.x : undefined,
      y: currentTool === 'rectangle' || currentTool === 'circle' ? coords.y : undefined,
      width: 0,
      height: 0
    };

    setCurrentAnnotation(newAnnotation);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (!isDrawing || !currentAnnotation) return;

    const coords = getCanvasCoords(e);

    if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'arrow') {
      setCurrentAnnotation(prev => prev ? {
        ...prev,
        points: [...(prev.points || []), coords]
      } : null);
    } else if (currentTool === 'rectangle' || currentTool === 'circle') {
      setCurrentAnnotation(prev => prev ? {
        ...prev,
        width: coords.x - (prev.x || 0),
        height: coords.y - (prev.y || 0)
      } : null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    
    if (isDrawing && currentAnnotation) {
      setAnnotations(prev => [...prev, currentAnnotation]);
      setCurrentAnnotation(null);
    }
    setIsDrawing(false);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, annotations]);
    setAnnotations(prev);
    setUndoStack(u => u.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, annotations]);
    setAnnotations(next);
    setRedoStack(r => r.slice(0, -1));
  };

  const handleAddText = () => {
    if (!textInputPosition || !textInputValue.trim()) {
      setTextInputPosition(null);
      setTextInputValue('');
      return;
    }

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      type: 'text',
      color: currentColor,
      strokeWidth,
      x: textInputPosition.x,
      y: textInputPosition.y,
      text: textInputValue
    };

    setUndoStack(prev => [...prev, annotations]);
    setAnnotations(prev => [...prev, newAnnotation]);
    setTextInputPosition(null);
    setTextInputValue('');
  };

  const handleAddComment = () => {
    if (!commentText.trim()) {
      setShowCommentInput(false);
      return;
    }

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      type: 'comment',
      color: currentColor,
      strokeWidth,
      x: commentPosition.x,
      y: commentPosition.y,
      text: commentText,
      author: 'Current User',
      timestamp: new Date().toISOString()
    };

    setUndoStack(prev => [...prev, annotations]);
    setAnnotations(prev => [...prev, newAnnotation]);
    setShowCommentInput(false);
    setCommentText('');
  };

  const handleSave = async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      await onSave(annotations);
      toast.success('Annotations saved');
    } catch (error) {
      toast.error('Failed to save annotations');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${documentName}-annotated.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Annotated document exported');
  };

  const tools: { tool: Tool; icon: React.ReactNode; label: string }[] = [
    { tool: 'select', icon: <Move aria-hidden="true" className="h-4 w-4" />, label: 'Pan/Select' },
    { tool: 'pen', icon: <Pencil aria-hidden="true" className="h-4 w-4" />, label: 'Pen' },
    { tool: 'highlighter', icon: <Highlighter aria-hidden="true" className="h-4 w-4" />, label: 'Highlighter' },
    { tool: 'rectangle', icon: <Square aria-hidden="true" className="h-4 w-4" />, label: 'Rectangle' },
    { tool: 'circle', icon: <Circle aria-hidden="true" className="h-4 w-4" />, label: 'Circle' },
    { tool: 'arrow', icon: <ArrowRight aria-hidden="true" className="h-4 w-4" />, label: 'Arrow' },
    { tool: 'text', icon: <Type aria-hidden="true" className="h-4 w-4" />, label: 'Text' },
    { tool: 'comment', icon: <MessageSquare aria-hidden="true" className="h-4 w-4" />, label: 'Comment' },
    { tool: 'eraser', icon: <Eraser aria-hidden="true" className="h-4 w-4" />, label: 'Eraser' },
  ];

  return (
    <Card className="bg-dark-card border-gray-700 overflow-hidden h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          {/* Tools */}
          {tools.map(({ tool, icon, label }) => (
            <Button
              key={tool}
              variant={currentTool === tool ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-8 w-8 p-0',
                currentTool === tool ? 'bg-orange-500' : 'text-gray-400'
              )}
              onClick={() => setCurrentTool(tool)}
              title={label}
              disabled={readOnly && tool !== 'select'}
            >
              {icon}
            </Button>
          ))}

          <div className="w-px h-6 bg-gray-700 mx-2" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            {COLORS.map(color => (
              <button
                key={color}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-all',
                  currentColor === color ? 'border-white scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: color }}
                onClick={() => setCurrentColor(color)}
                disabled={readOnly}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-gray-700 mx-2" />

          {/* Stroke Width */}
          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map(w => (
              <button
                key={w}
                className={cn(
                  'w-6 h-6 flex items-center justify-center rounded',
                  strokeWidth === w ? 'bg-gray-600' : 'hover:bg-gray-700'
                )}
                onClick={() => setStrokeWidth(w)}
                disabled={readOnly}
              >
                <div 
                  className="rounded-full bg-gray-300"
                  style={{ width: w * 2, height: w * 2 }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="text-gray-400"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="text-gray-400"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="text-gray-400"
            title="Reset View"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-gray-700 mx-2" />

          {/* Undo/Redo */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={undoStack.length === 0 || readOnly}
            className="text-gray-400"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={redoStack.length === 0 || readOnly}
            className="text-gray-400"
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-gray-700 mx-2" />

          {/* Save/Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="border-gray-600 text-gray-300"
          >
            <Download aria-hidden="true" className="h-4 w-4 mr-1" />
            Export
          </Button>
          {onSave && !readOnly && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Save aria-hidden="true" className="h-4 w-4 mr-1" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="flex-1 relative overflow-hidden bg-gray-900"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            'absolute inset-0',
            currentTool === 'select' ? 'cursor-grab' : 'cursor-crosshair',
            isPanning && 'cursor-grabbing'
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Text Input Overlay */}
        {textInputPosition && (
          <div
            className="absolute bg-dark-card border border-gray-600 rounded p-2 shadow-xl"
            style={{
              left: textInputPosition.x * zoom + pan.x,
              top: textInputPosition.y * zoom + pan.y
            }}
          >
            <Input
              autoFocus
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              placeholder="Enter text..."
              className="w-48 bg-gray-700 border-gray-600 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddText();
                if (e.key === 'Escape') setTextInputPosition(null);
              }}
            />
            <div className="flex gap-1 mt-2">
              <Button size="sm" onClick={handleAddText} className="text-xs">Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setTextInputPosition(null)} className="text-xs">Cancel</Button>
            </div>
          </div>
        )}

        {/* Comment Input Overlay */}
        {showCommentInput && (
          <div
            className="absolute bg-dark-card border border-gray-600 rounded p-3 shadow-xl w-64"
            style={{
              left: commentPosition.x * zoom + pan.x + 20,
              top: commentPosition.y * zoom + pan.y
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-200">Add Comment</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowCommentInput(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              autoFocus
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Enter your comment..."
              rows={3}
              className="bg-gray-700 border-gray-600 text-sm"
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button size="sm" onClick={handleAddComment} className="bg-orange-500 hover:bg-orange-600">
                Add Comment
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1.5 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
        <span>{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span>
        <span>{documentName}</span>
      </div>
    </Card>
  );
}
