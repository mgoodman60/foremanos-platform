'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3x3,
  MapPin,
  X,
  Layers,
  Home,
  Zap,
  Package,
  Move,
  RotateCcw,
  Download,
  Eye,
  EyeOff,
  Loader2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Box,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { WithTooltip } from '@/components/ui/icon-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Room {
  id: string;
  name: string;
  number?: string;
  location?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface Equipment {
  id: string;
  tag: string;
  name: string;
  trade: string;
  location?: string;
  position?: {
    x: number;
    y: number;
  };
}

interface TakeoffItem {
  id: string;
  itemName: string;
  category: string;
  location?: string;
  position?: {
    x: number;
    y: number;
  };
}

interface Annotation {
  id: string;
  type: 'room' | 'equipment' | 'takeoff' | 'marker';
  data: Room | Equipment | TakeoffItem | any;
  position: { x: number; y: number };
  bounds?: { x: number; y: number; width: number; height: number };
}

interface InteractivePlanViewerProps {
  projectSlug: string;
  documentId: string;
  documentName: string;
  totalPages?: number;
  onClose?: () => void;
}

export function InteractivePlanViewer({
  projectSlug,
  documentId,
  documentName,
  totalPages = 1,
  onClose
}: InteractivePlanViewerProps) {
  const { data: session } = useSession() || {};
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(false);
  const [showRooms, setShowRooms] = useState(true);
  const [showEquipment, setShowEquipment] = useState(true);
  const [showTakeoff, setShowTakeoff] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [usePdfFallback, setUsePdfFallback] = useState(false);
  
  // Room takeoff state
  const [roomTakeoffs, setRoomTakeoffs] = useState<{
    room: { id: string; name: string; number?: string; type?: string; area?: number; floor?: number };
    takeoffItems: Array<{
      id: string;
      category: string;
      itemName: string;
      description?: string;
      quantity: number;
      unit: string;
      unitCost?: number;
      totalCost?: number;
      verified: boolean;
      verificationStatus?: string;
    }>;
    summary: {
      totalItems: number;
      totalCost: number;
      categories: Record<string, { count: number; cost: number; items: string[] }>;
    };
  } | null>(null);
  const [loadingTakeoffs, setLoadingTakeoffs] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const imageUrl = `/api/projects/${projectSlug}/plans/${documentId}/image?page=${currentPage}`;

  // Check for PDF fallback when image fails to load
  useEffect(() => {
    if (imageError && !pdfUrl) {
      // Try to get PDF URL fallback
      fetch(`${imageUrl}&fallback=true`)
        .then(res => res.json())
        .then(data => {
          if (data.type === 'pdf_url' && data.url) {
            setPdfUrl(data.url);
            setUsePdfFallback(true);
          }
        })
        .catch(err => console.error('Failed to get PDF fallback:', err));
    }
  }, [imageError, imageUrl, pdfUrl]);

  // Reset states when page changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setUsePdfFallback(false);
  }, [currentPage]);

  // Load annotations based on visible layers
  useEffect(() => {
    loadAnnotations();
  }, [currentPage, showRooms, showEquipment, showTakeoff]);

  const loadAnnotations = async () => {
    const newAnnotations: Annotation[] = [];

    // Load rooms if enabled
    if (showRooms) {
      try {
        const response = await fetch(`/api/projects/${projectSlug}/rooms`);
        if (response.ok) {
          const rooms = await response.json();
          // For demo, position rooms randomly (in production, use actual coordinates)
          rooms.forEach((room: Room, idx: number) => {
            newAnnotations.push({
              id: `room-${room.id}`,
              type: 'room',
              data: room,
              position: {
                x: 20 + (idx % 3) * 30,
                y: 20 + Math.floor(idx / 3) * 25
              },
              bounds: {
                x: 20 + (idx % 3) * 30,
                y: 20 + Math.floor(idx / 3) * 25,
                width: 25,
                height: 20
              }
            });
          });
        }
      } catch (error) {
        console.error('Error loading rooms:', error);
      }
    }

    // Load equipment if enabled
    if (showEquipment) {
      try {
        const response = await fetch(`/api/projects/${projectSlug}/mep`);
        if (response.ok) {
          const equipment = await response.json();
          // Position equipment markers (in production, use actual coordinates)
          equipment.forEach((item: Equipment, idx: number) => {
            newAnnotations.push({
              id: `equipment-${item.id || idx}`,
              type: 'equipment',
              data: item,
              position: {
                x: 15 + (idx % 4) * 20,
                y: 60 + Math.floor(idx / 4) * 15
              }
            });
          });
        }
      } catch (error) {
        console.error('Error loading equipment:', error);
      }
    }

    // Load takeoff items if enabled
    if (showTakeoff) {
      try {
        const response = await fetch(`/api/projects/${projectSlug}/takeoffs`);
        if (response.ok) {
          const takeoffs = await response.json();
          // Position takeoff markers
          takeoffs.forEach((item: TakeoffItem, idx: number) => {
            newAnnotations.push({
              id: `takeoff-${item.id || idx}`,
              type: 'takeoff',
              data: item,
              position: {
                x: 10 + (idx % 5) * 18,
                y: 30 + Math.floor(idx / 5) * 12
              }
            });
          });
        }
      } catch (error) {
        console.error('Error loading takeoff items:', error);
      }
    }

    setAnnotations(newAnnotations);
  };

  // Load takeoffs for a selected room
  const loadRoomTakeoffs = useCallback(async (roomId: string) => {
    setLoadingTakeoffs(true);
    setRoomTakeoffs(null);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/rooms/${roomId}/takeoffs`);
      if (response.ok) {
        const data = await response.json();
        setRoomTakeoffs(data);
        // Expand categories with items by default
        const categoriesWithItems = Object.keys(data.summary?.categories || {});
        setExpandedCategories(new Set(categoriesWithItems.slice(0, 3))); // Expand first 3
      }
    } catch (error) {
      console.error('Error loading room takeoffs:', error);
    } finally {
      setLoadingTakeoffs(false);
    }
  }, [projectSlug]);

  // Handle annotation selection - load takeoffs for rooms
  const handleAnnotationSelect = useCallback((annotationId: string | null, annotation?: Annotation) => {
    setSelectedAnnotation(annotationId);
    
    if (annotationId && annotation?.type === 'room' && annotation.data?.id) {
      loadRoomTakeoffs(annotation.data.id);
    } else {
      setRoomTakeoffs(null);
    }
  }, [loadRoomTakeoffs]);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Format currency
  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 4));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToScreen = () => {
    if (containerRef.current && imageRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const imageWidth = imageRef.current.naturalWidth;
      const imageHeight = imageRef.current.naturalHeight;

      const scaleX = containerWidth / imageWidth;
      const scaleY = containerHeight / imageHeight;
      const newZoom = Math.min(scaleX, scaleY) * 0.9;

      setZoom(newZoom);
      setPan({ x: 0, y: 0 });
    }
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.25, Math.min(4, prev + delta)));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Grid rendering
  const renderGrid = () => {
    if (!showGrid || !imageRef.current) return null;

    const gridLines = [];
    const gridSize = 50; // pixels between grid lines
    const width = imageRef.current.naturalWidth;
    const height = imageRef.current.naturalHeight;

    // Vertical lines
    for (let i = 0; i <= width; i += gridSize) {
      gridLines.push(
        <line
          key={`v-${i}`}
          x1={i}
          y1={0}
          x2={i}
          y2={height}
          stroke="rgba(59, 130, 246, 0.3)"
          strokeWidth={1 / zoom}
        />
      );
    }

    // Horizontal lines
    for (let i = 0; i <= height; i += gridSize) {
      gridLines.push(
        <line
          key={`h-${i}`}
          x1={0}
          y1={i}
          x2={width}
          y2={i}
          stroke="rgba(59, 130, 246, 0.3)"
          strokeWidth={1 / zoom}
        />
      );
    }

    // Grid labels (letters for columns, numbers for rows)
    const labels = [];
    const labelStep = gridSize * 2;

    // Column labels (A, B, C...)
    for (let i = 0, col = 0; i < width; i += labelStep, col++) {
      const letter = String.fromCharCode(65 + (col % 26));
      labels.push(
        <text
          key={`col-${i}`}
          x={i + 10}
          y={20}
          fill="#3B82F6"
          fontSize={14 / zoom}
          fontWeight="bold"
        >
          {letter}
        </text>
      );
    }

    // Row labels (1, 2, 3...)
    for (let i = 0, row = 1; i < height; i += labelStep, row++) {
      labels.push(
        <text
          key={`row-${i}`}
          x={10}
          y={i + 20}
          fill="#3B82F6"
          fontSize={14 / zoom}
          fontWeight="bold"
        >
          {row}
        </text>
      );
    }

    return (
      <>
        {gridLines}
        {labels}
      </>
    );
  };

  // Annotation rendering
  const renderAnnotations = () => {
    if (!imageRef.current) return null;

    const width = imageRef.current.naturalWidth;
    const height = imageRef.current.naturalHeight;

    return annotations.map((annotation) => {
      const x = (annotation.position.x / 100) * width;
      const y = (annotation.position.y / 100) * height;
      const isSelected = selectedAnnotation === annotation.id;

      if (annotation.type === 'room' && annotation.bounds) {
        const boundsX = (annotation.bounds.x / 100) * width;
        const boundsY = (annotation.bounds.y / 100) * height;
        const boundsWidth = (annotation.bounds.width / 100) * width;
        const boundsHeight = (annotation.bounds.height / 100) * height;

        return (
          <g key={annotation.id}>
            {/* Room boundary */}
            <rect
              x={boundsX}
              y={boundsY}
              width={boundsWidth}
              height={boundsHeight}
              fill={isSelected ? "rgba(34, 197, 94, 0.25)" : "rgba(34, 197, 94, 0.1)"}
              stroke="#22C55E"
              strokeWidth={isSelected ? 3 / zoom : 2 / zoom}
              strokeDasharray={isSelected ? '5,5' : 'none'}
              onClick={() => handleAnnotationSelect(isSelected ? null : annotation.id, annotation)}
              className="cursor-pointer hover:fill-[rgba(34,197,94,0.2)]"
            />
            {/* Room label */}
            <text
              x={boundsX + boundsWidth / 2}
              y={boundsY + boundsHeight / 2}
              fill="#22C55E"
              fontSize={12 / zoom}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              <tspan x={boundsX + boundsWidth / 2} dy="0">
                {annotation.data.name}
              </tspan>
              {annotation.data.number && (
                <tspan x={boundsX + boundsWidth / 2} dy="1.2em" fontSize={10 / zoom}>
                  #{annotation.data.number}
                </tspan>
              )}
            </text>
          </g>
        );
      }

      if (annotation.type === 'equipment') {
        const color = annotation.data.trade === 'HVAC' ? '#3B82F6' :
                     annotation.data.trade === 'Electrical' ? '#F59E0B' :
                     annotation.data.trade === 'Plumbing' ? '#06B6D4' :
                     '#EF4444';

        return (
          <g key={annotation.id}>
            {/* Equipment marker */}
            <circle
              cx={x}
              cy={y}
              r={8 / zoom}
              fill={color}
              stroke="white"
              strokeWidth={2 / zoom}
              onClick={() => setSelectedAnnotation(isSelected ? null : annotation.id)}
              className="cursor-pointer"
            />
            {/* Equipment tag */}
            <text
              x={x}
              y={y - 15 / zoom}
              fill={color}
              fontSize={10 / zoom}
              fontWeight="bold"
              textAnchor="middle"
            >
              {annotation.data.tag}
            </text>
          </g>
        );
      }

      if (annotation.type === 'takeoff') {
        return (
          <g key={annotation.id}>
            {/* Takeoff marker */}
            <rect
              x={x - 6 / zoom}
              y={y - 6 / zoom}
              width={12 / zoom}
              height={12 / zoom}
              fill="#A855F7"
              stroke="white"
              strokeWidth={2 / zoom}
              onClick={() => setSelectedAnnotation(isSelected ? null : annotation.id)}
              className="cursor-pointer"
            />
            {/* Item label */}
            <text
              x={x}
              y={y - 15 / zoom}
              fill="#A855F7"
              fontSize={9 / zoom}
              textAnchor="middle"
            >
              {annotation.data.category}
            </text>
          </g>
        );
      }

      return null;
    });
  };

  const getAnnotationIcon = (type: string) => {
    switch (type) {
      case 'room':
        return <Home className="h-4 w-4" />;
      case 'equipment':
        return <Zap className="h-4 w-4" />;
      case 'takeoff':
        return <Package className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex h-full flex-col bg-dark-surface text-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dark-hover p-3">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold">{documentName}</h2>
            <p className="text-xs text-gray-400">Page {currentPage} of {totalPages}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <WithTooltip tooltip="Close viewer">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </WithTooltip>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Viewer */}
        <div className="flex flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-dark-hover p-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <WithTooltip tooltip="Zoom out">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomOut}
                  className="border-dark-hover text-gray-300 hover:bg-dark-card"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <span className="min-w-[60px] text-center text-sm text-gray-400">
                {Math.round(zoom * 100)}%
              </span>
              <WithTooltip tooltip="Zoom in">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomIn}
                  className="border-dark-hover text-gray-300 hover:bg-dark-card"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <Separator orientation="vertical" className="mx-2 h-6" />
              <WithTooltip tooltip="Reset view">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetView}
                  className="border-dark-hover text-gray-300 hover:bg-dark-card"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <WithTooltip tooltip="Fit to screen">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFitToScreen}
                  className="border-dark-hover text-gray-300 hover:bg-dark-card"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </WithTooltip>
            </div>

            {/* Page Navigation */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border-dark-hover text-gray-300 hover:bg-dark-card"
                >
                  Previous
                </Button>
                <Select
                  value={currentPage.toString()}
                  onValueChange={(val) => setCurrentPage(parseInt(val, 10))}
                >
                  <SelectTrigger className="w-[100px] bg-dark-card border-dark-hover text-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <SelectItem key={page} value={page.toString()}>
                        Page {page}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="border-dark-hover text-gray-300 hover:bg-dark-card"
                >
                  Next
                </Button>
              </div>
            )}

            {/* Layer Toggles */}
            <div className="flex items-center gap-1">
              <WithTooltip tooltip={showGrid ? 'Hide grid overlay' : 'Show grid overlay'}>
                <Button
                  variant={showGrid ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowGrid(!showGrid)}
                  className={showGrid ? 'bg-blue-500 hover:bg-blue-600' : 'border-dark-hover text-gray-300 hover:bg-dark-card'}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <WithTooltip tooltip={showRooms ? 'Hide room boundaries' : 'Show room boundaries'}>
                <Button
                  variant={showRooms ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowRooms(!showRooms)}
                  className={showRooms ? 'bg-green-500 hover:bg-green-600' : 'border-dark-hover text-gray-300 hover:bg-dark-card'}
                >
                  <Home className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <WithTooltip tooltip={showEquipment ? 'Hide equipment markers' : 'Show equipment markers'}>
                <Button
                  variant={showEquipment ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowEquipment(!showEquipment)}
                  className={showEquipment ? 'bg-orange-500 hover:bg-orange-600' : 'border-dark-hover text-gray-300 hover:bg-dark-card'}
                >
                  <Zap className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <WithTooltip tooltip={showTakeoff ? 'Hide material takeoff' : 'Show material takeoff'}>
                <Button
                  variant={showTakeoff ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowTakeoff(!showTakeoff)}
                  className={showTakeoff ? 'bg-purple-500 hover:bg-purple-600' : 'border-dark-hover text-gray-300 hover:bg-dark-card'}
                >
                  <Package className="h-4 w-4" />
                </Button>
              </WithTooltip>
            </div>
          </div>

          {/* Viewer Canvas */}
          <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden bg-dark-base"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              {/* Plan Image or PDF Fallback */}
              {usePdfFallback && pdfUrl ? (
                <div className="w-full h-full flex items-center justify-center">
                  <iframe
                    src={`${pdfUrl}#page=${currentPage}`}
                    className="w-full h-full border-0"
                    title={`${documentName} - Page ${currentPage}`}
                  />
                </div>
              ) : !imageError ? (
                <div className="relative">
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={`${documentName} - Page ${currentPage}`}
                    onLoad={() => {
                      setImageLoaded(true);
                      setImageError(false);
                    }}
                    onError={() => {
                      setImageError(true);
                      setImageLoaded(false);
                    }}
                    className="max-w-none"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  />

                  {/* SVG Overlay for annotations */}
                  {imageLoaded && imageRef.current && (
                    <svg
                      className="absolute inset-0"
                      width={imageRef.current.naturalWidth}
                      height={imageRef.current.naturalHeight}
                      style={{ pointerEvents: 'auto' }}
                    >
                      {renderGrid()}
                      {renderAnnotations()}
                    </svg>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <div className="mb-3 text-gray-500">
                    <Layers className="mx-auto h-16 w-16" />
                  </div>
                  <p className="text-sm text-gray-400">Failed to load document image</p>
                  <p className="mt-2 text-xs text-gray-500">The document may need to be re-processed or the file format is not supported</p>
                </div>
              )}

              {!imageLoaded && !imageError && !usePdfFallback && (
                <div className="text-center">
                  <Loader2 className="animate-spin text-orange-500 h-8 w-8 mb-3 inline-block" />
                  <p className="text-sm text-gray-400">Loading document...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Annotation Details Panel */}
        {selectedAnnotation && (
          <div className="w-96 flex flex-col border-l border-dark-hover bg-dark-surface overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dark-hover p-3">
              <h3 className="text-sm font-semibold">Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAnnotationSelect(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {annotations
                .filter((a) => a.id === selectedAnnotation)
                .map((annotation) => (
                  <div key={annotation.id} className="space-y-4">
                    {/* Annotation Type Badge */}
                    <div className="flex items-center gap-2">
                      {getAnnotationIcon(annotation.type)}
                      <Badge variant="outline" className="capitalize">
                        {annotation.type}
                      </Badge>
                    </div>

                    {/* Room Details with Takeoffs */}
                    {annotation.type === 'room' && (
                      <div className="space-y-4">
                        {/* Basic Room Info */}
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-400">Name:</span>
                            <p className="font-medium">{annotation.data.name}</p>
                          </div>
                          {annotation.data.number && (
                            <div>
                              <span className="text-gray-400">Number:</span>
                              <p className="font-medium">#{annotation.data.number}</p>
                            </div>
                          )}
                          {annotation.data.location && (
                            <div>
                              <span className="text-gray-400">Location:</span>
                              <p className="font-medium">{annotation.data.location}</p>
                            </div>
                          )}
                        </div>

                        {/* Room Takeoffs Section */}
                        <Separator className="bg-gray-700" />
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-purple-400" />
                            <span className="text-sm font-medium">Material Takeoffs</span>
                          </div>

                          {loadingTakeoffs && (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                              <span className="ml-2 text-sm text-gray-400">Loading takeoffs...</span>
                            </div>
                          )}

                          {!loadingTakeoffs && roomTakeoffs && (
                            <>
                              {/* Summary Stats */}
                              {roomTakeoffs.summary.totalItems > 0 ? (
                                <>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-md bg-dark-card p-2">
                                      <div className="text-xs text-gray-400">Items</div>
                                      <div className="text-lg font-semibold text-purple-400">
                                        {roomTakeoffs.summary.totalItems}
                                      </div>
                                    </div>
                                    <div className="rounded-md bg-dark-card p-2">
                                      <div className="text-xs text-gray-400">Est. Cost</div>
                                      <div className="text-lg font-semibold text-green-400">
                                        {formatCurrency(roomTakeoffs.summary.totalCost)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Categories Accordion */}
                                  <div className="space-y-1">
                                    {Object.entries(roomTakeoffs.summary.categories).map(([category, data]) => (
                                      <div key={category} className="rounded-md border border-dark-hover bg-dark-subtle">
                                        <button
                                          onClick={() => toggleCategory(category)}
                                          className="flex w-full items-center justify-between p-2 text-left hover:bg-dark-hover"
                                        >
                                          <div className="flex items-center gap-2">
                                            {expandedCategories.has(category) ? (
                                              <ChevronDown className="h-4 w-4 text-gray-400" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4 text-gray-400" />
                                            )}
                                            <span className="text-sm font-medium">{category}</span>
                                            <Badge variant="secondary" className="text-xs">
                                              {data.count}
                                            </Badge>
                                          </div>
                                          <span className="text-xs text-green-400">
                                            {formatCurrency(data.cost)}
                                          </span>
                                        </button>

                                        {expandedCategories.has(category) && (
                                          <div className="border-t border-dark-hover p-2">
                                            {roomTakeoffs.takeoffItems
                                              .filter((item) => item.category === category)
                                              .map((item) => (
                                                <div
                                                  key={item.id}
                                                  className="mb-2 rounded bg-dark-base p-2 text-xs last:mb-0"
                                                >
                                                  <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                      <div className="flex items-center gap-1">
                                                        {item.verified ? (
                                                          <CheckCircle className="h-3 w-3 text-green-500" />
                                                        ) : (
                                                          <AlertCircle className="h-3 w-3 text-yellow-500" />
                                                        )}
                                                        <span className="font-medium">{item.itemName}</span>
                                                      </div>
                                                      {item.description && (
                                                        <p className="mt-1 text-gray-500 line-clamp-2">
                                                          {item.description}
                                                        </p>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="mt-1 flex items-center justify-between text-gray-400">
                                                    <span>
                                                      {item.quantity} {item.unit}
                                                    </span>
                                                    {item.totalCost && (
                                                      <span className="text-green-400">
                                                        {formatCurrency(item.totalCost)}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div className="rounded-md bg-dark-card p-4 text-center">
                                  <Box className="mx-auto h-8 w-8 text-gray-500" />
                                  <p className="mt-2 text-sm text-gray-400">
                                    No takeoff items found for this room
                                  </p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    Items will appear here when extracted from plans
                                  </p>
                                </div>
                              )}
                            </>
                          )}

                          {!loadingTakeoffs && !roomTakeoffs && (
                            <div className="text-center text-sm text-gray-500">
                              Unable to load takeoffs
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Equipment Details */}
                    {annotation.type === 'equipment' && (
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Tag:</span>
                          <p className="font-medium">{annotation.data.tag}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Name:</span>
                          <p className="font-medium">{annotation.data.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Trade:</span>
                          <Badge variant="outline">{annotation.data.trade}</Badge>
                        </div>
                      </div>
                    )}

                    {/* Takeoff Item Details */}
                    {annotation.type === 'takeoff' && (
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Item:</span>
                          <p className="font-medium">{annotation.data.itemName}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Category:</span>
                          <p className="font-medium">{annotation.data.category}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t border-dark-hover bg-dark-surface px-4 py-2 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          </span>
          <span>•</span>
          <span>Pan: {isDragging ? 'Active' : 'Inactive'}</span>
        </div>
        <div>
          Mouse wheel to zoom • Click and drag to pan
        </div>
      </div>
    </div>
  );
}
