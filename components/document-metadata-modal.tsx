'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Tag, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

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
  const [description, setDescription] = useState(currentDescription);
  const [tags, setTags] = useState<string[]>(currentTags);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim() || null,
          tags,
        }),
      });

      if (res.ok) {
        toast.success('Document metadata updated successfully');
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update metadata');
      }
    } catch (error) {
      console.error('Error updating metadata:', error);
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-metadata-modal-title"
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full"
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

        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003B71] focus:border-transparent resize-none"
              rows={4}
              placeholder="Add a description for this document..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="w-4 h-4 inline mr-1" />
              Tags
            </label>
            
            {/* Tag List */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-blue-900"
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
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003B71] focus:border-transparent"
                placeholder="Add a tag..."
              />
              <Button
                type="button"
                onClick={addTag}
                variant="outline"
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Press Enter or click Add to add a tag
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-[#003B71] hover:bg-[#002855]"
            >
              {saving ? (
                'Saving...'
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
