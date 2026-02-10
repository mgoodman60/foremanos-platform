'use client';

import { Image, LayoutGrid, Columns, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEMPLATES = [
  {
    id: 'hero_sign',
    name: 'Hero Sign',
    description: 'Full-bleed render with overlay',
    Icon: Image,
  },
  {
    id: 'portfolio_sheet',
    name: 'Portfolio Sheet',
    description: 'Multi-render grid layout',
    Icon: LayoutGrid,
  },
  {
    id: 'before_after',
    name: 'Before / After',
    description: 'Site photo vs render comparison',
    Icon: Columns,
  },
  {
    id: 'presentation_cover',
    name: 'Cover Page',
    description: 'Minimalist presentation cover',
    Icon: FileText,
  },
] as const;

interface TemplateSelectorProps {
  selectedTemplate: string;
  onSelect: (id: string) => void;
}

export function TemplateSelector({ selectedTemplate, onSelect }: TemplateSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
        Template
      </h3>
      {TEMPLATES.map(({ id, name, description, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            'flex items-center gap-3 min-h-[80px] rounded-lg border-2 p-3 text-left transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selectedTemplate === id
              ? 'border-primary bg-primary/5 text-foreground'
              : 'border-border bg-background hover:border-muted-foreground/40 hover:bg-muted/30 text-muted-foreground'
          )}
          aria-pressed={selectedTemplate === id}
        >
          <Icon
            size={20}
            className={cn(
              'shrink-0',
              selectedTemplate === id ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium">{name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
