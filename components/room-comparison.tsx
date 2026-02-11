/**
 * Room Comparison Component
 * Side-by-side comparison of finish schedules between rooms
 */

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  X,
  Check,
  Minus,
  ChevronDown,
  Loader2,
} from 'lucide-react';

interface Room {
  id: string;
  name: string;
  roomNumber: string;
  type: string;
  finishItems: any[];
}

interface RoomComparisonProps {
  projectSlug: string;
  onClose?: () => void;
}

export default function RoomComparison({ projectSlug, onClose }: RoomComparisonProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [leftRoomId, setLeftRoomId] = useState<string>('');
  const [rightRoomId, setRightRoomId] = useState<string>('');
  const [leftRoom, setLeftRoom] = useState<Room | null>(null);
  const [rightRoom, setRightRoom] = useState<Room | null>(null);

  useEffect(() => {
    fetchRooms();
  }, [projectSlug]);

  const fetchRooms = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/rooms`);
      const data = await res.json();
      setRooms(data.rooms || []);
      
      // Auto-select first two rooms
      if (data.rooms?.length >= 2) {
        setLeftRoomId(data.rooms[0].id);
        setRightRoomId(data.rooms[1].id);
      }
    } catch (error) {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leftRoomId) {
      const room = rooms.find((r) => r.id === leftRoomId);
      setLeftRoom(room || null);
    } else {
      setLeftRoom(null);
    }
  }, [leftRoomId, rooms]);

  useEffect(() => {
    if (rightRoomId) {
      const room = rooms.find((r) => r.id === rightRoomId);
      setRightRoom(room || null);
    } else {
      setRightRoom(null);
    }
  }, [rightRoomId, rooms]);

  // Get all unique finish categories from both rooms
  const getCategories = (): string[] => {
    const cats = new Set<string>();
    leftRoom?.finishItems?.forEach((item) => cats.add(item.category || 'Other'));
    rightRoom?.finishItems?.forEach((item) => cats.add(item.category || 'Other'));
    return Array.from(cats).sort();
  };

  // Get items by category for a room
  const getItemsByCategory = (room: Room | null, category: string): any[] => {
    if (!room) return [];
    return room.finishItems?.filter((item) => (item.category || 'Other') === category) || [];
  };

  // Compare two items
  const compareItems = (
    leftItems: any[],
    rightItems: any[]
  ): { itemName: string; left: string; right: string; match: boolean }[] => {
    const allItemNames = new Set<string>();
    leftItems.forEach((i) => allItemNames.add(i.itemName || i.type || 'Unknown'));
    rightItems.forEach((i) => allItemNames.add(i.itemName || i.type || 'Unknown'));

    return Array.from(allItemNames).map((itemName) => {
      const leftItem = leftItems.find((i) => (i.itemName || i.type) === itemName);
      const rightItem = rightItems.find((i) => (i.itemName || i.type) === itemName);
      
      const leftValue = leftItem?.description || leftItem?.productName || '-';
      const rightValue = rightItem?.description || rightItem?.productName || '-';

      return {
        itemName,
        left: leftValue,
        right: rightValue,
        match: leftValue === rightValue && leftValue !== '-',
      };
    });
  };

  const swapRooms = () => {
    const temp = leftRoomId;
    setLeftRoomId(rightRoomId);
    setRightRoomId(temp);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-blue-600" />
          <h3 id="room-comparison-title" className="font-semibold text-gray-900">Room Comparison</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Room Selectors */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Room A</label>
            <select
              value={leftRoomId}
              onChange={(e) => setLeftRoomId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select room...</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id} disabled={room.id === rightRoomId}>
                  {room.roomNumber} - {room.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={swapRooms}
            className="mt-5 p-2 border rounded-lg hover:bg-white"
            title="Swap rooms"
          >
            <ArrowLeftRight className="h-4 w-4 text-gray-400" />
          </button>

          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Room B</label>
            <select
              value={rightRoomId}
              onChange={(e) => setRightRoomId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select room...</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id} disabled={room.id === leftRoomId}>
                  {room.roomNumber} - {room.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Comparison Content */}
      {leftRoom && rightRoom ? (
        <div className="max-h-[60vh] overflow-y-auto">
          {getCategories().map((category) => {
            const leftItems = getItemsByCategory(leftRoom, category);
            const rightItems = getItemsByCategory(rightRoom, category);
            const comparisons = compareItems(leftItems, rightItems);

            return (
              <div key={category} className="border-b last:border-b-0">
                <div className="px-4 py-2 bg-gray-100 font-medium text-sm text-gray-700">
                  {category}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-gray-400">
                      <th className="py-2 px-4 text-left w-1/4">Item</th>
                      <th className="py-2 px-4 text-left w-1/3 bg-blue-50">
                        {leftRoom.roomNumber}
                      </th>
                      <th className="py-2 px-4 text-left w-1/3 bg-green-50">
                        {rightRoom.roomNumber}
                      </th>
                      <th className="py-2 px-2 w-12 text-center">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {comparisons.map((comp, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2 px-4 font-medium text-gray-700">
                          {comp.itemName.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 px-4 bg-blue-50/50 text-gray-600">
                          {comp.left.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 px-4 bg-green-50/50 text-gray-600">
                          {comp.right.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {comp.match ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : comp.left === '-' || comp.right === '-' ? (
                            <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-orange-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-400">
          Select two rooms to compare their finish schedules.
        </div>
      )}

      {/* Summary */}
      {leftRoom && rightRoom && (
        <div className="px-4 py-3 border-t bg-gray-50 text-sm text-gray-600">
          Comparing {leftRoom.roomNumber} ({leftRoom.type}) with {rightRoom.roomNumber} ({rightRoom.type})
        </div>
      )}
    </div>
  );
}
