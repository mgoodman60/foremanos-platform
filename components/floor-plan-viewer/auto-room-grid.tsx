'use client';

import { Grid3X3 } from 'lucide-react';
import { getTypeColor } from './status-helpers';
import { getStatusIcon } from './status-icon';

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

interface AutoRoomGridProps {
  rooms: Room[];
  gridCols: number;
  expanded: boolean;
  hoveredRoom: string | null;
  onRoomHover: (id: string | null) => void;
  onRoomClick: (room: Room) => void;
}

export function AutoRoomGrid({
  rooms,
  gridCols,
  expanded,
  hoveredRoom,
  onRoomHover,
  onRoomClick,
}: AutoRoomGridProps) {
  return (
    <div className="p-3 h-full flex flex-col">
      {/* Label */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Grid3X3 className="h-3 w-3" />
          <span>Auto-generated layout (no floor plan uploaded)</span>
        </div>
      </div>

      {/* Grid */}
      <div
        className="grid gap-2 h-full"
        style={{
          gridTemplateColumns: `repeat(${Math.min(gridCols, 6)}, minmax(100px, 1fr))`,
        }}
      >
        {rooms.map((room, idx) => (
          <div
            key={room.id}
            className={`
              relative rounded-lg border-2 p-2 cursor-pointer transition-all
              ${getTypeColor(room.type)}
              ${hoveredRoom === room.id ? 'ring-2 ring-orange-500 scale-105' : ''}
              ${room.status === 'completed' ? 'opacity-70' : ''}
            `}
            style={{ minHeight: expanded ? '80px' : '50px' }}
            onMouseEnter={() => onRoomHover(room.id)}
            onMouseLeave={() => onRoomHover(null)}
            onClick={() => onRoomClick(room)}
          >
            {/* Status indicator */}
            <div className="absolute top-1 right-1">{getStatusIcon(room.status)}</div>

            {/* Room info */}
            <div className="flex flex-col h-full justify-center">
              <span className="text-xs font-bold text-white truncate">
                {room.roomNumber || `#${idx + 1}`}
              </span>
              <span className="text-[10px] text-gray-300 truncate">{room.name}</span>
              {room.area && expanded && (
                <span className="text-[9px] text-gray-400 mt-1">{room.area.toFixed(0)} SF</span>
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
  );
}
