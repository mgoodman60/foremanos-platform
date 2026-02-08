'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createScopedLogger } from '@/lib/logger';
import { semanticColors } from '@/lib/design-tokens';

const log = createScopedLogger('CREW_TEMPLATE_SELECTOR');

interface CrewEntry {
  tradeName: string;
  workerCount: number;
  hourlyRate?: number;
}

interface CrewTemplate {
  id: string;
  name: string;
  entries: CrewEntry[];
  lastUsedAt?: string;
}

interface CrewTemplateSelectorProps {
  projectSlug: string;
  onSelect: (entries: CrewEntry[]) => void;
  currentEntries?: CrewEntry[];
}

export default function CrewTemplateSelector({ projectSlug, onSelect, currentEntries }: CrewTemplateSelectorProps) {
  const [templates, setTemplates] = useState<CrewTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [saved, setSaved] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/crew-templates`);
      if (response.ok) {
        const data = await response.json();
        const sorted = (data.templates || []).sort(
          (a: CrewTemplate, b: CrewTemplate) => {
            if (!a.lastUsedAt) return 1;
            if (!b.lastUsedAt) return -1;
            return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
          }
        );
        setTemplates(sorted);
      }
    } catch (error) {
      log.error('Failed to fetch crew templates', error as Error);
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      onSelect(template.entries);
      toast.success(`Applied crew template: ${template.name}`);
    }
  };

  const handleSave = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/crew-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTemplateName.trim(), entries: currentEntries }),
      });

      if (response.ok) {
        setSaved(true);
        setNewTemplateName('');
        setShowSaveInput(false);
        toast.success('Crew template saved');
        fetchTemplates();
        setTimeout(() => setSaved(false), 2000);
      } else {
        toast.error('Failed to save template');
      }
    } catch (error) {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const formatTemplateSummary = (template: CrewTemplate) => {
    const tradeCount = template.entries.length;
    const totalWorkers = template.entries.reduce((sum, e) => sum + e.workerCount, 0);
    return `${tradeCount} trade${tradeCount !== 1 ? 's' : ''}, ${totalWorkers} worker${totalWorkers !== 1 ? 's' : ''} total`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select onValueChange={handleSelect} disabled={loading || templates.length === 0}>
            <SelectTrigger className="bg-dark-surface border-gray-700 text-gray-100">
              <SelectValue
                placeholder={
                  loading
                    ? 'Loading templates...'
                    : templates.length === 0
                    ? 'No saved templates'
                    : 'Select crew template'
                }
              />
            </SelectTrigger>
            <SelectContent className="bg-dark-card border-gray-700">
              {templates.map((template) => (
                <SelectItem
                  key={template.id}
                  value={template.id}
                  className="text-gray-100"
                >
                  <div className="flex flex-col">
                    <span>{template.name}</span>
                    <span className="text-xs text-gray-400">
                      {formatTemplateSummary(template)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!showSaveInput ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSaveInput(true)}
            disabled={!currentEntries || currentEntries.length === 0}
            className="border-gray-700 text-gray-300 hover:bg-dark-surface whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 mr-1" style={{ color: semanticColors.success[500] }} />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Save Current
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Input
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="Template name"
              className="bg-dark-surface border-gray-700 text-gray-100 w-36 h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setShowSaveInput(false);
                  setNewTemplateName('');
                }
              }}
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowSaveInput(false);
                setNewTemplateName('');
              }}
              className="text-gray-400 hover:text-gray-200 h-9 px-2"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
