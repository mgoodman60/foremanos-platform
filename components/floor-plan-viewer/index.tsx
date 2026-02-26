'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Building2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { ViewerToolbar } from './viewer-toolbar';
import { RoomDetailModal } from './room-detail-modal';
import { DwgDataPanel } from './dwg-data-panel';
import { AutoRoomGrid } from './auto-room-grid';
import { getStatusColor, getStatusHoverColor } from './status-helpers';

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

  // Data state
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [currentFloorPlan, setCurrentFloorPlan] = useState<FloorPlan | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  // UI state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showProgressOverlay, setShowProgressOverlay] = useState(true);

  // Fetch floor plans, plan documents, and DWG data
  useEffect(() => {
    const fetchDwgData = async () => {
      try {
        const response = await fetch(`/api/autodesk/models?projectSlug=${projectSlug}`);
        if (!response.ok) return;
        const data = await response.json();

        const dwgModel = data.models?.find(
          (m: any) =>
            m.status === 'ready' &&
            m.extractedMetadata &&
            (m.fileType === 'dwg' ||
              m.fileType === 'dxf' ||
              m.fileName?.endsWith('.dwg') ||
              m.fileName?.endsWith('.dxf'))
        );

        if (dwgModel?.extractedMetadata) {
          const meta = dwgModel.extractedMetadata;
          setDwgData({
            fileName: dwgModel.fileName,
            layers: meta.layers || [],
            blocks: meta.blocks || [],
            textAnnotations: meta.textAnnotations || [],
          });
          setHasDwg(true);
        }
      } catch (error) {
        console.error('Error fetching DWG data:', error);
      }
    };

    const fetchPlanDocuments = async () => {
      try {
        const response = await fetch(`/api/documents?projectSlug=${projectSlug}`);
        if (!response.ok) return;
        const data = await response.json();

        const plans = (data.documents || []).filter((doc: any) => {
          const name = doc.name?.toLowerCase() || '';
          const fileName = doc.fileName?.toLowerCase() || '';
          const category = doc.category?.toLowerCase() || '';

          const isPdf =
            doc.fileType === 'pdf' ||
            doc.fileType === 'application/pdf' ||
            fileName.endsWith('.pdf') ||
            doc.mimeType?.includes('pdf');

          if (!isPdf) return false;

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
            name === 'plans' ||
            fileName === 'plans.pdf' ||
            name.startsWith('a-') ||
            name.match(/^a\d/) !== null;

          return isFloorPlan;
        });

        console.log('[FloorPlanViewer] Found plan documents:', plans.map((p: any) => p.name));

        plans.sort((a: any, b: any) => {
          const aName = a.name?.toLowerCase() || '';
          const bName = b.name?.toLowerCase() || '';
          if (aName === 'plans' || a.fileName?.toLowerCase() === 'plans.pdf') return -1;
          if (bName === 'plans' || b.fileName?.toLowerCase() === 'plans.pdf') return 1;
          return 0;
        });

        if (plans.length > 0) {
          setPlanDocuments(plans);
          setCurrentPlanDoc(plans[0]);
        } else {
          await fetchDwgData();
        }
      } catch (error) {
        console.error('Error fetching plan documents:', error);
        await fetchDwgData();
      }
    };

    const fetchFloorPlans = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/projects/${projectSlug}/floor-plans?active=true`
        );
        if (!response.ok) throw new Error('Failed to fetch floor plans');
        const data = await response.json();
        setFloorPlans(data.floorPlans || []);

        const matchingPlan =
          data.floorPlans?.find((fp: FloorPlan) => fp.floor === String(selectedFloor)) ||
          data.floorPlans?.[0];

        if (matchingPlan) {
          setCurrentFloorPlan(matchingPlan);
        }

        if (!data.floorPlans || data.floorPlans.length === 0) {
          await fetchPlanDocuments();
        }
      } catch (error) {
        console.error('Error fetching floor plans:', error);
        await fetchPlanDocuments();
      } finally {
        setLoading(false);
      }
    };

    fetchFloorPlans();
  }, [projectSlug, selectedFloor]);

  // Fetch plan document image when currentPlanDoc or page changes
  useEffect(() => {
    const fetchPlanDocImage = async () => {
      if (!currentPlanDoc) {
        setPlanDocImageUrl(null);
        return;
      }

      try {
        setLoadingPlanImage(true);
        const response = await fetch(
          `/api/projects/${projectSlug}/plans/${currentPlanDoc.id}/image?page=${currentPage}&fallback=true`
        );

        if (!response.ok) throw new Error('Failed to get plan image');

        const data = await response.json();

        if (data.type === 'pdf_url' && data.url) {
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
        const response = await fetch(
          `/api/files/url?path=${encodeURIComponent(currentFloorPlan.cloud_storage_path)}&isPublic=${currentFloorPlan.isPublic}`
        );
        if (!response.ok) throw new Error('Failed to get file URL');
        const data = await response.json();
        setImageUrl(data.url);
      } catch (error) {
        console.error('Error fetching image URL:', error);
        setImageUrl(null);
      }
    };

    fetchImageUrl();
  }, [currentFloorPlan]);

  // Derived data
  const floorRooms = useMemo(() => {
    if (!currentFloorPlan) {
      if (selectedFloor === null) return rooms;
      return rooms.filter(room => room.floorNumber === selectedFloor);
    }
    if (currentFloorPlan.floor === null) return rooms;
    return rooms.filter(room => String(room.floorNumber) === currentFloorPlan.floor);
  }, [rooms, currentFloorPlan, selectedFloor]);

  const roomsWithHotspots = useMemo(() => floorRooms.filter(
    room => room.hotspotX !== undefined && room.hotspotY !== undefined
  ), [floorRooms]);

  const gridLayout = useMemo(() => {
    const totalRooms = floorRooms.length;
    const cols = Math.ceil(Math.sqrt(totalRooms * 1.5));
    const rows = Math.ceil(totalRooms / cols);
    return { cols, rows, totalRooms };
  }, [floorRooms.length]);

  // Mode flags
  const hasPlanDocuments = planDocuments.length > 0 && currentPlanDoc;
  const showPlanDocument = !imageUrl && !!hasPlanDocuments;
  const showDwg = !imageUrl && !hasPlanDocuments && hasDwg;
  const showAutoGrid = !imageUrl && !hasPlanDocuments && !hasDwg;

  // Zoom handlers
  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z * 1.2, 4)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z / 1.2, 0.5)), []);
  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Pan (drag) handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // Room interaction
  const handleRoomClick = useCallback((room: Room) => {
    setSelectedRoom(room);
    setShowRoomModal(true);
    onRoomSelect?.(room);
  }, [onRoomSelect]);

  // Toolbar toggle handlers
  const handleCollapseToggle = useCallback(() => setIsCollapsed(prev => !prev), []);
  const handleProgressToggle = useCallback(() => setShowProgressOverlay(prev => !prev), []);

  const handleSaveRoom = async (editedRoom: Partial<Room>) => {
    if (!selectedRoom) return;

    try {
      setSavingRoom(true);
      const response = await fetch(`/api/projects/${projectSlug}/rooms/${selectedRoom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedRoom),
      });

      if (!response.ok) throw new Error('Failed to update room');

      await response.json();
      toast.success('Room updated successfully');
      onRoomUpdate?.(selectedRoom.id, editedRoom);
    } catch (error) {
      console.error('Error saving room:', error);
      toast.error('Failed to save room changes');
    } finally {
      setSavingRoom(false);
    }
  };

  // Navigation
  const navigateFloorPlan = (direction: 'prev' | 'next') => {
    if (!currentFloorPlan || floorPlans.length <= 1) return;
    const currentIndex = floorPlans.findIndex(fp => fp.id === currentFloorPlan.id);
    const newIndex =
      direction === 'prev'
        ? (currentIndex - 1 + floorPlans.length) % floorPlans.length
        : (currentIndex + 1) % floorPlans.length;
    setCurrentFloorPlan(floorPlans[newIndex]);
    handleReset();
  };

  const navigateDocument = (direction: 'prev' | 'next') => {
    const idx = planDocuments.findIndex(d => d.id === currentPlanDoc?.id);
    if (direction === 'prev') {
      const prevIdx = idx > 0 ? idx - 1 : planDocuments.length - 1;
      setCurrentPlanDoc(planDocuments[prevIdx]);
    } else {
      const nextIdx = idx < planDocuments.length - 1 ? idx + 1 : 0;
      setCurrentPlanDoc(planDocuments[nextIdx]);
    }
    setCurrentPage(1);
  };

  return (
    <div className={`relative bg-dark-active border border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <ViewerToolbar
        imageUrl={imageUrl}
        showPlanDocument={showPlanDocument}
        showDwg={showDwg}
        isCollapsed={isCollapsed}
        currentFloorPlan={currentFloorPlan}
        currentPlanDoc={currentPlanDoc}
        planDocuments={planDocuments}
        floorPlans={floorPlans}
        floorRoomsCount={floorRooms.length}
        dwgLayerCount={dwgData?.layers.length || 0}
        zoom={zoom}
        showProgressOverlay={showProgressOverlay}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onCollapseToggle={handleCollapseToggle}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onProgressToggle={handleProgressToggle}
        onNavigateFloor={navigateFloorPlan}
        onNavigateDocument={navigateDocument}
      />

      {/* Body */}
      {!isCollapsed && (
        <>
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
              /* PDF document viewer */
              <div className="h-full w-full flex flex-col relative">
                <iframe
                  src={`${planDocImageUrl}#page=${currentPage}&view=FitH&toolbar=0&navpanes=0`}
                  className="w-full flex-1 bg-gray-900 border-0"
                  style={{ minHeight: expanded ? '500px' : '180px' }}
                  title={currentPlanDoc?.name || 'Floor Plan'}
                />
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
                      onClick={() =>
                        setCurrentPage(p => Math.min(currentPlanDoc.pageCount || 1, p + 1))
                      }
                      disabled={currentPage >= (currentPlanDoc.pageCount || 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ) : showDwg && dwgData ? (
              /* DWG data panel */
              <DwgDataPanel
                dwgData={dwgData}
                floorRooms={floorRooms}
                gridCols={gridLayout.cols}
                expanded={expanded}
                hoveredRoom={hoveredRoom}
                onRoomHover={setHoveredRoom}
                onRoomClick={handleRoomClick}
              />
            ) : showAutoGrid ? (
              floorRooms.length === 0 ? (
                /* Empty state */
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <Building2 className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">No floor plan or room data available</p>
                  <p className="text-xs mt-1">
                    Upload a floor plan image or extract rooms from documents
                  </p>
                </div>
              ) : (
                /* Auto-generated room grid */
                <AutoRoomGrid
                  rooms={floorRooms}
                  gridCols={gridLayout.cols}
                  expanded={expanded}
                  hoveredRoom={hoveredRoom}
                  onRoomHover={setHoveredRoom}
                  onRoomClick={handleRoomClick}
                />
              )
            ) : (
              /* Uploaded floor plan image with hotspots */
              <div
                className="absolute inset-0 transition-transform"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl!}
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

                {/* Room hotspots */}
                {roomsWithHotspots.map(room => (
                  <div
                    key={room.id}
                    className={`absolute border-2 rounded transition-all cursor-pointer ${
                      showProgressOverlay
                        ? hoveredRoom === room.id
                          ? getStatusHoverColor(room.status)
                          : getStatusColor(room.status)
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
                    onClick={e => {
                      e.stopPropagation();
                      handleRoomClick(room);
                    }}
                  >
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

            {/* Legend for uploaded floor plans with hotspots */}
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
      <RoomDetailModal
        open={showRoomModal}
        onOpenChange={setShowRoomModal}
        selectedRoom={selectedRoom}
        savingRoom={savingRoom}
        onSave={handleSaveRoom}
      />
    </div>
  );
}
