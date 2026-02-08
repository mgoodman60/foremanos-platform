/**
 * Daily Report Photos Section
 * 
 * Integrates photo gallery, bulk upload, and PDF export for daily report chats.
 * Shows in the chat sidebar or as an expandable panel.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Camera, Upload, FileText, RefreshCcw, Check, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoGallery } from './photo-gallery';
import { BulkUploadModal } from './bulk-upload-modal';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PhotoMetadata } from '@/lib/photo-analyzer';
import { createScopedLogger } from '@/lib/logger';
import { semanticColors } from '@/lib/design-tokens';

const log = createScopedLogger('DAILY_REPORT_PHOTOS');

function getExpirationBadge(expiresAt: string) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { label: 'Expired', color: semanticColors.error[500], bg: semanticColors.error[50] };
  }
  if (diffDays <= 1) {
    return { label: 'Expires today', color: semanticColors.error[600], bg: semanticColors.error[50] };
  }
  if (diffDays <= 3) {
    return { label: `Expires in ${diffDays} days`, color: semanticColors.warning[600], bg: semanticColors.warning[50] };
  }
  return { label: `Expires in ${diffDays} days`, color: semanticColors.success[600], bg: semanticColors.success[50] };
}

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
  const isDailyReport = conversationType === 'daily_report';

  const fetchPhotos = useCallback(async () => {
    if (!isDailyReport) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/photos`);
      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }
      const data = await response.json();
      setPhotos(data.photos || []);
    } catch (error) {
      log.error('Failed to fetch photos', error as Error);
      toast.error('Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [conversationId, isDailyReport]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Only show for daily report chats
  if (!isDailyReport) {
    return null;
  }

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
          <div className="px-4 py-2 space-y-1.5">
            <div className="text-xs text-gray-500">
              {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
              {photos.filter((p) => p.captionSource === 'auto').length > 0 &&
                ` (${photos.filter((p) => p.captionSource === 'auto').length} AI analyzed)`}
            </div>
            {/* Expiration and sync badges */}
            <div className="flex flex-wrap gap-1.5">
              {photos.map((photo: any) => {
                const badges = [];

                if (photo.expiresAt) {
                  const badge = getExpirationBadge(photo.expiresAt);
                  badges.push(
                    <Badge
                      key={`exp-${photo.id}`}
                      variant="outline"
                      className="text-xs gap-1"
                      style={{ color: badge.color, backgroundColor: badge.bg, borderColor: badge.color }}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {badge.label}
                    </Badge>
                  );
                }

                if (photo.onedriveSynced) {
                  badges.push(
                    <Badge
                      key={`sync-${photo.id}`}
                      variant="outline"
                      className="text-xs gap-1"
                      style={{
                        color: semanticColors.success[600],
                        backgroundColor: semanticColors.success[50],
                        borderColor: semanticColors.success[300],
                      }}
                    >
                      <Check className="h-2.5 w-2.5" />
                      Synced
                    </Badge>
                  );
                }

                return badges.length > 0 ? badges : null;
              })}
            </div>
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
