'use client';

import { useState, useEffect, useRef } from 'react';
import { Building2, Home, Plane, MapPin, Upload } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ViewType = 'exterior' | 'interior' | 'aerial_site';

interface ViewOption {
  value: ViewType;
  label: string;
  description: string;
  Icon: LucideIcon;
}

const VIEW_OPTIONS: ViewOption[] = [
  {
    value: 'exterior',
    label: 'Exterior View',
    description: 'Front, rear, or side elevation of the building exterior',
    Icon: Building2,
  },
  {
    value: 'interior',
    label: 'Interior Room',
    description: 'Interior perspective of a specific room or space',
    Icon: Home,
  },
  {
    value: 'aerial_site',
    label: 'Aerial / Site',
    description: "Bird's-eye view showing the building and surrounding site",
    Icon: Plane,
  },
];

const CAMERA_ANGLES = [
  { value: 'eye_level', label: 'Eye Level' },
  { value: 'elevated', label: 'Elevated' },
  { value: 'corner_3_4', label: 'Corner 3/4' },
  { value: 'worms_eye', label: "Worm's Eye" },
  { value: 'overhead', label: 'Overhead' },
];

interface Room {
  id: string;
  roomNumber: string;
  roomName: string | null;
}

interface RenderStep1ViewProps {
  viewType: ViewType | null;
  onViewTypeChange: (vt: ViewType) => void;
  roomId: string | null;
  onRoomIdChange: (id: string | null) => void;
  cameraAngle: string;
  onCameraAngleChange: (angle: string) => void;
  projectSlug: string;
  compositeMode: 'standalone' | 'site_composite';
  onCompositeModeChange: (mode: 'standalone' | 'site_composite') => void;
  sitePhotoBase64: string | null;
  onSitePhotoChange: (base64: string | null) => void;
  placementBounds: { x: number; y: number; width: number; height: number } | null;
  onPlacementBoundsChange: (bounds: { x: number; y: number; width: number; height: number } | null) => void;
}

export function RenderStep1View({
  viewType,
  onViewTypeChange,
  roomId,
  onRoomIdChange,
  cameraAngle,
  onCameraAngleChange,
  projectSlug,
  compositeMode,
  onCompositeModeChange,
  sitePhotoBase64,
  onSitePhotoChange,
  placementBounds,
  onPlacementBoundsChange,
}: RenderStep1ViewProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (viewType !== 'interior') return;
    setLoadingRooms(true);
    fetch(`/api/projects/${projectSlug}/rooms`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { rooms: [] }))
      .then((data) => setRooms(data.rooms ?? []))
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false));
  }, [viewType, projectSlug]);

  const availableAngles =
    viewType === 'aerial_site'
      ? CAMERA_ANGLES
      : CAMERA_ANGLES.filter((a) => a.value !== 'overhead');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold">Choose a View Type</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Select the type of architectural visualization you want to create.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {VIEW_OPTIONS.map(({ value, label, description, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onViewTypeChange(value)}
            className={cn(
              'flex min-h-[120px] flex-col items-center gap-3 rounded-lg border-2 p-5 text-center transition-colors',
              'hover:border-primary/50 hover:bg-accent/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              viewType === value
                ? 'border-primary bg-primary/5'
                : 'border-border'
            )}
            aria-pressed={viewType === value}
          >
            <Icon
              size={48}
              color={viewType === value ? 'hsl(var(--primary))' : 'currentColor'}
              className={cn(
                'transition-colors',
                viewType === value ? '' : 'text-muted-foreground'
              )}
            />
            <div>
              <div className="text-sm font-medium">{label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{description}</div>
            </div>
          </button>
        ))}
      </div>

      {viewType === 'interior' && (
        <div className="space-y-2">
          <Label htmlFor="room-select">Select Room</Label>
          {loadingRooms ? (
            <p className="text-sm text-muted-foreground">Loading rooms...</p>
          ) : rooms.length > 0 ? (
            <Select
              value={roomId ?? undefined}
              onValueChange={(v) => onRoomIdChange(v)}
            >
              <SelectTrigger id="room-select">
                <SelectValue placeholder="Choose a room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.roomNumber}
                    {r.roomName ? ` - ${r.roomName}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              No rooms found. The render will use general interior details.
            </p>
          )}
        </div>
      )}

      {viewType && (
        <div className="space-y-2">
          <Label>Camera Angle</Label>
          <div className="flex flex-wrap gap-2">
            {availableAngles.map((angle) => (
              <button
                key={angle.value}
                type="button"
                onClick={() => onCameraAngleChange(angle.value)}
                className={cn(
                  'min-h-[44px] rounded-full border px-4 py-2 text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  cameraAngle === angle.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent'
                )}
                aria-pressed={cameraAngle === angle.value}
              >
                {angle.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(viewType === 'exterior' || viewType === 'aerial_site') && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const newMode = compositeMode === 'site_composite' ? 'standalone' : 'site_composite';
                onCompositeModeChange(newMode);
                if (newMode === 'standalone') {
                  onSitePhotoChange(null);
                  onPlacementBoundsChange(null);
                }
              }}
              className={cn(
                'flex min-h-[44px] items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                compositeMode === 'site_composite'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/50'
              )}
              aria-pressed={compositeMode === 'site_composite'}
            >
              <MapPin size={18} />
              Place on Site Photo
            </button>
            {compositeMode === 'site_composite' && (
              <span className="text-xs text-muted-foreground">
                Upload a photo of the construction site to place the render in context
              </span>
            )}
          </div>

          {compositeMode === 'site_composite' && (
            <SitePhotoUploader
              sitePhotoBase64={sitePhotoBase64}
              onSitePhotoChange={onSitePhotoChange}
              placementBounds={placementBounds}
              onPlacementBoundsChange={onPlacementBoundsChange}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SitePhotoUploader({
  sitePhotoBase64,
  onSitePhotoChange,
  placementBounds,
  onPlacementBoundsChange,
}: {
  sitePhotoBase64: string | null;
  onSitePhotoChange: (base64: string | null) => void;
  placementBounds: { x: number; y: number; width: number; height: number } | null;
  onPlacementBoundsChange: (bounds: { x: number; y: number; width: number; height: number } | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB limit

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix to get pure base64
      const base64 = result.split(',')[1];
      onSitePhotoChange(base64);
      onPlacementBoundsChange(null); // Reset bounds for new photo
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDragStart({ x, y });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const x = Math.max(0, Math.min(dragStart.x, currentX));
    const y = Math.max(0, Math.min(dragStart.y, currentY));
    const width = Math.min(100 - x, Math.abs(currentX - dragStart.x));
    const height = Math.min(100 - y, Math.abs(currentY - dragStart.y));

    onPlacementBoundsChange({ x, y, width, height });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  if (!sitePhotoBase64) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors',
            'hover:border-primary/50 hover:bg-accent/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <Upload size={32} className="text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Upload Site Photo</p>
            <p className="text-xs text-muted-foreground">
              PNG or JPG, up to 10MB
            </p>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleFileSelect}
          aria-label="Upload site photo"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {placementBounds
            ? 'Building placement area selected. Drag to adjust.'
            : 'Click and drag on the photo to define where the building should go, or let AI decide.'}
        </p>
        <button
          type="button"
          onClick={() => {
            onSitePhotoChange(null);
            onPlacementBoundsChange(null);
          }}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Remove
        </button>
      </div>
      <div
        ref={imageRef}
        className="relative cursor-crosshair overflow-hidden rounded-lg border"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        role="img"
        aria-label="Site photo with placement overlay"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${sitePhotoBase64}`}
          alt="Construction site"
          className="w-full select-none"
          draggable={false}
        />
        {placementBounds && (
          <div
            className="absolute border-2 border-dashed border-orange-400 bg-orange-400/20"
            style={{
              left: `${placementBounds.x}%`,
              top: `${placementBounds.y}%`,
              width: `${placementBounds.width}%`,
              height: `${placementBounds.height}%`,
            }}
          >
            <span className="absolute -top-5 left-0 text-[10px] font-medium text-orange-400">
              Building placement
            </span>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        No area selected = AI auto-placement (recommended). The AI will analyze the site and determine the best position.
      </p>
    </div>
  );
}
