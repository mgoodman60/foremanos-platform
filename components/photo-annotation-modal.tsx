'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { photoAnnotationSchema, type PhotoAnnotationFormData, TRADE_TYPES, COMMON_PHOTO_TAGS } from '@/lib/schemas';
import { FormError } from '@/components/ui/form-error';

interface PhotoAnnotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoId: string;
  conversationId: string;
  currentCaption?: string;
  currentLocation?: string;
  currentTrade?: string;
  currentTags?: string[];
  onSave: () => void;
}

export function PhotoAnnotationModal({
  open,
  onOpenChange,
  photoId,
  conversationId,
  currentCaption = '',
  currentLocation = '',
  currentTrade = '',
  currentTags = [],
  onSave,
}: PhotoAnnotationModalProps) {
  const [newTag, setNewTag] = useState('');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PhotoAnnotationFormData>({
    resolver: zodResolver(photoAnnotationSchema),
    mode: 'onBlur',
    defaultValues: {
      caption: currentCaption,
      location: currentLocation,
      trade: currentTrade,
      tags: currentTags,
    },
  });

  const tags = watch('tags') || [];

  // Reset form when modal opens with new data
  useEffect(() => {
    if (open) {
      reset({
        caption: currentCaption,
        location: currentLocation,
        trade: currentTrade,
        tags: currentTags,
      });
    }
  }, [open, currentCaption, currentLocation, currentTrade, currentTags, reset]);

  const handleAddTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setValue('tags', [...tags, tag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setValue('tags', tags.filter((t) => t !== tagToRemove));
  };

  const onSubmit = async (data: PhotoAnnotationFormData) => {
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/photos/${photoId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption: data.caption,
            location: data.location,
            trade: data.trade,
            tags: data.tags,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update photo');
      }

      toast.success('Photo annotations saved');
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving annotations:', error);
      toast.error('Failed to save annotations');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-dark-card border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Photo Details</DialogTitle>
          <DialogDescription className="text-gray-400">
            Add notes, location, trade, and tags to organize this photo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Caption/Notes */}
          <div>
            <Label htmlFor="caption">Caption / Notes</Label>
            <Textarea
              id="caption"
              {...register('caption')}
              placeholder="Describe what's shown in this photo..."
              rows={3}
              className="bg-dark-surface border-gray-600 text-white"
              aria-invalid={!!errors.caption}
              aria-describedby={errors.caption ? 'caption-error' : undefined}
            />
            <FormError error={errors.caption} fieldName="caption" />
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              {...register('location')}
              placeholder="e.g., Building A - 2nd Floor, East Wing"
              className="bg-dark-surface border-gray-600 text-white"
              aria-invalid={!!errors.location}
              aria-describedby={errors.location ? 'location-error' : undefined}
            />
            <FormError error={errors.location} fieldName="location" />
          </div>

          {/* Trade */}
          <div>
            <Label htmlFor="trade">Trade</Label>
            <Controller
              name="trade"
              control={control}
              render={({ field }) => (
                <Select value={field.value || ''} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="trade"
                    className="bg-dark-surface border-gray-600 text-white"
                    aria-invalid={!!errors.trade}
                    aria-describedby={errors.trade ? 'trade-error' : undefined}
                  >
                    <SelectValue placeholder="Select trade (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-card border-gray-700">
                    <SelectItem value="none" className="text-white">
                      No trade
                    </SelectItem>
                    {TRADE_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-white">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FormError error={errors.trade} fieldName="trade" />
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="bg-[#F97316]/20 text-[#F97316] hover:bg-[#F97316]/30"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-red-300"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>

            <div className="flex gap-2 mb-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(newTag);
                  }
                }}
                placeholder="Add custom tag..."
                className="bg-dark-surface border-gray-600 text-white"
                aria-label="Add custom tag"
              />
              <Button
                type="button"
                onClick={() => handleAddTag(newTag)}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-dark-surface"
              >
                Add
              </Button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-400">Quick tags:</p>
              <div className="flex flex-wrap gap-1">
                {COMMON_PHOTO_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAddTag(tag)}
                    disabled={tags.includes(tag)}
                    className="px-2 py-1 text-xs rounded bg-dark-surface text-gray-300 hover:bg-[#F97316]/20 hover:text-[#F97316] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            {errors.tags?.root && (
              <FormError error={errors.tags.root} fieldName="tags" />
            )}
            {errors.tags?.message && (
              <FormError message={errors.tags.message as string} fieldName="tags" />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="border-gray-600 text-gray-300 hover:bg-dark-surface"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#F97316] hover:bg-[#ea580c] text-white"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
