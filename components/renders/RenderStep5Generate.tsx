'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Loader2, Download, RefreshCw, Check, AlertTriangle, ArrowLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RenderStep5GenerateProps {
  projectSlug: string;
  viewType: string;
  style: string;
  qualityTier: 'draft' | 'high' | 'max';
  cameraAngle: string;
  roomId: string | null;
  userOverrides: Record<string, string>;
  saveToProject: boolean;
  referencePhotoKeys: string[];
  constructionPhase: string | null;
  compositeMode: 'standalone' | 'site_composite';
  sitePhotoBase64: string | null;
  placementBounds: { x: number; y: number; width: number; height: number } | null;
  onComplete: (render: { id: string; imageUrl: string }) => void;
  onBack: () => void;
}

const STYLE_LABELS: Record<string, string> = {
  photorealistic: 'Photorealistic',
  conceptual: 'Conceptual',
  sketch: 'Architectural Sketch',
  dusk_twilight: 'Dusk / Twilight',
  construction_phase: 'Construction Phase',
  material_closeup: 'Material Closeup',
  aerial_perspective: 'Aerial Perspective',
  section_cut: 'Section Cut',
};

const VIEW_LABELS: Record<string, string> = {
  exterior: 'Exterior View',
  interior: 'Interior Room',
  aerial_site: 'Aerial / Site',
};

const TIER_COSTS: Record<string, string> = {
  draft: '~$0.01',
  high: '~$0.04-0.20',
  max: '~$0.04',
};

export function RenderStep5Generate({
  projectSlug,
  viewType,
  style,
  qualityTier,
  cameraAngle,
  roomId,
  userOverrides,
  saveToProject,
  referencePhotoKeys,
  constructionPhase,
  compositeMode,
  sitePhotoBase64,
  placementBounds,
  onComplete,
  onBack,
}: RenderStep5GenerateProps) {
  const [stage, setStage] = useState<'idle' | 'creating' | 'generating' | 'uploading' | 'completed' | 'failed'>('idle');
  const [renderId, setRenderId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleGenerate = async () => {
    // Prevent double-click
    if (buttonDisabled || stage !== 'idle') return;
    setButtonDisabled(true);
    setStage('creating');
    setError(null);

    try {
      // Step 1: Create render record
      const createRes = await fetch(`/api/projects/${projectSlug}/renders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewType,
          style,
          qualityTier,
          cameraAngle,
          roomId,
          userOverrides,
          saveToProject,
          referencePhotoKeys,
          constructionPhase,
          compositeMode,
          sitePhotoKey: sitePhotoBase64 ? 'pending_upload' : null,
          placementBounds,
        }),
      });

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({ error: 'Failed to create render' }));
        throw new Error(body.error || `Create failed (${createRes.status})`);
      }

      const createData = await createRes.json();
      const newRenderId = createData.id;
      setRenderId(newRenderId);

      // Step 2: Trigger generation
      setStage('generating');
      const generateRes = await fetch(`/api/projects/${projectSlug}/renders/${newRenderId}/generate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!generateRes.ok) {
        const body = await generateRes.json().catch(() => ({ error: 'Failed to start generation' }));
        throw new Error(body.error || `Generation failed (${generateRes.status})`);
      }

      // Step 3: Poll for completion
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/projects/${projectSlug}/renders/${newRenderId}`, {
            credentials: 'include',
          });

          if (!statusRes.ok) {
            throw new Error('Failed to fetch render status');
          }

          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }

            setStage('uploading');
            // Brief delay to show upload stage
            setTimeout(() => {
              setStage('completed');
              setImageUrl(statusData.imageUrl || statusData.thumbnailUrl);
              setButtonDisabled(false);
            }, 500);
          } else if (statusData.status === 'failed') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            throw new Error(statusData.error || 'Generation failed');
          }
          // Otherwise keep polling (status is 'generating')
        } catch (pollError) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          throw pollError;
        }
      }, 3000);
    } catch (err) {
      setStage('failed');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setButtonDisabled(false);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  };

  const handleRegenerate = () => {
    setStage('idle');
    setRenderId(null);
    setImageUrl(null);
    setError(null);
    setButtonDisabled(false);
  };

  const handleSaveAndClose = () => {
    if (renderId && imageUrl) {
      onComplete({ id: renderId, imageUrl });
    }
  };

  // Error state
  if (stage === 'failed') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle size={32} className="text-destructive" aria-hidden="true" />
        </div>
        <div className="text-center">
          <h3 className="text-base font-semibold">Generation Failed</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRegenerate} className="min-h-[44px]">
            Try Again
          </Button>
          <Button variant="outline" onClick={onBack} className="min-h-[44px]">
            <ArrowLeft size={16} className="mr-1" aria-hidden="true" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  // Completed state
  if (stage === 'completed' && imageUrl) {
    return (
      <div className="space-y-6">
        <div className="relative aspect-video overflow-hidden rounded-lg border">
          <Image
            src={imageUrl}
            alt="Generated render"
            fill
            unoptimized
            className="object-contain"
          />
        </div>

        <p className="text-center text-xs text-muted-foreground italic">
          AI-generated conceptual visualization — for illustrative purposes only.
        </p>

        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => {
              const a = document.createElement('a');
              a.href = imageUrl;
              a.download = `render-${renderId}.png`;
              a.click();
            }}
            className="min-h-[44px]"
          >
            <Download size={16} className="mr-1" aria-hidden="true" />
            Download
          </Button>
          <Button
            variant="outline"
            onClick={handleRegenerate}
            className="min-h-[44px]"
          >
            <RefreshCw size={16} className="mr-1" aria-hidden="true" />
            Regenerate
          </Button>
          <Button
            onClick={handleSaveAndClose}
            className="min-h-[44px]"
          >
            <Check size={16} className="mr-1" aria-hidden="true" />
            {saveToProject ? 'Save to Gallery' : 'Done'}
          </Button>
        </div>
      </div>
    );
  }

  // Generating states
  if (stage !== 'idle') {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <Loader2 size={48} className="animate-spin text-primary" />

        <div className="w-full max-w-xs space-y-3">
          {['creating', 'generating', 'uploading'].map((s, i) => {
            const labels = [
              'Assembling project data...',
              'Generating render...',
              'Uploading to gallery...',
            ];
            const isActive = stage === s;
            const isCompleted = ['creating', 'generating', 'uploading'].indexOf(stage) > i;

            return (
              <div
                key={s}
                className={cn(
                  'flex items-center gap-2 text-sm transition-opacity',
                  isActive || isCompleted ? 'opacity-100' : 'opacity-30'
                )}
              >
                {isCompleted ? (
                  <Check size={14} className="shrink-0 text-green-500" aria-hidden="true" />
                ) : isActive ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-primary" aria-hidden="true" />
                ) : (
                  <div className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{labels[i]}</span>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          This may take 30-60 seconds...
        </p>
      </div>
    );
  }

  // Idle state (summary)
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Sparkles size={32} className="text-primary" aria-hidden="true" />
      </div>

      <div>
        <h3 className="mb-1 text-center text-base font-semibold">
          Ready to Generate
        </h3>
        <p className="text-center text-sm text-muted-foreground">
          Review the summary below and click Generate when ready.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg border p-4 space-y-2">
        <SummaryRow label="View Type" value={VIEW_LABELS[viewType] ?? viewType} />
        <SummaryRow label="Style" value={STYLE_LABELS[style] ?? style} />
        <SummaryRow
          label="Quality"
          value={
            <span className="flex items-center gap-2">
              {qualityTier.charAt(0).toUpperCase() + qualityTier.slice(1)}
              <Badge variant="secondary" className="text-[10px]">
                {TIER_COSTS[qualityTier]}
              </Badge>
            </span>
          }
        />
        {compositeMode === 'site_composite' && (
          <SummaryRow label="Mode" value="Site Photo Composite" />
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground italic max-w-md">
        AI-generated conceptual visualization — for illustrative purposes only.
      </p>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onBack}
          className="min-h-[44px]"
        >
          <ArrowLeft size={16} className="mr-1" aria-hidden="true" />
          Back
        </Button>
        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={buttonDisabled}
          className="min-h-[44px] min-w-[200px] bg-orange-600 hover:bg-orange-700"
        >
          {buttonDisabled ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={16} className="mr-2" aria-hidden="true" />
              Generate Render
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
