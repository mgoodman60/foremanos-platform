'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  ArrowLeft,
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  Circle,
  ChevronRight,
  Zap,
  Droplets,
  Wind,
  Loader2,
  X,
  Grid3X3,
  List,
  FileText,
  Flame,
  PaintBucket,
  Layers,
  ArrowUpFromDot,
  Map,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import Link from 'next/link';
import { FloorPlanRoomView } from '@/components/rooms/FloorPlanRoomView';

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
  _count?: {
    FinishScheduleItem: number;
  };
  mepEquipment?: MEPItem[];
  FinishScheduleItem?: FinishItem[];
  DoorScheduleItem?: any[];
}

interface RoomFilters {
  search: string;
  type: string;
  status: string;
  floor: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  documentCount: number;
  ownerId: string;
}

interface RoomsPageContentProps {
  project: Project;
}

export default function RoomsPageContent({ project }: RoomsPageContentProps) {
  const slug = project.slug;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'floorplan'>('grid');
  const [expandedMEP, setExpandedMEP] = useState<string | null>(null);
  const [filters, setFilters] = useState<RoomFilters>({
    search: '',
    type: 'all',
    status: 'all',
    floor: 'all',
  });
  const [projectName, setProjectName] = useState(project.name);
  const [exporting, setExporting] = useState<string | null>(null);

  // Fetch rooms
  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${slug}/rooms`);
      if (!response.ok) throw new Error('Failed to fetch rooms');

      const data = await response.json();
      setRooms(data.rooms || []);
      setProjectName(data.projectName || project.name);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, [slug, project.name]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Sync selectedRoom when rooms array updates
  useEffect(() => {
    if (selectedRoom) {
      const updated = rooms.find(r => r.id === selectedRoom.id);
      if (updated) setSelectedRoom(updated);
    }
  }, [rooms]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filters
  useEffect(() => {
    let result = [...rooms];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (room) =>
          room.roomNumber?.toLowerCase().includes(searchLower) ||
          room.name?.toLowerCase().includes(searchLower) ||
          room.type?.toLowerCase().includes(searchLower)
      );
    }

    // Type filter
    if (filters.type !== 'all') {
      result = result.filter((room) => room.type?.toLowerCase() === filters.type);
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter((room) => room.status === filters.status);
    }

    // Floor filter
    if (filters.floor !== 'all') {
      result = result.filter((room) => String(room.floorNumber) === filters.floor);
    }

    // Sort by room number
    result.sort((a, b) => {
      const numA = parseInt(a.roomNumber?.replace(/\D/g, '') || '0');
      const numB = parseInt(b.roomNumber?.replace(/\D/g, '') || '0');
      return numA - numB;
    });

    setFilteredRooms(result);
  }, [rooms, filters]);

  // Get unique values for filters
  const uniqueTypes = [...new Set(rooms.map((r) => r.type?.toLowerCase()).filter(Boolean))];
  const uniqueFloors = [...new Set(rooms.map((r) => String(r.floorNumber)).filter(Boolean))].sort();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTypeColor = (type: string) => {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('office')) return 'border-blue-500 bg-blue-500/20';
    if (lowerType.includes('conference') || lowerType.includes('meeting')) return 'border-purple-500 bg-purple-500/20';
    if (lowerType.includes('restroom') || lowerType.includes('toilet')) return 'border-cyan-500 bg-cyan-500/20';
    if (lowerType.includes('corridor') || lowerType.includes('hall')) return 'border-gray-500 bg-gray-500/20';
    if (lowerType.includes('lobby') || lowerType.includes('reception')) return 'border-pink-500 bg-pink-500/20';
    if (lowerType.includes('storage') || lowerType.includes('closet')) return 'border-orange-500 bg-orange-500/20';
    if (lowerType.includes('mechanical') || lowerType.includes('mech')) return 'border-red-500 bg-red-500/20';
    if (lowerType.includes('electrical') || lowerType.includes('elec')) return 'border-yellow-500 bg-yellow-500/20';
    if (lowerType.includes('kitchen') || lowerType.includes('catering')) return 'border-amber-500 bg-amber-500/20';
    if (lowerType.includes('vestibule') || lowerType.includes('vest')) return 'border-indigo-500 bg-indigo-500/20';
    if (lowerType.includes('multipurpose') || lowerType.includes('multi')) return 'border-green-500 bg-green-500/20';
    return 'border-gray-500 bg-gray-500/20';
  };

  const handleExportPDF = async (room: Room) => {
    try {
      setExporting(room.id);
      const response = await fetch(`/api/projects/${slug}/rooms/${room.id}/export-pdf`);

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${room.roomNumber}-room-sheet-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Room sheet exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export room sheet');
    } finally {
      setExporting(null);
    }
  };

  // Trade badge color mapping
  const tradeColors: Record<string, string> = {
    electrical: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    hvac: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    plumbing: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    fire_alarm: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const tradeIcons: Record<string, React.ReactNode> = {
    electrical: <Zap className="h-3 w-3" />,
    hvac: <Wind className="h-3 w-3" />,
    plumbing: <Droplets className="h-3 w-3" />,
    fire_alarm: <Flame className="h-3 w-3" />,
  };

  // Heatmap colors by status
  const heatmapColors: Record<string, string> = {
    not_started: 'bg-gray-500/10 border-gray-600',
    in_progress: 'bg-blue-500/10 border-blue-500/30',
    completed: 'bg-green-500/10 border-green-500/30',
  };

  function _getHeatmapColor(status: string): string {
    return heatmapColors[status] || 'bg-amber-500/10 border-amber-500/30';
  }

  function getTradeCounts(mepEquipment: MEPItem[] | undefined): Record<string, number> {
    return (mepEquipment || []).reduce((acc, item) => {
      const trade = item.trade || 'electrical';
      acc[trade] = (acc[trade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  function groupFinishesByCategory(items: FinishItem[]) {
    const groups = { floor: [] as FinishItem[], wall: [] as FinishItem[], ceiling: [] as FinishItem[], other: [] as FinishItem[] };
    items.forEach(item => {
      const cat = (item.category || '').toLowerCase();
      if (cat.includes('floor') || cat.includes('base')) groups.floor.push(item);
      else if (cat.includes('wall') || cat.includes('paint')) groups.wall.push(item);
      else if (cat.includes('ceiling')) groups.ceiling.push(item);
      else groups.other.push(item);
    });
    return groups;
  }

  function estimateWallArea(roomArea: number | null): number | null {
    if (!roomArea || roomArea <= 0) return null;
    const perimeter = 4 * Math.sqrt(roomArea);
    const wallHeight = 9; // standard 9ft ceiling
    return Math.round(perimeter * wallHeight);
  }

  function paintGallons(wallAreaSF: number): { oneCoat: number; twoCoat: number } {
    return {
      oneCoat: Math.round((wallAreaSF / 350) * 10) / 10,
      twoCoat: Math.round((wallAreaSF / 175) * 10) / 10,
    };
  }

  // Stats
  const stats = {
    total: rooms.length,
    completed: rooms.filter((r) => r.status === 'completed').length,
    inProgress: rooms.filter((r) => r.status === 'in_progress').length,
    pending: rooms.filter((r) => r.status === 'pending').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-base flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-base">
      {/* Header */}
      <div className="bg-dark-subtle border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/project/${slug}`}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-orange-500" />
                  Room Browser
                </h1>
                <p className="text-sm text-gray-400">{projectName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRooms}
                className="border-gray-700 text-gray-300"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-dark-subtle rounded-lg p-4 border border-gray-800">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-gray-400">Total Rooms</div>
          </div>
          <div className="bg-dark-subtle rounded-lg p-4 border border-gray-800">
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            <div className="text-sm text-gray-400">Completed</div>
          </div>
          <div className="bg-dark-subtle rounded-lg p-4 border border-gray-800">
            <div className="text-2xl font-bold text-blue-400">{stats.inProgress}</div>
            <div className="text-sm text-gray-400">In Progress</div>
          </div>
          <div className="bg-dark-subtle rounded-lg p-4 border border-gray-800">
            <div className="text-2xl font-bold text-gray-400">{stats.pending}</div>
            <div className="text-sm text-gray-400">Pending</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-dark-subtle rounded-lg p-4 border border-gray-800 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search rooms..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10 bg-dark-base border-gray-700 text-white"
                />
              </div>
            </div>

            <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
              <SelectTrigger className="w-[150px] bg-dark-base border-gray-700 text-white">
                <SelectValue placeholder="Room Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="w-[150px] bg-dark-base border-gray-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.floor} onValueChange={(v) => setFilters({ ...filters, floor: v })}>
              <SelectTrigger className="w-[150px] bg-dark-base border-gray-700 text-white">
                <SelectValue placeholder="Floor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                {uniqueFloors.map((floor) => (
                  <SelectItem key={floor} value={floor}>
                    {floor === '1' ? '1st Floor' : floor === '2' ? '2nd Floor' : `Floor ${floor}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center border border-gray-700 rounded-md">
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${viewMode === 'grid' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400'}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${viewMode === 'list' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400'}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${viewMode === 'floorplan' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400'}`}
                onClick={() => setViewMode('floorplan')}
                title="Floor Plan view"
              >
                <Map className="h-4 w-4" />
              </Button>
            </div>

            {(filters.search || filters.type !== 'all' || filters.status !== 'all' || filters.floor !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ search: '', type: 'all', status: 'all', floor: 'all' })}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-400">
            Showing {filteredRooms.length} of {rooms.length} rooms
          </span>
        </div>

        {/* Room Grid/List/FloorPlan */}
        {viewMode === 'floorplan' ? (
          <FloorPlanRoomView
            projectSlug={slug}
            rooms={filteredRooms}
            allRooms={rooms}
            selectedRoom={selectedRoom}
            onRoomSelect={(room) => setSelectedRoom(room)}
            onRoomsChange={fetchRooms}
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                className={`bg-dark-subtle rounded-lg border-2 overflow-hidden hover:border-orange-500/50 transition-all cursor-pointer ${getTypeColor(room.type)}`}
                onClick={() => setSelectedRoom(room)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-lg font-bold text-white">{room.roomNumber}</div>
                      <div className="text-sm text-gray-400">{room.name || room.type}</div>
                    </div>
                    {getStatusIcon(room.status)}
                  </div>

                  {room.area != null && room.area > 0 && (
                    <div className="text-sm text-gray-400 mb-2">{room.area} sq ft</div>
                  )}

                  <div className="flex flex-wrap gap-1 mt-2">
                    {room.FinishScheduleItem && room.FinishScheduleItem.length > 0 && (
                      <Badge variant="outline" className="text-[10px] border-gray-600">
                        {room.FinishScheduleItem.length} finishes
                      </Badge>
                    )}
                    {(() => {
                      const trades = getTradeCounts(room.mepEquipment);
                      return Object.entries(trades).map(([trade, count]) => (
                        <Badge key={trade} variant="outline" className={`text-[10px] ${tradeColors[trade] || 'border-gray-600 text-gray-400'}`}>
                          {tradeIcons[trade]}
                          <span className="ml-1">{count}</span>
                        </Badge>
                      ));
                    })()}
                  </div>
                </div>

                <div className="px-4 py-2 bg-dark-base border-t border-gray-700 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {room.floor || 'Unassigned'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-dark-subtle rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-dark-base">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Room</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Floor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Area</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room) => (
                  <tr
                    key={room.id}
                    className="border-b border-gray-800 hover:bg-dark-hover cursor-pointer"
                    onClick={() => setSelectedRoom(room)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{room.roomNumber}</div>
                      <div className="text-sm text-gray-400">{room.name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{room.type}</td>
                    <td className="px-4 py-3 text-gray-300">{room.floor || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-gray-300">{room.area != null && room.area > 0 ? `${room.area} SF` : 'Not measured'}</td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(room.status)}>
                        {room.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleExportPDF(room); }}
                        disabled={exporting === room.id}
                        className="text-gray-400 hover:text-white"
                      >
                        {exporting === room.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {filteredRooms.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No rooms found matching your filters</p>
          </div>
        )}
      </div>

      {/* Room Detail Sidebar */}
      {selectedRoom && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-dark-subtle border-l border-gray-800 shadow-xl z-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Room {selectedRoom.roomNumber}</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedRoom(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Details</h3>
                <div className="bg-dark-base rounded-lg p-4 space-y-2">
                  <DetailRow label="Name" value={selectedRoom.name || '-'} />
                  <DetailRow label="Type" value={selectedRoom.type} />
                  <DetailRow label="Floor" value={selectedRoom.floor || 'Unassigned'} />
                  <DetailRow label="Area" value={selectedRoom.area != null && selectedRoom.area > 0 ? `${selectedRoom.area} SF` : 'Not measured'} />
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status</span>
                    <Badge className={getStatusColor(selectedRoom.status)}>
                      {selectedRoom.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Finish Schedule - Grouped */}
              {selectedRoom.FinishScheduleItem && selectedRoom.FinishScheduleItem.length > 0 && (() => {
                const groups = groupFinishesByCategory(selectedRoom.FinishScheduleItem);
                const wallArea = estimateWallArea(selectedRoom.area);
                const gallons = wallArea ? paintGallons(wallArea) : null;

                return (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">
                      Finish Schedule ({selectedRoom.FinishScheduleItem.length})
                    </h3>
                    <div className="space-y-3">
                      {/* Floor Finishes */}
                      {groups.floor.length > 0 && (
                        <div className="bg-dark-base rounded-lg overflow-hidden">
                          <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-xs font-medium text-amber-400 uppercase">Floor</span>
                          </div>
                          <div className="divide-y divide-gray-800">
                            {groups.floor.map((item, idx) => (
                              <div key={idx} className="p-3">
                                <div className="font-medium text-white text-sm">{item.finishType || item.material}</div>
                                {item.material && item.finishType && <div className="text-xs text-gray-400">{item.material}</div>}
                                {item.manufacturer && <div className="text-xs text-gray-500">{item.manufacturer}</div>}
                                {item.color && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="w-4 h-4 rounded-full border border-gray-600" style={{ backgroundColor: item.color }} />
                                    <span className="text-xs text-gray-400">{item.color}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                            {selectedRoom.area != null && selectedRoom.area > 0 && (
                              <div className="px-3 py-2 text-xs text-gray-500">
                                {selectedRoom.area} sq ft of flooring
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Wall Finishes */}
                      {groups.wall.length > 0 && (
                        <div className="bg-dark-base rounded-lg overflow-hidden">
                          <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
                            <PaintBucket className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-xs font-medium text-blue-400 uppercase">Wall</span>
                          </div>
                          <div className="divide-y divide-gray-800">
                            {groups.wall.map((item, idx) => (
                              <div key={idx} className="p-3">
                                <div className="font-medium text-white text-sm">{item.finishType || item.material}</div>
                                {item.material && item.finishType && <div className="text-xs text-gray-400">{item.material}</div>}
                                {item.manufacturer && <div className="text-xs text-gray-500">{item.manufacturer}</div>}
                                {item.color && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="w-4 h-4 rounded-full border border-gray-600" style={{ backgroundColor: item.color }} />
                                    <span className="text-xs text-gray-400">{item.color}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                            {wallArea && gallons && (
                              <div className="px-3 py-2 text-xs text-gray-500 space-y-0.5">
                                <div>~{wallArea} sq ft wall area</div>
                                <div>~{gallons.oneCoat} gal (1 coat) / ~{gallons.twoCoat} gal (2 coats)</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Ceiling Finishes */}
                      {groups.ceiling.length > 0 && (
                        <div className="bg-dark-base rounded-lg overflow-hidden">
                          <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
                            <ArrowUpFromDot className="h-3.5 w-3.5 text-purple-400" />
                            <span className="text-xs font-medium text-purple-400 uppercase">Ceiling</span>
                          </div>
                          <div className="divide-y divide-gray-800">
                            {groups.ceiling.map((item, idx) => (
                              <div key={idx} className="p-3">
                                <div className="font-medium text-white text-sm">{item.finishType || item.material}</div>
                                {item.material && item.finishType && <div className="text-xs text-gray-400">{item.material}</div>}
                                {item.manufacturer && <div className="text-xs text-gray-500">{item.manufacturer}</div>}
                              </div>
                            ))}
                            {selectedRoom.area != null && selectedRoom.area > 0 && (
                              <div className="px-3 py-2 text-xs text-gray-500">
                                {selectedRoom.area} sq ft ceiling area
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Other Finishes */}
                      {groups.other.length > 0 && (
                        <div className="bg-dark-base rounded-lg overflow-hidden">
                          <div className="px-3 py-2 border-b border-gray-800">
                            <span className="text-xs font-medium text-gray-400 uppercase">Other</span>
                          </div>
                          <div className="divide-y divide-gray-800">
                            {groups.other.map((item, idx) => (
                              <div key={idx} className="p-3">
                                <div className="font-medium text-white text-sm">{item.finishType || item.material}</div>
                                {item.material && item.finishType && <div className="text-xs text-gray-400">{item.material}</div>}
                                {item.manufacturer && <div className="text-xs text-gray-500">{item.manufacturer}</div>}
                                {item.color && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="w-4 h-4 rounded-full border border-gray-600" style={{ backgroundColor: item.color }} />
                                    <span className="text-xs text-gray-400">{item.color}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* MEP Equipment - Expandable */}
              {selectedRoom.mepEquipment && selectedRoom.mepEquipment.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    MEP Equipment ({selectedRoom.mepEquipment.length})
                  </h3>
                  <div className="bg-dark-base rounded-lg divide-y divide-gray-800">
                    {selectedRoom.mepEquipment.map((equip: MEPItem) => (
                      <div key={equip.id || equip.tag}>
                        <button
                          onClick={() => setExpandedMEP(expandedMEP === equip.tag ? null : equip.tag)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-dark-hover transition-colors text-left"
                        >
                          {equip.trade === 'hvac' ? (
                            <Wind className="h-4 w-4 text-blue-400 shrink-0" />
                          ) : equip.trade === 'plumbing' ? (
                            <Droplets className="h-4 w-4 text-cyan-400 shrink-0" />
                          ) : equip.trade === 'fire_alarm' ? (
                            <Flame className="h-4 w-4 text-red-400 shrink-0" />
                          ) : (
                            <Zap className="h-4 w-4 text-yellow-400 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white text-sm">{equip.tag}</div>
                            <div className="text-xs text-gray-400 truncate">{equip.name || equip.type}</div>
                          </div>
                          <ChevronRight className={`h-4 w-4 text-gray-500 transition-transform shrink-0 ${expandedMEP === equip.tag ? 'rotate-90' : ''}`} />
                        </button>
                        {expandedMEP === equip.tag && (
                          <div className="px-3 pb-3 pl-10 space-y-2 text-xs border-b border-gray-800">
                            {equip.manufacturer && <DetailRow label="Manufacturer" value={equip.manufacturer} />}
                            {equip.model && <DetailRow label="Model" value={equip.model} />}
                            {equip.capacity && <DetailRow label="Capacity" value={equip.capacity} />}
                            {equip.estimatedCost != null && <DetailRow label="Est. Cost" value={`$${equip.estimatedCost.toLocaleString()}`} />}
                            {equip.status && <DetailRow label="Status" value={equip.status.replace(/_/g, ' ')} />}
                            {equip.notes && <div className="text-gray-400 italic mt-1">{equip.notes}</div>}
                            {equip.source === 'mep_equipment' && <div className="text-green-500/60 text-[10px]">From MEP equipment records</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-gray-700">
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  onClick={() => handleExportPDF(selectedRoom)}
                  disabled={exporting === selectedRoom.id}
                >
                  {exporting === selectedRoom.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Export Room Sheet PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
