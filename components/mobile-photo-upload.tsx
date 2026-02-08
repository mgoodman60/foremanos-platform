'use client';

import { useState, useRef } from 'react';
import { Camera, X, Upload, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import Image from 'next/image';

interface MobilePhotoUploadProps {
  conversationId: string;
  onPhotoUploaded: () => void;
}

interface PhotoPreview {
  id: string;
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  error: string | null;
}

export function MobilePhotoUpload({
  conversationId,
  onPhotoUploaded,
}: MobilePhotoUploadProps) {
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Validate total photo count (max 20)
    if (photos.length + files.length > 20) {
      toast.error('Maximum 20 photos allowed');
      return;
    }

    const newPhotos: PhotoPreview[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }

      // Validate file size (20MB max)
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        continue;
      }

      const photo: PhotoPreview = {
        id: `${Date.now()}-${i}`,
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
        uploaded: false,
        error: null,
      };

      newPhotos.push(photo);
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  // Remove photo
  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === photoId);
      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter((p) => p.id !== photoId);
    });
  };

  // Upload single photo via presigned URL
  const uploadPhoto = async (photo: PhotoPreview): Promise<boolean> => {
    try {
      // Update photo status
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id ? { ...p, uploading: true, error: null } : p
        )
      );

      // Step 1: Get presigned URL
      const presignRes = await fetch(
        `/api/conversations/${conversationId}/photos/presigned`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: photo.file.name,
            contentType: photo.file.type || 'image/jpeg',
          }),
        }
      );

      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to prepare upload');
      }

      const { uploadUrl, cloud_storage_path } = await presignRes.json();

      // Step 2: Upload file directly to R2 via presigned URL
      let putRes: Response;
      try {
        putRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: photo.file,
          headers: { 'Content-Type': photo.file.type || 'image/jpeg' },
        });
      } catch {
        throw new Error('Upload blocked — likely a CORS issue on the storage bucket. Run `npx tsx scripts/setup-r2-cors.ts` to fix.');
      }

      if (!putRes.ok) {
        throw new Error(putRes.status === 403
          ? 'Upload URL expired. Please try again.'
          : `Upload to storage failed (${putRes.status})`);
      }

      // Step 3: Confirm upload by sending metadata to the photos endpoint
      const confirmRes = await fetch(
        `/api/conversations/${conversationId}/photos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cloudStoragePath: cloud_storage_path,
            fileName: photo.file.name,
            fileSize: photo.file.size,
            contentType: photo.file.type || 'image/jpeg',
          }),
        }
      );

      if (!confirmRes.ok) {
        const error = await confirmRes.json().catch(() => ({}));
        throw new Error(error.error || 'Upload failed');
      }

      // Update photo status to uploaded
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, uploading: false, uploaded: true, error: null }
            : p
        )
      );

      return true;
    } catch (error: any) {
      console.error('Error uploading photo:', error);

      // Update photo status with error
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, uploading: false, uploaded: false, error: error.message }
            : p
        )
      );

      return false;
    }
  };

  // Upload all photos
  const handleUploadAll = async () => {
    const photosToUpload = photos.filter((p) => !p.uploaded && !p.uploading);

    if (photosToUpload.length === 0) {
      toast.error('No photos to upload');
      return;
    }

    setIsUploading(true);

    let successCount = 0;
    let failCount = 0;

    for (const photo of photosToUpload) {
      const success = await uploadPhoto(photo);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} photo${successCount > 1 ? 's' : ''} uploaded successfully`);
      onPhotoUploaded();
    }

    if (failCount > 0) {
      toast.error(`${failCount} photo${failCount > 1 ? 's' : ''} failed to upload`);
    }

    // Remove successfully uploaded photos after a delay
    setTimeout(() => {
      setPhotos((prev) => prev.filter((p) => !p.uploaded));
    }, 2000);
  };

  // Retry failed upload
  const handleRetryPhoto = async (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (photo) {
      await uploadPhoto(photo);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Upload Buttons */}
      <div className="flex items-center gap-3">
        {/* Camera Button (Mobile) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          <Camera className="h-6 w-6" />
          <span>Take Photo</span>
        </button>

        {/* Gallery Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-dark-card hover:bg-dark-hover text-slate-50 border border-gray-600 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          <ImageIcon className="h-6 w-6" />
          <span>Choose Photos</span>
        </button>
      </div>

      {/* Photo Previews */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {photos.length} photo{photos.length > 1 ? 's' : ''} selected
            </p>
            {photos.some((p) => !p.uploaded) && (
              <Button
                onClick={handleUploadAll}
                disabled={isUploading || photos.every((p) => p.uploaded)}
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload All ({photos.filter((p) => !p.uploaded && !p.uploading).length})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative bg-dark-card border border-gray-600 rounded-lg overflow-hidden aspect-square"
              >
                {/* Photo Image */}
                <div className="relative w-full h-full">
                  <Image
                    src={photo.preview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Status Overlay */}
                {(photo.uploading || photo.uploaded || photo.error) && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    {photo.uploading && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        <p className="text-xs text-white">Uploading...</p>
                      </div>
                    )}
                    {photo.uploaded && (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle className="h-8 w-8 text-green-400" />
                        <p className="text-xs text-green-400">Uploaded</p>
                      </div>
                    )}
                    {photo.error && (
                      <div className="flex flex-col items-center gap-2 px-2">
                        <AlertCircle className="h-8 w-8 text-red-400" />
                        <p className="text-xs text-red-400 text-center">{photo.error}</p>
                        <Button
                          onClick={() => handleRetryPhoto(photo.id)}
                          variant="ghost"
                          size="sm"
                          className="text-white bg-red-900/50 hover:bg-red-900"
                        >
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Remove Button */}
                {!photo.uploading && !photo.uploaded && (
                  <button
                    onClick={() => handleRemovePhoto(photo.id)}
                    className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full touch-manipulation"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Upload Info */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
            <p className="text-xs text-blue-200">
              📸 Photos are automatically analyzed and captioned. Maximum 20 photos per report, 20MB per photo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
