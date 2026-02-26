'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  Building2,
  X,
  Calculator,
  RefreshCw,
  Home,
  Paintbrush,
  Zap,
  Bug,
  ArrowLeftRight,
  FileDown,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WithTooltip } from '@/components/ui/icon-button';
import { QuickActionMenu } from '@/components/ui/header-action-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { TakeoffSummaryModal } from '@/components/takeoff-summary-modal';
import { FloorPlanViewer } from '@/components/floor-plan-viewer';

import { Room, RoomSummary, RoomBrowserProps } from './types';
import { RoomFiltersPanel } from './room-filters-panel';
import { RoomListByFloor } from './room-list-by-floor';
import { RoomBulkActions } from './room-bulk-actions';
import { RoomComparisonModal } from './room-comparison-modal';

type SortField = 'roomNumber' | 'name' | 'type' | 'area' | 'status' | 'progress';

export function RoomBrowser({ projectSlug, onClose, onRoomSelect }: RoomBrowserProps) {
  const { data: _session } = useSession() || {};
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
  const [sortBy, setSortBy] = useState<SortField>('roomNumber');
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

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

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
    } catch (error: unknown) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectSlug) {
      fetchRooms();
    }
  }, [projectSlug, filterType, filterStatus, filterFloor]);

  // ---------------------------------------------------------------------------
  // Extract / debug handlers
  // ---------------------------------------------------------------------------

  const extractRooms = async () => {
    try {
      setExtracting(true);
      toast.loading('Extracting rooms from documents...', { id: 'extract-rooms' });

      const response = await fetch(`/api/projects/${projectSlug}/extract-rooms`, {
        method: 'POST',
      });

      if (!response.ok) {
        let errorMessage = 'Failed to extract rooms';
        try {
          const data = await response.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch (_parseError) {
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch (_textError) {
            errorMessage = response.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        toast.success(
          `Extracted ${data.extracted} rooms (${data.created} new, ${data.updated} updated)`,
          { id: 'extract-rooms' }
        );
        await fetchRooms();
      } else {
        toast.info(data.message || 'No rooms found in documents', { id: 'extract-rooms' });
      }
    } catch (error: unknown) {
      console.error('Error extracting rooms:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to extract rooms';
      toast.error(errMsg, { id: 'extract-rooms' });
    } finally {
      setExtracting(false);
    }
  };

  const extractFinishSchedules = async () => {
    try {
      setExtractingFinishes(true);
      toast.loading('Extracting finish schedules and matching with rooms...', {
        id: 'extract-finishes',
      });

      const response = await fetch(`/api/projects/${projectSlug}/extract-finish-schedules`, {
        method: 'POST',
      });

      if (!response.ok) {
        let errorMessage = 'Failed to extract finish schedules';
        try {
          const data = await response.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch (_parseError) {
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch (_textError) {
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
        await fetchRooms();
      } else {
        toast.info(data.message || 'No finish schedule data found', { id: 'extract-finishes' });
      }
    } catch (error: unknown) {
      console.error('Error extracting finish schedules:', error);
      const errMsg =
        error instanceof Error ? error.message : 'Failed to extract finish schedules';
      toast.error(errMsg, { id: 'extract-finishes' });
    } finally {
      setExtractingFinishes(false);
    }
  };

  const extractMEPSchedules = async () => {
    try {
      setExtractingMEP(true);
      toast.loading('Extracting MEP equipment schedules (lights, plumbing, HVAC)...', {
        id: 'extract-mep',
      });

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
    } catch (error: unknown) {
      console.error('Error extracting MEP schedules:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to extract MEP schedules';
      toast.error(errMsg, { id: 'extract-mep' });
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

      console.log('=== FINISH SCHEDULE DEBUG INFO ===');
      console.log('Summary:', data.summary);
      console.log('Keyword Matches:', data.keywordMatches);
      console.log('Room Numbers in Finish Chunks:', data.roomNumbersInFinishChunks);
      console.log('Project Room Numbers:', data.projectRoomNumbers);
      console.log('Top Finish Chunks:', data.topFinishChunks);

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
  .join('\n')}

📋 **Room Numbers in Finish Chunks:**
${Object.entries(data.roomNumbersInFinishChunks || {})
  .slice(0, 10)
  .map(([roomNum, count]) => `  • Room ${roomNum}: appears ${count} times`)
  .join('\n') || '  None found'}

✅ **Check console for detailed chunk previews**
      `.trim();

      toast.dismiss('debug-finishes');
      alert(msg);

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
    } catch (error: unknown) {
      console.error('Error debugging finish content:', error);
      toast.error('Failed to analyze finish content', { id: 'debug-finishes' });
    } finally {
      setDebuggingFinishes(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Takeoff generation
  // ---------------------------------------------------------------------------

  const generateTakeoffs = async () => {
    try {
      setGeneratingTakeoffs(true);
      toast.loading('Generating automatic takeoffs from room data...', {
        id: 'generate-takeoffs',
      });

      const response = await fetch(`/api/projects/${projectSlug}/generate-takeoffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ceilingHeight: 9 }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate takeoffs';
        try {
          const data = await response.json();
          errorMessage = data.error || data.details || errorMessage;
        } catch (_parseError) {
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch (_textError) {
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
        setTakeoffSummary(data);
        setShowTakeoffModal(true);
      } else {
        toast.info(data.message || 'No takeoffs generated', { id: 'generate-takeoffs' });
      }
    } catch (error: unknown) {
      console.error('Error generating takeoffs:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to generate takeoffs';
      toast.error(errorMessage, { id: 'generate-takeoffs' });
    } finally {
      setGeneratingTakeoffs(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Room floor update
  // ---------------------------------------------------------------------------

  const updateRoomFloor = async (roomId: string, newFloor: number | null) => {
    try {
      setUpdatingRoomId(roomId);
      const toastId = `update-floor-${roomId}`;
      toast.loading('Updating room floor...', { id: toastId });

      const room = rooms.find((r) => r.id === roomId);
      if (!room) {
        toast.error('Room not found', { id: toastId });
        return;
      }

      const response = await fetch(`/api/projects/${projectSlug}/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...room, floorNumber: newFloor }),
      });

      if (!response.ok) {
        throw new Error('Failed to update room floor');
      }

      toast.success('Room floor updated successfully', { id: toastId });
      await fetchRooms();
    } catch (error: unknown) {
      console.error('Error updating room floor:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to update room floor';
      toast.error(errMsg);
    } finally {
      setUpdatingRoomId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Export handlers
  // ---------------------------------------------------------------------------

  const exportRoomToPDF = useCallback(async (room: Room) => {
    try {
      setExportingRoomId(room.id);
      toast.loading('Generating room sheet PDF...', { id: `export-room-${room.id}` });

      const response = await fetch(
        `/api/projects/${projectSlug}/rooms/${room.id}/export-pdf`
      );
      if (!response.ok) {
        throw new Error('Failed to generate room PDF');
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Generated PDF is empty');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${room.roomNumber || room.name}-room-sheet-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Room sheet PDF downloaded!', { id: `export-room-${room.id}` });
    } catch (error: unknown) {
      logger.error('ROOM_BROWSER', 'Error exporting room PDF', error as Error);
      const errMsg = error instanceof Error ? error.message : 'Failed to export room PDF';
      toast.error(errMsg, { id: `export-room-${room.id}` });
    } finally {
      setExportingRoomId(null);
    }
  }, [projectSlug]);

  const exportRoomToDOCX = useCallback(async (room: Room) => {
    try {
      setExportingDocxRoomId(room.id);
      toast.loading('Generating room sheet DOCX...', { id: `export-docx-${room.id}` });

      const response = await fetch(
        `/api/projects/${projectSlug}/rooms/${room.id}/export-pdf?format=json`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch room data');
      }

      const roomData = await response.json();

      const { generateRoomSheetDOCX } = await import('@/lib/room-docx-generator');
      const docxBlob = await generateRoomSheetDOCX(roomData);

      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${room.roomNumber || room.name}-room-sheet-${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Room sheet DOCX downloaded!', { id: `export-docx-${room.id}` });
    } catch (error: unknown) {
      logger.error('ROOM_BROWSER', 'Error exporting room DOCX', error as Error);
      const errMsg = error instanceof Error ? error.message : 'Failed to export room DOCX';
      toast.error(errMsg, { id: `export-docx-${room.id}` });
    } finally {
      setExportingDocxRoomId(null);
    }
  }, [projectSlug]);

  const bulkExportRooms = async (format: 'pdf' | 'docx') => {
    try {
      setBulkExporting(true);
      const roomIds = selectedRoomIds.size > 0 ? Array.from(selectedRoomIds) : undefined;
      const count = roomIds?.length || rooms.length;

      toast.loading(`Generating ${format.toUpperCase()} for ${count} rooms...`, {
        id: 'bulk-export',
      });

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
    } catch (error: unknown) {
      console.error('Bulk export error:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to export rooms';
      toast.error(errMsg, { id: 'bulk-export' });
    } finally {
      setBulkExporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const toggleRoomSelection = useCallback((roomId: string) => {
    setSelectedRoomIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(roomId)) newSet.delete(roomId);
      else newSet.add(roomId);
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRoomIds(new Set());
  }, []);

  const bulkUpdateFloor = async (newFloor: number | null) => {
    if (selectedRoomIds.size === 0) return;

    try {
      setBulkUpdating(true);
      const toastId = 'bulk-update-floor';
      toast.loading(
        `Updating ${selectedRoomIds.size} rooms to floor ${newFloor ?? 'unassigned'}...`,
        { id: toastId }
      );

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
        } catch (_parseError) {
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch (_textError) {
            errorMessage = response.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      toast.success(data.message || `Updated ${data.updated} rooms`, { id: toastId });

      clearSelection();
      await fetchRooms();
    } catch (error: unknown) {
      console.error('Error bulk updating floors:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to update rooms';
      toast.error(errMsg, { id: 'bulk-update-floor' });
    } finally {
      setBulkUpdating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Expand helpers
  // ---------------------------------------------------------------------------

  const toggleRoomDetails = useCallback((roomId: string) => {
    setExpandedRooms((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(roomId)) newSet.delete(roomId);
      else newSet.add(roomId);
      return newSet;
    });
  }, []);

  const toggleFloor = useCallback((floor: number) => {
    setExpandedFloors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(floor)) newSet.delete(floor);
      else newSet.add(floor);
      return newSet;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Floor plan callbacks
  // ---------------------------------------------------------------------------

  const handleRoomUpdate = useCallback((roomId: string, updates: Partial<Room>) => {
    setRooms((prevRooms) =>
      prevRooms.map((room) => (room.id === roomId ? { ...room, ...updates } : room))
    );
  }, []);

  const handleFloorPlanRoomSelect = useCallback(
    (room: Room) => {
      if (room.floorNumber !== undefined) {
        setExpandedFloors((prev) => {
          const newSet = new Set(prev);
          newSet.add(room.floorNumber!);
          return newSet;
        });
      }
      setExpandedRooms((prev) => {
        const newSet = new Set(prev);
        newSet.add(room.id);
        return newSet;
      });
      setTimeout(() => {
        const roomElement = document.getElementById(`room-${room.id}`);
        if (roomElement) {
          roomElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          roomElement.classList.add('ring-2', 'ring-orange-500');
          setTimeout(() => roomElement.classList.remove('ring-2', 'ring-orange-500'), 2000);
        }
      }, 100);
      onRoomSelect?.(room);
    },
    [onRoomSelect]
  );

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const filteredRooms = useMemo(() => rooms.filter((room) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      room.name.toLowerCase().includes(query) ||
      room.roomNumber?.toLowerCase().includes(query) ||
      room.type.toLowerCase().includes(query) ||
      room.gridLocation?.toLowerCase().includes(query)
    );
  }), [rooms, searchQuery]);

  const sortedRooms = useMemo(() => [...filteredRooms].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'roomNumber': {
        const aNum = parseInt(a.roomNumber?.replace(/\D/g, '') || '0');
        const bNum = parseInt(b.roomNumber?.replace(/\D/g, '') || '0');
        comparison = aNum - bNum;
        break;
      }
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
  }), [filteredRooms, sortBy, sortDirection]);

  const selectAllVisible = useCallback(() => {
    const visibleRoomIds = new Set(sortedRooms.map((r) => r.id));
    setSelectedRoomIds(visibleRoomIds);
  }, [sortedRooms]);

  const roomsByFloor = useMemo(() => sortedRooms.reduce(
    (acc, room) => {
      const floor = room.floorNumber ?? -1;
      if (!acc[floor]) acc[floor] = [];
      acc[floor].push(room);
      return acc;
    },
    {} as Record<number, Room[]>
  ), [sortedRooms]);

  const floors = useMemo(() => Object.keys(roomsByFloor)
    .map(Number)
    .sort((a, b) => a - b), [roomsByFloor]);

  const uniqueTypes = useMemo(() => Array.from(new Set(rooms.map((r) => r.type))), [rooms]);
  const uniqueFloors = useMemo(() => Array.from(
    new Set(
      rooms
        .map((r) => r.floorNumber)
        .filter((f): f is number => f !== null && f !== undefined)
    )
  ), [rooms]);

  const hasActiveFilters =
    !!searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterFloor !== 'all';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="flex flex-col bg-dark-surface text-slate-50 overflow-auto w-full"
      style={{ maxHeight: 'calc(100vh - 80px)', minHeight: '600px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dark-hover p-4 sticky top-0 z-10 bg-dark-surface">
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
                disabled: extracting || extractingFinishes,
              },
              {
                id: 'extract-finishes',
                label: 'Extract Finishes',
                icon: Paintbrush,
                onClick: extractFinishSchedules,
                disabled: extracting || extractingFinishes || extractingMEP || rooms.length === 0,
              },
              {
                id: 'extract-mep',
                label: 'Extract MEP Schedules',
                icon: Zap,
                onClick: extractMEPSchedules,
                disabled: extracting || extractingFinishes || extractingMEP,
              },
              {
                id: 'debug-finishes',
                label: 'Debug Finishes',
                icon: Bug,
                onClick: debugFinishContent,
                disabled: debuggingFinishes,
              },
            ]}
          />

          {/* Generate Takeoffs Button */}
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
                disabled: bulkExporting || rooms.length === 0,
              },
              {
                id: 'export-all-docx',
                label: 'Export All (DOCX)',
                icon: FileText,
                onClick: () => bulkExportRooms('docx'),
                disabled: bulkExporting || rooms.length === 0,
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
        <div className="border-b border-dark-hover p-4">
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
      <div
        className={`border-b border-dark-hover transition-all duration-300 ${floorPlanExpanded ? 'p-0' : 'p-3'}`}
      >
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
      <RoomBulkActions
        selectedCount={selectedRoomIds.size}
        bulkUpdating={bulkUpdating}
        bulkExporting={bulkExporting}
        onClearSelection={clearSelection}
        onBulkExport={bulkExportRooms}
        onBulkUpdateFloor={bulkUpdateFloor}
      />

      {/* Search and Filters */}
      <RoomFiltersPanel
        searchQuery={searchQuery}
        filterType={filterType}
        filterStatus={filterStatus}
        filterFloor={filterFloor}
        sortBy={sortBy}
        sortDirection={sortDirection}
        uniqueTypes={uniqueTypes}
        uniqueFloors={uniqueFloors}
        visibleRoomCount={sortedRooms.length}
        selectedCount={selectedRoomIds.size}
        onSearchChange={setSearchQuery}
        onFilterTypeChange={setFilterType}
        onFilterStatusChange={setFilterStatus}
        onFilterFloorChange={setFilterFloor}
        onSortByChange={setSortBy}
        onSortDirectionToggle={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
        onSelectAll={selectAllVisible}
        onClearSelection={clearSelection}
        onClearFilters={() => {
          setSearchQuery('');
          setFilterType('all');
          setFilterStatus('all');
          setFilterFloor('all');
        }}
      />

      {/* Room List */}
      <div className="flex-1">
        <RoomListByFloor
          floors={floors}
          roomsByFloor={roomsByFloor}
          expandedFloors={expandedFloors}
          expandedRooms={expandedRooms}
          selectedRoomIds={selectedRoomIds}
          updatingRoomId={updatingRoomId}
          exportingRoomId={exportingRoomId}
          exportingDocxRoomId={exportingDocxRoomId}
          loading={loading}
          hasActiveFilters={hasActiveFilters}
          extracting={extracting}
          onToggleFloor={toggleFloor}
          onToggleRoomExpand={toggleRoomDetails}
          onToggleRoomSelect={toggleRoomSelection}
          onUpdateFloor={updateRoomFloor}
          onExportPDF={exportRoomToPDF}
          onExportDOCX={exportRoomToDOCX}
          onExtractRooms={extractRooms}
        />
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
        <RoomComparisonModal
          projectSlug={projectSlug}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
}
