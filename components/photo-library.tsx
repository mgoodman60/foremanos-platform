'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { X, Download, Search, Filter, Calendar, MapPin, Briefcase, CheckSquare, Square, Package, Tag, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { getFileUrl } from '@/lib/s3';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface Photo {
  id: string;
  cloud_storage_path: string;
  caption?: string;
  location?: string;
  trade?: string;
  aiDescription?: string;
  aiConfidence?: number;
  uploadedAt: string;
  conversationId: string;
  conversationDate?: string;
}

interface PhotoLibraryProps {
  projectSlug: string;
  onClose: () => void;
  startInUploadMode?: boolean;
}

export function PhotoLibrary({ projectSlug, onClose, startInUploadMode = false }: PhotoLibraryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'location'>('date-desc');
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showBulkCaptionDialog, setShowBulkCaptionDialog] = useState(false);
  const [bulkTrade, setBulkTrade] = useState('');
  const [bulkLocation, setBulkLocation] = useState('');
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Fetch all photos for the project
  useEffect(() => {
    fetchPhotos();
  }, [projectSlug]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectSlug}/photos`);
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

  // Extract unique locations and trades
  const locations = useMemo(() => {
    const locs = new Set<string>();
    photos.forEach(p => {
      if (p.location) locs.add(p.location);
    });
    return Array.from(locs).sort();
  }, [photos]);

  const trades = useMemo(() => {
    const tr = new Set<string>();
    photos.forEach(p => {
      if (p.trade) tr.add(p.trade);
    });
    return Array.from(tr).sort();
  }, [photos]);

  // Filter and sort photos
  const filteredPhotos = useMemo(() => {
    let filtered = photos;

    // Search filter (caption, AI description, location)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        const caption = (p.caption || '').toLowerCase();
        const aiDesc = (p.aiDescription || '').toLowerCase();
        const location = (p.location || '').toLowerCase();
        return caption.includes(query) || aiDesc.includes(query) || location.includes(query);
      });
    }

    // Location filter
    if (selectedLocation !== 'all') {
      filtered = filtered.filter(p => p.location === selectedLocation);
    }

    // Trade filter
    if (selectedTrade !== 'all') {
      filtered = filtered.filter(p => p.trade === selectedTrade);
    }

    // Sort
    if (sortBy === 'date-desc') {
      filtered.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    } else if (sortBy === 'date-asc') {
      filtered.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    } else if (sortBy === 'location') {
      filtered.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
    }

    return filtered;
  }, [photos, searchQuery, selectedLocation, selectedTrade, sortBy]);

  // Toggle photo selection
  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  // Select/deselect all visible photos
  const toggleSelectAll = () => {
    if (selectedPhotos.size === filteredPhotos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(filteredPhotos.map(p => p.id)));
    }
  };

  // Download selected photos as ZIP
  const downloadSelectedPhotos = async () => {
    if (selectedPhotos.size === 0) {
      toast.error('Please select at least one photo');
      return;
    }

    try {
      setDownloading(true);
      toast.info(`Preparing ${selectedPhotos.size} photos for download...`);

      const zip = new JSZip();
      const selectedPhotoData = photos.filter(p => selectedPhotos.has(p.id));

      // Fetch and add each photo to ZIP
      for (let i = 0; i < selectedPhotoData.length; i++) {
        const photo = selectedPhotoData[i];
        try {
          // Get signed URL
          const url = await getFileUrl(photo.cloud_storage_path, false);
          
          // Fetch image data
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch photo ${photo.id}`);
          const blob = await response.blob();
          
          // Generate filename
          const date = photo.conversationDate || new Date(photo.uploadedAt).toISOString().split('T')[0];
          const location = photo.location ? `_${photo.location.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
          const extension = photo.cloud_storage_path.split('.').pop() || 'jpg';
          const filename = `${date}${location}_${i + 1}.${extension}`;
          
          // Add to ZIP
          zip.file(filename, blob);
        } catch (error) {
          console.error(`Error adding photo ${photo.id} to ZIP:`, error);
        }
      }

      // Generate and download ZIP
      toast.info('Generating ZIP file...');
      const content = await zip.generateAsync({ type: 'blob' });
      const zipFilename = `${projectSlug}_photos_${new Date().toISOString().split('T')[0]}.zip`;
      saveAs(content, zipFilename);
      
      toast.success(`Downloaded ${selectedPhotos.size} photos`);
      setSelectedPhotos(new Set());
    } catch (error) {
      console.error('Error downloading photos:', error);
      toast.error('Failed to download photos');
    } finally {
      setDownloading(false);
    }
  };

  // Bulk tag photos
  const handleBulkTag = async () => {
    if (selectedPhotos.size === 0) {
      toast.error('Please select at least one photo');
      return;
    }

    if (!bulkTrade && !bulkLocation) {
      toast.error('Please enter at least a trade or location');
      return;
    }

    try {
      setBulkProcessing(true);
      const photoIds = Array.from(selectedPhotos);

      const res = await fetch(`/api/projects/${projectSlug}/photos/bulk-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds,
          trade: bulkTrade || undefined,
          location: bulkLocation || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to tag photos');

      toast.success(`Tagged ${selectedPhotos.size} photos`);
      setShowBulkTagDialog(false);
      setBulkTrade('');
      setBulkLocation('');
      setSelectedPhotos(new Set());
      fetchPhotos(); // Refresh
    } catch (error) {
      console.error('Error tagging photos:', error);
      toast.error('Failed to tag photos');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Bulk caption photos
  const handleBulkCaption = async () => {
    if (selectedPhotos.size === 0) {
      toast.error('Please select at least one photo');
      return;
    }

    if (!bulkCaption.trim()) {
      toast.error('Please enter a caption');
      return;
    }

    try {
      setBulkProcessing(true);
      const photoIds = Array.from(selectedPhotos);

      const res = await fetch(`/api/projects/${projectSlug}/photos/bulk-caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds,
          caption: bulkCaption,
        }),
      });

      if (!res.ok) throw new Error('Failed to caption photos');

      toast.success(`Captioned ${selectedPhotos.size} photos`);
      setShowBulkCaptionDialog(false);
      setBulkCaption('');
      setSelectedPhotos(new Set());
      fetchPhotos(); // Refresh
    } catch (error) {
      console.error('Error captioning photos:', error);
      toast.error('Failed to caption photos');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Bulk delete photos
  const handleBulkDelete = async () => {
    if (selectedPhotos.size === 0) {
      toast.error('Please select at least one photo');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedPhotos.size} photos? This action cannot be undone.`)) {
      return;
    }

    try {
      setBulkProcessing(true);
      const photoIds = Array.from(selectedPhotos);

      const res = await fetch(`/api/projects/${projectSlug}/photos/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds }),
      });

      if (!res.ok) throw new Error('Failed to delete photos');

      toast.success(`Deleted ${selectedPhotos.size} photos`);
      setSelectedPhotos(new Set());
      fetchPhotos(); // Refresh
    } catch (error) {
      console.error('Error deleting photos:', error);
      toast.error('Failed to delete photos');
    } finally {
      setBulkProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-surface border border-gray-700 rounded-lg w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-[#F8FAFC]">Photo Library</h2>
            <p className="text-sm text-gray-400 mt-1">
              {filteredPhotos.length} photo{filteredPhotos.length !== 1 ? 's' : ''}
              {selectedPhotos.size > 0 && ` · ${selectedPhotos.size} selected`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedPhotos.size > 0 && (
              <>
                <Button
                  onClick={() => setShowBulkTagDialog(true)}
                  disabled={bulkProcessing}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Tag
                </Button>
                <Button
                  onClick={() => setShowBulkCaptionDialog(true)}
                  disabled={bulkProcessing}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Caption
                </Button>
                <Button
                  onClick={handleBulkDelete}
                  disabled={bulkProcessing}
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <Button
                  onClick={downloadSelectedPhotos}
                  disabled={downloading}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloading ? 'Downloading...' : `Download ${selectedPhotos.size}`}
                </Button>
              </>
            )}
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white hover:bg-dark-card"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-700 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by caption, description, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-dark-card border-gray-600 text-[#F8FAFC] placeholder:text-gray-500"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-sm text-[#F8FAFC] hover:bg-[#3d434b] transition-colors"
            >
              <option value="date-desc">📅 Newest First</option>
              <option value="date-asc">📅 Oldest First</option>
              <option value="location">📍 By Location</option>
            </select>

            {/* Trade filter */}
            {trades.length > 0 && (
              <select
                value={selectedTrade}
                onChange={(e) => setSelectedTrade(e.target.value)}
                className="px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-sm text-[#F8FAFC] hover:bg-[#3d434b] transition-colors"
              >
                <option value="all">🔨 All Trades</option>
                {trades.map(trade => (
                  <option key={trade} value={trade}>{trade}</option>
                ))}
              </select>
            )}

            {/* Location filter */}
            {locations.length > 0 && (
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-sm text-[#F8FAFC] hover:bg-[#3d434b] transition-colors"
              >
                <option value="all">📍 All Locations</option>
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            )}

            {/* Select all */}
            {filteredPhotos.length > 0 && (
              <Button
                onClick={toggleSelectAll}
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white"
              >
                {selectedPhotos.size === filteredPhotos.length ? (
                  <CheckSquare className="h-4 w-4 mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                {selectedPhotos.size === filteredPhotos.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
        </div>

        {/* Photo Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Package className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No photos found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPhotos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  selected={selectedPhotos.has(photo.id)}
                  onToggleSelect={() => togglePhotoSelection(photo.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Tag Dialog */}
      {showBulkTagDialog && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-dark-surface border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-[#F8FAFC] mb-4">
              Tag {selectedPhotos.size} Photo{selectedPhotos.size !== 1 ? 's' : ''}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Trade
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Electrical, Plumbing"
                  value={bulkTrade}
                  onChange={(e) => setBulkTrade(e.target.value)}
                  className="bg-dark-card border-gray-600 text-[#F8FAFC]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Basement, 2nd Floor"
                  value={bulkLocation}
                  onChange={(e) => setBulkLocation(e.target.value)}
                  className="bg-dark-card border-gray-600 text-[#F8FAFC]"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  onClick={() => {
                    setShowBulkTagDialog(false);
                    setBulkTrade('');
                    setBulkLocation('');
                  }}
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkTag}
                  disabled={bulkProcessing}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {bulkProcessing ? 'Tagging...' : 'Apply Tags'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Caption Dialog */}
      {showBulkCaptionDialog && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-dark-surface border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-[#F8FAFC] mb-4">
              Caption {selectedPhotos.size} Photo{selectedPhotos.size !== 1 ? 's' : ''}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Caption
                </label>
                <Input
                  type="text"
                  placeholder="Enter caption for all selected photos"
                  value={bulkCaption}
                  onChange={(e) => setBulkCaption(e.target.value)}
                  className="bg-dark-card border-gray-600 text-[#F8FAFC]"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  onClick={() => {
                    setShowBulkCaptionDialog(false);
                    setBulkCaption('');
                  }}
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkCaption}
                  disabled={bulkProcessing}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {bulkProcessing ? 'Captioning...' : 'Apply Caption'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PhotoCardProps {
  photo: Photo;
  selected: boolean;
  onToggleSelect: () => void;
}

function PhotoCard({ photo, selected, onToggleSelect }: PhotoCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const url = await getFileUrl(photo.cloud_storage_path, false);
        setImageUrl(url);
      } catch (error) {
        console.error('Error loading image:', error);
      } finally {
        setLoading(false);
      }
    };
    loadImage();
  }, [photo.cloud_storage_path]);

  return (
    <Card
      className={`bg-dark-card border-2 transition-all cursor-pointer group ${
        selected ? 'border-orange-500 ring-2 ring-orange-500/50' : 'border-gray-700 hover:border-gray-600'
      }`}
      onClick={onToggleSelect}
    >
      {/* Image */}
      <div className="aspect-square relative bg-dark-surface rounded-t-lg overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : imageUrl ? (
          <Image
            src={imageUrl}
            alt={photo.caption || 'Photo'}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <p className="text-sm">Failed to load</p>
          </div>
        )}
        
        {/* Selection indicator */}
        <div className="absolute top-2 right-2">
          <div
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              selected
                ? 'bg-orange-500 border-orange-500'
                : 'bg-black/30 border-white/50 group-hover:bg-black/50'
            }`}
          >
            {selected && <CheckSquare className="h-4 w-4 text-white" />}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-3 space-y-2">
        {/* Date */}
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar className="h-3 w-3" />
          {new Date(photo.uploadedAt).toLocaleDateString()}
        </div>

        {/* Location */}
        {photo.location && (
          <div className="flex items-center gap-1 text-xs text-gray-300">
            <MapPin className="h-3 w-3" />
            {photo.location}
          </div>
        )}

        {/* Trade */}
        {photo.trade && (
          <div className="flex items-center gap-1 text-xs text-gray-300">
            <Briefcase className="h-3 w-3" />
            {photo.trade}
          </div>
        )}

        {/* Caption */}
        {photo.caption && (
          <p className="text-sm text-[#F8FAFC] line-clamp-2">{photo.caption}</p>
        )}

        {/* AI Description */}
        {photo.aiDescription && photo.aiConfidence && photo.aiConfidence >= 80 && (
          <p className="text-xs text-gray-400 italic line-clamp-2">
            AI: {photo.aiDescription}
          </p>
        )}
      </div>
    </Card>
  );
}
