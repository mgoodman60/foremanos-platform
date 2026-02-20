'use client';

import { useState, useMemo } from 'react';
import {
  X,
  Save,
  Loader2,
  CheckCircle2,
  MapPin,
  MousePointer2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useFloorPlanCanvas } from '@/hooks/useFloorPlanCanvas';

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
  mepEquipment?: any[];
  FinishScheduleItem?: any[];
}

interface RoomPlacementEditorProps {
  projectSlug: string;
  rooms: Room[];
  floorPlanId: string;
  imageUrl: string;
  onSave: () => void;
  onCancel: () => void;
}

interface Placement {
  roomId: string;
  hotspotX: number;
  hotspotY: number;
  hotspotWidth: number;
  hotspotHeight: number;
  floorPlanId: string;
}

interface DragState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function RoomPlacementEditor({
  projectSlug,
  rooms,
  floorPlanId,
  imageUrl,
  onSave,
  onCancel,
}: RoomPlacementEditorProps) {
  const [placements, setPlacements] = useState<Record<string, Placement>>(() => {
    // Initialize with existing placements
    const initial: Record<string, Placement> = {};
    rooms.forEach(room => {
      if (room.hotspotX !== undefined && room.hotspotY !== undefined) {
        initial[room.id] = {
          roomId: room.id,
          hotspotX: room.hotspotX,
          hotspotY: room.hotspotY,
          hotspotWidth: room.hotspotWidth || 8,
          hotspotHeight: room.hotspotHeight || 8,
          floorPlanId: room.floorPlanId || floorPlanId,
        };
      }
    });
    return initial;
  });

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizingRoomId, setResizingRoomId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    zoom,
    containerRef,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleWheel,
    getTransformStyle,
  } = useFloorPlanCanvas();

  // Separate placed and unplaced rooms
  const { placedRooms, unplacedRooms } = useMemo(() => {
    const placed: Room[] = [];
    const unplaced: Room[] = [];

    rooms.forEach(room => {
      if (placements[room.id]) {
        placed.push(room);
      } else {
        unplaced.push(room);
      }
    });

    return { placedRooms: placed, unplacedRooms: unplaced };
  }, [rooms, placements]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedRoomId || resizingRoomId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDragging(true);
    setDragState({ startX: x, startY: y, endX: x, endY: y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragState) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setDragState({ ...dragState, endX: x, endY: y });
  };

  const handleCanvasMouseUp = () => {
    if (!isDragging || !dragState || !selectedRoomId) return;

    const width = Math.abs(dragState.endX - dragState.startX);
    const height = Math.abs(dragState.endY - dragState.startY);

    // Minimum size check
    if (width < 2 || height < 2) {
      setIsDragging(false);
      setDragState(null);
      return;
    }

    const placement: Placement = {
      roomId: selectedRoomId,
      hotspotX: Math.min(dragState.startX, dragState.endX),
      hotspotY: Math.min(dragState.startY, dragState.endY),
      hotspotWidth: width,
      hotspotHeight: height,
      floorPlanId,
    };

    setPlacements(prev => ({ ...prev, [selectedRoomId]: placement }));
    setSelectedRoomId(null);
    setIsDragging(false);
    setDragState(null);
  };

  const handleResizeStart = (roomId: string, handle: 'tl' | 'tr' | 'bl' | 'br', e: React.MouseEvent) => {
    e.stopPropagation();
    setResizingRoomId(roomId);
    setResizeHandle(handle);
  };

  const handleResizeMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!resizingRoomId || !resizeHandle || !containerRef.current) return;

    const placement = placements[resizingRoomId];
    if (!placement) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newPlacement = { ...placement };

    switch (resizeHandle) {
      case 'tl':
        newPlacement.hotspotWidth = placement.hotspotX + placement.hotspotWidth - x;
        newPlacement.hotspotHeight = placement.hotspotY + placement.hotspotHeight - y;
        newPlacement.hotspotX = x;
        newPlacement.hotspotY = y;
        break;
      case 'tr':
        newPlacement.hotspotWidth = x - placement.hotspotX;
        newPlacement.hotspotHeight = placement.hotspotY + placement.hotspotHeight - y;
        newPlacement.hotspotY = y;
        break;
      case 'bl':
        newPlacement.hotspotWidth = placement.hotspotX + placement.hotspotWidth - x;
        newPlacement.hotspotHeight = y - placement.hotspotY;
        newPlacement.hotspotX = x;
        break;
      case 'br':
        newPlacement.hotspotWidth = x - placement.hotspotX;
        newPlacement.hotspotHeight = y - placement.hotspotY;
        break;
    }

    // Minimum size constraint
    if (newPlacement.hotspotWidth >= 2 && newPlacement.hotspotHeight >= 2) {
      setPlacements(prev => ({ ...prev, [resizingRoomId]: newPlacement }));
    }
  };

  const handleResizeEnd = () => {
    setResizingRoomId(null);
    setResizeHandle(null);
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const placementsArray = Object.values(placements);

      const response = await fetch(
        `/api/projects/${projectSlug}/rooms/bulk-update-hotspots`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placements: placementsArray }),
        }
      );

      if (!response.ok) throw new Error('Failed to save placements');

      onSave();
    } catch (error) {
      console.error('Error saving placements:', error);
      toast.error('Failed to save room placements');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePlacement = (roomId: string) => {
    setPlacements(prev => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  };

  return (
    <div className="flex h-[calc(100vh-300px)] gap-4">
      {/* Left sidebar - Room list */}
      <div className="w-80 bg-dark-subtle border border-gray-800 rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white mb-1">Room Placement</h3>
          <p className="text-xs text-gray-400">
            Click a room, then drag on the floor plan to place it
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Unplaced rooms */}
          {unplacedRooms.length > 0 && (
            <div className="p-3 border-b border-gray-800">
              <div className="text-xs font-medium text-gray-400 uppercase mb-2">
                Unplaced ({unplacedRooms.length})
              </div>
              <div className="space-y-1">
                {unplacedRooms.map(room => (
                  <button
                    key={room.id}
                    className={`w-full text-left p-2 rounded border transition-colors ${
                      selectedRoomId === room.id
                        ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                        : 'bg-dark-base border-gray-700 text-white hover:border-gray-600'
                    }`}
                    onClick={() => setSelectedRoomId(room.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{room.roomNumber}</div>
                        <div className="text-xs text-gray-400 truncate">{room.name}</div>
                      </div>
                      {selectedRoomId === room.id && (
                        <MousePointer2 className="h-3 w-3 text-orange-400 ml-2 shrink-0" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Placed rooms */}
          {placedRooms.length > 0 && (
            <div className="p-3">
              <div className="text-xs font-medium text-gray-400 uppercase mb-2">
                Placed ({placedRooms.length})
              </div>
              <div className="space-y-1">
                {placedRooms.map(room => (
                  <div
                    key={room.id}
                    className="flex items-center gap-2 p-2 rounded bg-dark-base border border-gray-700"
                  >
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {room.roomNumber}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{room.name}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-red-400"
                      onClick={() => handleRemovePlacement(room.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-3 border-t border-gray-800 space-y-2">
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleSaveAll}
            disabled={saving || Object.keys(placements).length === 0}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4 mr-2" aria-hidden="true" />
            )}
            Save All Placements
          </Button>
          <Button
            variant="outline"
            className="w-full border-gray-700 text-gray-300"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Right side - Floor plan canvas */}
      <div className="flex-1 bg-dark-subtle border border-gray-800 rounded-lg overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <span className="text-sm font-medium text-white">Floor Plan Editor</span>
            {selectedRoomId && (
              <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                Click and drag to place room
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 border border-gray-700 rounded-md">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400"
              onClick={handleZoomOut}
            >
              -
            </Button>
            <span className="text-xs text-gray-400 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400"
              onClick={handleZoomIn}
            >
              +
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400"
              onClick={handleZoomReset}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className={`flex-1 overflow-hidden bg-dark-base relative ${
            selectedRoomId ? 'cursor-crosshair' : 'cursor-default'
          }`}
          onWheel={handleWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={(e) => {
            handleCanvasMouseMove(e);
            handleResizeMove(e);
          }}
          onMouseUp={() => {
            handleCanvasMouseUp();
            handleResizeEnd();
          }}
          onMouseLeave={() => {
            handleResizeEnd();
          }}
        >
          <div style={getTransformStyle()}>
            {/* Floor plan image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Floor Plan"
              className="max-w-none select-none"
              draggable={false}
            />

            {/* Existing placements */}
            {Object.entries(placements).map(([roomId, placement]) => {
              const room = rooms.find(r => r.id === roomId);
              if (!room) return null;

              return (
                <div
                  key={roomId}
                  className="absolute border-2 border-orange-500 bg-orange-500/20 rounded cursor-move"
                  style={{
                    left: `${placement.hotspotX}%`,
                    top: `${placement.hotspotY}%`,
                    width: `${placement.hotspotWidth}%`,
                    height: `${placement.hotspotHeight}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRoomId(roomId);
                  }}
                >
                  {/* Room label */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-white bg-dark-surface/90 px-2 py-1 rounded">
                      {room.roomNumber}
                    </span>
                  </div>

                  {/* Resize handles */}
                  {['tl', 'tr', 'bl', 'br'].map((handle) => (
                    <div
                      key={handle}
                      className={`absolute w-3 h-3 bg-orange-500 border border-white rounded-full cursor-${
                        handle === 'tl' || handle === 'br' ? 'nwse' : 'nesw'
                      }-resize hover:scale-125 transition-transform`}
                      style={{
                        top: handle.includes('t') ? '-6px' : 'auto',
                        bottom: handle.includes('b') ? '-6px' : 'auto',
                        left: handle.includes('l') ? '-6px' : 'auto',
                        right: handle.includes('r') ? '-6px' : 'auto',
                      }}
                      onMouseDown={(e) =>
                        handleResizeStart(roomId, handle as 'tl' | 'tr' | 'bl' | 'br', e)
                      }
                    />
                  ))}
                </div>
              );
            })}

            {/* Active drag rectangle */}
            {isDragging && dragState && (
              <div
                className="absolute border-2 border-dashed border-orange-400 bg-orange-500/10"
                style={{
                  left: `${Math.min(dragState.startX, dragState.endX)}%`,
                  top: `${Math.min(dragState.startY, dragState.endY)}%`,
                  width: `${Math.abs(dragState.endX - dragState.startX)}%`,
                  height: `${Math.abs(dragState.endY - dragState.startY)}%`,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
