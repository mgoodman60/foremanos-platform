'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, FileText, Tag, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { documentMetadataSchema, type DocumentMetadataFormData } from '@/lib/schemas';
import { FormError } from '@/components/ui/form-error';

interface DocumentMetadataModalProps {
  documentId: string;
  documentName: string;
  currentDescription?: string;
  currentTags?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function DocumentMetadataModal({
  documentId,
  documentName,
  currentDescription = '',
  currentTags = [],
  onClose,
  onSuccess,
}: DocumentMetadataModalProps) {
  const [tagInput, setTagInput] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DocumentMetadataFormData>({
    resolver: zodResolver(documentMetadataSchema),
    mode: 'onBlur',
    defaultValues: {
      description: currentDescription,
      tags: currentTags,
    },
  });

  const tags = watch('tags') || [];

  // Reset form when modal opens with new data
  useEffect(() => {
    reset({
      description: currentDescription,
      tags: currentTags,
    });
  }, [currentDescription, currentTags, reset]);

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setValue('tags', [...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue('tags', tags.filter(tag => tag !== tagToRemove));
  };

  const onSubmit = async (data: DocumentMetadataFormData) => {
    try {
      const res = await fetch(`/api/documents/${documentId}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: data.description?.trim() || null,
          tags: data.tags,
        }),
      });

      if (res.ok) {
        toast.success('Document metadata updated successfully');
        onSuccess();
        onClose();
      } else {
        const responseData = await res.json();
        toast.error(responseData.error || 'Failed to update metadata');
      }
    } catch (error) {
      console.error('Error updating metadata:', error);
      toast.error('Network error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-metadata-modal-title"
        className="bg-dark-card border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full"
      >
        <div className="bg-[#003B71] text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6" />
              <div>
                <h2 id="document-metadata-modal-title" className="text-xl font-bold">Edit Document Metadata</h2>
                <p className="text-blue-100 text-sm mt-1">{documentName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6" noValidate>
          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              {...register('description')}
              className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#003B71] focus:border-transparent resize-none"
              rows={4}
              placeholder="Add a description for this document..."
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'description-error' : undefined}
            />
            <FormError error={errors.description} fieldName="description" />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Tag className="w-4 h-4 inline mr-1" />
              Tags
            </label>

            {/* Tag List */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-blue-200"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add Tag Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#003B71] focus:border-transparent"
                placeholder="Add a tag..."
                aria-label="Add a tag"
              />
              <Button
                type="button"
                onClick={addTag}
                variant="outline"
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Press Enter or click Add to add a tag
            </p>
            {errors.tags?.root && (
              <FormError error={errors.tags.root} fieldName="tags" />
            )}
            {errors.tags?.message && (
              <FormError message={errors.tags.message as string} fieldName="tags" />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#003B71] hover:bg-[#002855]"
            >
              {isSubmitting ? (
                'Saving...'
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
