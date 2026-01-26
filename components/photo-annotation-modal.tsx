'use client';

import { useState } from 'react';
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

const TRADE_TYPES = [
  'General Contractor',
  'Concrete & Masonry',
  'Carpentry & Framing',
  'Electrical',
  'Plumbing',
  'HVAC & Mechanical',
  'Drywall & Finishes',
  'Site Utilities',
  'Structural Steel',
  'Roofing',
  'Glazing & Windows',
  'Painting & Coating',
  'Flooring',
];

const COMMON_TAGS = [
  'Progress',
  'Issue',
  'Safety',
  'Quality',
  'Defect',
  'Completion',
  'Before',
  'After',
  'Detail',
  'Overview',
];

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
  const [caption, setCaption] = useState(currentCaption);
  const [location, setLocation] = useState(currentLocation);
  const [trade, setTrade] = useState(currentTrade);
  const [tags, setTags] = useState<string[]>(currentTags);
  const [newTag, setNewTag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      const response = await fetch(
        `/api/conversations/${conversationId}/photos/${photoId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption,
            location,
            trade,
            tags,
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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2d333b] border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Photo Details</DialogTitle>
          <DialogDescription className="text-gray-400">
            Add notes, location, trade, and tags to organize this photo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Caption/Notes */}
          <div>
            <Label htmlFor="caption">Caption / Notes</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe what's shown in this photo..."
              rows={3}
              className="bg-[#1F2328] border-gray-600 text-white"
            />
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Building A - 2nd Floor, East Wing"
              className="bg-[#1F2328] border-gray-600 text-white"
            />
          </div>

          {/* Trade */}
          <div>
            <Label htmlFor="trade">Trade</Label>
            <Select value={trade} onValueChange={setTrade}>
              <SelectTrigger className="bg-[#1F2328] border-gray-600 text-white">
                <SelectValue placeholder="Select trade (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-[#2d333b] border-gray-700">
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
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-red-300"
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
                className="bg-[#1F2328] border-gray-600 text-white"
              />
              <Button
                type="button"
                onClick={() => handleAddTag(newTag)}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-[#1F2328]"
              >
                Add
              </Button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-400">Quick tags:</p>
              <div className="flex flex-wrap gap-1">
                {COMMON_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleAddTag(tag)}
                    disabled={tags.includes(tag)}
                    className="px-2 py-1 text-xs rounded bg-[#1F2328] text-gray-300 hover:bg-[#F97316]/20 hover:text-[#F97316] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="border-gray-600 text-gray-300 hover:bg-[#1F2328]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#F97316] hover:bg-[#ea580c] text-white"
          >
            {submitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
