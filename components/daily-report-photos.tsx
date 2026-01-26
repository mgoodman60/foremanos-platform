/**
 * Daily Report Photos Section
 * 
 * Integrates photo gallery, bulk upload, and PDF export for daily report chats.
 * Shows in the chat sidebar or as an expandable panel.
 */

'use client';

import { useState, useEffect } from 'react';
import { Camera, Upload, FileText, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoGallery } from './photo-gallery';
import { BulkUploadModal } from './bulk-upload-modal';
import { toast } from 'sonner';
import { PhotoMetadata } from '@/lib/photo-analyzer';

interface DailyReportPhotosProps {
  conversationId: string;
  conversationType: string;
}

export function DailyReportPhotos({
  conversationId,
  conversationType,
}: DailyReportPhotosProps) {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Only show for daily report chats
  if (conversationType !== 'daily_report') {
    return null;
  }

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/photos`);
      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }
      const data = await response.json();
      setPhotos(data.photos || []);
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast.error('Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [conversationId]);

  const handlePhotoDeleted = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleUploadComplete = () => {
    fetchPhotos();
  };

  const handleExportPDF = () => {
    window.open(`/api/conversations/${conversationId}/export-pdf`, '_blank');
  };

  return (
    <>
      <div className="border-t border-gray-200 bg-white">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between bg-gray-50 border-b border-gray-200">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
          >
            <Camera className="h-4 w-4" />
            <span>
              Photos ({photos.length})
            </span>
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchPhotos}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBulkUploadOpen(true)}
              title="Bulk Upload"
            >
              <Upload className="h-4 w-4" />
            </Button>
            {photos.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportPDF}
                title="Export PDF"
              >
                <FileText className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Gallery - Collapsible */}
        {expanded && (
          <div className="p-4">
            <PhotoGallery
              conversationId={conversationId}
              photos={photos}
              onPhotoDeleted={handlePhotoDeleted}
            />
          </div>
        )}

        {/* Quick Summary when collapsed */}
        {!expanded && photos.length > 0 && (
          <div className="px-4 py-2 text-xs text-gray-500">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
            {photos.filter((p) => p.captionSource === 'auto').length > 0 &&
              ` (${photos.filter((p) => p.captionSource === 'auto').length} AI analyzed)`}
          </div>
        )}
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        conversationId={conversationId}
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onUploadComplete={handleUploadComplete}
      />
    </>
  );
}
