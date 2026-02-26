'use client';

import { Layers, Grid3X3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getTypeColor, getLayerColor } from './status-helpers';
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

interface DwgData {
  fileName: string;
  layers: { name: string; objectCount: number }[];
  blocks: { name: string; count: number }[];
  textAnnotations: string[];
}

interface DwgDataPanelProps {
  dwgData: DwgData;
  floorRooms: Room[];
  gridCols: number;
  expanded: boolean;
  hoveredRoom: string | null;
  onRoomHover: (id: string | null) => void;
  onRoomClick: (room: Room) => void;
}

export function DwgDataPanel({
  dwgData,
  floorRooms,
  gridCols,
  expanded,
  hoveredRoom,
  onRoomHover,
  onRoomClick,
}: DwgDataPanelProps) {
  const maxLayers = expanded ? 20 : 6;
  const maxBlocks = expanded ? 12 : 4;
  const maxRooms = expanded ? 15 : 6;

  return (
    <div className="p-3 h-full overflow-auto">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-medium text-white">{dwgData.fileName}</span>
        <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-400">
          CAD Data
        </Badge>
      </div>

      {/* Layers */}
      <div className="grid gap-3 mb-4">
        <div className="text-xs text-gray-400 uppercase tracking-wider">
          Layers ({dwgData.layers.length})
        </div>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
        >
          {dwgData.layers.slice(0, maxLayers).map((layer, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-2 py-1.5 bg-gray-800/50 rounded border border-gray-700 hover:border-orange-500/50 transition-colors"
            >
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getLayerColor(layer.name, idx) }}
              />
              <span className="text-xs text-gray-300 truncate flex-1">{layer.name}</span>
              <span className="text-[10px] text-gray-400">{layer.objectCount}</span>
            </div>
          ))}
        </div>
        {dwgData.layers.length > maxLayers && (
          <span className="text-xs text-gray-400">
            +{dwgData.layers.length - maxLayers} more layers
          </span>
        )}
      </div>

      {/* Blocks */}
      {dwgData.blocks.length > 0 && (
        <div className="grid gap-3 mb-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider">
            Blocks ({dwgData.blocks.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {dwgData.blocks.slice(0, maxBlocks).map((block, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2 py-1 bg-blue-900/30 rounded border border-blue-700/50"
              >
                <Grid3X3 className="h-3 w-3 text-blue-400" />
                <span className="text-xs text-blue-300">{block.name}</span>
                <span className="text-[10px] text-blue-500">x{block.count}</span>
              </div>
            ))}
            {dwgData.blocks.length > maxBlocks && (
              <span className="text-xs text-gray-400 self-center">
                +{dwgData.blocks.length - maxBlocks} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Room Grid (if rooms exist alongside DWG) */}
      {floorRooms.length > 0 && (
        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            Extracted Rooms ({floorRooms.length})
          </div>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.min(gridCols, 5)}, minmax(90px, 1fr))`,
            }}
          >
            {floorRooms.slice(0, maxRooms).map(room => (
              <div
                key={room.id}
                className={`
                  relative rounded-lg border p-1.5 cursor-pointer transition-all text-center
                  ${getTypeColor(room.type)}
                  ${hoveredRoom === room.id ? 'ring-2 ring-orange-500' : ''}
                `}
                onMouseEnter={() => onRoomHover(room.id)}
                onMouseLeave={() => onRoomHover(null)}
                onClick={() => onRoomClick(room)}
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

      {/* Text Annotations (if present) */}
      {dwgData.textAnnotations.length > 0 && (
        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            Text Annotations ({dwgData.textAnnotations.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dwgData.textAnnotations.slice(0, expanded ? 20 : 8).map((text, idx) => (
              <span
                key={idx}
                className="text-[10px] text-gray-300 bg-gray-800/50 border border-gray-700 rounded px-1.5 py-0.5"
              >
                {text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
