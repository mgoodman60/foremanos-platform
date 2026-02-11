'use client';

import React from 'react';
import { Droplets, Zap, Wind, Flame, type LucideIcon } from 'lucide-react';
import { chartColors, neutralColors } from '@/lib/design-tokens';

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

interface EquipmentMarkerOverlayProps {
  rooms: Room[];
  visibleDisciplines: string[];
  zoom: number;
}

interface MarkerConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  label: string;
}

const MARKER_CONFIGS: Record<string, MarkerConfig> = {
  plumbing: {
    icon: Droplets,
    color: chartColors.trades.plumbing,
    bgColor: 'rgba(6, 182, 212, 0.2)',
    label: 'Plumbing',
  },
  electrical: {
    icon: Zap,
    color: chartColors.trades.electrical,
    bgColor: 'rgba(245, 158, 11, 0.2)',
    label: 'Electrical',
  },
  hvac: {
    icon: Wind,
    color: chartColors.trades.hvac,
    bgColor: 'rgba(59, 130, 246, 0.2)',
    label: 'HVAC',
  },
  fire_alarm: {
    icon: Flame,
    color: chartColors.trades.fireProtection,
    bgColor: 'rgba(239, 68, 68, 0.2)',
    label: 'Fire Protection',
  },
};

interface EquipmentItem {
  id: string;
  tag: string;
  type: string;
  manufacturer?: string;
  trade: string;
  roomId: string;
}

export function EquipmentMarkerOverlay({
  rooms,
  visibleDisciplines,
  zoom,
}: EquipmentMarkerOverlayProps) {
  // Normalize discipline names to match the marker configs
  const normalizedDisciplines = visibleDisciplines.map((d) => {
    const lower = d.toLowerCase();
    if (lower === 'fire protection') return 'fire_alarm';
    return lower;
  });

  // Group equipment by room and trade
  const roomEquipment = new Map<string, Map<string, EquipmentItem[]>>();

  rooms.forEach((room) => {
    if (!room.mepEquipment || room.mepEquipment.length === 0) return;
    if (!room.hotspotX || !room.hotspotY || !room.hotspotWidth || !room.hotspotHeight) return;

    const equipmentByTrade = new Map<string, EquipmentItem[]>();

    room.mepEquipment.forEach((equipment: any) => {
      const trade = equipment.trade?.toLowerCase() || 'unknown';

      // Only include if discipline is visible
      if (!normalizedDisciplines.includes(trade)) return;

      if (!equipmentByTrade.has(trade)) {
        equipmentByTrade.set(trade, []);
      }

      equipmentByTrade.get(trade)!.push({
        id: equipment.id || `${room.id}-${equipment.tag}`,
        tag: equipment.tag || 'Unknown',
        type: equipment.equipmentType || equipment.type || 'Unknown',
        manufacturer: equipment.manufacturer,
        trade,
        roomId: room.id,
      });
    });

    if (equipmentByTrade.size > 0) {
      roomEquipment.set(room.id, equipmentByTrade);
    }
  });

  // Calculate marker size based on zoom (inverse scaling for readability)
  const markerSize = Math.max(12, Math.min(24, 16 / zoom));

  return (
    <div className="absolute inset-0 pointer-events-none">
      {rooms.map((room) => {
        const equipmentMap = roomEquipment.get(room.id);
        if (!equipmentMap) return null;

        const { hotspotX = 0, hotspotY = 0, hotspotWidth = 0, hotspotHeight = 0 } = room;

        return (
          <div key={room.id}>
            {Array.from(equipmentMap.entries()).map(([trade, items]) => {
              const config = MARKER_CONFIGS[trade];
              if (!config) return null;

              const Icon = config.icon;

              // Distribute markers evenly within the room hotspot
              return items.map((item, index) => {
                // Calculate position within room bounds
                const cols = Math.ceil(Math.sqrt(items.length));
                const row = Math.floor(index / cols);
                const col = index % cols;
                const rowCount = Math.ceil(items.length / cols);

                // Position with some padding from edges
                const padding = markerSize;
                const availableWidth = hotspotWidth - 2 * padding;
                const availableHeight = hotspotHeight - 2 * padding;

                const x =
                  hotspotX +
                  padding +
                  (availableWidth / (cols + 1)) * (col + 1);
                const y =
                  hotspotY +
                  padding +
                  (availableHeight / (rowCount + 1)) * (row + 1);

                return (
                  <div
                    key={item.id}
                    className="absolute pointer-events-auto group"
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* Marker circle */}
                    <div
                      className="rounded-full flex items-center justify-center cursor-help transition-transform hover:scale-125"
                      style={{
                        width: `${markerSize}px`,
                        height: `${markerSize}px`,
                        backgroundColor: config.bgColor,
                        border: `2px solid ${config.color}`,
                      }}
                    >
                      <Icon
                        className="shrink-0"
                        size={markerSize * 0.5}
                        color={config.color}
                        aria-hidden="true"
                      />
                    </div>

                    {/* Tooltip on hover */}
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                      style={{ minWidth: '120px' }}
                    >
                      <div className="font-semibold">{item.tag}</div>
                      <div className="text-gray-300">{item.type}</div>
                      {item.manufacturer && (
                        <div className="text-gray-400 text-[10px]">
                          {item.manufacturer}
                        </div>
                      )}
                      {/* Tooltip arrow */}
                      <div
                        className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                        style={{
                          borderLeft: '4px solid transparent',
                          borderRight: '4px solid transparent',
                          borderTop: `4px solid ${neutralColors.gray[900]}`,
                        }}
                      />
                    </div>
                  </div>
                );
              });
            })}
          </div>
        );
      })}
    </div>
  );
}
