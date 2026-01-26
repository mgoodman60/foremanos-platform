'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Calendar, MapPin, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { getFileUrl } from '@/lib/s3';
import { format, parseISO, isValid } from 'date-fns';

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

interface DayGroup {
  date: string;
  displayDate: string;
  photos: Photo[];
}

interface PhotoTimelineProps {
  projectSlug: string;
  onClose: () => void;
}

export function PhotoTimeline({ projectSlug, onClose }: PhotoTimelineProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

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

  // Group photos by date
  const groupedPhotos: DayGroup[] = (() => {
    const groups: Map<string, Photo[]> = new Map();

    photos.forEach((photo) => {
      // Use conversation date if available, otherwise upload date
      const dateStr = photo.conversationDate || photo.uploadedAt;
      let dateKey: string;

      try {
        const date = parseISO(dateStr);
        if (isValid(date)) {
          dateKey = format(date, 'yyyy-MM-dd');
        } else {
          dateKey = 'unknown';
        }
      } catch {
        dateKey = 'unknown';
      }

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(photo);
    });

    // Convert to array and sort by date (newest first)
    return Array.from(groups.entries())
      .map(([date, photos]) => ({
        date,
        displayDate:
          date === 'unknown'
            ? 'Unknown Date'
            : format(parseISO(date), 'EEEE, MMMM d, yyyy'),
        photos: photos.sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        ),
      }))
      .sort((a, b) => {
        if (a.date === 'unknown') return 1;
        if (b.date === 'unknown') return -1;
        return b.date.localeCompare(a.date);
      });
  })();

  // Toggle day expansion
  const toggleDay = (date: string) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDays(newExpanded);
  };

  // Expand all or collapse all
  const expandAll = () => {
    setExpandedDays(new Set(groupedPhotos.map((g) => g.date)));
  };

  const collapseAll = () => {
    setExpandedDays(new Set());
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1F2328] border border-gray-700 rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-[#F8FAFC]">Photo Timeline</h2>
            <p className="text-sm text-gray-400 mt-1">
              {photos.length} photo{photos.length !== 1 ? 's' : ''} across {groupedPhotos.length} day{groupedPhotos.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={expandAll}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-[#2d333b] hover:text-white"
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Expand All
            </Button>
            <Button
              onClick={collapseAll}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-[#2d333b] hover:text-white"
            >
              <ChevronUp className="h-4 w-4 mr-1" />
              Collapse All
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white hover:bg-[#2d333b]"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : groupedPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Calendar className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No photos found</p>
              <p className="text-sm mt-1">Upload photos to see them in the timeline</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedPhotos.map((group) => (
                <div key={group.date} className="relative">
                  {/* Timeline dot and line */}
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-700">
                    <div className="absolute top-6 left-0 -translate-x-1/2 w-4 h-4 rounded-full bg-orange-500 border-4 border-[#1F2328]"></div>
                  </div>

                  {/* Day header */}
                  <div className="ml-10">
                    <button
                      onClick={() => toggleDay(group.date)}
                      className="flex items-center justify-between w-full p-4 bg-[#2d333b] border border-gray-700 rounded-lg hover:bg-[#3d434b] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-orange-500" />
                        <div className="text-left">
                          <h3 className="text-lg font-semibold text-[#F8FAFC]">
                            {group.displayDate}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {group.photos.length} photo{group.photos.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {expandedDays.has(group.date) ? (
                        <ChevronUp className="h-5 w-5 text-gray-400 group-hover:text-white" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400 group-hover:text-white" />
                      )}
                    </button>

                    {/* Photos grid */}
                    {expandedDays.has(group.date) && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.photos.map((photo) => (
                          <TimelinePhotoCard key={photo.id} photo={photo} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TimelinePhotoCardProps {
  photo: Photo;
}

function TimelinePhotoCard({ photo }: TimelinePhotoCardProps) {
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
    <Card className="bg-[#2d333b] border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors">
      {/* Image */}
      <div className="aspect-square relative bg-[#1F2328]">
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
      </div>

      {/* Details */}
      <div className="p-3 space-y-2">
        {/* Time */}
        <div className="text-xs text-gray-400">
          {format(parseISO(photo.uploadedAt), 'h:mm a')}
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
