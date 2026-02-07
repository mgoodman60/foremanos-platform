'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Map,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  X,
  Building2,
  Home,
  Ruler,
  Edit3,
  Save,
  Eye,
  CheckCircle2,
  Clock,
  Circle,
  Loader2,
  Grid3X3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WithTooltip } from '@/components/ui/icon-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Room {
  id: string;
  name: string;
  roomNumber?: string;
  type: string;
  floorNumber?: number;
  area?: number;
  gridLocation?: string;
  status: string;
  percentComplete: number;
  notes?: string;
  floorPlanId?: string;
  hotspotX?: number;
  hotspotY?: number;
  hotspotWidth?: number;
  hotspotHeight?: number;
  FinishScheduleItem?: any[];
  mepEquipment?: any[];
}

interface FloorPlan {
  id: string;
  name: string;
  floor: string | null;
  building: string | null;
  cloud_storage_path: string;
  isPublic: boolean;
  imageWidth: number | null;
  imageHeight: number | null;
  isActive: boolean;
}

interface PlanDocument {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  category: string;
  pageCount?: number;
  cloud_storage_path?: string;
}

interface FloorPlanViewerProps {
  projectSlug: string;
  rooms: Room[];
  selectedFloor?: number | null;
  onRoomSelect?: (room: Room) => void;
  onRoomUpdate?: (roomId: string, updates: Partial<Room>) => void;
  className?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  defaultCollapsed?: boolean;
}

export function FloorPlanViewer({
  projectSlug,
  rooms,
  selectedFloor = 1,
  onRoomSelect,
  onRoomUpdate,
  className = '',
  expanded = false,
  onToggleExpand,
  defaultCollapsed = false,
}: FloorPlanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [currentFloorPlan, setCurrentFloorPlan] = useState<FloorPlan | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);
  const [editedRoom, setEditedRoom] = useState<Partial<Room>>({});
  const [savingRoom, setSavingRoom] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showProgressOverlay, setShowProgressOverlay] = useState(true);
  const [dwgData, setDwgData] = useState<{
    fileName: string;
    layers: { name: string; objectCount: number }[];
    blocks: { name: string; count: number }[];
    textAnnotations: string[];
  } | null>(null);
  const [hasDwg, setHasDwg] = useState(false);
  const [planDocuments, setPlanDocuments] = useState<PlanDocument[]>([]);
  const [currentPlanDoc, setCurrentPlanDoc] = useState<PlanDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [planDocImageUrl, setPlanDocImageUrl] = useState<string | null>(null);
  const [loadingPlanImage, setLoadingPlanImage] = useState(false);

  // Fetch floor plans, plan documents, and DWG data
  useEffect(() => {
    const fetchFloorPlans = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/projects/${projectSlug}/floor-plans?active=true`);
        if (!response.ok) throw new Error('Failed to fetch floor plans');
        const data = await response.json();
        setFloorPlans(data.floorPlans || []);
        
        // Select floor plan matching selectedFloor
        const matchingPlan = data.floorPlans?.find(
          (fp: FloorPlan) => fp.floor === String(selectedFloor)
        ) || data.floorPlans?.[0];
        
        if (matchingPlan) {
          setCurrentFloorPlan(matchingPlan);
        }
        
        // If no floor plan images, check for plan documents in the library
        if (!data.floorPlans || data.floorPlans.length === 0) {
          await fetchPlanDocuments();
        }
      } catch (error) {
        console.error('Error fetching floor plans:', error);
        // Still try to get plan documents as fallback
        await fetchPlanDocuments();
      } finally {
        setLoading(false);
      }
    };
    
    const fetchPlanDocuments = async () => {
      try {
        // Fetch documents from the project
        const response = await fetch(`/api/documents?projectSlug=${projectSlug}`);
        if (!response.ok) return;
        const data = await response.json();
        
        // Filter for plan/drawing documents (PDF architectural plans)
        const plans = (data.documents || []).filter((doc: any) => {
          const name = doc.name?.toLowerCase() || '';
          const fileName = doc.fileName?.toLowerCase() || '';
          const category = doc.category?.toLowerCase() || '';
          
          // Check if it's a PDF (various ways it might be indicated)
          const isPdf = doc.fileType === 'pdf' || 
                       doc.fileType === 'application/pdf' ||
                       fileName.endsWith('.pdf') || 
                       doc.mimeType?.includes('pdf');
          
          if (!isPdf) return false;
          
          // Match plans, floor plans, architectural documents
          const isFloorPlan = 
            name.includes('plan') || 
            name.includes('floor') ||
            name.includes('architectural') ||
            name.includes('layout') ||
            name.includes('drawing') ||
            name.includes('sheet') ||
            fileName.includes('plan') ||
            fileName.includes('floor') ||
            category === 'plans_drawings' ||
            category === 'architectural' ||
            category === 'plans_drawings' ||
            // Also match common construction document names
            name === 'plans' ||
            fileName === 'plans.pdf' ||
            name.startsWith('a-') || // Architectural sheets like A-101
            name.match(/^a\d/) !== null; // A101, A102, etc.
          
          return isFloorPlan;
        });
        
        console.log('[FloorPlanViewer] Found plan documents:', plans.map((p: any) => p.name));
        
        // Sort to prioritize "Plans" document
        plans.sort((a: any, b: any) => {
          const aName = a.name?.toLowerCase() || '';
          const bName = b.name?.toLowerCase() || '';
          // Exact "plans" match gets highest priority
          if (aName === 'plans' || a.fileName?.toLowerCase() === 'plans.pdf') return -1;
          if (bName === 'plans' || b.fileName?.toLowerCase() === 'plans.pdf') return 1;
          return 0;
        });
        
        if (plans.length > 0) {
          setPlanDocuments(plans);
          setCurrentPlanDoc(plans[0]);
        } else {
          // No plan documents found, try DWG data
          await fetchDwgData();
        }
      } catch (error) {
        console.error('Error fetching plan documents:', error);
        await fetchDwgData();
      }
    };
    
    const fetchDwgData = async () => {
      try {
        const response = await fetch(`/api/autodesk/models?projectSlug=${projectSlug}`);
        if (!response.ok) return;
        const data = await response.json();
        
        // Find a ready DWG/DXF model with extracted metadata
        const dwgModel = data.models?.find((m: any) => 
          m.status === 'ready' && 
          m.extractedMetadata && 
          (m.fileType === 'dwg' || m.fileType === 'dxf' || m.fileName?.endsWith('.dwg') || m.fileName?.endsWith('.dxf'))
        );
        
        if (dwgModel?.extractedMetadata) {
          const meta = dwgModel.extractedMetadata;
          setDwgData({
            fileName: dwgModel.fileName,
            layers: meta.layers || [],
            blocks: meta.blocks || [],
            textAnnotations: meta.textAnnotations || []
          });
          setHasDwg(true);
        }
      } catch (error) {
        console.error('Error fetching DWG data:', error);
      }
    };
    
    fetchFloorPlans();
  }, [projectSlug, selectedFloor]);

  // Fetch plan document image when currentPlanDoc changes
  useEffect(() => {
    const fetchPlanDocImage = async () => {
      if (!currentPlanDoc) {
        setPlanDocImageUrl(null);
        return;
      }
      
      try {
        setLoadingPlanImage(true);
        // Use the plans image API to get a rendered image of the PDF page
        const response = await fetch(
          `/api/projects/${projectSlug}/plans/${currentPlanDoc.id}/image?page=${currentPage}&fallback=true`
        );
        
        if (!response.ok) throw new Error('Failed to get plan image');
        
        const data = await response.json();
        
        if (data.type === 'pdf_url' && data.url) {
          // Set the PDF URL for display
          setPlanDocImageUrl(data.url);
        } else {
          setPlanDocImageUrl(null);
        }
      } catch (error) {
        console.error('Error fetching plan document image:', error);
        setPlanDocImageUrl(null);
      } finally {
        setLoadingPlanImage(false);
      }
    };
    
    fetchPlanDocImage();
  }, [currentPlanDoc, currentPage, projectSlug]);

  // Fetch image URL when floor plan changes
  useEffect(() => {
    const fetchImageUrl = async () => {
      if (!currentFloorPlan?.cloud_storage_path) {
        setImageUrl(null);
        return;
      }
      
      try {
        // Fetch signed URL from API
        const response = await fetch(`/api/files/url?path=${encodeURIComponent(currentFloorPlan.cloud_storage_path)}&isPublic=${currentFloorPlan.isPublic}`);
        if (!response.ok) {
          throw new Error('Failed to get file URL');
        }
        const data = await response.json();
        setImageUrl(data.url);
      } catch (error) {
        console.error('Error fetching image URL:', error);
        setImageUrl(null);
      }
    };
    
    fetchImageUrl();
  }, [currentFloorPlan]);

  // Filter rooms for current floor (or all rooms if no floor plan)
  const floorRooms = useMemo(() => {
    if (!currentFloorPlan) {
      // No floor plan - show rooms filtered by selectedFloor
      if (selectedFloor === null) return rooms;
      return rooms.filter(room => room.floorNumber === selectedFloor);
    }
    if (currentFloorPlan.floor === null) return rooms;
    return rooms.filter(room => String(room.floorNumber) === currentFloorPlan.floor);
  }, [rooms, currentFloorPlan, selectedFloor]);

  // Rooms with hotspot coordinates (for uploaded floor plans)
  const roomsWithHotspots = floorRooms.filter(
    room => room.hotspotX !== undefined && room.hotspotY !== undefined
  );

  // Group rooms by type for auto-generated grid layout
  const roomsByType = useMemo(() => {
    const grouped: Record<string, Room[]> = {};
    floorRooms.forEach(room => {
      const type = room.type || 'other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(room);
    });
    return grouped;
  }, [floorRooms]);

  // Calculate grid dimensions for auto-layout
  const gridLayout = useMemo(() => {
    const totalRooms = floorRooms.length;
    const cols = Math.ceil(Math.sqrt(totalRooms * 1.5)); // Slightly wider than square
    const rows = Math.ceil(totalRooms / cols);
    return { cols, rows, totalRooms };
  }, [floorRooms.length]);

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
    setEditedRoom(room);
    setShowRoomModal(true);
    onRoomSelect?.(room);
  };

  const handleSaveRoom = async () => {
    if (!selectedRoom || !editedRoom) return;
    
    try {
      setSavingRoom(true);
      const response = await fetch(
        `/api/projects/${projectSlug}/rooms/${selectedRoom.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editedRoom),
        }
      );
      
      if (!response.ok) throw new Error('Failed to update room');
      
      const data = await response.json();
      toast.success('Room updated successfully');
      setEditingRoom(false);
      onRoomUpdate?.(selectedRoom.id, editedRoom);
    } catch (error) {
      console.error('Error saving room:', error);
      toast.error('Failed to save room changes');
    } finally {
      setSavingRoom(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-500 bg-green-500/30';
      case 'in_progress':
        return 'border-blue-500 bg-blue-500/30';
      default:
        return 'border-gray-400 bg-gray-400/20';
    }
  };

  const getStatusHoverColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-400 bg-green-500/50';
      case 'in_progress':
        return 'border-blue-400 bg-blue-500/50';
      default:
        return 'border-orange-400 bg-orange-500/40';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const navigateFloorPlan = (direction: 'prev' | 'next') => {
    if (!currentFloorPlan || floorPlans.length <= 1) return;
    const currentIndex = floorPlans.findIndex(fp => fp.id === currentFloorPlan.id);
    const newIndex = direction === 'prev'
      ? (currentIndex - 1 + floorPlans.length) % floorPlans.length
      : (currentIndex + 1) % floorPlans.length;
    setCurrentFloorPlan(floorPlans[newIndex]);
    handleReset();
  };

  // Get type color for auto-generated grid
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      office: 'bg-blue-500/40 border-blue-500',
      conference: 'bg-purple-500/40 border-purple-500',
      restroom: 'bg-cyan-500/40 border-cyan-500',
      corridor: 'bg-gray-500/40 border-gray-500',
      lobby: 'bg-amber-500/40 border-amber-500',
      storage: 'bg-orange-500/40 border-orange-500',
      mechanical: 'bg-red-500/40 border-red-500',
      electrical: 'bg-yellow-500/40 border-yellow-500',
      multipurpose: 'bg-green-500/40 border-green-500',
      exam_room: 'bg-teal-500/40 border-teal-500',
      waiting: 'bg-indigo-500/40 border-indigo-500',
      reception: 'bg-pink-500/40 border-pink-500',
    };
    return colors[type.toLowerCase()] || 'bg-gray-500/30 border-gray-500';
  };

  // Get color for DWG layer visualization
  const getLayerColor = (layerName: string, index: number): string => {
    const lowerName = layerName.toLowerCase();
    
    // Category-based colors
    if (lowerName.includes('sv') || lowerName.includes('survey') || lowerName.includes('pnt')) {
      return '#10B981'; // Green - survey points
    }
    if (lowerName.includes('grading') || lowerName.includes('grade') || lowerName.includes('elev')) {
      return '#F59E0B'; // Amber - grading
    }
    if (lowerName.includes('util') || lowerName.includes('storm') || lowerName.includes('water') || lowerName.includes('sewer')) {
      return '#3B82F6'; // Blue - utilities
    }
    if (lowerName.includes('pav') || lowerName.includes('curb') || lowerName.includes('road') || lowerName.includes('drive')) {
      return '#8B5CF6'; // Purple - paving
    }
    if (lowerName.includes('land') || lowerName.includes('tree') || lowerName.includes('plant')) {
      return '#22C55E'; // Green - landscaping
    }
    if (lowerName.includes('bldg') || lowerName.includes('build') || lowerName.includes('struct')) {
      return '#EC4899'; // Pink - building
    }
    if (lowerName.includes('elec') || lowerName.includes('light')) {
      return '#FACC15'; // Yellow - electrical
    }
    
    // Fallback: cycle through colors based on index
    const fallbackColors = ['#6366F1', '#14B8A6', '#F97316', '#EF4444', '#A855F7', '#06B6D4'];
    return fallbackColors[index % fallbackColors.length];
  };

  // Determine what we're showing
  const hasPlanDocuments = planDocuments.length > 0 && currentPlanDoc;
  const showPlanDocument = !imageUrl && hasPlanDocuments;
  const showDwg = !imageUrl && !hasPlanDocuments && hasDwg;
  const showAutoGrid = !imageUrl && !hasPlanDocuments && !hasDwg;

  return (
    <div className={`relative bg-[#1a1d21] border border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header - Clickable to collapse/expand */}
      <div 
        className="flex items-center justify-between border-b border-gray-700 px-4 py-2 bg-dark-card cursor-pointer hover:bg-[#363d47] transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          {imageUrl ? (
            <Map className="h-4 w-4 text-orange-500" />
          ) : showPlanDocument ? (
            <Map className="h-4 w-4 text-blue-500" />
          ) : showDwg ? (
            <Layers className="h-4 w-4 text-orange-500" />
          ) : (
            <Grid3X3 className="h-4 w-4 text-orange-500" />
          )}
          <span className="text-sm font-medium text-white">
            {imageUrl 
              ? (currentFloorPlan?.name || 'Floor Plan')
              : showPlanDocument
                ? (currentPlanDoc?.name || 'Architectural Plans')
                : showDwg 
                  ? 'CAD Drawing' 
                  : 'Floor Plan'}
          </span>
          {currentFloorPlan?.floor && imageUrl && (
            <Badge variant="outline" className="text-xs">
              {currentFloorPlan.floor === '1' ? '1st Floor' :
               currentFloorPlan.floor === '2' ? '2nd Floor' :
               currentFloorPlan.floor === '3' ? '3rd Floor' :
               `Floor ${currentFloorPlan.floor}`}
            </Badge>
          )}
          {/* Show appropriate badge */}
          {showPlanDocument ? (
            <Badge className="bg-blue-500/20 text-blue-400 text-xs">
              {planDocuments.length} document{planDocuments.length > 1 ? 's' : ''}
            </Badge>
          ) : showDwg ? (
            <Badge className="bg-blue-500/20 text-blue-400 text-xs">
              {dwgData?.layers.length || 0} layers
            </Badge>
          ) : (
            <Badge className="bg-orange-500/20 text-orange-400 text-xs">
              {floorRooms.length} rooms
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {/* Document navigation (when showing plan documents) */}
          {!isCollapsed && showPlanDocument && planDocuments.length > 1 && (
            <>
              <WithTooltip tooltip="Previous document">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                  onClick={() => {
                    const idx = planDocuments.findIndex(d => d.id === currentPlanDoc?.id);
                    const prevIdx = idx > 0 ? idx - 1 : planDocuments.length - 1;
                    setCurrentPlanDoc(planDocuments[prevIdx]);
                    setCurrentPage(1);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <span className="text-xs text-gray-400 px-1">
                {planDocuments.findIndex(d => d.id === currentPlanDoc?.id) + 1}/{planDocuments.length}
              </span>
              <WithTooltip tooltip="Next document">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                  onClick={() => {
                    const idx = planDocuments.findIndex(d => d.id === currentPlanDoc?.id);
                    const nextIdx = idx < planDocuments.length - 1 ? idx + 1 : 0;
                    setCurrentPlanDoc(planDocuments[nextIdx]);
                    setCurrentPage(1);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </WithTooltip>
            </>
          )}
          {/* Floor navigation (only when not collapsed and has floor plans) */}
          {!isCollapsed && floorPlans.length > 1 && (
            <>
              <WithTooltip tooltip="Previous floor">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                  onClick={() => navigateFloorPlan('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <WithTooltip tooltip="Next floor">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                  onClick={() => navigateFloorPlan('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </WithTooltip>
            </>
          )}
          
          {/* Zoom controls - only shown when not collapsed and has image */}
          {!isCollapsed && imageUrl && (
            <>
              <WithTooltip tooltip="Zoom out">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <span className="text-xs text-gray-400 w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <WithTooltip tooltip="Zoom in">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <WithTooltip tooltip="Reset view">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </WithTooltip>
              <WithTooltip tooltip={showProgressOverlay ? 'Hide progress colors' : 'Show progress colors'}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 hover:bg-gray-700 ${showProgressOverlay ? 'text-green-400' : 'text-gray-400'}`}
                  onClick={() => setShowProgressOverlay(!showProgressOverlay)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </WithTooltip>
            </>
          )}
          {onToggleExpand && !isCollapsed && (
            <WithTooltip tooltip={expanded ? 'Minimize' : 'Expand'}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={onToggleExpand}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </WithTooltip>
          )}
          {/* Collapse toggle icon */}
          <WithTooltip tooltip={isCollapsed ? 'Expand section' : 'Collapse section'}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
              onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </WithTooltip>
        </div>
      </div>

      {/* Content - Only shown when not collapsed */}
      {!isCollapsed && (
        <>
          {/* Floor Plan Canvas or Auto-Generated Grid */}
          <div
            ref={containerRef}
            className={`relative overflow-hidden ${imageUrl ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
            style={{ height: expanded ? 'calc(100vh - 300px)' : '200px' }}
            onMouseDown={imageUrl ? handleMouseDown : undefined}
            onMouseMove={imageUrl ? handleMouseMove : undefined}
            onMouseUp={imageUrl ? handleMouseUp : undefined}
            onMouseLeave={imageUrl ? handleMouseUp : undefined}
          >
            {loading || loadingPlanImage ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              </div>
            ) : showPlanDocument && planDocImageUrl ? (
              /* ARCHITECTURAL PLAN DOCUMENT - PDF Viewer using iframe */
              <div className="h-full w-full flex flex-col relative">
                <iframe
                  src={`${planDocImageUrl}#page=${currentPage}&view=FitH&toolbar=0&navpanes=0`}
                  className="w-full flex-1 bg-gray-900 border-0"
                  style={{ minHeight: expanded ? '500px' : '180px' }}
                  title={currentPlanDoc?.name || 'Floor Plan'}
                />
                {/* PDF controls overlay - positioned at bottom */}
                {currentPlanDoc?.pageCount && currentPlanDoc.pageCount > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 rounded-full px-3 py-1.5 z-10">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-white hover:bg-white/20"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-white min-w-[60px] text-center">
                      Page {currentPage} / {currentPlanDoc.pageCount}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-white hover:bg-white/20"
                      onClick={() => setCurrentPage(p => Math.min(currentPlanDoc.pageCount || 1, p + 1))}
                      disabled={currentPage >= (currentPlanDoc.pageCount || 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ) : !imageUrl ? (
              /* DWG VISUALIZATION or AUTO-GENERATED ROOM GRID when no floor plan image */
              showDwg && dwgData ? (
                /* DWG-based visualization */
                <div className="p-3 h-full overflow-auto">
                  <div className="mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-white">{dwgData.fileName}</span>
                    <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-400">
                      CAD Data
                    </Badge>
                  </div>
                  
                  {/* DWG Layers Visualization */}
                  <div className="grid gap-3 mb-4">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Layers ({dwgData.layers.length})</div>
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                      {dwgData.layers.slice(0, expanded ? 20 : 6).map((layer, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center gap-2 px-2 py-1.5 bg-gray-800/50 rounded border border-gray-700 hover:border-orange-500/50 transition-colors"
                        >
                          <div 
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: getLayerColor(layer.name, idx) }}
                          />
                          <span className="text-xs text-gray-300 truncate flex-1">{layer.name}</span>
                          <span className="text-[10px] text-gray-500">{layer.objectCount}</span>
                        </div>
                      ))}
                    </div>
                    {dwgData.layers.length > (expanded ? 20 : 6) && (
                      <span className="text-xs text-gray-500">+{dwgData.layers.length - (expanded ? 20 : 6)} more layers</span>
                    )}
                  </div>
                  
                  {/* DWG Blocks */}
                  {dwgData.blocks.length > 0 && (
                    <div className="grid gap-3 mb-4">
                      <div className="text-xs text-gray-400 uppercase tracking-wider">Blocks ({dwgData.blocks.length})</div>
                      <div className="flex flex-wrap gap-2">
                        {dwgData.blocks.slice(0, expanded ? 12 : 4).map((block, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center gap-1.5 px-2 py-1 bg-blue-900/30 rounded border border-blue-700/50"
                          >
                            <Grid3X3 className="h-3 w-3 text-blue-400" />
                            <span className="text-xs text-blue-300">{block.name}</span>
                            <span className="text-[10px] text-blue-500">×{block.count}</span>
                          </div>
                        ))}
                        {dwgData.blocks.length > (expanded ? 12 : 4) && (
                          <span className="text-xs text-gray-500 self-center">+{dwgData.blocks.length - (expanded ? 12 : 4)} more</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Room Grid (if rooms exist) */}
                  {floorRooms.length > 0 && (
                    <div className="border-t border-gray-700 pt-3 mt-3">
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Extracted Rooms ({floorRooms.length})</div>
                      <div 
                        className="grid gap-2"
                        style={{ gridTemplateColumns: `repeat(${Math.min(gridLayout.cols, 5)}, minmax(90px, 1fr))` }}
                      >
                        {floorRooms.slice(0, expanded ? 15 : 6).map((room, idx) => (
                          <div
                            key={room.id}
                            className={`
                              relative rounded-lg border p-1.5 cursor-pointer transition-all text-center
                              ${getTypeColor(room.type)}
                              ${hoveredRoom === room.id ? 'ring-2 ring-orange-500' : ''}
                            `}
                            onMouseEnter={() => setHoveredRoom(room.id)}
                            onMouseLeave={() => setHoveredRoom(null)}
                            onClick={() => handleRoomClick(room)}
                          >
                            <span className="text-[10px] font-medium text-white truncate block">
                              {room.roomNumber || room.name}
                            </span>
                            {room.area && (
                              <span className="text-[9px] text-gray-400">{room.area.toFixed(0)} SF</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : floorRooms.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                  <Building2 className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">No floor plan or room data available</p>
                  <p className="text-xs mt-1">Upload a floor plan image or extract rooms from documents</p>
                </div>
              ) : (
                /* Auto-generated room grid - LAST RESORT */
                <div className="p-3 h-full flex flex-col">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Grid3X3 className="h-3 w-3" />
                      <span>Auto-generated layout (no floor plan uploaded)</span>
                    </div>
                  </div>
                  
                  <div 
                    className="grid gap-2 h-full"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(gridLayout.cols, 6)}, minmax(100px, 1fr))`,
                    }}
                  >
                    {floorRooms.map((room, idx) => (
                      <div
                        key={room.id}
                        className={`
                          relative rounded-lg border-2 p-2 cursor-pointer transition-all
                          ${getTypeColor(room.type)}
                          ${hoveredRoom === room.id ? 'ring-2 ring-orange-500 scale-105' : ''}
                          ${room.status === 'completed' ? 'opacity-70' : ''}
                        `}
                        style={{ minHeight: expanded ? '80px' : '50px' }}
                        onMouseEnter={() => setHoveredRoom(room.id)}
                        onMouseLeave={() => setHoveredRoom(null)}
                        onClick={() => handleRoomClick(room)}
                      >
                        {/* Status indicator */}
                        <div className="absolute top-1 right-1">
                          {getStatusIcon(room.status)}
                        </div>
                        
                        {/* Room info */}
                        <div className="flex flex-col h-full justify-center">
                          <span className="text-xs font-bold text-white truncate">
                            {room.roomNumber || `#${idx + 1}`}
                          </span>
                          <span className="text-[10px] text-gray-300 truncate">
                            {room.name}
                          </span>
                          {room.area && expanded && (
                            <span className="text-[9px] text-gray-400 mt-1">
                              {room.area.toFixed(0)} SF
                            </span>
                          )}
                        </div>
                        
                        {/* Progress bar */}
                        {room.percentComplete > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700 rounded-b">
                            <div 
                              className="h-full bg-green-500 rounded-b"
                              style={{ width: `${room.percentComplete}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              /* UPLOADED FLOOR PLAN IMAGE */
              <div
                className="absolute inset-0 transition-transform"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center',
                }}
              >
                {/* Floor Plan Image */}
                <img
                  src={imageUrl}
                  alt={currentFloorPlan?.name || 'Floor Plan'}
                  className="max-w-none select-none"
                  style={{
                    width: currentFloorPlan?.imageWidth || 'auto',
                    height: currentFloorPlan?.imageHeight || 'auto',
                    maxHeight: expanded ? 'calc(100vh - 300px)' : '200px',
                    objectFit: 'contain',
                  }}
                  draggable={false}
                />
                
                {/* Room Hotspots */}
                {roomsWithHotspots.map(room => (
                  <div
                    key={room.id}
                    className={`absolute border-2 rounded transition-all cursor-pointer ${
                      showProgressOverlay
                        ? (hoveredRoom === room.id
                            ? getStatusHoverColor(room.status)
                            : getStatusColor(room.status))
                        : 'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20'
                    }`}
                    style={{
                      left: `${room.hotspotX}%`,
                      top: `${room.hotspotY}%`,
                      width: `${room.hotspotWidth || 8}%`,
                      height: `${room.hotspotHeight || 8}%`,
                    }}
                    onMouseEnter={() => setHoveredRoom(room.id)}
                    onMouseLeave={() => setHoveredRoom(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRoomClick(room);
                    }}
                  >
                    {/* Room Label (shown on hover) */}
                    {hoveredRoom === room.id && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-surface border border-gray-600 px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                        <span className="text-xs text-white font-medium">
                          {room.roomNumber || room.name}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Room Count Legend (for uploaded floor plans with hotspots) */}
            {imageUrl && roomsWithHotspots.length > 0 && (
              <div className="absolute bottom-2 left-2 bg-dark-surface/90 border border-gray-700 rounded px-2 py-1">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded border-2 border-green-500 bg-green-500/30" />
                    <span className="text-gray-400">Done</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded border-2 border-blue-500 bg-blue-500/30" />
                    <span className="text-gray-400">Active</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded border-2 border-gray-400 bg-gray-400/20" />
                    <span className="text-gray-400">Pending</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Room Detail Modal */}
      <Dialog open={showRoomModal} onOpenChange={setShowRoomModal}>
        <DialogContent className="max-w-2xl bg-dark-surface border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-orange-500" />
                <span>
                  {selectedRoom?.roomNumber
                    ? `Room ${selectedRoom.roomNumber}`
                    : selectedRoom?.name}
                </span>
                {getStatusIcon(selectedRoom?.status || 'not_started')}
              </div>
              <div className="flex items-center gap-2">
                {editingRoom ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingRoom(false)}
                      className="text-gray-400"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveRoom}
                      disabled={savingRoom}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      {savingRoom ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingRoom(true)}
                    className="text-orange-400 border-orange-500/50 hover:bg-orange-500/20"
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedRoom && (
            <div className="space-y-4 mt-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Room Name</label>
                  {editingRoom ? (
                    <Input
                      value={editedRoom.name || ''}
                      onChange={(e) => setEditedRoom({ ...editedRoom, name: e.target.value })}
                      className="bg-dark-card border-gray-600 text-white"
                    />
                  ) : (
                    <p className="text-white">{selectedRoom.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Room Number</label>
                  {editingRoom ? (
                    <Input
                      value={editedRoom.roomNumber || ''}
                      onChange={(e) => setEditedRoom({ ...editedRoom, roomNumber: e.target.value })}
                      className="bg-dark-card border-gray-600 text-white"
                    />
                  ) : (
                    <p className="text-white">{selectedRoom.roomNumber || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Type</label>
                  {editingRoom ? (
                    <Select
                      value={editedRoom.type || selectedRoom.type}
                      onValueChange={(value) => setEditedRoom({ ...editedRoom, type: value })}
                    >
                      <SelectTrigger className="bg-dark-card border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="conference">Conference</SelectItem>
                        <SelectItem value="restroom">Restroom</SelectItem>
                        <SelectItem value="corridor">Corridor</SelectItem>
                        <SelectItem value="lobby">Lobby</SelectItem>
                        <SelectItem value="storage">Storage</SelectItem>
                        <SelectItem value="mechanical">Mechanical</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="multipurpose">Multipurpose</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-white capitalize">{selectedRoom.type?.replace('_', ' ')}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Status</label>
                  {editingRoom ? (
                    <Select
                      value={editedRoom.status || selectedRoom.status}
                      onValueChange={(value) => setEditedRoom({ ...editedRoom, status: value })}
                    >
                      <SelectTrigger className="bg-dark-card border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedRoom.status)}
                      <span className="text-white capitalize">
                        {selectedRoom.status?.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Area</label>
                  {editingRoom ? (
                    <Input
                      type="number"
                      value={editedRoom.area || ''}
                      onChange={(e) => setEditedRoom({ ...editedRoom, area: parseFloat(e.target.value) || undefined })}
                      className="bg-dark-card border-gray-600 text-white"
                      placeholder="sq ft"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <Ruler className="h-4 w-4 text-gray-500" />
                      <span className="text-white">
                        {selectedRoom.area ? `${selectedRoom.area.toFixed(0)} sq ft` : '-'}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Floor</label>
                  {editingRoom ? (
                    <Select
                      value={String(editedRoom.floorNumber ?? selectedRoom.floorNumber ?? -1)}
                      onValueChange={(value) => setEditedRoom({ ...editedRoom, floorNumber: parseInt(value) })}
                    >
                      <SelectTrigger className="bg-dark-card border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-1">Unassigned</SelectItem>
                        <SelectItem value="0">Ground Floor</SelectItem>
                        <SelectItem value="1">1st Floor</SelectItem>
                        <SelectItem value="2">2nd Floor</SelectItem>
                        <SelectItem value="3">3rd Floor</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Layers className="h-4 w-4 text-orange-500" />
                      <span className="text-white">
                        {selectedRoom.floorNumber === 1 ? '1st Floor' :
                         selectedRoom.floorNumber === 2 ? '2nd Floor' :
                         selectedRoom.floorNumber === 3 ? '3rd Floor' :
                         selectedRoom.floorNumber === 0 ? 'Ground Floor' : 'Unassigned'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Finishes Section */}
              {selectedRoom.FinishScheduleItem && selectedRoom.FinishScheduleItem.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Finish Schedule ({selectedRoom.FinishScheduleItem.length} items)
                  </h4>
                  <div className="bg-dark-card rounded-lg p-3 max-h-40 overflow-y-auto">
                    <div className="space-y-2">
                      {selectedRoom.FinishScheduleItem.map((finish: any, idx: number) => (
                        <div key={finish.id || idx} className="flex items-center justify-between text-sm border-b border-gray-700 pb-2 last:border-0">
                          <span className="text-white">{finish.category}</span>
                          <span className="text-gray-400">{finish.material || finish.finishType || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MEP Equipment Section */}
              {selectedRoom.mepEquipment && selectedRoom.mepEquipment.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    MEP Equipment ({selectedRoom.mepEquipment.length} items)
                  </h4>
                  <div className="bg-dark-card rounded-lg p-3 max-h-40 overflow-y-auto">
                    <div className="space-y-2">
                      {selectedRoom.mepEquipment.map((equip: any, idx: number) => (
                        <div key={equip.id || idx} className="flex items-center justify-between text-sm border-b border-gray-700 pb-2 last:border-0">
                          <span className="text-white">{equip.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {equip.trade}
                            </Badge>
                            {equip.quantity && (
                              <span className="text-gray-400">x{equip.quantity}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Notes</label>
                {editingRoom ? (
                  <textarea
                    value={editedRoom.notes || ''}
                    onChange={(e) => setEditedRoom({ ...editedRoom, notes: e.target.value })}
                    className="w-full bg-dark-card border border-gray-600 text-white rounded-md p-2 text-sm min-h-[80px]"
                    placeholder="Add notes..."
                  />
                ) : (
                  <p className="text-gray-300 text-sm bg-dark-card rounded-md p-2 min-h-[40px]">
                    {selectedRoom.notes || 'No notes'}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
