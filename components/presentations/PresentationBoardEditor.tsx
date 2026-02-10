'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TemplateSelector } from './TemplateSelector';
import { RenderPicker } from './RenderPicker';
import { LogoUploader } from './LogoUploader';
import { PresentationBoardPreview } from './PresentationBoardPreview';
import { PresentationExportBar } from './PresentationExportBar';

interface BoardData {
  title: string;
  templateId: string;
  projectName: string;
  companyName: string;
  tagline: string;
  contactInfo: string;
  dateText: string;
  primaryColor: string;
  accentColor: string;
  renderIds: string[];
  companyLogoUrl: string | null;
  clientLogoUrl: string | null;
  partnerLogo1Url: string | null;
  partnerLogo2Url: string | null;
  sitePhotoUrl: string | null;
}

const DEFAULT_BOARD: BoardData = {
  title: '',
  templateId: 'hero_sign',
  projectName: '',
  companyName: '',
  tagline: '',
  contactInfo: '',
  dateText: new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  }),
  primaryColor: '#F97316',
  accentColor: '#003B71',
  renderIds: [],
  companyLogoUrl: null,
  clientLogoUrl: null,
  partnerLogo1Url: null,
  partnerLogo2Url: null,
  sitePhotoUrl: null,
};

interface RenderImageData {
  id: string;
  url: string;
  title: string | null;
}

interface PresentationBoardEditorProps {
  projectSlug: string;
  boardId: string | null;
  onBack: () => void;
}

export function PresentationBoardEditor({
  projectSlug,
  boardId,
  onBack,
}: PresentationBoardEditorProps) {
  const [data, setData] = useState<BoardData>(DEFAULT_BOARD);
  const [saving, setSaving] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(!!boardId);
  const [renderImages, setRenderImages] = useState<RenderImageData[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

  // Fetch existing board data
  useEffect(() => {
    if (!boardId) return;
    async function loadBoard() {
      try {
        const response = await fetch(
          `/api/projects/${projectSlug}/presentations/${boardId}`
        );
        if (!response.ok) throw new Error('Failed to load board');
        const board = await response.json();
        setData({
          title: board.title || '',
          templateId: board.templateId || 'hero_sign',
          projectName: board.projectName || '',
          companyName: board.companyName || '',
          tagline: board.tagline || '',
          contactInfo: board.contactInfo || '',
          dateText: board.dateText || '',
          primaryColor: board.primaryColor || '#F97316',
          accentColor: board.accentColor || '#003B71',
          renderIds: board.renderIds || [],
          companyLogoUrl: board.companyLogoUrl || null,
          clientLogoUrl: board.clientLogoUrl || null,
          partnerLogo1Url: board.partnerLogo1Url || null,
          partnerLogo2Url: board.partnerLogo2Url || null,
          sitePhotoUrl: board.sitePhotoUrl || null,
        });
      } catch {
        // Board load failed, use defaults
      } finally {
        setLoadingBoard(false);
      }
    }
    loadBoard();
  }, [boardId, projectSlug]);

  // Fetch render image URLs for selected IDs
  useEffect(() => {
    if (data.renderIds.length === 0) {
      setRenderImages([]);
      return;
    }
    async function fetchRenderUrls() {
      try {
        const params = new URLSearchParams({ status: 'completed', limit: '50' });
        const response = await fetch(
          `/api/projects/${projectSlug}/renders?${params}`
        );
        if (!response.ok) return;
        const result = await response.json();
        const allRenders = result.renders || [];
        const selected = data.renderIds
          .map((id: string) => {
            const r = allRenders.find((render: RenderImageData & { thumbnailUrl?: string | null; imageUrl?: string | null }) => render.id === id);
            if (!r) return null;
            return { id: r.id, url: r.imageUrl || r.thumbnailUrl || '', title: r.title };
          })
          .filter(Boolean) as RenderImageData[];
        setRenderImages(selected);
      } catch {
        // Keep existing images
      }
    }
    fetchRenderUrls();
  }, [data.renderIds, projectSlug]);

  const updateField = useCallback(
    <K extends keyof BoardData>(key: K, value: BoardData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const method = boardId ? 'PATCH' : 'POST';
      const url = boardId
        ? `/api/projects/${projectSlug}/presentations/${boardId}`
        : `/api/projects/${projectSlug}/presentations`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Save failed');
      const result = await response.json();

      // If it was a new board, we now have an ID — just stay on editor
      if (!boardId && result.id) {
        // Transition to editing existing board without losing state
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch {
      alert('Failed to save board. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Build template props from current data
  const templateProps = {
    projectName: data.projectName || 'Project Name',
    companyName: data.companyName || 'Company Name',
    tagline: data.tagline,
    contactInfo: data.contactInfo,
    dateText: data.dateText,
    primaryColor: data.primaryColor,
    accentColor: data.accentColor,
    renderImages: renderImages.map((r) => ({ url: r.url, title: r.title || undefined })),
    companyLogoUrl: data.companyLogoUrl,
    clientLogoUrl: data.clientLogoUrl,
    partnerLogo1Url: data.partnerLogo1Url,
    partnerLogo2Url: data.partnerLogo2Url,
    sitePhotoUrl: data.sitePhotoUrl,
  };

  if (loadingBoard) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <Input
            value={data.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Untitled Board"
            className="h-8 w-48 sm:w-64 text-sm bg-transparent border-transparent hover:border-border focus:border-border"
            aria-label="Board title"
          />
        </div>
        <div className="flex items-center gap-2">
          <PresentationExportBar
            previewRef={previewRef}
            boardTitle={data.title}
            templateId={data.templateId}
            onExported={() => {}}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Main content — 3 columns on desktop, stacked on mobile */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Template selector */}
        <div className="shrink-0 w-full lg:w-[200px] border-b lg:border-b-0 lg:border-r border-border p-4 overflow-y-auto">
          <TemplateSelector
            selectedTemplate={data.templateId}
            onSelect={(id) => updateField('templateId', id)}
          />
        </div>

        {/* Center: Live preview */}
        <div className="flex-1 min-h-[300px] p-4 flex">
          <PresentationBoardPreview
            ref={previewRef}
            templateId={data.templateId}
            {...templateProps}
          />
        </div>

        {/* Right: Edit panel */}
        <div className="shrink-0 w-full lg:w-[320px] border-t lg:border-t-0 lg:border-l border-border overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Text section */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Text
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="projectName" className="text-xs">
                    Project Name
                  </Label>
                  <Input
                    id="projectName"
                    value={data.projectName}
                    onChange={(e) => updateField('projectName', e.target.value)}
                    placeholder="e.g. Riverside Tower"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="companyName" className="text-xs">
                    Company Name
                  </Label>
                  <Input
                    id="companyName"
                    value={data.companyName}
                    onChange={(e) =>
                      updateField('companyName', e.target.value)
                    }
                    placeholder="e.g. Acme Construction"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="tagline" className="text-xs">
                    Tagline
                  </Label>
                  <Textarea
                    id="tagline"
                    value={data.tagline}
                    onChange={(e) => updateField('tagline', e.target.value)}
                    placeholder="Short description or tagline"
                    rows={2}
                    className="mt-1 text-sm min-h-0"
                  />
                </div>
                <div>
                  <Label htmlFor="contactInfo" className="text-xs">
                    Contact Info
                  </Label>
                  <Input
                    id="contactInfo"
                    value={data.contactInfo}
                    onChange={(e) =>
                      updateField('contactInfo', e.target.value)
                    }
                    placeholder="email / phone / address"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="dateText" className="text-xs">
                    Date
                  </Label>
                  <Input
                    id="dateText"
                    value={data.dateText}
                    onChange={(e) => updateField('dateText', e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>
            </section>

            {/* Colors section */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Colors
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="primaryColor" className="text-xs text-muted-foreground">
                    Primary
                  </label>
                  <input
                    id="primaryColor"
                    type="color"
                    value={data.primaryColor}
                    onChange={(e) =>
                      updateField('primaryColor', e.target.value)
                    }
                    className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="accentColor" className="text-xs text-muted-foreground">
                    Accent
                  </label>
                  <input
                    id="accentColor"
                    type="color"
                    value={data.accentColor}
                    onChange={(e) =>
                      updateField('accentColor', e.target.value)
                    }
                    className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                  />
                </div>
              </div>
            </section>

            {/* Logos section */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Logos
              </h3>
              <div className="space-y-3">
                <LogoUploader
                  label="Company Logo"
                  logoUrl={data.companyLogoUrl}
                  onUpload={(_key, url) =>
                    updateField('companyLogoUrl', url)
                  }
                  onRemove={() => updateField('companyLogoUrl', null)}
                  projectSlug={projectSlug}
                  boardId={boardId}
                  slot="company"
                />
                <LogoUploader
                  label="Client Logo"
                  logoUrl={data.clientLogoUrl}
                  onUpload={(_key, url) =>
                    updateField('clientLogoUrl', url)
                  }
                  onRemove={() => updateField('clientLogoUrl', null)}
                  projectSlug={projectSlug}
                  boardId={boardId}
                  slot="client"
                />
                <LogoUploader
                  label="Partner Logo 1"
                  logoUrl={data.partnerLogo1Url}
                  onUpload={(_key, url) =>
                    updateField('partnerLogo1Url', url)
                  }
                  onRemove={() => updateField('partnerLogo1Url', null)}
                  projectSlug={projectSlug}
                  boardId={boardId}
                  slot="partner1"
                />
                <LogoUploader
                  label="Partner Logo 2"
                  logoUrl={data.partnerLogo2Url}
                  onUpload={(_key, url) =>
                    updateField('partnerLogo2Url', url)
                  }
                  onRemove={() => updateField('partnerLogo2Url', null)}
                  projectSlug={projectSlug}
                  boardId={boardId}
                  slot="partner2"
                />
              </div>
            </section>

            {/* Renders section */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Renders
              </h3>
              <RenderPicker
                projectSlug={projectSlug}
                selectedIds={data.renderIds}
                onSelectionChange={(ids) => updateField('renderIds', ids)}
              />
            </section>

            {/* Site Photo section — only for before_after template */}
            {data.templateId === 'before_after' && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Site Photo
                </h3>
                <SitePhotoUploader
                  url={data.sitePhotoUrl}
                  onChange={(url) => updateField('sitePhotoUrl', url)}
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline sub-component for site photo upload (only used in before_after)
function SitePhotoUploader({
  url,
  onChange,
}: {
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleFile}
        className="hidden"
        aria-label="Upload site photo"
      />
      {url ? (
        <div className="relative">
          <img
            src={url}
            alt="Site photo"
            className="w-full rounded border border-border object-cover max-h-32"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onChange(null)}
            className="absolute top-1 right-1 h-6 px-2 text-xs"
          >
            Remove
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="w-full"
        >
          Upload Site Photo
        </Button>
      )}
    </div>
  );
}
