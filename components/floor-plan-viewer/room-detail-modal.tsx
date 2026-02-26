'use client';

import { useState } from 'react';
import {
  Building2,
  Home,
  Eye,
  Save,
  Edit3,
  Ruler,
  Layers,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface RoomDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRoom: Room | null;
  savingRoom: boolean;
  onSave: (editedRoom: Partial<Room>) => void;
}

export function RoomDetailModal({
  open,
  onOpenChange,
  selectedRoom,
  savingRoom,
  onSave,
}: RoomDetailModalProps) {
  const [editingRoom, setEditingRoom] = useState(false);
  const [editedRoom, setEditedRoom] = useState<Partial<Room>>({});

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setEditingRoom(false);
      setEditedRoom({});
    } else if (selectedRoom) {
      setEditedRoom(selectedRoom);
    }
    onOpenChange(nextOpen);
  };

  // Sync editedRoom when selectedRoom changes while modal is open
  const handleEditStart = () => {
    if (selectedRoom) setEditedRoom({ ...selectedRoom });
    setEditingRoom(true);
  };

  const handleSave = () => {
    onSave(editedRoom);
    setEditingRoom(false);
  };

  if (!selectedRoom) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl bg-dark-surface border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-orange-500" />
              <span>
                {selectedRoom.roomNumber
                  ? `Room ${selectedRoom.roomNumber}`
                  : selectedRoom.name}
              </span>
              {getStatusIcon(selectedRoom.status)}
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
                    onClick={handleSave}
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
                  onClick={handleEditStart}
                  className="text-orange-400 border-orange-500/50 hover:bg-orange-500/20"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Room Name</label>
              {editingRoom ? (
                <Input
                  value={editedRoom.name || ''}
                  onChange={e => setEditedRoom({ ...editedRoom, name: e.target.value })}
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
                  onChange={e => setEditedRoom({ ...editedRoom, roomNumber: e.target.value })}
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
                  onValueChange={value => setEditedRoom({ ...editedRoom, type: value })}
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
                  onValueChange={value => setEditedRoom({ ...editedRoom, status: value })}
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
                  onChange={e =>
                    setEditedRoom({
                      ...editedRoom,
                      area: parseFloat(e.target.value) || undefined,
                    })
                  }
                  className="bg-dark-card border-gray-600 text-white"
                  placeholder="sq ft"
                />
              ) : (
                <div className="flex items-center gap-1">
                  <Ruler className="h-4 w-4 text-gray-400" />
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
                  onValueChange={value =>
                    setEditedRoom({ ...editedRoom, floorNumber: parseInt(value) })
                  }
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
                    {selectedRoom.floorNumber === 1
                      ? '1st Floor'
                      : selectedRoom.floorNumber === 2
                        ? '2nd Floor'
                        : selectedRoom.floorNumber === 3
                          ? '3rd Floor'
                          : selectedRoom.floorNumber === 0
                            ? 'Ground Floor'
                            : 'Unassigned'}
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
                    <div
                      key={finish.id || idx}
                      className="flex items-center justify-between text-sm border-b border-gray-700 pb-2 last:border-0"
                    >
                      <span className="text-white">{finish.category}</span>
                      <span className="text-gray-400">
                        {finish.material || finish.finishType || '-'}
                      </span>
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
                    <div
                      key={equip.id || idx}
                      className="flex items-center justify-between text-sm border-b border-gray-700 pb-2 last:border-0"
                    >
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
                onChange={e => setEditedRoom({ ...editedRoom, notes: e.target.value })}
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
      </DialogContent>
    </Dialog>
  );
}
