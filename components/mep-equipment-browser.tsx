'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Wrench,
  Zap,
  Droplets,
  Flame,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  MapPin,
  FileText,
  Info,
  Download,
  Filter,
  Sparkles,
  Loader2,
  MapPinned
} from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { WithTooltip } from '@/components/ui/icon-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface RoomBreakdown {
  room: string;
  quantity: number;
  level?: string;
}

interface MEPEquipment {
  id: string;
  tag: string;
  name: string;
  type: string;
  trade: 'hvac' | 'electrical' | 'plumbing' | 'fire_alarm';
  specifications: Record<string, any>;
  location?: string;
  status: 'installed' | 'pending' | 'ordered';
  sheetReference?: string;
  notes: string[];
  roomBreakdown?: RoomBreakdown[];
}

interface MEPConflict {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  location: string;
  affectedEquipment: string[];
}

interface MEPStats {
  total: number;
  installed: number;
  pending: number;
  conflicts: number;
}

interface MEPEquipmentBrowserProps {
  projectSlug: string;
  onClose?: () => void;
}

const tradeConfig = {
  hvac: {
    label: 'HVAC',
    icon: Wrench,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    description: 'Heating, Ventilation & Air Conditioning'
  },
  electrical: {
    label: 'Electrical',
    icon: Zap,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500',
    description: 'Electrical Systems & Power Distribution'
  },
  plumbing: {
    label: 'Plumbing',
    icon: Droplets,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500',
    description: 'Plumbing & Water Systems'
  },
  fire_alarm: {
    label: 'Fire Protection',
    icon: Flame,
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    description: 'Fire Alarm & Suppression'
  }
};

export function MEPEquipmentBrowser({ projectSlug, onClose }: MEPEquipmentBrowserProps) {
  const { data: session } = useSession() || {};
  const [equipment, setEquipment] = useState<MEPEquipment[]>([]);
  const [conflicts, setConflicts] = useState<MEPConflict[]>([]);
  const [stats, setStats] = useState<MEPStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set(['hvac', 'electrical', 'plumbing', 'fire_alarm']));
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showConflicts, setShowConflicts] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [showLocationAssignment, setShowLocationAssignment] = useState(false);
  const [assigningLocations, setAssigningLocations] = useState(false);
  interface LocationItem {
    id: string;
    name: string;
    room?: string;
    location?: string;
    category?: string;
    itemName?: string;
    description?: string;
    quantity?: number | string;
    unit?: string;
  }
  interface LocationRoom {
    id: string;
    name: string;
    level?: string;
    roomNumber?: string;
    floorNumber?: string | number;
  }
  const [locationData, setLocationData] = useState<{
    items: LocationItem[];
    rooms: LocationRoom[];
    stats: { total: number; withLocation: number; withoutLocation: number };
  } | null>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (projectSlug) {
      fetchMEPData();
    }
  }, [projectSlug, selectedTrade]);

  const handleExtractMEP = async () => {
    try {
      setExtracting(true);
      toast.loading('Extracting MEP data from project documents...', { id: 'mep-extract' });
      
      const response = await fetch(`/api/projects/${projectSlug}/mep-takeoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Extraction failed');
      }
      
      const result = await response.json();
      
      toast.dismiss('mep-extract');
      
      if (result.success) {
        const totalItems = (result.electrical?.itemCount || 0) + 
                          (result.plumbing?.itemCount || 0) + 
                          (result.hvac?.itemCount || 0);
        toast.success(`Extracted ${totalItems} MEP items ($${result.totalCost?.toLocaleString() || 0} estimated)`);
        // Refresh the equipment list
        await fetchMEPData();
      } else {
        toast.error('MEP extraction completed with errors');
      }
    } catch (error: unknown) {
      toast.dismiss('mep-extract');
      console.error('MEP extraction error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to extract MEP data');
    } finally {
      setExtracting(false);
    }
  };

  const fetchMEPData = async () => {
    try {
      setLoading(true);
      const tradeParam = selectedTrade !== 'all' ? `?trade=${selectedTrade}` : '';
      const response = await fetch(`/api/projects/${projectSlug}/mep${tradeParam}`);
      if (!response.ok) throw new Error('Failed to fetch MEP data');

      const data = await response.json();
      setEquipment(data.equipment || []);
      setConflicts(data.conflicts || []);
      setStats(data.stats || null);
    } catch (error: unknown) {
      console.error('Error fetching MEP data:', error);
      toast.error('Failed to load MEP equipment');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationData = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/mep/assign-locations`);
      if (!response.ok) throw new Error('Failed to fetch location data');
      const data = await response.json();
      setLocationData(data);
    } catch (error: unknown) {
      console.error('Error fetching location data:', error);
      toast.error('Failed to load location assignment data');
    }
  };

  const handleOpenLocationAssignment = async () => {
    setShowLocationAssignment(true);
    setSelectedAssignments({});
    await fetchLocationData();
  };

  const handleAssignLocations = async () => {
    if (Object.keys(selectedAssignments).length === 0) {
      toast.error('No locations selected');
      return;
    }

    try {
      setAssigningLocations(true);
      const assignments = Object.entries(selectedAssignments).map(([itemId, roomId]) => ({
        itemId,
        roomId
      }));

      const response = await fetch(`/api/projects/${projectSlug}/mep/assign-locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Assignment failed');
      }

      const result = await response.json();
      toast.success(`Updated locations for ${result.updated} items`);
      
      // Refresh data
      await fetchMEPData();
      await fetchLocationData();
      setSelectedAssignments({});
    } catch (error: unknown) {
      console.error('Error assigning locations:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign locations');
    } finally {
      setAssigningLocations(false);
    }
  };

  const handleAutoAssignLocations = async () => {
    try {
      setAssigningLocations(true);
      toast.loading('Auto-assigning MEP items to rooms...', { id: 'auto-assign' });

      const response = await fetch(`/api/projects/${projectSlug}/mep/assign-locations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Auto-assignment failed');
      }

      const result = await response.json();
      toast.dismiss('auto-assign');
      toast.success(result.message || `Auto-assigned ${result.updated} items`);
      
      // Refresh data
      await fetchMEPData();
      await fetchLocationData();
    } catch (error: unknown) {
      toast.dismiss('auto-assign');
      console.error('Error auto-assigning locations:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to auto-assign locations');
    } finally {
      setAssigningLocations(false);
    }
  };

  const toggleTrade = (trade: string) => {
    const newExpanded = new Set(expandedTrades);
    if (newExpanded.has(trade)) {
      newExpanded.delete(trade);
    } else {
      newExpanded.add(trade);
    }
    setExpandedTrades(newExpanded);
  };

  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const getFilteredEquipment = (): MEPEquipment[] => {
    return equipment.filter((eq) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          eq.tag.toLowerCase().includes(query) ||
          eq.name.toLowerCase().includes(query) ||
          eq.type.toLowerCase().includes(query) ||
          eq.location?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Trade filter (already applied via API, but double-check)
      if (selectedTrade !== 'all' && eq.trade !== selectedTrade) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && eq.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  };

  const groupByTrade = (): Record<string, MEPEquipment[]> => {
    const filtered = getFilteredEquipment();
    const grouped: Record<string, MEPEquipment[]> = {
      hvac: [],
      electrical: [],
      plumbing: [],
      fire_alarm: []
    };

    filtered.forEach((eq) => {
      if (grouped[eq.trade]) {
        grouped[eq.trade].push(eq);
      }
    });

    return grouped;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'installed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-400" />;
      case 'ordered':
        return <Package className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-400" />;
    }
  };

  // Format item names nicely (e.g., "water_closet" -> "Water Closet")
  const formatItemName = (name: string): string => {
    if (!name) return 'Unknown Item';
    return name
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      installed: { color: 'bg-green-500/20 text-green-400 border-green-700', label: 'Installed' },
      pending: { color: 'bg-orange-500/20 text-orange-400 border-orange-700', label: 'Pending' },
      ordered: { color: 'bg-blue-500/20 text-blue-400 border-blue-700', label: 'Ordered' }
    };

    const variant = variants[status] || variants.pending;
    return (
      <Badge variant="outline" className={`text-xs ${variant.color}`}>
        {variant.label}
      </Badge>
    );
  };

  const exportToCSV = () => {
    const filtered = getFilteredEquipment();
    
    // CSV Header
    const header = [
      'Trade',
      'Tag',
      'Name',
      'Type',
      'Status',
      'Location',
      'Sheet Reference',
      'Specifications',
      'Notes'
    ].join(',');

    // CSV Rows
    const rows = filtered.map(eq => [
      eq.trade,
      eq.tag,
      `"${eq.name}"`,
      `"${eq.type}"`,
      eq.status,
      eq.location || '',
      eq.sheetReference || '',
      `"${Object.entries(eq.specifications).map(([k, v]) => `${k}: ${v}`).join('; ')}"`,
      `"${eq.notes.join('; ')}"`
    ].join(','));

    const csv = [header, ...rows].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MEP_Equipment_${projectSlug}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success('Exported to CSV');
  };

  const grouped = groupByTrade();
  const filteredEquipment = getFilteredEquipment();

  return (
    <div className="flex h-full max-h-[80vh] flex-col bg-dark-surface text-[#F8FAFC] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">MEP Equipment Browser</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExtractMEP}
            disabled={extracting}
            className="border-blue-600 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
          >
            {extracting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {extracting ? 'Extracting...' : 'Extract MEP'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={filteredEquipment.length === 0}
            className="border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenLocationAssignment}
            className="border-green-600 text-green-400 hover:bg-green-500/20 hover:text-green-300"
          >
            <MapPinned className="mr-2 h-4 w-4" />
            Assign Locations
          </Button>
          {onClose && (
            <WithTooltip tooltip="Close panel">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </WithTooltip>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="border-b border-gray-700 p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">{stats.total}</div>
              <div className="text-xs text-gray-400">Total Equipment</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{stats.installed}</div>
              <div className="text-xs text-gray-400">Installed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{stats.pending}</div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{stats.conflicts}</div>
              <div className="text-xs text-gray-400">Conflicts</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3 border-b border-gray-700 p-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search equipment tags, types, locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-dark-card border-gray-600 pl-10 text-[#F8FAFC] placeholder:text-gray-500"
          />
        </div>

        {/* Trade & Status Filters */}
        <div className="flex gap-2">
          <Select value={selectedTrade} onValueChange={setSelectedTrade}>
            <SelectTrigger className="flex-1 bg-dark-card border-gray-600 text-[#F8FAFC]">
              <SelectValue placeholder="All Trades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trades</SelectItem>
              <SelectItem value="hvac">HVAC</SelectItem>
              <SelectItem value="electrical">Electrical</SelectItem>
              <SelectItem value="plumbing">Plumbing</SelectItem>
              <SelectItem value="fire_alarm">Fire Protection</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="flex-1 bg-dark-card border-gray-600 text-[#F8FAFC]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="installed">Installed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conflicts Toggle */}
        {conflicts.length > 0 && (
          <Button
            variant={showConflicts ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowConflicts(!showConflicts)}
            className={showConflicts ? 'bg-red-500 hover:bg-red-600' : 'border-red-700 text-red-400 hover:bg-red-500/20'}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            {showConflicts ? 'Hide' : 'Show'} Conflicts ({conflicts.length})
          </Button>
        )}

        {/* Clear Filters */}
        {(searchQuery || selectedTrade !== 'all' || selectedStatus !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedTrade('all');
              setSelectedStatus('all');
            }}
            className="w-full text-orange-500 hover:text-orange-400 hover:bg-dark-card"
          >
            <X className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
              <p className="text-sm text-gray-400">Loading MEP equipment...</p>
            </div>
          </div>
        ) : showConflicts ? (
          // Conflicts View
          <div className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">MEP Coordination Conflicts</h3>
            {conflicts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
                <p className="text-sm text-gray-400">No conflicts detected</p>
              </div>
            ) : (
              conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="rounded-lg border border-red-700 bg-dark-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-1 h-5 w-5 text-red-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-[#F8FAFC]">{conflict.description}</h4>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            conflict.severity === 'high'
                              ? 'bg-red-500/20 text-red-400 border-red-700'
                              : conflict.severity === 'medium'
                              ? 'bg-orange-500/20 text-orange-400 border-orange-700'
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-700'
                          }`}
                        >
                          {conflict.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <MapPin className="h-3 w-3" />
                        <span>{conflict.location}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {conflict.affectedEquipment.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Wrench className="mx-auto mb-3 h-12 w-12 text-gray-600" />
              <p className="text-sm text-gray-400">
                {searchQuery || selectedTrade !== 'all' || selectedStatus !== 'all'
                  ? 'No equipment matches your filters'
                  : 'No MEP equipment found'}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {searchQuery || selectedTrade !== 'all' || selectedStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Click the button below to extract MEP data from project documents'}
              </p>
              {!(searchQuery || selectedTrade !== 'all' || selectedStatus !== 'all') && (
                <Button
                  onClick={handleExtractMEP}
                  disabled={extracting}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {extracting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {extracting ? 'Extracting MEP Data...' : 'Extract MEP Data'}
                </Button>
              )}
            </div>
          </div>
        ) : (
          // Equipment by Trade
          <div className="p-4 space-y-2">
            {Object.entries(grouped).map(([trade, eqList]) => {
              if (eqList.length === 0) return null;

              const config = tradeConfig[trade as keyof typeof tradeConfig];
              const TradeIcon = config.icon;

              return (
                <div key={trade}>
                  {/* Trade Header */}
                  <button
                    onClick={() => toggleTrade(trade)}
                    className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-left hover:bg-[#383e47] transition-colors"
                  >
                    {expandedTrades.has(trade) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    <TradeIcon className={`h-5 w-5 ${config.color}`} />
                    <span className="font-medium text-[#F8FAFC]">{config.label}</span>
                    <span className="text-xs text-gray-400">({eqList.length})</span>
                    <div className="ml-auto text-xs text-gray-500">{config.description}</div>
                  </button>

                  {/* Equipment List */}
                  {expandedTrades.has(trade) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {eqList.map((eq) => {
                        const isExpanded = expandedItems.has(eq.id);
                        const hasRoomData = eq.roomBreakdown && eq.roomBreakdown.length > 0;
                        
                        return (
                          <div
                            key={eq.id}
                            className="rounded-lg border border-gray-700 bg-dark-surface text-sm transition-all overflow-hidden"
                          >
                            {/* Collapsible Header */}
                            <button
                              onClick={() => toggleItem(eq.id)}
                              className="flex w-full items-start gap-3 p-3 hover:bg-dark-card transition-colors text-left"
                            >
                              {/* Expand/Collapse Icon */}
                              <div className="mt-1 flex-shrink-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                              
                              {/* Status Icon */}
                              <div className="mt-1 flex-shrink-0">
                                {getStatusIcon(eq.status)}
                              </div>

                              {/* Equipment Summary */}
                              <div className="flex-1 min-w-0">
                                {/* Header Row - Name prominently displayed */}
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-[#F8FAFC]">
                                    {formatItemName(eq.name)}
                                  </h4>
                                  {getStatusBadge(eq.status)}
                                </div>

                                {/* Summary Stats */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {eq.specifications?.quantity && (
                                    <Badge variant="outline" className="text-xs text-blue-400 border-blue-700">
                                      Qty: {eq.specifications.quantity} {eq.specifications.unit || 'EA'}
                                    </Badge>
                                  )}
                                  {eq.specifications?.totalCost && (
                                    <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-700">
                                      ${Number(eq.specifications.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Badge>
                                  )}
                                  {hasRoomData && (
                                    <Badge variant="outline" className="text-xs text-purple-400 border-purple-700">
                                      {eq.roomBreakdown!.length} location{eq.roomBreakdown!.length > 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                              <div className="border-t border-gray-700 bg-[#161b22] p-4">
                                {/* Tag and Type */}
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-xs font-mono text-gray-500">{eq.tag}</span>
                                  {eq.type && eq.type !== eq.trade && (
                                    <span className="text-xs text-gray-400">• {eq.type}</span>
                                  )}
                                </div>

                                {/* Detailed Specifications */}
                                {eq.specifications && (
                                  <div className="flex flex-wrap items-center gap-2 mb-3">
                                    {eq.specifications.unitCost && (
                                      <Badge variant="outline" className="text-xs text-green-400 border-green-700">
                                        Unit: ${Number(eq.specifications.unitCost).toFixed(2)}
                                      </Badge>
                                    )}
                                    {eq.specifications.confidence && (
                                      <Badge variant="outline" className={`text-xs ${
                                        Number(eq.specifications.confidence) >= 0.8 
                                          ? 'text-green-400 border-green-700' 
                                          : Number(eq.specifications.confidence) >= 0.6 
                                            ? 'text-yellow-400 border-yellow-700'
                                            : 'text-orange-400 border-orange-700'
                                      }`}>
                                        {(Number(eq.specifications.confidence) * 100).toFixed(0)}% confidence
                                      </Badge>
                                    )}
                                  </div>
                                )}

                                {/* Location & Sheet */}
                                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-3">
                                  {eq.location && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      <span>{eq.location}</span>
                                    </div>
                                  )}
                                  {eq.sheetReference && (
                                    <div className="flex items-center gap-1">
                                      <FileText className="h-3 w-3" />
                                      <span>{eq.sheetReference}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Room Breakdown */}
                                {hasRoomData && (
                                  <div className="mt-3 border-t border-gray-700 pt-3">
                                    <h5 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      Quantity by Location
                                    </h5>
                                    <div className="grid gap-1">
                                      {eq.roomBreakdown!.map((rb, idx) => (
                                        <div 
                                          key={idx}
                                          className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-dark-surface"
                                        >
                                          <span className="text-gray-300">
                                            {rb.room}
                                            {rb.level && <span className="text-gray-500 ml-1">({rb.level})</span>}
                                          </span>
                                          <Badge variant="outline" className="text-xs text-blue-400 border-blue-700">
                                            {rb.quantity} {eq.specifications?.unit || 'EA'}
                                          </Badge>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Notes */}
                                {eq.notes && eq.notes.length > 0 && (
                                  <div className="mt-3 border-t border-gray-700 pt-3">
                                    <h5 className="text-xs font-semibold text-gray-400 mb-2">Notes</h5>
                                    {eq.notes.map((note, idx) => (
                                      <p key={idx} className="text-xs text-gray-500 italic">
                                        • {note}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Location Assignment Dialog */}
      <Dialog open={showLocationAssignment} onOpenChange={setShowLocationAssignment}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden bg-dark-surface border-gray-700 text-[#F8FAFC]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-green-500" />
              Assign Room Locations to MEP Equipment
            </DialogTitle>
          </DialogHeader>
          
          {locationData ? (
            <div className="flex-1 overflow-hidden">
              {/* Stats */}
              <div className="flex gap-4 mb-4 p-3 bg-[#161b22] rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-500">{locationData.stats.total}</div>
                  <div className="text-xs text-gray-400">Total Items</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-500">{locationData.stats.withLocation}</div>
                  <div className="text-xs text-gray-400">With Location</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-500">{locationData.stats.withoutLocation}</div>
                  <div className="text-xs text-gray-400">Without Location</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-500">{Object.keys(selectedAssignments).length}</div>
                  <div className="text-xs text-gray-400">Selected</div>
                </div>
              </div>

              {/* Items List */}
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {locationData.items
                    .filter(item => !item.location)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-[#161b22] hover:bg-[#1c2128]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {item.category?.toLowerCase().includes('electric') && (
                              <Zap className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                            )}
                            {item.category?.toLowerCase().includes('plumb') && (
                              <Droplets className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                            )}
                            {item.category?.toLowerCase().includes('hvac') && (
                              <Wrench className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            )}
                            {(item.category?.toLowerCase().includes('fire') || item.category?.toLowerCase().includes('alarm')) && (
                              <Flame className="h-4 w-4 text-red-500 flex-shrink-0" />
                            )}
                            <span className="font-medium text-sm truncate">
                              {formatItemName(item.itemName || item.description || 'Unknown')}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.category ?? ''} • Qty: {String(item.quantity ?? '')} {item.unit ?? ''}
                          </div>
                        </div>
                        <Select
                          value={selectedAssignments[item.id] || ''}
                          onValueChange={(value) => {
                            setSelectedAssignments(prev => ({
                              ...prev,
                              [item.id]: value
                            }));
                          }}
                        >
                          <SelectTrigger className="w-48 bg-dark-base border-gray-600">
                            <SelectValue placeholder="Select room..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#161b22] border-gray-700">
                            {locationData.rooms.map((room) => (
                              <SelectItem key={room.id} value={room.id}>
                                {room.roomNumber ? `${room.roomNumber} - ` : ''}{room.name}
                                {room.floorNumber ? ` (Floor ${room.floorNumber})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  
                  {locationData.items.filter(item => !item.location).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>All MEP items have locations assigned!</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          )}

          <DialogFooter className="border-t border-gray-700 pt-4 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowLocationAssignment(false)}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAutoAssignLocations}
              disabled={assigningLocations || (locationData?.stats?.withoutLocation === 0)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {assigningLocations ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Auto-Assigning...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Auto-Assign All ({locationData?.stats?.withoutLocation || 0})
                </>
              )}
            </Button>
            <Button
              onClick={handleAssignLocations}
              disabled={Object.keys(selectedAssignments).length === 0 || assigningLocations}
              className="bg-green-600 hover:bg-green-700"
            >
              {assigningLocations ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <MapPinned className="mr-2 h-4 w-4" />
                  Assign Selected ({Object.keys(selectedAssignments).length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
