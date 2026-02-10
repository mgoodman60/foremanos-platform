'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Map,
  Upload,
  Loader2,
  Edit3,
  CheckCircle2,
  Clock,
  Circle,
  Zap,
  Droplets,
  Wind,
  Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useFloorPlanCanvas } from '@/hooks/useFloorPlanCanvas';
import { RoomPlacementEditor } from './RoomPlacementEditor';

interface MEPItem {
  id: string;
  tag: string;
  name: string;
  trade: string;
  type?: string;
  manufacturer?: string;
  model?: string;
  capacity?: string;
  specifications?: any;
  status?: string;
  estimatedCost?: number;
  notes?: string;
  source?: 'mep_equipment' | 'takeoff';
  quantity?: number;
  unit?: string;
}

interface FinishItem {
  id: string;
  category: string;
  finishType?: string;
  material?: string;
  manufacturer?: string;
  color?: string;
  dimensions?: string;
  modelNumber?: string;
  csiCode?: string;
  status?: string;
  isConfirmed?: boolean;
}

interface Room {
  id: string;
  roomNumber: string;
  name: string;
  type: string;
  floor: string;
  floorNumber: number;
  area: number | null;
  status: string;
  percentComplete: number;
  notes: string | null;
  hotspotX?: number;
  hotspotY?: number;
  hotspotWidth?: number;
  hotspotHeight?: number;
  floorPlanId?: string;
  mepEquipment?: MEPItem[];
  FinishScheduleItem?: FinishItem[];
}

interface FloorPlan {
  id: string;
  name: string;
  floor: string | null;
  imageUrl: string;
  cloud_storage_path: string;
  imageWidth: number | null;
  imageHeight: number | null;
}

interface FloorPlanRoomViewProps {
  projectSlug: string;
  rooms: Room[];
  allRooms: Room[];
  selectedRoom: Room | null;
  onRoomSelect: (room: Room) => void;
  onRoomsChange: () => void;
  overlayContent?: React.ReactNode;
  toolbarActions?: React.ReactNode;
}

type ColorMode = 'status' | 'completion' | 'trade' | 'finishes';

export function FloorPlanRoomView({
  projectSlug,
  rooms,
  allRooms,
  selectedRoom,
  onRoomSelect,
  onRoomsChange,
  overlayContent,
  toolbarActions,
}: FloorPlanRoomViewProps) {
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [currentFloorPlan, setCurrentFloorPlan] = useState<FloorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('status');
  const [isEditingPlacement, setIsEditingPlacement] = useState(false);

  const {
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
  } = useFloorPlanCanvas();

  // Fetch floor plans
  useEffect(() => {
    const fetchFloorPlans = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/projects/${projectSlug}/floor-plans?active=true`);
        if (!response.ok) throw new Error('Failed to fetch floor plans');

        const data = await response.json();
        setFloorPlans(data.floorPlans || []);

        if (data.floorPlans && data.floorPlans.length > 0) {
          setCurrentFloorPlan(data.floorPlans[0]);
        }
      } catch (error) {
        console.error('Error fetching floor plans:', error);
        toast.error('Failed to load floor plans');
      } finally {
        setLoading(false);
      }
    };

    fetchFloorPlans();
  }, [projectSlug]);

  // Filter rooms for current floor
  const floorRooms = useMemo(() => {
    if (!currentFloorPlan?.floor) return rooms;
    return rooms.filter(room => String(room.floorNumber) === currentFloorPlan.floor);
  }, [rooms, currentFloorPlan]);

  // Rooms with hotspot coordinates
  const roomsWithHotspots = useMemo(() => {
    return floorRooms.filter(
      room => room.hotspotX !== undefined && room.hotspotY !== undefined
    );
  }, [floorRooms]);

  // Get room color based on current mode
  const getRoomColor = (room: Room): string => {
    switch (colorMode) {
      case 'status':
        switch (room.status) {
          case 'completed':
            return 'border-green-500 bg-green-500/30';
          case 'in_progress':
            return 'border-blue-500 bg-blue-500/30';
          default:
            return 'border-gray-400 bg-gray-400/20';
        }

      case 'completion':
        const percent = room.percentComplete;
        if (percent >= 75) return 'border-green-500 bg-green-500/30';
        if (percent >= 50) return 'border-yellow-500 bg-yellow-500/30';
        if (percent >= 25) return 'border-amber-500 bg-amber-500/30';
        return 'border-red-500 bg-red-500/30';

      case 'trade': {
        const tradeCounts = (room.mepEquipment || []).reduce((acc, item) => {
          const trade = item.trade || 'electrical';
          acc[trade] = (acc[trade] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const dominantTrade = Object.entries(tradeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

        switch (dominantTrade) {
          case 'hvac':
            return 'border-blue-500 bg-blue-500/30';
          case 'plumbing':
            return 'border-cyan-500 bg-cyan-500/30';
          case 'fire_alarm':
            return 'border-red-500 bg-red-500/30';
          case 'electrical':
            return 'border-yellow-500 bg-yellow-500/30';
          default:
            return 'border-gray-400 bg-gray-400/20';
        }
      }

      case 'finishes': {
        const finishes = room.FinishScheduleItem || [];
        const confirmedCount = finishes.filter(f => f.isConfirmed).length;

        if (confirmedCount === finishes.length && finishes.length > 0) {
          return 'border-green-500 bg-green-500/30';
        }
        if (confirmedCount > 0) {
          return 'border-amber-500 bg-amber-500/30';
        }
        return 'border-gray-400 bg-gray-400/20';
      }

      default:
        return 'border-gray-400 bg-gray-400/20';
    }
  };

  const getHoverColor = (room: Room): string => {
    switch (colorMode) {
      case 'status':
        switch (room.status) {
          case 'completed':
            return 'border-green-400 bg-green-500/50';
          case 'in_progress':
            return 'border-blue-400 bg-blue-500/50';
          default:
            return 'border-orange-400 bg-orange-500/40';
        }
      default:
        return 'border-orange-400 bg-orange-500/40';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-3 w-3 text-blue-500" />;
      default:
        return <Circle className="h-3 w-3 text-gray-400" />;
    }
  };

  const getTradeCounts = (mepEquipment: MEPItem[] | undefined): Record<string, number> => {
    return (mepEquipment || []).reduce((acc, item) => {
      const trade = item.trade || 'electrical';
      acc[trade] = (acc[trade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!currentFloorPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Upload className="h-16 w-16 text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No Floor Plan Available</h3>
        <p className="text-sm text-gray-400 max-w-md">
          Upload a floor plan to see rooms spatially and manage room placement
        </p>
      </div>
    );
  }

  if (isEditingPlacement) {
    return (
      <RoomPlacementEditor
        projectSlug={projectSlug}
        rooms={allRooms}
        floorPlanId={currentFloorPlan.id}
        imageUrl={currentFloorPlan.imageUrl}
        onSave={() => {
          setIsEditingPlacement(false);
          onRoomsChange();
          toast.success('Room placements saved');
        }}
        onCancel={() => setIsEditingPlacement(false)}
      />
    );
  }

  return (
    <div className="space-y-4" id="floor-plan-export-container">
      {/* Toolbar */}
      <div className="bg-dark-subtle rounded-lg p-4 border border-gray-800">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Floor selector */}
            {floorPlans.length > 1 && (
              <Select
                value={currentFloorPlan.id}
                onValueChange={(id) => {
                  const plan = floorPlans.find(fp => fp.id === id);
                  if (plan) setCurrentFloorPlan(plan);
                }}
              >
                <SelectTrigger className="w-[180px] bg-dark-base border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {floorPlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Color mode toggle */}
            <div className="flex items-center gap-1 border border-gray-700 rounded-md p-1">
              <button
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  colorMode === 'status'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setColorMode('status')}
              >
                Status
              </button>
              <button
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  colorMode === 'completion'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setColorMode('completion')}
              >
                Completion %
              </button>
              <button
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  colorMode === 'trade'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setColorMode('trade')}
              >
                Trade
              </button>
              <button
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  colorMode === 'finishes'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setColorMode('finishes')}
              >
                Finishes
              </button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 border border-gray-700 rounded-md">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400"
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-400 w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400"
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400"
                onClick={handleZoomReset}
                title="Reset view"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {toolbarActions}
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300"
              onClick={() => setIsEditingPlacement(true)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Placement
            </Button>
          </div>
        </div>
      </div>

      {/* Floor plan canvas */}
      <div className="bg-dark-subtle rounded-lg border border-gray-800 overflow-hidden">
        <div
          ref={containerRef}
          className={`relative bg-dark-base overflow-hidden ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ height: '600px' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div style={getTransformStyle()}>
            {/* Floor plan image */}
            <img
              src={currentFloorPlan.imageUrl}
              alt={currentFloorPlan.name}
              className="max-w-none select-none"
              style={{
                width: currentFloorPlan.imageWidth || 'auto',
                height: currentFloorPlan.imageHeight || 'auto',
                maxHeight: '600px',
                objectFit: 'contain',
              }}
              draggable={false}
            />

            {/* Room overlays */}
            {roomsWithHotspots.map((room) => (
              <div
                key={room.id}
                className={`absolute border-2 rounded transition-all cursor-pointer ${
                  hoveredRoom === room.id ? getHoverColor(room) : getRoomColor(room)
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
                  onRoomSelect(room);
                }}
              >
                {/* Tooltip on hover */}
                {hoveredRoom === room.id && (
                  <div className="absolute -top-20 left-1/2 -translate-x-1/2 bg-dark-surface border border-gray-600 px-3 py-2 rounded shadow-xl whitespace-nowrap z-50 min-w-[200px]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-white">{room.roomNumber}</span>
                        {getStatusIcon(room.status)}
                      </div>
                      <div className="text-xs text-gray-400">{room.name}</div>
                      {room.area != null && room.area > 0 && (
                        <div className="text-xs text-gray-500">{room.area} sq ft</div>
                      )}
                      <div className="text-xs text-gray-500">
                        {room.percentComplete}% complete
                      </div>
                      {room.mepEquipment && room.mepEquipment.length > 0 && (
                        <div className="flex items-center gap-1 pt-1 border-t border-gray-700">
                          <span className="text-[10px] text-gray-500">MEP:</span>
                          {Object.entries(getTradeCounts(room.mepEquipment))
                            .slice(0, 3)
                            .map(([trade, count]) => (
                              <Badge
                                key={trade}
                                variant="outline"
                                className="text-[9px] px-1 py-0 border-gray-600"
                              >
                                {trade}: {count}
                              </Badge>
                            ))}
                        </div>
                      )}
                      {room.FinishScheduleItem && room.FinishScheduleItem.length > 0 && (
                        <div className="text-[10px] text-gray-500">
                          {room.FinishScheduleItem.length} finishes
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Overlay content (for discipline layers, etc.) */}
            {overlayContent}
          </div>
        </div>

        {/* Color legend */}
        <div className="absolute bottom-4 left-4 bg-dark-surface/95 border border-gray-700 rounded px-3 py-2 shadow-xl">
          <div className="flex items-center gap-4 text-xs">
            {colorMode === 'status' && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-green-500 bg-green-500/30" />
                  <span className="text-gray-400">Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-blue-500 bg-blue-500/30" />
                  <span className="text-gray-400">In Progress</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-gray-400 bg-gray-400/20" />
                  <span className="text-gray-400">Not Started</span>
                </div>
              </>
            )}
            {colorMode === 'completion' && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-green-500 bg-green-500/30" />
                  <span className="text-gray-400">75-100%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-yellow-500 bg-yellow-500/30" />
                  <span className="text-gray-400">50-74%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-amber-500 bg-amber-500/30" />
                  <span className="text-gray-400">25-49%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-red-500 bg-red-500/30" />
                  <span className="text-gray-400">0-24%</span>
                </div>
              </>
            )}
            {colorMode === 'trade' && (
              <>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-yellow-400" />
                  <span className="text-gray-400">Electrical</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wind className="h-3 w-3 text-blue-400" />
                  <span className="text-gray-400">HVAC</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Droplets className="h-3 w-3 text-cyan-400" />
                  <span className="text-gray-400">Plumbing</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Flame className="h-3 w-3 text-red-400" />
                  <span className="text-gray-400">Fire Alarm</span>
                </div>
              </>
            )}
            {colorMode === 'finishes' && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-green-500 bg-green-500/30" />
                  <span className="text-gray-400">All Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-amber-500 bg-amber-500/30" />
                  <span className="text-gray-400">Partial</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-gray-400 bg-gray-400/20" />
                  <span className="text-gray-400">None</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
