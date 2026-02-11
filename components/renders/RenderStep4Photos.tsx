'use client';

import { useState, useEffect, useRef } from 'react';
import { ImagePlus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface ProjectPhoto {
  id: string;
  url: string;
  caption?: string;
}

interface RenderStep4PhotosProps {
  projectSlug: string;
  referencePhotoKeys: string[];
  onReferencePhotoKeysChange: (keys: string[]) => void;
}

export function RenderStep4Photos({
  projectSlug,
  referencePhotoKeys,
  onReferencePhotoKeysChange,
}: RenderStep4PhotosProps) {
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadedNames, setUploadedNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectSlug}/photos`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { photos: [] }))
      .then((data) => setPhotos(data.photos ?? []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, [projectSlug]);

  const togglePhoto = (id: string) => {
    if (referencePhotoKeys.includes(id)) {
      onReferencePhotoKeysChange(referencePhotoKeys.filter((k) => k !== id));
    } else {
      onReferencePhotoKeysChange([...referencePhotoKeys, id]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const names = Array.from(files).map((f) => f.name);
    setUploadedNames((prev) => [...prev, ...names]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold">Reference Photos</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Reference photos help guide the style and feel of the render.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Project Photos</Label>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Loading photos...
          </div>
        ) : photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => {
              const selected = referencePhotoKeys.includes(photo.id);
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => togglePhoto(photo.id)}
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-lg border-2 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-primary' : 'border-border hover:border-primary/50'
                  )}
                  aria-pressed={selected}
                  aria-label={photo.caption ? `Select ${photo.caption}` : `Select photo`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption ?? 'Project photo'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {selected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check size={16} aria-hidden="true" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No project photos available. Upload some photos to your project to use
            them as reference.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <Label>Upload Inspiration</Label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors',
            'hover:border-primary/50 hover:bg-accent/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <ImagePlus size={32} className="text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">
            Click to upload or drag and drop
          </span>
          <span className="text-xs text-muted-foreground">
            PNG, JPG up to 10MB
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={handleFileChange}
          aria-label="Upload inspiration photos"
        />

        {uploadedNames.length > 0 && (
          <ul className="space-y-1">
            {uploadedNames.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Check size={12} className="text-green-500" aria-hidden="true" />
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
