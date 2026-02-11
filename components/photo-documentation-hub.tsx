/**
 * Photo Documentation Hub
 * Unified photo management with linking to daily reports, punch items, RFIs, and rooms
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Camera,
  Upload,
  X,
  Search,
  Filter,
  Calendar,
  MapPin,
  Link2,
  Tag,
  FileText,
  ClipboardList,
  HelpCircle,
  Building2,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  Grid,
  List,
  Download,
  Trash2,
  Eye,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface Photo {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  location?: string;
  trade?: string;
  takenAt: string;
  uploadedAt: string;
  linkedTo: LinkedEntity[];
  aiDescription?: string;
  gpsCoords?: { lat: number; lng: number };
  roomNumber?: string;
}

interface LinkedEntity {
  type: 'daily_report' | 'punch_item' | 'rfi' | 'room';
  id: string;
  label: string;
  date?: string;
}

interface FilterState {
  search: string;
  dateRange: { start: string; end: string } | null;
  location: string;
  trade: string;
  linkedType: string;
  unlinkedOnly: boolean;
}

interface PhotoDocumentationHubProps {
  projectSlug: string;
}

export default function PhotoDocumentationHub({ projectSlug }: PhotoDocumentationHubProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    dateRange: null,
    location: '',
    trade: '',
    linkedType: '',
    unlinkedOnly: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Link targets
  const [dailyReports, setDailyReports] = useState<{ id: string; date: string }[]>([]);
  const [punchItems, setPunchItems] = useState<{ id: string; title: string }[]>([]);
  const [rfis, setRfis] = useState<{ id: string; number: string; subject: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; roomNumber: string; name: string }[]>([]);

  useEffect(() => {
    fetchPhotos();
    fetchLinkTargets();
  }, [projectSlug]);

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/photos/all`);
      if (!res.ok) throw new Error('Failed to fetch photos');
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast.error('Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkTargets = async () => {
    try {
      const [drRes, piRes, rfiRes, roomRes] = await Promise.all([
        fetch(`/api/projects/${projectSlug}/daily-reports?limit=50`),
        fetch(`/api/projects/${projectSlug}/punch-items?status=open`),
        fetch(`/api/projects/${projectSlug}/rfis?status=open`),
        fetch(`/api/projects/${projectSlug}/rooms`),
      ]);

      if (drRes.ok) {
        const drData = await drRes.json();
        setDailyReports(drData.reports?.map((r: any) => ({ id: r.id, date: r.reportDate })) || []);
      }
      if (piRes.ok) {
        const piData = await piRes.json();
        setPunchItems(piData.items?.map((i: any) => ({ id: i.id, title: i.title })) || []);
      }
      if (rfiRes.ok) {
        const rfiData = await rfiRes.json();
        setRfis(rfiData.rfis?.map((r: any) => ({ id: r.id, number: r.rfiNumber, subject: r.subject })) || []);
      }
      if (roomRes.ok) {
        const roomData = await roomRes.json();
        setRooms(roomData.rooms?.map((r: any) => ({ id: r.id, roomNumber: r.roomNumber, name: r.roomName })) || []);
      }
    } catch (error) {
      console.error('Error fetching link targets:', error);
    }
  };

  const handleLinkPhotos = async (entityType: string, entityId: string) => {
    if (selectedPhotos.size === 0) return;

    try {
      const res = await fetch(`/api/projects/${projectSlug}/photos/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: Array.from(selectedPhotos),
          entityType,
          entityId,
        }),
      });

      if (!res.ok) throw new Error('Failed to link photos');
      
      toast.success(`Linked ${selectedPhotos.size} photo(s) successfully`);
      setSelectedPhotos(new Set());
      setShowLinkModal(false);
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to link photos');
    }
  };

  const handleUnlinkPhoto = async (photoId: string, entityType: string, entityId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/photos/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, entityType, entityId }),
      });

      if (!res.ok) throw new Error('Failed to unlink photo');
      
      toast.success('Photo unlinked');
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to unlink photo');
    }
  };

  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const locations = new Set<string>();
    const trades = new Set<string>();
    photos.forEach(p => {
      if (p.location) locations.add(p.location);
      if (p.trade) trades.add(p.trade);
    });
    return {
      locations: Array.from(locations).sort(),
      trades: Array.from(trades).sort(),
    };
  }, [photos]);

  // Filter photos
  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => {
      // Search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matches =
          photo.caption?.toLowerCase().includes(searchLower) ||
          photo.location?.toLowerCase().includes(searchLower) ||
          photo.trade?.toLowerCase().includes(searchLower) ||
          photo.aiDescription?.toLowerCase().includes(searchLower) ||
          photo.roomNumber?.toLowerCase().includes(searchLower);
        if (!matches) return false;
      }

      // Location
      if (filters.location && photo.location !== filters.location) return false;

      // Trade
      if (filters.trade && photo.trade !== filters.trade) return false;

      // Linked type
      if (filters.linkedType) {
        const hasType = photo.linkedTo.some(l => l.type === filters.linkedType);
        if (!hasType) return false;
      }

      // Unlinked only
      if (filters.unlinkedOnly && photo.linkedTo.length > 0) return false;

      return true;
    });
  }, [photos, filters]);

  // Group by date for timeline view
  const photosByDate = useMemo(() => {
    const groups: Record<string, Photo[]> = {};
    filteredPhotos.forEach(photo => {
      const date = format(new Date(photo.takenAt || photo.uploadedAt), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(photo);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredPhotos]);

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPhotos(new Set(filteredPhotos.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedPhotos(new Set());
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'daily_report': return <FileText className="w-3 h-3" />;
      case 'punch_item': return <ClipboardList className="w-3 h-3" />;
      case 'rfi': return <HelpCircle className="w-3 h-3" />;
      case 'room': return <Building2 className="w-3 h-3" />;
      default: return <Link2 className="w-3 h-3" />;
    }
  };

  const getEntityColor = (type: string) => {
    switch (type) {
      case 'daily_report': return 'bg-cyan-600/30 text-cyan-400 border-cyan-600/50';
      case 'punch_item': return 'bg-orange-600/30 text-orange-400 border-orange-600/50';
      case 'rfi': return 'bg-purple-600/30 text-purple-400 border-purple-600/50';
      case 'room': return 'bg-blue-600/30 text-blue-400 border-blue-600/50';
      default: return 'bg-slate-600/30 text-slate-400 border-slate-600/50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-gray-400">Loading photos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Camera className="w-7 h-7 text-blue-400" />
            Photo Documentation
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {photos.length} photos • {photos.filter(p => p.linkedTo.length === 0).length} unlinked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Upload className="w-4 h-4" />
            Upload Photos
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by caption, location, trade..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-2 rounded ${viewMode === 'timeline' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters
                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                : 'bg-slate-800 border-slate-600 text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Location</label>
              <select
                value={filters.location}
                onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
              >
                <option value="">All Locations</option>
                {filterOptions.locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Trade</label>
              <select
                value={filters.trade}
                onChange={e => setFilters(f => ({ ...f, trade: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
              >
                <option value="">All Trades</option>
                {filterOptions.trades.map(trade => (
                  <option key={trade} value={trade}>{trade}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Linked To</label>
              <select
                value={filters.linkedType}
                onChange={e => setFilters(f => ({ ...f, linkedType: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
              >
                <option value="">Any</option>
                <option value="daily_report">Daily Reports</option>
                <option value="punch_item">Punch Items</option>
                <option value="rfi">RFIs</option>
                <option value="room">Rooms</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.unlinkedOnly}
                  onChange={e => setFilters(f => ({ ...f, unlinkedOnly: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600"
                />
                <span className="text-gray-300">Unlinked only</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Selection Actions */}
      {selectedPhotos.size > 0 && (
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4 flex items-center justify-between">
          <span className="text-blue-400">
            {selectedPhotos.size} photo{selectedPhotos.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLinkModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <Link2 className="w-4 h-4" />
              Link to...
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Photo Grid/Timeline */}
      {filteredPhotos.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No photos found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or upload new photos</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredPhotos.map(photo => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              selected={selectedPhotos.has(photo.id)}
              onSelect={() => togglePhotoSelection(photo.id)}
              onPreview={() => setPreviewPhoto(photo)}
              getEntityIcon={getEntityIcon}
              getEntityColor={getEntityColor}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {photosByDate.map(([date, datePhotos]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-400" />
                <h3 className="text-white font-medium">
                  {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                </h3>
                <span className="text-gray-400 text-sm">({datePhotos.length} photos)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {datePhotos.map(photo => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    selected={selectedPhotos.has(photo.id)}
                    onSelect={() => togglePhotoSelection(photo.id)}
                    onPreview={() => setPreviewPhoto(photo)}
                    getEntityIcon={getEntityIcon}
                    getEntityColor={getEntityColor}
                    compact
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <LinkPhotosModal
          selectedCount={selectedPhotos.size}
          dailyReports={dailyReports}
          punchItems={punchItems}
          rfis={rfis}
          rooms={rooms}
          onLink={handleLinkPhotos}
          onClose={() => setShowLinkModal(false)}
        />
      )}

      {/* Preview Modal */}
      {previewPhoto && (
        <PhotoPreviewModal
          photo={previewPhoto}
          onClose={() => setPreviewPhoto(null)}
          onUnlink={handleUnlinkPhoto}
          getEntityIcon={getEntityIcon}
          getEntityColor={getEntityColor}
        />
      )}
    </div>
  );
}

// Photo Card Component
function PhotoCard({
  photo,
  selected,
  onSelect,
  onPreview,
  getEntityIcon,
  getEntityColor,
  compact = false,
}: {
  photo: Photo;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  getEntityIcon: (type: string) => React.ReactNode;
  getEntityColor: (type: string) => string;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-slate-700 hover:border-slate-600'
      }`}
    >
      <div
        className={`relative ${compact ? 'aspect-square' : 'aspect-[4/3]'} bg-slate-800`}
        onClick={onPreview}
      >
        <Image
          src={photo.thumbnailUrl || photo.url}
          alt={photo.caption || 'Project photo'}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Eye className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Selection Checkbox */}
      <button
        onClick={e => {
          e.stopPropagation();
          onSelect();
        }}
        className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
          selected
            ? 'bg-blue-600 text-white'
            : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'
        }`}
      >
        {selected && <CheckCircle className="w-4 h-4" />}
      </button>

      {/* Linked Indicators */}
      {photo.linkedTo.length > 0 && (
        <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end max-w-[60%]">
          {photo.linkedTo.slice(0, 3).map((link, i) => (
            <span
              key={i}
              className={`px-1.5 py-0.5 rounded text-xs flex items-center gap-1 border ${getEntityColor(link.type)}`}
            >
              {getEntityIcon(link.type)}
            </span>
          ))}
          {photo.linkedTo.length > 3 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-gray-300">
              +{photo.linkedTo.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Info Bar */}
      {!compact && (
        <div className="p-2 bg-slate-900">
          <p className="text-white text-sm truncate">
            {photo.caption || photo.location || 'No caption'}
          </p>
          <p className="text-gray-400 text-xs">
            {formatDistanceToNow(new Date(photo.takenAt || photo.uploadedAt), { addSuffix: true })}
          </p>
        </div>
      )}
    </div>
  );
}

// Link Modal Component
function LinkPhotosModal({
  selectedCount,
  dailyReports,
  punchItems,
  rfis,
  rooms,
  onLink,
  onClose,
}: {
  selectedCount: number;
  dailyReports: { id: string; date: string }[];
  punchItems: { id: string; title: string }[];
  rfis: { id: string; number: string; subject: string }[];
  rooms: { id: string; roomNumber: string; name: string }[];
  onLink: (type: string, id: string) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'daily_report' | 'punch_item' | 'rfi' | 'room'>('daily_report');

  const tabs = [
    { key: 'daily_report', label: 'Daily Reports', icon: FileText, count: dailyReports.length },
    { key: 'punch_item', label: 'Punch Items', icon: ClipboardList, count: punchItems.length },
    { key: 'rfi', label: 'RFIs', icon: HelpCircle, count: rfis.length },
    { key: 'room', label: 'Rooms', icon: Building2, count: rooms.length },
  ];

  const linkContainerRef = useFocusTrap({ isActive: true, onEscape: onClose });

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
    >
      <div
        ref={linkContainerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-link-dialog-title"
        className="bg-slate-900 border-2 border-slate-600 rounded-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
      >
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h3 id="photo-link-dialog-title" className="text-lg font-semibold text-white">Link Photos</h3>
            <p className="text-gray-400 text-sm">Link {selectedCount} photo(s) to:</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 px-3 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === tab.key
                  ? 'text-blue-400 border-b-2 border-blue-400 -mb-[2px]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="text-xs bg-slate-700 px-1.5 rounded">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'daily_report' && (
            <div className="space-y-2">
              {dailyReports.map(dr => (
                <button
                  key={dr.id}
                  onClick={() => onLink('daily_report', dr.id)}
                  className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left flex items-center gap-3"
                >
                  <FileText className="w-5 h-5 text-cyan-400" />
                  <span className="text-white">{format(new Date(dr.date), 'MMM d, yyyy')}</span>
                </button>
              ))}
            </div>
          )}
          {activeTab === 'punch_item' && (
            <div className="space-y-2">
              {punchItems.map(pi => (
                <button
                  key={pi.id}
                  onClick={() => onLink('punch_item', pi.id)}
                  className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left flex items-center gap-3"
                >
                  <ClipboardList className="w-5 h-5 text-orange-400" />
                  <span className="text-white truncate">{pi.title}</span>
                </button>
              ))}
            </div>
          )}
          {activeTab === 'rfi' && (
            <div className="space-y-2">
              {rfis.map(rfi => (
                <button
                  key={rfi.id}
                  onClick={() => onLink('rfi', rfi.id)}
                  className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left flex items-center gap-3"
                >
                  <HelpCircle className="w-5 h-5 text-purple-400" />
                  <div>
                    <span className="text-white">RFI #{rfi.number}</span>
                    <p className="text-gray-400 text-sm truncate">{rfi.subject}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {activeTab === 'room' && (
            <div className="space-y-2">
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => onLink('room', room.id)}
                  className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left flex items-center gap-3"
                >
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <div>
                    <span className="text-white">Room {room.roomNumber}</span>
                    {room.name && <p className="text-gray-400 text-sm">{room.name}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Preview Modal Component
function PhotoPreviewModal({
  photo,
  onClose,
  onUnlink,
  getEntityIcon,
  getEntityColor,
}: {
  photo: Photo;
  onClose: () => void;
  onUnlink: (photoId: string, entityType: string, entityId: string) => void;
  getEntityIcon: (type: string) => React.ReactNode;
  getEntityColor: (type: string) => string;
}) {
  const previewContainerRef = useFocusTrap({ isActive: true, onEscape: onClose });

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
    >
      <div
        ref={previewContainerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-preview-dialog-title"
        className="relative max-w-4xl w-full mx-4"
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300"
          aria-label="Close preview"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="bg-slate-900 rounded-xl overflow-hidden">
          <div className="relative aspect-video bg-black">
            <Image
              src={photo.url}
              alt={photo.caption || 'Photo'}
              fill
              className="object-contain"
            />
          </div>

          <div className="p-4 space-y-3">
            {photo.caption && (
              <p id="photo-preview-dialog-title" className="text-white text-lg">{photo.caption}</p>
            )}
            {!photo.caption && (
              <p id="photo-preview-dialog-title" className="text-white text-lg">Photo Preview</p>
            )}
            {photo.aiDescription && (
              <p className="text-gray-400 text-sm italic">
                AI: {photo.aiDescription}
              </p>
            )}

            <div className="flex flex-wrap gap-2 text-sm">
              {photo.location && (
                <span className="flex items-center gap-1 text-gray-400">
                  <MapPin className="w-4 h-4" /> {photo.location}
                </span>
              )}
              {photo.trade && (
                <span className="flex items-center gap-1 text-gray-400">
                  <Tag className="w-4 h-4" /> {photo.trade}
                </span>
              )}
              <span className="flex items-center gap-1 text-gray-400">
                <Calendar className="w-4 h-4" />
                {format(new Date(photo.takenAt || photo.uploadedAt), 'MMM d, yyyy h:mm a')}
              </span>
            </div>

            {/* Linked Items */}
            {photo.linkedTo.length > 0 && (
              <div className="pt-3 border-t border-slate-700">
                <p className="text-gray-400 text-sm mb-2">Linked to:</p>
                <div className="flex flex-wrap gap-2">
                  {photo.linkedTo.map((link, i) => (
                    <span
                      key={i}
                      className={`px-3 py-1 rounded-lg text-sm flex items-center gap-2 border ${getEntityColor(link.type)}`}
                    >
                      {getEntityIcon(link.type)}
                      {link.label}
                      <button
                        onClick={() => onUnlink(photo.id, link.type, link.id)}
                        className="ml-1 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
