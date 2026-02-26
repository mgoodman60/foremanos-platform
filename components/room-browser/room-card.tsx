'use client';

import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Circle,
  AlertCircle,
  Home,
  Ruler,
  MapPin,
  Layers,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Room } from './types';
import { FinishScheduleTable } from './finish-schedule-table';
import { MEPEquipmentTable } from './mep-equipment-table';

interface RoomCardProps {
  room: Room;
  isExpanded: boolean;
  isSelected: boolean;
  isUpdatingFloor: boolean;
  exportingRoomId: string | null;
  exportingDocxRoomId: string | null;
  onToggleExpand: (roomId: string) => void;
  onToggleSelect: (roomId: string) => void;
  onUpdateFloor: (roomId: string, newFloor: number | null) => void;
  onExportPDF: (room: Room) => void;
  onExportDOCX: (room: Room) => void;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'in_progress':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'not_started':
      return <Circle className="h-4 w-4 text-gray-400" />;
    default:
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-500">Completed</Badge>;
    case 'in_progress':
      return <Badge variant="default" className="bg-blue-500">In Progress</Badge>;
    case 'not_started':
      return <Badge variant="secondary">Not Started</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getRoomTypeLabel(type: string) {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function RoomCard({
  room,
  isExpanded,
  isSelected,
  isUpdatingFloor,
  exportingRoomId,
  exportingDocxRoomId,
  onToggleExpand,
  onToggleSelect,
  onUpdateFloor,
  onExportPDF,
  onExportDOCX,
}: RoomCardProps) {
  return (
    <div
      id={`room-${room.id}`}
      className="rounded-lg border border-dark-hover bg-dark-surface overflow-hidden transition-all duration-300"
    >
      {/* Room Header - Always Visible */}
      <div className="flex items-start gap-3 p-3">
        {/* Selection Checkbox */}
        <div className="mt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(room.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-dark-hover bg-dark-card text-orange-500 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
            title="Select room"
          />
        </div>

        {/* Status Icon */}
        <div className="mt-1">{getStatusIcon(room.status)}</div>

        {/* Room Info */}
        <div className="flex-1 min-w-0">
          {/* Room Name & Number */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-slate-50 truncate">{room.name}</h3>
            {room.roomNumber && (
              <Badge variant="outline" className="text-xs">
                {room.roomNumber}
              </Badge>
            )}
          </div>

          {/* Room Type & Floor Selector */}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-1.5">
              <Home className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-400">{getRoomTypeLabel(room.type)}</span>
            </div>

            {/* Floor Selector */}
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Layers className="h-3 w-3 text-orange-500" />
              <Select
                value={room.floorNumber?.toString() || '-1'}
                onValueChange={(value) => {
                  const newFloor = value === '-1' ? null : parseInt(value);
                  onUpdateFloor(room.id, newFloor);
                }}
                disabled={isUpdatingFloor}
              >
                <SelectTrigger className="h-6 w-[120px] text-xs bg-dark-hover hover:bg-dark-hover/80 border-orange-500/50 text-slate-50 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">Unassigned</SelectItem>
                  <SelectItem value="0">Ground Floor</SelectItem>
                  <SelectItem value="1">1st Floor</SelectItem>
                  <SelectItem value="2">2nd Floor</SelectItem>
                  <SelectItem value="3">3rd Floor</SelectItem>
                  <SelectItem value="4">4th Floor</SelectItem>
                  <SelectItem value="5">5th Floor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            {room.area && (
              <div className="flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                <span>{room.area.toFixed(0)} sq ft</span>
              </div>
            )}
            {room.gridLocation && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{room.gridLocation}</span>
              </div>
            )}
            {room.sheetId && (
              <div className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                <span>Sheet {room.sheetId}</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {room.percentComplete > 0 && (
            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-dark-hover">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400"
                  style={{ width: `${room.percentComplete}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">{room.percentComplete}% Complete</p>
            </div>
          )}
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => onToggleExpand(room.id)}
          className="p-2 hover:bg-dark-card rounded transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
          title={isExpanded ? 'Hide details' : 'Show details'}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Collapsible Room Details */}
      {isExpanded && (
        <div className="border-t border-dark-hover bg-dark-card p-4 space-y-4">
          {/* Export Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onExportDOCX(room)}
              disabled={exportingDocxRoomId === room.id || exportingRoomId === room.id}
              className="border-dark-hover text-gray-300 hover:bg-dark-hover hover:text-white"
            >
              {exportingDocxRoomId === room.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export DOCX (Editable)
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => onExportPDF(room)}
              disabled={exportingRoomId === room.id || exportingDocxRoomId === room.id}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {exportingRoomId === room.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Export PDF
                </>
              )}
            </Button>
          </div>

          {/* Basic Info Section */}
          <div>
            <h4 className="text-sm font-semibold text-orange-400 mb-2">Basic Information</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {room.roomNumber && (
                <div>
                  <span className="text-gray-400">Room Number:</span>
                  <p className="text-slate-50 mt-0.5">{room.roomNumber}</p>
                </div>
              )}
              <div>
                <span className="text-gray-400">Type:</span>
                <p className="text-slate-50 mt-0.5">{getRoomTypeLabel(room.type)}</p>
              </div>
              {room.doorType && (
                <div>
                  <span className="text-gray-400">Door Type:</span>
                  <p className="text-slate-50 mt-0.5">{room.doorType}</p>
                </div>
              )}
              {room.area && (
                <div>
                  <span className="text-gray-400">Area:</span>
                  <p className="text-slate-50 mt-0.5">{room.area.toFixed(2)} sq ft</p>
                </div>
              )}
              <div>
                <span className="text-gray-400">Status:</span>
                <div className="mt-0.5">{getStatusBadge(room.status)}</div>
              </div>
              {room.gridLocation && (
                <div>
                  <span className="text-gray-400">Grid Location:</span>
                  <p className="text-slate-50 mt-0.5">{room.gridLocation}</p>
                </div>
              )}
              {room.sheetId && (
                <div>
                  <span className="text-gray-400">Sheet:</span>
                  <p className="text-slate-50 mt-0.5">{room.sheetId}</p>
                </div>
              )}
              {room.tradeType && (
                <div>
                  <span className="text-gray-400">Trade Type:</span>
                  <p className="text-slate-50 mt-0.5">{room.tradeType}</p>
                </div>
              )}
              {room.assignedTo && (
                <div>
                  <span className="text-gray-400">Assigned To:</span>
                  <p className="text-slate-50 mt-0.5">{room.assignedTo}</p>
                </div>
              )}
            </div>
            {room.notes && (
              <div className="mt-3">
                <span className="text-gray-400">Notes:</span>
                <p className="text-slate-50 mt-1 text-xs">{room.notes}</p>
              </div>
            )}
          </div>

          {/* Finish Schedule Section */}
          {room.FinishScheduleItem && room.FinishScheduleItem.length > 0 && (
            <FinishScheduleTable items={room.FinishScheduleItem} />
          )}

          {/* MEP Equipment Section */}
          {room.mepEquipment && room.mepEquipment.length > 0 && (
            <MEPEquipmentTable items={room.mepEquipment} />
          )}

          {/* No Finish Data Message */}
          {(!room.FinishScheduleItem || room.FinishScheduleItem.length === 0) &&
            (!room.mepEquipment || room.mepEquipment.length === 0) && (
              <div className="text-center py-4">
                <Circle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-400">
                  No finish schedule or MEP data available for this room
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
