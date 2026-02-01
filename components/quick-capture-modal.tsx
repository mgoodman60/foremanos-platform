'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Camera, Upload, MapPin, Briefcase, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Image from 'next/image';
import { getErrorMessage } from '@/lib/fetch-with-retry';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { quickCaptureSchema, type QuickCaptureFormData } from '@/lib/schemas';
import { FormError } from '@/components/ui/form-error';

interface QuickCaptureModalProps {
  conversationId: string | null;
  projectSlug?: string;
  onClose: () => void;
  onPhotoUploaded: () => void;
  suggestedLocation?: string;
  suggestedTrade?: string;
}

// Common trade options
const COMMON_TRADES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Framing',
  'Concrete',
  'Drywall',
  'Painting',
  'Roofing',
  'Flooring',
  'MEP',
  'Sitework',
];

export function QuickCaptureModal({
  conversationId,
  projectSlug,
  onClose,
  onPhotoUploaded,
  suggestedLocation,
  suggestedTrade,
}: QuickCaptureModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Focus trap for accessibility
  const containerRef = useFocusTrap({
    isActive: true,
    onEscape: onClose,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuickCaptureFormData>({
    resolver: zodResolver(quickCaptureSchema),
    mode: 'onBlur',
    defaultValues: {
      location: suggestedLocation || '',
      trade: suggestedTrade || '',
      caption: '',
    },
  });

  // Reset form when modal opens with new suggestions
  useEffect(() => {
    reset({
      location: suggestedLocation || '',
      trade: suggestedTrade || '',
      caption: '',
    });
  }, [suggestedLocation, suggestedTrade, reset]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle upload
  const onSubmit = async (data: QuickCaptureFormData) => {
    if (!selectedFile) {
      toast.error('Please select a photo');
      return;
    }

    try {
      setUploading(true);

      // Step 1: Get presigned URL
      const presignedRes = await fetch(
        `/api/conversations/${conversationId}/photos/presigned`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: selectedFile.name,
            contentType: selectedFile.type,
          }),
        }
      );

      if (!presignedRes.ok) {
        const errorMessage = await getErrorMessage(presignedRes, 'Failed to get upload URL');
        throw new Error(errorMessage);
      }

      const { uploadUrl, cloud_storage_path } = await presignedRes.json();

      // Step 2: Upload to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Quick capture endpoint (includes AI analysis)
      const confirmRes = await fetch(
        `/api/conversations/${conversationId}/photos-quick`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cloud_storage_path,
            location: data.location?.trim() || undefined,
            trade: data.trade || undefined,
            caption: data.caption?.trim() || undefined,
          }),
        }
      );

      if (!confirmRes.ok) {
        const errorMessage = await getErrorMessage(confirmRes, 'Failed to confirm upload');
        throw new Error(errorMessage);
      }

      toast.success('Photo uploaded successfully!');
      onPhotoUploaded();
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-capture-modal-title"
        className="bg-dark-surface border border-gray-700 rounded-lg w-full max-w-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 id="quick-capture-modal-title" className="text-lg font-semibold text-[#F8FAFC]">Quick Capture</h3>
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-dark-card"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4" noValidate>
          {/* Photo preview or upload buttons */}
          {preview ? (
            <div className="relative aspect-video bg-dark-card rounded-lg overflow-hidden">
              <Image src={preview} alt="Preview" fill className="object-contain" />
              <Button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreview(null);
                }}
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Camera button */}
              <Button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white h-16"
              >
                <Camera className="h-5 w-5 mr-2" />
                Take Photo
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Gallery button */}
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white h-12"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose from Gallery
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Location input */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-300 mb-2">
              <MapPin className="h-4 w-4 inline mr-1" />
              Location (optional)
            </label>
            <Input
              id="location"
              type="text"
              {...register('location')}
              placeholder="e.g., 2nd Floor, Room 201"
              className="bg-dark-card border-gray-600 text-[#F8FAFC] placeholder:text-gray-500"
              aria-invalid={!!errors.location}
              aria-describedby={errors.location ? 'location-error' : undefined}
            />
            <FormError error={errors.location} fieldName="location" />
          </div>

          {/* Trade dropdown */}
          <div>
            <label htmlFor="trade" className="block text-sm font-medium text-gray-300 mb-2">
              <Briefcase className="h-4 w-4 inline mr-1" />
              Trade/Sub (optional)
            </label>
            <Controller
              name="trade"
              control={control}
              render={({ field }) => (
                <select
                  id="trade"
                  value={field.value || ''}
                  onChange={field.onChange}
                  className="w-full px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-[#F8FAFC]"
                  aria-invalid={!!errors.trade}
                  aria-describedby={errors.trade ? 'trade-error' : undefined}
                >
                  <option value="">Select trade...</option>
                  {COMMON_TRADES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            />
            <FormError error={errors.trade} fieldName="trade" />
          </div>

          {/* Caption input */}
          <div>
            <label htmlFor="caption" className="block text-sm font-medium text-gray-300 mb-2">
              Caption (optional)
            </label>
            <Input
              id="caption"
              type="text"
              {...register('caption')}
              placeholder="Brief description..."
              className="bg-dark-card border-gray-600 text-[#F8FAFC] placeholder:text-gray-500"
              aria-invalid={!!errors.caption}
              aria-describedby={errors.caption ? 'caption-error' : undefined}
            />
            <FormError error={errors.caption} fieldName="caption" />
          </div>

          {/* Upload button */}
          {selectedFile && (
            <Button
              type="submit"
              disabled={uploading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Photo
                </>
              )}
            </Button>
          )}

          {/* Info text */}
          <p className="text-xs text-gray-400 text-center">
            AI will analyze the photo and auto-detect work details
          </p>
        </form>
      </div>
    </div>
  );
}
