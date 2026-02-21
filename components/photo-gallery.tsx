/**
 * Photo Gallery Component for Daily Report Chat
 * 
 * Displays uploaded photos in a responsive grid with lightbox view.
 * Shows captions, metadata, and allows downloading/deleting photos.
 */

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Download, Trash2, Camera, ZoomIn, MapPin, Briefcase, Calendar, Edit, Filter, ArrowUpDown, Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhotoMetadata } from '@/lib/photo-analyzer';
import { createScopedLogger } from '@/lib/logger';
import { toast } from 'sonner';
import { PhotoAnnotationModal } from './photo-annotation-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';

const log = createScopedLogger('PHOTO_GALLERY');

interface PhotoGalleryProps {
  conversationId: string;
  photos: PhotoMetadata[];
  onPhotoDeleted?: (photoId: string) => void;
  readOnly?: boolean;
}

export function PhotoGallery({
  conversationId,
  photos,
  onPhotoDeleted,
  readOnly = false,
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMetadata | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [_loading, setLoading] = useState(false);
  
  // Filtering state
  const [filterTrade, setFilterTrade] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [filteredPhotos, setFilteredPhotos] = useState<PhotoMetadata[]>(photos);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('date-desc');
  
  // Annotation modal state
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<PhotoMetadata | null>(null);

  // Analyze state
  const [analyzingPhotoId, setAnalyzingPhotoId] = useState<string | null>(null);
  const [localCaptions, setLocalCaptions] = useState<Record<string, string>>({});
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);

  // Fetch signed URLs for all photos
  useEffect(() => {
    if (photos.length === 0) return;

    const fetchPhotoUrls = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/photos-export`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch photo URLs');
        }

        const data = await response.json();
        const urls: Record<string, string> = {};
        
        data.photos?.forEach((photo: PhotoMetadata & { signedUrl: string }) => {
          if (photo.signedUrl) {
            urls[photo.id] = photo.signedUrl;
          }
        });

        setPhotoUrls(urls);
      } catch (error) {
        log.error('Failed to fetch photo URLs', error as Error);
        toast.error('Failed to load photos');
      } finally {
        setLoading(false);
      }
    };

    fetchPhotoUrls();
  }, [conversationId, photos.length]);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...photos];

    // Apply filters
    if (filterTrade !== 'all') {
      filtered = filtered.filter((p) => p.trade === filterTrade);
    }

    if (filterLocation !== 'all') {
      filtered = filtered.filter((p) => p.location === filterLocation);
    }

    if (filterDate !== 'all') {
      const targetDate = filterDate;
      filtered = filtered.filter((p) => {
        if (!p.uploadedAt) return false;
        const uploadedAtStr = typeof p.uploadedAt === 'string' ? p.uploadedAt : p.uploadedAt.toISOString();
        const photoDate = uploadedAtStr.split('T')[0];
        return photoDate === targetDate;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        case 'date-asc':
          return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        case 'location-asc':
          return (a.location || '').localeCompare(b.location || '');
        case 'location-desc':
          return (b.location || '').localeCompare(a.location || '');
        case 'trade-asc':
          return (a.trade || '').localeCompare(b.trade || '');
        case 'trade-desc':
          return (b.trade || '').localeCompare(a.trade || '');
        default:
          return 0;
      }
    });

    setFilteredPhotos(sorted);
  }, [photos, filterTrade, filterLocation, filterDate, sortBy]);

  // Get unique filter values
  const uniqueTrades = Array.from(new Set(photos.map((p) => p.trade).filter(Boolean)));
  const uniqueLocations = Array.from(new Set(photos.map((p) => p.location).filter(Boolean)));
  const uniqueDates = Array.from(new Set(photos.map((p) => {
    if (!p.uploadedAt) return '';
    const uploadedAtStr = typeof p.uploadedAt === 'string' ? p.uploadedAt : p.uploadedAt.toISOString();
    return uploadedAtStr.split('T')[0];
  }).filter(Boolean)));

  const handleAnalyze = async (e: React.MouseEvent, photo: PhotoMetadata) => {
    e.stopPropagation();
    setAnalyzingPhotoId(photo.id);
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/photos/${photo.id}/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'haiku' }),
        }
      );

      if (!response.ok) throw new Error('Failed to analyze photo');

      const data = await response.json();
      if (data.description) {
        setLocalCaptions((prev) => ({ ...prev, [photo.id]: data.description }));
        toast.success('Photo analyzed');
      }
    } catch (error) {
      log.error('Photo analysis failed', error as Error);
      toast.error('Failed to analyze photo');
    } finally {
      setAnalyzingPhotoId(null);
    }
  };

  const handleEdit = (photo: PhotoMetadata) => {
    setEditingPhoto(photo);
    setShowAnnotationModal(true);
  };

  const handleAnnotationSave = () => {
    // Refresh photo list after annotation update
    window.location.reload();
  };

  const handleDownload = async (photo: PhotoMetadata) => {
    const url = photoUrls[photo.id];
    if (!url) {
      toast.error('Photo URL not available');
      return;
    }

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = photo.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      
      toast.success('Photo downloaded');
    } catch (error) {
      log.error('Failed to download photo', error as Error);
      toast.error('Failed to download photo');
    }
  };

  const handleDelete = (photoId: string) => {
    setDeletePhotoId(photoId);
  };

  const doDeletePhoto = async () => {
    const photoId = deletePhotoId;
    setDeletePhotoId(null);
    if (!photoId) return;

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/photos/${photoId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }

      toast.success('Photo deleted');
      onPhotoDeleted?.(photoId);
      setSelectedPhoto(null);
    } catch (error) {
      log.error('Failed to delete photo', error as Error);
      toast.error('Failed to delete photo');
    }
  };

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Camera className="h-12 w-12 text-gray-400 mb-3" />
        <p className="text-gray-400 text-sm">No photos uploaded yet</p>
      </div>
    );
  }

  return (
    <>
      {/* Filters and Sorting */}
      {(uniqueTrades.length > 0 || uniqueLocations.length > 0 || uniqueDates.length > 1 || photos.length > 1) && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Filters & Sort</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {uniqueTrades.length > 0 && (
              <Select value={filterTrade} onValueChange={setFilterTrade}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="All trades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All trades</SelectItem>
                  {uniqueTrades.map((trade) => (
                    <SelectItem key={trade} value={trade}>
                      {trade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {uniqueLocations.length > 0 && (
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {uniqueLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {uniqueDates.length > 1 && (
              <Select value={filterDate} onValueChange={setFilterDate}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="All dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates</SelectItem>
                  {uniqueDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {new Date(date).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="text-sm">
                <div className="flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest first</SelectItem>
                <SelectItem value="date-asc">Oldest first</SelectItem>
                <SelectItem value="location-asc">Location (A-Z)</SelectItem>
                <SelectItem value="location-desc">Location (Z-A)</SelectItem>
                <SelectItem value="trade-asc">Trade (A-Z)</SelectItem>
                <SelectItem value="trade-desc">Trade (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      
      {/* Results count */}
      {filteredPhotos.length !== photos.length && (
        <div className="mb-2 text-sm text-gray-600">
          Showing {filteredPhotos.length} of {photos.length} photos
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredPhotos.map((photo) => {
          const url = photoUrls[photo.id];
          return (
            <div
              key={photo.id}
              className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:ring-2 hover:ring-orange-500 transition-all touch-manipulation"
              onClick={() => setSelectedPhoto(photo)}
            >
              {url ? (
                <Image
                  src={url}
                  alt={photo.caption || 'Construction photo'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Camera className="h-8 w-8 text-gray-400" />
                </div>
              )}
              
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Caption badge */}
              {photo.captionSource === 'auto' && (
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="text-xs bg-blue-500 text-white">
                    AI
                  </Badge>
                </div>
              )}

              {/* Analyze button */}
              {!readOnly && (
                <button
                  className="absolute top-2 right-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-3 sm:p-1.5 rounded-md bg-black/50 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/70 disabled:opacity-50 touch-manipulation"
                  onClick={(e) => handleAnalyze(e, photo)}
                  disabled={analyzingPhotoId === photo.id}
                  aria-label={`Analyze photo ${photo.fileName}`}
                  title="Analyze with AI"
                >
                  {analyzingPhotoId === photo.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                </button>
              )}

              {/* AI caption preview */}
              {localCaptions[photo.id] && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                  <p className="text-xs text-white truncate">
                    {localCaptions[photo.id]}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedPhoto && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="text-lg font-semibold">
                    {selectedPhoto.fileName}
                  </span>
                  <div className="flex gap-2">
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedPhoto(null);
                          handleEdit(selectedPhoto);
                        }}
                        className="text-blue-600 hover:text-blue-700 min-h-[44px] min-w-[44px]"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(selectedPhoto)}
                      className="min-h-[44px] min-w-[44px]"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(selectedPhoto.id)}
                        className="text-red-500 hover:text-red-600 min-h-[44px] min-w-[44px]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Photo */}
              <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
                {photoUrls[selectedPhoto.id] ? (
                  <Image
                    src={photoUrls[selectedPhoto.id]}
                    alt={selectedPhoto.caption || 'Construction photo'}
                    fill
                    className="object-contain"
                    sizes="(max-width: 1024px) 100vw, 1024px"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Camera className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-4 mt-4">
                {/* Caption */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Caption</h4>
                  <p className="text-gray-600">{selectedPhoto.caption}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {selectedPhoto.captionSource === 'auto'
                        ? `AI Generated (${selectedPhoto.confidence}% confidence)`
                        : selectedPhoto.captionSource === 'user'
                        ? 'User Provided'
                        : 'Neutral'}
                    </Badge>
                  </div>
                </div>

                {/* Construction Details */}
                {(selectedPhoto.trade ||
                  selectedPhoto.workType ||
                  selectedPhoto.location) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {selectedPhoto.trade && (
                      <div className="flex items-start gap-2">
                        <Briefcase className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-400">Trade</p>
                          <p className="text-sm font-medium capitalize">
                            {selectedPhoto.trade}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedPhoto.workType && (
                      <div className="flex items-start gap-2">
                        <Camera className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-400">Work Type</p>
                          <p className="text-sm font-medium capitalize">
                            {selectedPhoto.workType}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedPhoto.location && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-400">Location</p>
                          <p className="text-sm font-medium">
                            {selectedPhoto.location}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Materials */}
                {selectedPhoto.materials && selectedPhoto.materials.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      Materials
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedPhoto.materials.map((material, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {material}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Safety Notes */}
                {selectedPhoto.safety && selectedPhoto.safety.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      Safety Observations
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {selectedPhoto.safety.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Technical Details */}
                <div className="text-xs text-gray-400 space-y-1">
                  {selectedPhoto.uploadedAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Uploaded: {new Date(selectedPhoto.uploadedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPhoto.dimensions && (
                    <div>
                      Dimensions: {selectedPhoto.dimensions.width} x{' '}
                      {selectedPhoto.dimensions.height} px
                      {selectedPhoto.dimensions.fileSize && (
                        <>
                          {' · '}
                          {(selectedPhoto.dimensions.fileSize / 1024 / 1024).toFixed(2)} MB
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Annotation Modal */}
      {editingPhoto && (
        <PhotoAnnotationModal
          open={showAnnotationModal}
          onOpenChange={setShowAnnotationModal}
          photoId={editingPhoto.id}
          conversationId={conversationId}
          currentCaption={editingPhoto.caption}
          currentLocation={editingPhoto.location}
          currentTrade={editingPhoto.trade}
          currentTags={(editingPhoto as any).tags || []}
          onSave={handleAnnotationSave}
        />
      )}

      <ConfirmDialog
        open={deletePhotoId !== null}
        onConfirm={doDeletePhoto}
        onCancel={() => setDeletePhotoId(null)}
        title="Delete Photo"
        description="Are you sure you want to delete this photo?"
        variant="destructive"
      />
    </>
  );
}
