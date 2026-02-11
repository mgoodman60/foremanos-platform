'use client';

import { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

interface DataCompletenessItem {
  key: string;
  label: string;
  status: 'available' | 'partial' | 'missing';
  hint?: string;
}

interface DataContext {
  dataCompleteness: {
    score: number;
    items: DataCompletenessItem[];
  };
  fields: Record<string, string>;
  promptPreview: string;
}

interface RenderStep3DataProps {
  viewType: 'exterior' | 'interior' | 'aerial_site';
  roomId: string | null;
  projectSlug: string;
  userOverrides: Record<string, string>;
  onOverridesChange: (overrides: Record<string, string>) => void;
  saveToProject: boolean;
  onSaveToProjectChange: (save: boolean) => void;
  dataContext: DataContext | null;
  onDataContextLoaded: (ctx: DataContext) => void;
}

const ARCH_STYLES = [
  'Modern', 'Traditional', 'Colonial', 'Contemporary', 'Mediterranean',
  'Craftsman', 'Industrial', 'Farmhouse', 'Mid-Century Modern', 'Victorian',
];

const BUILDING_USES = [
  'Residential', 'Commercial', 'Mixed-Use', 'Educational', 'Healthcare',
  'Industrial', 'Religious', 'Hospitality', 'Government', 'Retail',
];

const ROOF_TYPES = [
  'Flat', 'Gable', 'Hip', 'Shed', 'Mansard', 'Butterfly', 'Gambrel', 'Parapet',
];

const SITE_CONTEXTS = [
  'Urban', 'Suburban', 'Rural', 'Waterfront', 'Mountain', 'Desert', 'Forest',
];

const INTERIOR_STYLES = [
  'Modern', 'Traditional', 'Minimalist', 'Industrial', 'Scandinavian',
  'Mid-Century Modern', 'Coastal', 'Bohemian', 'Transitional', 'Art Deco',
];

export function RenderStep3Data({
  viewType,
  roomId,
  projectSlug,
  userOverrides,
  onOverridesChange,
  saveToProject,
  onSaveToProjectChange,
  dataContext,
  onDataContextLoaded,
}: RenderStep3DataProps) {
  const [loading, setLoading] = useState(!dataContext);
  const [promptExpanded, setPromptExpanded] = useState(false);

  useEffect(() => {
    if (dataContext) return;
    setLoading(true);
    const params = new URLSearchParams({ viewType });
    if (roomId) params.set('roomId', roomId);

    fetch(`/api/projects/${projectSlug}/renders/context?${params}`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          onDataContextLoaded(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [viewType, roomId, projectSlug, dataContext, onDataContextLoaded]);

  const getValue = (key: string) =>
    userOverrides[key] ?? dataContext?.fields?.[key] ?? '';

  const setField = (key: string, value: string) => {
    onOverridesChange({ ...userOverrides, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading project data...</p>
      </div>
    );
  }

  const completeness = dataContext?.dataCompleteness;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold">Project Details</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Review and edit the details that will inform the render. Fields are
          pre-populated from your project data.
        </p>
      </div>

      {completeness && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Data Completeness</span>
            <span className="text-sm font-semibold">{completeness.score}%</span>
          </div>
          <Progress value={completeness.score} className="h-2" />
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {completeness.items.map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-xs">
                {item.status === 'available' && (
                  <Check size={14} className="shrink-0 text-green-500" aria-hidden="true" />
                )}
                {item.status === 'partial' && (
                  <AlertTriangle size={14} className="shrink-0 text-yellow-500" aria-hidden="true" />
                )}
                {item.status === 'missing' && (
                  <X size={14} className="shrink-0 text-red-500" aria-hidden="true" />
                )}
                <span className="text-muted-foreground">
                  {item.label}
                  {item.status === 'missing' && item.hint && (
                    <span className="ml-1 text-[10px] italic">({item.hint})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {viewType === 'interior' ? (
            <InteriorFields getValue={getValue} setField={setField} />
          ) : (
            <ExteriorFields getValue={getValue} setField={setField} />
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setPromptExpanded(!promptExpanded)}
          >
            {promptExpanded ? 'Hide' : 'Show'} Prompt Preview
          </button>
          {promptExpanded && (
            <Textarea
              readOnly
              className="min-h-[300px] font-mono text-xs"
              value={dataContext?.promptPreview ?? 'Prompt preview unavailable'}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t pt-4">
        <Checkbox
          id="save-to-project"
          checked={saveToProject}
          onCheckedChange={(checked) => onSaveToProjectChange(checked === true)}
        />
        <Label htmlFor="save-to-project" className="cursor-pointer text-sm">
          Save these details to the project for future renders
        </Label>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ExteriorFields({
  getValue,
  setField,
}: {
  getValue: (k: string) => string;
  setField: (k: string, v: string) => void;
}) {
  return (
    <>
      <FieldRow label="Architectural Style" id="arch-style">
        <Select value={getValue('archStyle') || undefined} onValueChange={(v) => setField('archStyle', v)}>
          <SelectTrigger id="arch-style"><SelectValue placeholder="Select style" /></SelectTrigger>
          <SelectContent>
            {ARCH_STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Building Use" id="building-use">
        <Select value={getValue('buildingUse') || undefined} onValueChange={(v) => setField('buildingUse', v)}>
          <SelectTrigger id="building-use"><SelectValue placeholder="Select use" /></SelectTrigger>
          <SelectContent>
            {BUILDING_USES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Stories" id="stories">
        <Input id="stories" type="number" min={1} max={100} value={getValue('stories')} onChange={(e) => setField('stories', e.target.value)} placeholder="e.g. 2" />
      </FieldRow>

      <FieldRow label="Roof Type" id="roof-type">
        <Select value={getValue('roofType') || undefined} onValueChange={(v) => setField('roofType', v)}>
          <SelectTrigger id="roof-type"><SelectValue placeholder="Select roof type" /></SelectTrigger>
          <SelectContent>
            {ROOF_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Roof Material" id="roof-material">
        <Input id="roof-material" value={getValue('roofMaterial')} onChange={(e) => setField('roofMaterial', e.target.value)} placeholder="e.g. Standing seam metal" />
      </FieldRow>

      <FieldRow label="Exterior Materials" id="ext-materials">
        <Textarea id="ext-materials" value={getValue('exteriorMaterials')} onChange={(e) => setField('exteriorMaterials', e.target.value)} placeholder="e.g. Brick veneer, fiber cement siding" rows={2} />
      </FieldRow>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Color Palette</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['Primary', 'Secondary', 'Accent', 'Trim'] as const).map((c) => {
            const key = `color${c}`;
            return (
              <div key={key} className="space-y-1">
                <Label htmlFor={key} className="text-xs">{c}</Label>
                <Input id={key} value={getValue(key)} onChange={(e) => setField(key, e.target.value)} placeholder={c} />
              </div>
            );
          })}
        </div>
      </fieldset>

      <FieldRow label="Windows Summary" id="windows">
        <Textarea id="windows" value={getValue('windowsSummary')} onChange={(e) => setField('windowsSummary', e.target.value)} placeholder="e.g. Double-hung, black frames" rows={2} />
      </FieldRow>

      <FieldRow label="Landscaping" id="landscaping">
        <Textarea id="landscaping" value={getValue('landscaping')} onChange={(e) => setField('landscaping', e.target.value)} placeholder="e.g. Native plants, stone walkway" rows={2} />
      </FieldRow>

      <FieldRow label="Site Context" id="site-context">
        <Select value={getValue('siteContext') || undefined} onValueChange={(v) => setField('siteContext', v)}>
          <SelectTrigger id="site-context"><SelectValue placeholder="Select context" /></SelectTrigger>
          <SelectContent>
            {SITE_CONTEXTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Additional Notes" id="notes">
        <Textarea id="notes" value={getValue('additionalNotes')} onChange={(e) => setField('additionalNotes', e.target.value)} placeholder="Any other details..." rows={3} />
      </FieldRow>
    </>
  );
}

function InteriorFields({
  getValue,
  setField,
}: {
  getValue: (k: string) => string;
  setField: (k: string, v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="Room Name" id="room-name">
          <Input id="room-name" value={getValue('roomName')} onChange={(e) => setField('roomName', e.target.value)} placeholder="e.g. Living Room" />
        </FieldRow>
        <FieldRow label="Room Type" id="room-type">
          <Input id="room-type" value={getValue('roomType')} onChange={(e) => setField('roomType', e.target.value)} placeholder="e.g. Bedroom" />
        </FieldRow>
      </div>

      <FieldRow label="Dimensions" id="dimensions">
        <Input id="dimensions" value={getValue('dimensions')} onChange={(e) => setField('dimensions', e.target.value)} placeholder="e.g. 12' x 14' x 9'" />
      </FieldRow>

      <FieldRow label="Floor Finish" id="floor-finish">
        <Input id="floor-finish" value={getValue('floorFinish')} onChange={(e) => setField('floorFinish', e.target.value)} placeholder="e.g. Hardwood oak" />
      </FieldRow>

      <FieldRow label="Wall Finish" id="wall-finish">
        <Input id="wall-finish" value={getValue('wallFinish')} onChange={(e) => setField('wallFinish', e.target.value)} placeholder="e.g. Paint, SW Alabaster" />
      </FieldRow>

      <FieldRow label="Ceiling Finish" id="ceiling-finish">
        <Input id="ceiling-finish" value={getValue('ceilingFinish')} onChange={(e) => setField('ceilingFinish', e.target.value)} placeholder="e.g. Flat white, 9' AFF" />
      </FieldRow>

      <FieldRow label="Doors" id="doors">
        <Input id="doors" value={getValue('doors')} onChange={(e) => setField('doors', e.target.value)} placeholder="e.g. 3'-0 solid core, painted" />
      </FieldRow>

      <FieldRow label="Windows" id="windows-int">
        <Input id="windows-int" value={getValue('windowsInt')} onChange={(e) => setField('windowsInt', e.target.value)} placeholder="e.g. 4' x 5' casement, north wall" />
      </FieldRow>

      <FieldRow label="Lighting" id="lighting">
        <Input id="lighting" value={getValue('lighting')} onChange={(e) => setField('lighting', e.target.value)} placeholder="e.g. Recessed cans, pendant" />
      </FieldRow>

      <FieldRow label="Fixtures / Equipment" id="fixtures">
        <Input id="fixtures" value={getValue('fixtures')} onChange={(e) => setField('fixtures', e.target.value)} placeholder="e.g. Built-in shelving, fireplace" />
      </FieldRow>

      <FieldRow label="Interior Style" id="interior-style">
        <Select value={getValue('interiorStyle') || undefined} onValueChange={(v) => setField('interiorStyle', v)}>
          <SelectTrigger id="interior-style"><SelectValue placeholder="Select style" /></SelectTrigger>
          <SelectContent>
            {INTERIOR_STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Additional Notes" id="notes-int">
        <Textarea id="notes-int" value={getValue('additionalNotes')} onChange={(e) => setField('additionalNotes', e.target.value)} placeholder="Any other details..." rows={3} />
      </FieldRow>
    </>
  );
}
