'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Home,
  Ruler,
  Circle,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calculator,
  FileText,
  Download,
  Loader2,
  RefreshCw,
  Bug,
  Paintbrush,
  MoreVertical,
  Zap,
  Thermometer,
  Droplets,
  Flame,
  Map,
  Maximize2,
  Minimize2,
  ArrowLeftRight,
  Camera,
  FileDown,
} from 'lucide-react';
import RoomComparison from '@/components/room-comparison';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WithTooltip } from '@/components/ui/icon-button';
import { Separator } from '@/components/ui/separator';
import { QuickActionMenu, type ActionItem } from '@/components/ui/header-action-menu';
import { toast } from 'sonner';
import { TakeoffSummaryModal } from '@/components/takeoff-summary-modal';
import { FloorPlanViewer } from '@/components/floor-plan-viewer';

interface FinishItem {
  id: string;
  category: string;
  finishType?: string;
  material?: string;
  manufacturer?: string;
  modelNumber?: string;
  color?: string;
  dimensions?: string;
  notes?: string;
  csiCode?: string;
}

interface MEPEquipmentItem {
  id: string;
  tag: string;
  name: string;
  trade: 'electrical' | 'hvac' | 'plumbing' | 'fire_alarm';
  quantity?: number;
  unit?: string;
  unitCost?: number;
  totalCost?: number;
}

interface Room {
  id: string;
  name: string;
  roomNumber?: string;
  type: string;
  floorNumber?: number;
  area?: number;
  gridLocation?: string;
  sheetId?: string;
  status: string;
  percentComplete: number;
  notes?: string;
  tradeType?: string;
  assignedTo?: string;
  floorPlanId?: string;
  hotspotX?: number;
  hotspotY?: number;
  hotspotWidth?: number;
  hotspotHeight?: number;
  FinishScheduleItem?: FinishItem[];
  mepEquipment?: MEPEquipmentItem[];
  doorType?: string | null;
}

interface RoomSummary {
  totalRooms: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  averageProgress: number;
  byType: Record<string, number>;
}

interface RoomBrowserProps {
  projectSlug: string;
  onClose?: () => void;
  onRoomSelect?: (room: Room) => void;
}

export function RoomBrowser({ projectSlug, onClose, onRoomSelect }: RoomBrowserProps) {
  const { data: session } = useSession() || {};
  const [rooms, setRooms] = useState<Room[]>([]);
  const [summary, setSummary] = useState<RoomSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractingFinishes, setExtractingFinishes] = useState(false);
  const [extractingMEP, setExtractingMEP] = useState(false);
  const [debuggingFinishes, setDebuggingFinishes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(new Set([0, 1, 2]));
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'roomNumber' | 'name' | 'type' | 'area' | 'status' | 'progress'>('roomNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [updatingRoomId, setUpdatingRoomId] = useState<string | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [generatingTakeoffs, setGeneratingTakeoffs] = useState(false);
  const [showTakeoffModal, setShowTakeoffModal] = useState(false);
  const [takeoffSummary, setTakeoffSummary] = useState<any>(null);
  const [exportingRoomId, setExportingRoomId] = useState<string | null>(null);
  const [exportingDocxRoomId, setExportingDocxRoomId] = useState<string | null>(null);
  const [floorPlanExpanded, setFloorPlanExpanded] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);

  // Export room as PDF
  const exportRoomToPDF = async (room: Room) => {
    try {
      setExportingRoomId(room.id);
      toast.loading('Generating room sheet PDF...', { id: `export-room-${room.id}` });

      // Fetch complete room data from API (uses [id]/export-pdf route)
      const response = await fetch(`/api/projects/${projectSlug}/rooms/${room.id}/export-pdf`);
      if (!response.ok) {
        throw new Error('Failed to fetch room data');
      }

      const roomData = await response.json();

      // Dynamically import jsPDF to avoid SSR issues
      const { generateRoomSheetPDF } = await import('@/lib/room-pdf-generator');
      const pdfBlob = await generateRoomSheetPDF(roomData);

      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${room.roomNumber || room.name}-room-sheet-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Room sheet PDF downloaded!', { id: `export-room-${room.id}` });
    } catch (error: any) {
      console.error('Error exporting room PDF:', error);
      toast.error(error.message || 'Failed to export room PDF', { id: `export-room-${room.id}` });
    } finally {
      setExportingRoomId(null);
    }
  };

  // Export room as DOCX (editable Word document)
  const exportRoomToDOCX = async (room: Room) => {
    try {
      setExportingDocxRoomId(room.id);
      toast.loading('Generating room sheet DOCX...', { id: `export-docx-${room.id}` });

      // Fetch complete room data from API (uses same [id]/export-pdf route for data)
      const response = await fetch(`/api/projects/${projectSlug}/rooms/${room.id}/export-pdf`);
      if (!response.ok) {
        throw new Error('Failed to fetch room data');
      }

      const roomData = await response.json();

      // Dynamically import DOCX generator to avoid SSR issues
      const { generateRoomSheetDOCX } = await import('@/lib/room-docx-generator');
      const docxBlob = await generateRoomSheetDOCX(roomData);

      // Create download link
      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${room.roomNumber || room.name}-room-sheet-${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Room sheet DOCX downloaded!', { id: `export-docx-${room.id}` });
    } catch (error: any) {
      console.error('Error exporting room DOCX:', error);
      toast.error(error.message || 'Failed to export room DOCX', { id: `export-docx-${room.id}` });
    } finally {
      setExportingDocxRoomId(null);
    }
  };

  // Bulk export rooms
  const bulkExportRooms = async (format: 'pdf' | 'docx') => {
    try {
      setBulkExporting(true);
      const roomIds = selectedRoomIds.size > 0 ? Array.from(selectedRoomIds) : undefined;
      const count = roomIds?.length || rooms.length;
      
      toast.loading(`Generating ${format.toUpperCase()} for ${count} rooms...`, { id: 'bulk-export' });

      const response = await fetch(`/api/projects/${projectSlug}/rooms/bulk-export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomIds, format }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate export');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `room-schedule-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Exported ${count} rooms to ${format.toUpperCase()}`, { id: 'bulk-export' });
    } catch (error: any) {
      console.error('Bulk export error:', error);
      toast.error(error.message || 'Failed to export rooms', { id: 'bulk-export' });
    } finally {
      setBulkExporting(false);
    }
  };

  useEffect(() => {
    if (projectSlug) {
      fetchRooms();
    }
  }, [projectSlug, filterType, filterStatus, filterFloor]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterFloor !== 'all') params.append('floor', filterFloor);

      const response = await fetch(`/api/projects/${projectSlug}/rooms?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch rooms');

      const data = await response.json();
      setRooms(data.rooms || []);
      setSummary(data.summary || null);
    } catch (error: any) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const extractRooms = async () => {
    try {
      setExtracting(true);
      toast.loading('Extracting rooms from documents...', { id: 'extract-rooms' });
      
      const response = await fetch(`/api/projects/${projectSlug}/extract-rooms`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        // Try to parse error as JSON, fallback to text
        let errorMessage = 'Failed to extract rooms';
        try {
          const data = await response.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch (parseError) {
          // Not JSON, try to get as text
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch (textError) {
            errorMessage = response.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Extracted ${data.extracted} rooms (${data.created} new, ${data.updated} updated)`, { id: 'extract-rooms' });
        // Refresh room list
        await fetchRooms();
      } else {
        toast.info(data.message || 'No rooms found in documents', { id: 'extract-rooms' });
      }
    } catch (error: any) {
      console.error('Error extracting rooms:', error);
      toast.error(error.message || 'Failed to extract rooms', { id: 'extract-rooms' });
    } finally {
      setExtracting(false);
    }
  };

  const extractFinishSchedules = async () => {
    try {
      setExtractingFinishes(true);
      toast.loading('Extracting finish schedules and matching with rooms...', { id: 'extract-finishes' });
      
      const response = await fetch(`/api/projects/${projectSlug}/extract-finish-schedules`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to extract finish schedules';
        try {
          const data = await response.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch (parseError) {
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch (textError) {
            errorMessage = response.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(
          `Successfully added finish data to ${data.matchedRooms} rooms (${data.totalFinishes} finish items)`,
          { id: 'extract-finishes' }
        );
        // Refresh room list to show new finish data
        await fetchRooms();
      } else {
        toast.info(data.message || 'No finish schedule data found', { id: 'extract-finishes' });
      }
    } catch (error: any) {
      console.error('Error extracting finish schedules:', error);
      toast.error(error.message || 'Failed to extract finish schedules', { id: 'extract-finishes' });
    } finally {
      setExtractingFinishes(false);
    }
  };

  const extractMEPSchedules = async () => {
    try {
      setExtractingMEP(true);
      toast.loading('Extracting MEP equipment schedules (lights, plumbing, HVAC)...', { id: 'extract-mep' });
      
      const response = await fetch(`/api/projects/${projectSlug}/extract-mep-schedules`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to extract MEP schedules');
      }
      
      const data = await response.json();
      
      if (data.success) {
        const counts = data.summary || {};
        toast.success(
          `Extracted MEP schedules: ${counts.lightFixtures || 0} lights, ${counts.plumbingFixtures || 0} plumbing, ${counts.hvacEquipment || 0} HVAC, ${counts.abbreviations || 0} abbreviations`,
          { id: 'extract-mep', duration: 5000 }
        );
      } else {
        toast.info(data.message || 'No MEP schedules found in documents', { id: 'extract-mep' });
      }
    } catch (error: any) {
      console.error('Error extracting MEP schedules:', error);
      toast.error(error.message || 'Failed to extract MEP schedules', { id: 'extract-mep' });
    } finally {
      setExtractingMEP(false);
    }
  };

  const debugFinishContent = async () => {
    try {
      setDebuggingFinishes(true);
      toast.loading('Analyzing finish schedule content in documents...', { id: 'debug-finishes' });
      
      const response = await fetch(`/api/projects/${projectSlug}/debug-finish-content`);
      
      if (!response.ok) {
        throw new Error('Failed to debug finish content');
      }
      
      const data = await response.json();
      
      // Display comprehensive debug info
      console.log('=== FINISH SCHEDULE DEBUG INFO ===');
      console.log('Summary:', data.summary);
      console.log('Keyword Matches:', data.keywordMatches);
      console.log('Room Numbers in Finish Chunks:', data.roomNumbersInFinishChunks);
      console.log('Project Room Numbers:', data.projectRoomNumbers);
      console.log('Top Finish Chunks:', data.topFinishChunks);
      
      // Create a detailed message
      const msg = `
📊 **Debug Results:**
- Total document chunks: ${data.summary.totalChunks}
- Finish-related chunks: ${data.summary.finishRelatedChunks}
- Project rooms: ${data.summary.totalRooms}
- Room numbers found in finish chunks: ${data.summary.roomNumbersFound}

🔍 **Top Keywords Found:**
${Object.entries(data.keywordMatches || {})
  .sort((a, b) => (b[1] as number) - (a[1] as number))
  .slice(0, 5)
  .map(([keyword, count]) => `  • ${keyword}: ${count} times`)
  .join('\\n')}

📋 **Room Numbers in Finish Chunks:**
${Object.entries(data.roomNumbersInFinishChunks || {})
  .slice(0, 10)
  .map(([roomNum, count]) => `  • Room ${roomNum}: appears ${count} times`)
  .join('\\n') || '  None found'}

✅ **Check console for detailed chunk previews**
      `.trim();
      
      toast.dismiss('debug-finishes');
      
      // Show an alert with the results
      alert(msg);
      
      // Also show a success toast
      if (data.summary.finishRelatedChunks > 0) {
        toast.success(
          `Found ${data.summary.finishRelatedChunks} chunks with finish data. Check console for details.`,
          { duration: 5000 }
        );
      } else {
        toast.warning(
          'No finish schedule content found in documents. The finish schedule may be in a different document or format.',
          { duration: 7000 }
        );
      }
    } catch (error: any) {
      console.error('Error debugging finish content:', error);
      toast.error('Failed to analyze finish content', { id: 'debug-finishes' });
    } finally {
      setDebuggingFinishes(false);
    }
  };

  const generateTakeoffs = async () => {
    try {
      setGeneratingTakeoffs(true);
      toast.loading('Generating automatic takeoffs from room data...', { id: 'generate-takeoffs' });

      const response = await fetch(`/api/projects/${projectSlug}/generate-takeoffs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ceilingHeight: 9 }), // Default 9' ceilings
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate takeoffs';
        try {
          const data = await response.json();
          errorMessage = data.error || data.details || errorMessage;
        } catch (parseError) {
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch (textError) {
            errorMessage = response.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        toast.success(
          `Generated ${data.lineItemCount} takeoff items from ${data.roomCount} rooms`,
          { id: 'generate-takeoffs' }
        );

        // Show the takeoff summary modal
        setTakeoffSummary(data);
        setShowTakeoffModal(true);
      } else {
        toast.info(data.message || 'No takeoffs generated', { id: 'generate-takeoffs' });
      }
    } catch (error: unknown) {
      console.error('Error generating takeoffs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate takeoffs';
      toast.error(errorMessage, { id: 'generate-takeoffs' });
    } finally {
      setGeneratingTakeoffs(false);
    }
  };

  const updateRoomFloor = async (roomId: string, newFloor: number | null) => {
    try {
      setUpdatingRoomId(roomId);
      const toastId = `update-floor-${roomId}`;
      toast.loading('Updating room floor...', { id: toastId });

      const room = rooms.find(r => r.id === roomId);
      if (!room) {
        toast.error('Room not found', { id: toastId });
        return;
      }

      const response = await fetch(`/api/projects/${projectSlug}/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...room,
          floorNumber: newFloor,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update room floor');
      }

      toast.success('Room floor updated successfully', { id: toastId });
      await fetchRooms(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating room floor:', error);
      toast.error(error.message || 'Failed to update room floor');
    } finally {
      setUpdatingRoomId(null);
    }
  };

  const toggleRoomDetails = (roomId: string) => {
    const newExpanded = new Set(expandedRooms);
    if (newExpanded.has(roomId)) {
      newExpanded.delete(roomId);
    } else {
      newExpanded.add(roomId);
    }
    setExpandedRooms(newExpanded);
  };

  // Selection functions
  const toggleRoomSelection = (roomId: string) => {
    const newSelected = new Set(selectedRoomIds);
    if (newSelected.has(roomId)) {
      newSelected.delete(roomId);
    } else {
      newSelected.add(roomId);
    }
    setSelectedRoomIds(newSelected);
  };

  const selectAllVisible = () => {
    const visibleRoomIds = new Set(sortedRooms.map(r => r.id));
    setSelectedRoomIds(visibleRoomIds);
  };

  const clearSelection = () => {
    setSelectedRoomIds(new Set());
  };

  const bulkUpdateFloor = async (newFloor: number | null) => {
    if (selectedRoomIds.size === 0) return;

    try {
      setBulkUpdating(true);
      const toastId = 'bulk-update-floor';
      toast.loading(`Updating ${selectedRoomIds.size} rooms to floor ${newFloor ?? 'unassigned'}...`, { id: toastId });

      const response = await fetch(`/api/projects/${projectSlug}/rooms/bulk-update-floor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomIds: Array.from(selectedRoomIds),
          floorNumber: newFloor,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update rooms';
        try {
          const data = await response.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch (parseError) {
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch (textError) {
            errorMessage = response.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      toast.success(data.message || `Updated ${data.updated} rooms`, { id: toastId });

      // Clear selection and refresh
      clearSelection();
      await fetchRooms();
    } catch (error: any) {
      console.error('Error bulk updating floors:', error);
      toast.error(error.message || 'Failed to update rooms', { id: 'bulk-update-floor' });
    } finally {
      setBulkUpdating(false);
    }
  };

  // Filter rooms by search query
  const filteredRooms = rooms.filter((room) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      room.name.toLowerCase().includes(query) ||
      room.roomNumber?.toLowerCase().includes(query) ||
      room.type.toLowerCase().includes(query) ||
      room.gridLocation?.toLowerCase().includes(query)
    );
  });

  // Sort rooms
  const sortedRooms = [...filteredRooms].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'roomNumber':
        // Extract numeric part for proper sorting (001, 002, 010, 011, etc.)
        const aNum = parseInt(a.roomNumber?.replace(/\D/g, '') || '0');
        const bNum = parseInt(b.roomNumber?.replace(/\D/g, '') || '0');
        comparison = aNum - bNum;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'area':
        comparison = (a.area || 0) - (b.area || 0);
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      case 'progress':
        comparison = a.percentComplete - b.percentComplete;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Group rooms by floor
  const roomsByFloor = sortedRooms.reduce((acc, room) => {
    const floor = room.floorNumber ?? -1; // -1 for unassigned
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  // Get unique floors sorted
  const floors = Object.keys(roomsByFloor)
    .map(Number)
    .sort((a, b) => a - b);

  // Get unique types for filter
  const uniqueTypes = Array.from(new Set(rooms.map((r) => r.type)));

  // Get unique floors for filter
  const uniqueFloors = Array.from(new Set(rooms.map((r) => r.floorNumber).filter((f): f is number => f !== null && f !== undefined)));

  // Handle room update from floor plan viewer
  const handleRoomUpdate = useCallback((roomId: string, updates: Partial<Room>) => {
    setRooms(prevRooms => 
      prevRooms.map(room => 
        room.id === roomId ? { ...room, ...updates } : room
      )
    );
  }, []);

  // Highlight room in list when selected from floor plan
  const handleFloorPlanRoomSelect = useCallback((room: Room) => {
    // Expand the floor if not expanded
    if (room.floorNumber !== undefined) {
      setExpandedFloors(prev => {
        const newSet = new Set(prev);
        newSet.add(room.floorNumber!);
        return newSet;
      });
    }
    // Expand room details
    setExpandedRooms(prev => {
      const newSet = new Set(prev);
      newSet.add(room.id);
      return newSet;
    });
    // Scroll to room (optional enhancement)
    setTimeout(() => {
      const roomElement = document.getElementById(`room-${room.id}`);
      if (roomElement) {
        roomElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        roomElement.classList.add('ring-2', 'ring-orange-500');
        setTimeout(() => roomElement.classList.remove('ring-2', 'ring-orange-500'), 2000);
      }
    }, 100);
    onRoomSelect?.(room);
  }, [onRoomSelect]);

  const toggleFloor = (floor: number) => {
    const newExpanded = new Set(expandedFloors);
    if (newExpanded.has(floor)) {
      newExpanded.delete(floor);
    } else {
      newExpanded.add(floor);
    }
    setExpandedFloors(newExpanded);
  };

  const getStatusIcon = (status: string) => {
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
  };

  const getStatusBadge = (status: string) => {
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
  };

  const getRoomTypeLabel = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getFloorLabel = (floor: number) => {
    if (floor === -1) return 'Unassigned';
    if (floor === 0) return 'Ground Floor';
    if (floor === 1) return '1st Floor';
    if (floor === 2) return '2nd Floor';
    if (floor === 3) return '3rd Floor';
    return `${floor}th Floor`;
  };

  return (
    <div className="flex flex-col bg-dark-surface text-[#F8FAFC] overflow-auto w-full" style={{ maxHeight: 'calc(100vh - 80px)', minHeight: '600px' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 p-4 sticky top-0 z-10 bg-dark-surface">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Room Browser</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Extract Actions Dropdown */}
          <QuickActionMenu
            label={extracting || extractingFinishes ? 'Extracting...' : 'Extract'}
            icon={RefreshCw}
            variant="outline"
            items={[
              { 
                id: 're-extract',
                label: 'Re-extract Rooms', 
                icon: Home, 
                onClick: extractRooms,
                disabled: extracting || extractingFinishes
              },
              { 
                id: 'extract-finishes',
                label: 'Extract Finishes', 
                icon: Paintbrush, 
                onClick: extractFinishSchedules,
                disabled: extracting || extractingFinishes || extractingMEP || rooms.length === 0
              },
              { 
                id: 'extract-mep',
                label: 'Extract MEP Schedules', 
                icon: Zap, 
                onClick: extractMEPSchedules,
                disabled: extracting || extractingFinishes || extractingMEP
              },
              { 
                id: 'debug-finishes',
                label: 'Debug Finishes', 
                icon: Bug, 
                onClick: debugFinishContent,
                disabled: debuggingFinishes
              },
            ]}
          />
          
          {/* Generate Takeoffs Button - keep standalone since it's primary action */}
          <Button
            variant="outline"
            size="sm"
            onClick={generateTakeoffs}
            disabled={generatingTakeoffs || rooms.length === 0}
            className="text-xs bg-green-500/10 hover:bg-green-500/20 border-green-500/50"
          >
            <Calculator className="h-3 w-3 mr-1" />
            {generatingTakeoffs ? 'Generating...' : 'Generate Takeoffs'}
          </Button>

          {/* Room Comparison Button */}
          <WithTooltip tooltip="Compare room finishes">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComparison(true)}
              disabled={rooms.length < 2}
              className="text-xs bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/50"
            >
              <ArrowLeftRight className="h-3 w-3 mr-1" />
              Compare
            </Button>
          </WithTooltip>

          {/* Export All Button */}
          <QuickActionMenu
            label="Export"
            icon={FileDown}
            variant="outline"
            items={[
              { 
                id: 'export-all-pdf',
                label: 'Export All (PDF)', 
                icon: FileDown, 
                onClick: () => bulkExportRooms('pdf'),
                disabled: bulkExporting || rooms.length === 0
              },
              { 
                id: 'export-all-docx',
                label: 'Export All (DOCX)', 
                icon: FileText, 
                onClick: () => bulkExportRooms('docx'),
                disabled: bulkExporting || rooms.length === 0
              },
            ]}
          />
          
          {onClose && (
            <WithTooltip tooltip="Close panel">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </WithTooltip>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="border-b border-gray-700 p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{summary.totalRooms}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{summary.completed}</div>
              <div className="text-xs text-gray-400">Done</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">{summary.inProgress}</div>
              <div className="text-xs text-gray-400">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">{summary.notStarted}</div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
          </div>
        </div>
      )}

      {/* Floor Plan Viewer Ribbon */}
      <div className={`border-b border-gray-700 transition-all duration-300 ${floorPlanExpanded ? 'p-0' : 'p-3'}`}>
        <FloorPlanViewer
          projectSlug={projectSlug}
          rooms={rooms}
          selectedFloor={filterFloor !== 'all' ? parseInt(filterFloor) : 1}
          onRoomSelect={handleFloorPlanRoomSelect}
          onRoomUpdate={handleRoomUpdate}
          expanded={floorPlanExpanded}
          onToggleExpand={() => setFloorPlanExpanded(!floorPlanExpanded)}
        />
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedRoomIds.size > 0 && (
        <div className="border-b border-orange-500/50 bg-orange-500/10 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-orange-400">
                {selectedRoomIds.size} room{selectedRoomIds.size !== 1 ? 's' : ''} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-7 text-xs text-gray-400 hover:text-white"
              >
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {/* Bulk Export Buttons */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkExportRooms('pdf')}
                disabled={bulkExporting}
                className="h-8 text-xs bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/50"
              >
                <FileDown className="h-3 w-3 mr-1" />
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkExportRooms('docx')}
                disabled={bulkExporting}
                className="h-8 text-xs bg-green-500/10 hover:bg-green-500/20 border-green-500/50"
              >
                <FileText className="h-3 w-3 mr-1" />
                Export DOCX
              </Button>
              
              <Separator orientation="vertical" className="h-6 bg-gray-600" />
              
              <span className="text-xs text-gray-400">Move to:</span>
              <Select
                disabled={bulkUpdating}
                onValueChange={(value) => {
                  const floor = value === 'unassigned' ? null : parseInt(value);
                  bulkUpdateFloor(floor);
                }}
              >
                <SelectTrigger className="h-8 w-[140px] bg-[#3d4551] border-orange-500/50 text-[#F8FAFC] text-xs">
                  <SelectValue placeholder="Select floor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="-1">Basement</SelectItem>
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
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-3 border-b border-gray-700 p-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-dark-card border-gray-600 pl-10 text-[#F8FAFC] placeholder:text-gray-500"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="bg-dark-card border-gray-600 text-[#F8FAFC]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {getRoomTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="bg-dark-card border-gray-600 text-[#F8FAFC]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterFloor} onValueChange={setFilterFloor}>
            <SelectTrigger className="bg-dark-card border-gray-600 text-[#F8FAFC]">
              <SelectValue placeholder="Floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {[...uniqueFloors].sort((a, b) => a - b).map((floor) => (
                <SelectItem key={floor} value={floor.toString()}>
                  {getFloorLabel(floor)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Select All Checkbox */}
        {sortedRooms.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
            <input
              type="checkbox"
              id="select-all"
              checked={selectedRoomIds.size === sortedRooms.length && sortedRooms.length > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  selectAllVisible();
                } else {
                  clearSelection();
                }
              }}
              className="h-4 w-4 rounded border-gray-600 bg-dark-card text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
            />
            <label htmlFor="select-all" className="text-sm text-gray-400 cursor-pointer">
              Select all visible ({sortedRooms.length})
            </label>
          </div>
        )}

        {/* Sorting Controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort by:</span>
          <Select value={sortBy} onValueChange={(value: 'roomNumber' | 'name' | 'type' | 'area' | 'status' | 'progress') => setSortBy(value)}>
            <SelectTrigger className="bg-dark-card border-gray-600 text-[#F8FAFC] w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="roomNumber">Room Number</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="type">Type</SelectItem>
              <SelectItem value="area">Area</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="text-gray-400 hover:text-[#F8FAFC] hover:bg-dark-card px-2"
            title={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
          >
            {sortDirection === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Clear Filters */}
        {(searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterFloor !== 'all') && (
          <WithTooltip tooltip="Reset all filters">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
                setFilterStatus('all');
                setFilterFloor('all');
              }}
              className="w-full text-orange-500 hover:text-orange-400 hover:bg-dark-card"
            >
              <X className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          </WithTooltip>
        )}
      </div>

      {/* Room List */}
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
              <p className="text-sm text-gray-400">Loading rooms...</p>
            </div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Building2 className="mx-auto mb-3 h-12 w-12 text-gray-600" />
              <p className="text-sm text-gray-400">
                {searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterFloor !== 'all'
                  ? 'No rooms match your filters'
                  : 'No rooms found in this project'}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterFloor !== 'all'
                  ? 'Try adjusting your search criteria'
                  : 'Click below to extract rooms from processed documents'}
              </p>
              {!(searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterFloor !== 'all') && (
                <Button
                  onClick={extractRooms}
                  disabled={extracting}
                  className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {extracting ? (
                    <>
                      <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></span>
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
        ) : (
          <div className="p-4 space-y-2">
            {floors.map((floor) => (
              <div key={floor} className="space-y-1">
                {/* Floor Header */}
                <button
                  onClick={() => toggleFloor(floor)}
                  className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-left hover:bg-[#383e47] transition-colors"
                >
                  {expandedFloors.has(floor) ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <Layers className="h-4 w-4 text-orange-500" />
                  <span className="font-medium text-[#F8FAFC]">{getFloorLabel(floor)}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {roomsByFloor[floor].length}
                  </Badge>
                </button>

                {/* Floor Rooms */}
                {expandedFloors.has(floor) && (
                  <div className="ml-6 space-y-1">
                    {roomsByFloor[floor].map((room) => (
                      <div
                        key={room.id}
                        id={`room-${room.id}`}
                        className="rounded-lg border border-gray-700 bg-dark-surface overflow-hidden transition-all duration-300"
                      >
                        {/* Room Header - Always Visible */}
                        <div className="flex items-start gap-3 p-3">
                          {/* Selection Checkbox */}
                          <div className="mt-1">
                            <input
                              type="checkbox"
                              checked={selectedRoomIds.has(room.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleRoomSelection(room.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-gray-600 bg-dark-card text-orange-500 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
                              title="Select room"
                            />
                          </div>

                          {/* Status Icon */}
                          <div className="mt-1">
                            {getStatusIcon(room.status)}
                          </div>

                          {/* Room Info */}
                          <div className="flex-1 min-w-0">
                            {/* Room Name & Number */}
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-[#F8FAFC] truncate">{room.name}</h3>
                              {room.roomNumber && (
                                <Badge variant="outline" className="text-xs">
                                  {room.roomNumber}
                                </Badge>
                              )}
                            </div>

                            {/* Room Type & Floor Selector */}
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-1.5">
                                <Home className="h-3 w-3 text-gray-500" />
                                <span className="text-xs text-gray-400">{getRoomTypeLabel(room.type)}</span>
                              </div>
                              
                              {/* Floor Selector */}
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <Layers className="h-3 w-3 text-orange-500" />
                                <Select
                                  value={room.floorNumber?.toString() || '-1'}
                                  onValueChange={(value) => {
                                    const newFloor = value === '-1' ? null : parseInt(value);
                                    updateRoomFloor(room.id, newFloor);
                                  }}
                                  disabled={updatingRoomId === room.id}
                                >
                                  <SelectTrigger className="h-6 w-[120px] text-xs bg-[#3d4551] hover:bg-[#4a5160] border-orange-500/50 text-[#F8FAFC] shadow-sm">
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
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
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
                                <div className="h-1.5 w-full rounded-full bg-gray-700">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400"
                                    style={{ width: `${room.percentComplete}%` }}
                                  />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">{room.percentComplete}% Complete</p>
                              </div>
                            )}
                          </div>

                          {/* Expand/Collapse Button */}
                          <button
                            onClick={() => toggleRoomDetails(room.id)}
                            className="p-2 hover:bg-dark-card rounded transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                            title={expandedRooms.has(room.id) ? 'Hide details' : 'Show details'}
                          >
                            {expandedRooms.has(room.id) ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </div>

                        {/* Collapsible Room Details */}
                        {expandedRooms.has(room.id) && (
                          <div className="border-t border-gray-700 bg-dark-card p-4 space-y-4">
                            {/* Export Buttons */}
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => exportRoomToDOCX(room)}
                                disabled={exportingDocxRoomId === room.id || exportingRoomId === room.id}
                                className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
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
                                onClick={() => exportRoomToPDF(room)}
                                disabled={exportingRoomId === room.id || exportingDocxRoomId === room.id}
                                className="bg-[#F97316] hover:bg-[#ea6a0a] text-white"
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
                                    <span className="text-gray-500">Room Number:</span>
                                    <p className="text-[#F8FAFC] mt-0.5">{room.roomNumber}</p>
                                  </div>
                                )}
                                <div>
                                  <span className="text-gray-500">Type:</span>
                                  <p className="text-[#F8FAFC] mt-0.5">{getRoomTypeLabel(room.type)}</p>
                                </div>
                                {room.doorType && (
                                  <div>
                                    <span className="text-gray-500">Door Type:</span>
                                    <p className="text-[#F8FAFC] mt-0.5">{room.doorType}</p>
                                  </div>
                                )}
                                {room.area && (
                                  <div>
                                    <span className="text-gray-500">Area:</span>
                                    <p className="text-[#F8FAFC] mt-0.5">{room.area.toFixed(2)} sq ft</p>
                                  </div>
                                )}
                                <div>
                                  <span className="text-gray-500">Status:</span>
                                  <div className="mt-0.5">{getStatusBadge(room.status)}</div>
                                </div>
                                {room.gridLocation && (
                                  <div>
                                    <span className="text-gray-500">Grid Location:</span>
                                    <p className="text-[#F8FAFC] mt-0.5">{room.gridLocation}</p>
                                  </div>
                                )}
                                {room.sheetId && (
                                  <div>
                                    <span className="text-gray-500">Sheet:</span>
                                    <p className="text-[#F8FAFC] mt-0.5">{room.sheetId}</p>
                                  </div>
                                )}
                                {room.tradeType && (
                                  <div>
                                    <span className="text-gray-500">Trade Type:</span>
                                    <p className="text-[#F8FAFC] mt-0.5">{room.tradeType}</p>
                                  </div>
                                )}
                                {room.assignedTo && (
                                  <div>
                                    <span className="text-gray-500">Assigned To:</span>
                                    <p className="text-[#F8FAFC] mt-0.5">{room.assignedTo}</p>
                                  </div>
                                )}
                              </div>
                              {room.notes && (
                                <div className="mt-3">
                                  <span className="text-gray-500">Notes:</span>
                                  <p className="text-[#F8FAFC] mt-1 text-xs">{room.notes}</p>
                                </div>
                              )}
                            </div>

                            {/* Finish Schedule Section */}
                            {room.FinishScheduleItem && room.FinishScheduleItem.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-orange-400 mb-2">
                                  Finish Schedule ({room.FinishScheduleItem.length} items)
                                </h4>
                                <div className="space-y-2">
                                  {room.FinishScheduleItem.map((item) => (
                                    <div key={item.id} className="bg-dark-surface rounded p-3 text-xs overflow-hidden">
                                      <div className="flex items-start gap-2 mb-2">
                                        <span className="capitalize text-orange-400 font-medium min-w-[60px] shrink-0">
                                          {item.category}:
                                        </span>
                                        <span className="text-[#F8FAFC] break-words whitespace-normal overflow-hidden">
                                          {item.finishType || 'Not specified'}
                                        </span>
                                      </div>
                                      {item.material && (
                                        <div className="pl-[68px] text-gray-400 mb-1 break-words whitespace-normal">
                                          <span className="text-gray-500">Material:</span> {item.material}
                                        </div>
                                      )}
                                      {item.manufacturer && (
                                        <div className="pl-[68px] text-gray-400 mb-1 break-words whitespace-normal">
                                          <span className="text-gray-500">Mfr:</span> {item.manufacturer}
                                          {item.modelNumber && (
                                            <span className="block pl-0 text-gray-400 break-words">
                                              <span className="text-gray-500">Model:</span> {item.modelNumber}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {item.color && (
                                        <div className="pl-[68px] text-gray-400 mb-1 break-words whitespace-normal">
                                          <span className="text-gray-500">Color:</span> {item.color}
                                        </div>
                                      )}
                                      {item.dimensions && (
                                        <div className="pl-[68px] text-gray-400 mb-1 break-words whitespace-normal">
                                          <span className="text-gray-500">Dim:</span> {item.dimensions}
                                        </div>
                                      )}
                                      {item.csiCode && (
                                        <div className="pl-[68px] text-gray-500 break-words whitespace-normal">
                                          <span className="text-gray-600">CSI:</span> {item.csiCode}
                                        </div>
                                      )}
                                      {item.notes && (
                                        <div className="pl-[68px] text-gray-500 mt-1 italic break-words whitespace-normal">
                                          {item.notes}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* MEP Equipment Section */}
                            {room.mepEquipment && room.mepEquipment.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-blue-400 mb-2">
                                  MEP Equipment ({room.mepEquipment.length} items)
                                </h4>
                                <div className="space-y-2">
                                  {/* Group by trade */}
                                  {['electrical', 'hvac', 'plumbing', 'fire_alarm'].map((trade) => {
                                    const tradeItems = room.mepEquipment?.filter(e => e.trade === trade) || [];
                                    if (tradeItems.length === 0) return null;
                                    
                                    const TradeIcon = trade === 'electrical' ? Zap 
                                      : trade === 'hvac' ? Thermometer 
                                      : trade === 'plumbing' ? Droplets 
                                      : Flame;
                                    const tradeColor = trade === 'electrical' ? 'text-yellow-400'
                                      : trade === 'hvac' ? 'text-cyan-400'
                                      : trade === 'plumbing' ? 'text-blue-400'
                                      : 'text-red-400';
                                    const tradeBgColor = trade === 'electrical' ? 'bg-yellow-500/10 border-yellow-700'
                                      : trade === 'hvac' ? 'bg-cyan-500/10 border-cyan-700'
                                      : trade === 'plumbing' ? 'bg-blue-500/10 border-blue-700'
                                      : 'bg-red-500/10 border-red-700';
                                    const tradeLabel = trade === 'electrical' ? 'Electrical'
                                      : trade === 'hvac' ? 'HVAC'
                                      : trade === 'plumbing' ? 'Plumbing'
                                      : 'Fire Protection';
                                    
                                    return (
                                      <div key={trade} className={`rounded-lg border p-3 ${tradeBgColor}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                          <TradeIcon className={`h-4 w-4 ${tradeColor}`} />
                                          <span className={`text-xs font-semibold ${tradeColor}`}>
                                            {tradeLabel} ({tradeItems.length})
                                          </span>
                                        </div>
                                        <div className="space-y-1.5">
                                          {tradeItems.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between text-xs bg-dark-surface rounded px-2 py-1.5">
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="font-mono text-gray-500 flex-shrink-0">{item.tag}</span>
                                                <span className="text-[#F8FAFC] truncate">{item.name}</span>
                                              </div>
                                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                {item.quantity && (
                                                  <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-700">
                                                    {item.quantity} {item.unit || 'EA'}
                                                  </Badge>
                                                )}
                                                {item.totalCost && (
                                                  <Badge variant="outline" className="text-[10px] text-green-400 border-green-700">
                                                    ${item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* No Finish Data Message */}
                            {(!room.FinishScheduleItem || room.FinishScheduleItem.length === 0) && (!room.mepEquipment || room.mepEquipment.length === 0) && (
                              <div className="text-center py-4">
                                <Circle className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                                <p className="text-xs text-gray-500">No finish schedule or MEP data available for this room</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Takeoff Summary Modal */}
      {showTakeoffModal && takeoffSummary && (
        <TakeoffSummaryModal
          open={showTakeoffModal}
          onClose={() => setShowTakeoffModal(false)}
          summary={takeoffSummary.summary || []}
          lineItemCount={takeoffSummary.lineItemCount || 0}
          roomCount={takeoffSummary.roomCount || 0}
          takeoffId={takeoffSummary.takeoffId || ''}
          projectSlug={projectSlug}
        />
      )}

      {/* Room Comparison Modal */}
      {showComparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto">
            <RoomComparison 
              projectSlug={projectSlug} 
              onClose={() => setShowComparison(false)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
