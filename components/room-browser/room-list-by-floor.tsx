'use client';

import { ChevronDown, ChevronRight, Layers, Building2, Home, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Room } from './types';
import { RoomCard } from './room-card';

interface RoomListByFloorProps {
  floors: number[];
  roomsByFloor: Record<number, Room[]>;
  expandedFloors: Set<number>;
  expandedRooms: Set<string>;
  selectedRoomIds: Set<string>;
  updatingRoomId: string | null;
  exportingRoomId: string | null;
  exportingDocxRoomId: string | null;
  loading: boolean;
  hasActiveFilters: boolean;
  extracting: boolean;
  onToggleFloor: (floor: number) => void;
  onToggleRoomExpand: (roomId: string) => void;
  onToggleRoomSelect: (roomId: string) => void;
  onUpdateFloor: (roomId: string, newFloor: number | null) => void;
  onExportPDF: (room: Room) => void;
  onExportDOCX: (room: Room) => void;
  onExtractRooms: () => void;
}

function getFloorLabel(floor: number) {
  if (floor === -1) return 'Unassigned';
  if (floor === 0) return 'Ground Floor';
  if (floor === 1) return '1st Floor';
  if (floor === 2) return '2nd Floor';
  if (floor === 3) return '3rd Floor';
  return `${floor}th Floor`;
}

export function RoomListByFloor({
  floors,
  roomsByFloor,
  expandedFloors,
  expandedRooms,
  selectedRoomIds,
  updatingRoomId,
  exportingRoomId,
  exportingDocxRoomId,
  loading,
  hasActiveFilters,
  extracting,
  onToggleFloor,
  onToggleRoomExpand,
  onToggleRoomSelect,
  onUpdateFloor,
  onExportPDF,
  onExportDOCX,
  onExtractRooms,
}: RoomListByFloorProps) {
  const totalFilteredRooms = floors.reduce((sum, floor) => sum + (roomsByFloor[floor]?.length ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
          <p className="text-sm text-gray-400">Loading rooms...</p>
        </div>
      </div>
    );
  }

  if (totalFilteredRooms === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Building2 className="mx-auto mb-3 h-12 w-12 text-gray-600" />
          <p className="text-sm text-gray-400">
            {hasActiveFilters ? 'No rooms match your filters' : 'No rooms found in this project'}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            {hasActiveFilters
              ? 'Try adjusting your search criteria'
              : 'Click below to extract rooms from processed documents'}
          </p>
          {!hasActiveFilters && (
            <Button
              onClick={onExtractRooms}
              disabled={extracting}
              className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Home className="mr-2 h-4 w-4" />
                  Extract Rooms
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {floors.map((floor) => (
        <div key={floor} className="space-y-1">
          {/* Floor Header */}
          <button
            onClick={() => onToggleFloor(floor)}
            className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-left hover:bg-dark-hover transition-colors"
          >
            {expandedFloors.has(floor) ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
            <Layers className="h-4 w-4 text-orange-500" />
            <span className="font-medium text-slate-50">{getFloorLabel(floor)}</span>
            <Badge variant="secondary" className="ml-auto">
              {roomsByFloor[floor].length}
            </Badge>
          </button>

          {/* Floor Rooms */}
          {expandedFloors.has(floor) && (
            <div className="ml-6 space-y-1">
              {roomsByFloor[floor].map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  isExpanded={expandedRooms.has(room.id)}
                  isSelected={selectedRoomIds.has(room.id)}
                  isUpdatingFloor={updatingRoomId === room.id}
                  exportingRoomId={exportingRoomId}
                  exportingDocxRoomId={exportingDocxRoomId}
                  onToggleExpand={onToggleRoomExpand}
                  onToggleSelect={onToggleRoomSelect}
                  onUpdateFloor={onUpdateFloor}
                  onExportPDF={onExportPDF}
                  onExportDOCX={onExportDOCX}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
