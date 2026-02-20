'use client';

import { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/svg+xml';

interface LogoUploaderProps {
  label: string;
  logoUrl: string | null;
  onUpload: (key: string, url: string) => void;
  onRemove: () => void;
  projectSlug: string;
  boardId: string | null;
  slot: string;
}

export function LogoUploader({
  label,
  logoUrl,
  onUpload,
  onRemove,
  projectSlug,
  boardId,
  slot,
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    // For unsaved boards or as immediate preview, use local data URL
    if (!boardId) {
      const reader = new FileReader();
      reader.onload = () => {
        onUpload(slot, reader.result as string);
      };
      reader.readAsDataURL(file);
      return;
    }

    // Upload via API for saved boards
    setUploading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/presentations/${boardId}/logo-upload`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            slot,
          }),
        }
      );

      if (!response.ok) throw new Error('Upload request failed');
      const { uploadUrl, key } = await response.json();

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      // Use local preview URL immediately
      const localUrl = URL.createObjectURL(file);
      onUpload(key, localUrl);
    } catch {
      alert('Logo upload failed. Please try again.');
    } finally {
      setUploading(false);
    }

    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileSelect}
        className="hidden"
        aria-label={`Upload ${label}`}
      />

      {logoUrl ? (
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded border border-border overflow-hidden bg-white flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={label}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 px-2 text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${label}`}
          >
            <X size={14} />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn('h-10 gap-2 text-xs', uploading && 'opacity-50')}
        >
          {uploading ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Upload size={14} aria-hidden="true" />
          )}
          {label}
        </Button>
      )}
    </div>
  );
}
