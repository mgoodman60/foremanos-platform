'use client';

import {
  Camera,
  Lightbulb,
  Pencil,
  Sunset,
  HardHat,
  Layers,
  Plane,
  Scissors,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

interface StyleOption {
  value: string;
  label: string;
  description: string;
  Icon: LucideIcon;
}

const RENDER_STYLES: StyleOption[] = [
  { value: 'photorealistic', label: 'Photorealistic', description: 'Professional architectural photograph', Icon: Camera },
  { value: 'conceptual', label: 'Conceptual', description: 'Clean massing study, design intent', Icon: Lightbulb },
  { value: 'sketch', label: 'Architectural Sketch', description: 'Hand-drawn pencil/charcoal', Icon: Pencil },
  { value: 'dusk_twilight', label: 'Dusk / Twilight', description: 'Golden hour, warm ambient lighting', Icon: Sunset },
  { value: 'construction_phase', label: 'Construction Phase', description: 'Specific build stage', Icon: HardHat },
  { value: 'material_closeup', label: 'Material Closeup', description: 'Detail shot highlighting finishes', Icon: Layers },
  { value: 'aerial_perspective', label: 'Aerial Perspective', description: "Bird's-eye with site context", Icon: Plane },
  { value: 'section_cut', label: 'Section Cut', description: 'Cross-section showing interior layers', Icon: Scissors },
];

const CONSTRUCTION_PHASES = [
  { value: 'foundation', label: 'Foundation' },
  { value: 'framing', label: 'Framing' },
  { value: 'rough_in', label: 'Rough-In' },
  { value: 'drywall', label: 'Drywall' },
  { value: 'finishes', label: 'Finishes' },
];

const QUALITY_TIERS = [
  { value: 'draft' as const, label: 'Draft', cost: '~$0.01', description: 'Fast preview' },
  { value: 'high' as const, label: 'High Quality', cost: '~$0.04', description: 'Good for review' },
  { value: 'max' as const, label: 'Max Quality', cost: '~$0.04', description: 'Best for clients', recommended: true },
];

interface RenderStep2StyleProps {
  style: string;
  onStyleChange: (s: string) => void;
  constructionPhase: string | null;
  onConstructionPhaseChange: (p: string | null) => void;
  qualityTier: 'draft' | 'high' | 'max';
  onQualityTierChange: (t: 'draft' | 'high' | 'max') => void;
}

export function RenderStep2Style({
  style,
  onStyleChange,
  constructionPhase,
  onConstructionPhaseChange,
  qualityTier,
  onQualityTierChange,
}: RenderStep2StyleProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold">Choose a Style</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Select the visual style for your architectural render.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {RENDER_STYLES.map(({ value, label, description, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              onStyleChange(value);
              if (value !== 'construction_phase') {
                onConstructionPhaseChange(null);
              }
            }}
            className={cn(
              'flex min-h-[44px] items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors',
              'hover:border-primary/50 hover:bg-accent/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              style === value ? 'border-primary bg-primary/5' : 'border-border'
            )}
            aria-pressed={style === value}
          >
            <Icon
              size={24}
              color={style === value ? 'hsl(var(--primary))' : 'currentColor'}
              className={cn(
                'shrink-0 transition-colors',
                style === value ? '' : 'text-muted-foreground'
              )}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-muted-foreground">{description}</div>
            </div>
          </button>
        ))}
      </div>

      {style === 'construction_phase' && (
        <div className="space-y-2">
          <Label>Construction Phase</Label>
          <div className="flex flex-wrap gap-2">
            {CONSTRUCTION_PHASES.map((phase) => (
              <button
                key={phase.value}
                type="button"
                onClick={() => onConstructionPhaseChange(phase.value)}
                className={cn(
                  'min-h-[44px] rounded-full border px-4 py-2 text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  constructionPhase === phase.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent'
                )}
                aria-pressed={constructionPhase === phase.value}
              >
                {phase.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 border-t pt-4">
        <Label>Quality Tier</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {QUALITY_TIERS.map((tier) => (
            <button
              key={tier.value}
              type="button"
              onClick={() => onQualityTierChange(tier.value)}
              className={cn(
                'relative flex min-h-[44px] flex-col items-center gap-1 rounded-lg border-2 p-3 text-center transition-colors',
                'hover:border-primary/50 hover:bg-accent/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                qualityTier === tier.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              )}
              aria-pressed={qualityTier === tier.value}
            >
              {tier.recommended && (
                <Badge
                  variant="default"
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]"
                >
                  Recommended
                </Badge>
              )}
              <span className="text-sm font-medium">{tier.label}</span>
              <span className="text-xs text-muted-foreground">
                {tier.cost} &middot; {tier.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
