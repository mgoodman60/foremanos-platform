'use client';

import { useState, useEffect } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { MarkupStyle } from '@/lib/markup/markup-types';
import { logger } from '@/lib/logger';

interface ToolPreset {
  id: string;
  name: string;
  style: MarkupStyle;
}

interface ToolPresetManagerProps {
  currentStyle: MarkupStyle;
  onLoadPreset: (style: MarkupStyle) => void;
}

export function ToolPresetManager({ currentStyle, onLoadPreset }: ToolPresetManagerProps) {
  const [presets, setPresets] = useState<ToolPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPresets();
    }
  }, [open]);

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/markup/tool-presets');
      if (!res.ok) throw new Error('Failed to fetch presets');
      const data = await res.json();
      setPresets(data.presets || []);
    } catch (error) {
      logger.error('TOOL_PRESET_MANAGER', 'Failed to fetch presets', error);
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim() || saving) return;

    setSaving(true);
    try {
      const res = await fetch('/api/markup/tool-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: presetName.trim(),
          style: currentStyle,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        if (res.status === 409) {
          alert('A preset with this name already exists');
        } else {
          throw new Error(error.error || 'Failed to save preset');
        }
        return;
      }

      setPresetName('');
      await fetchPresets();
    } catch (error) {
      logger.error('TOOL_PRESET_MANAGER', 'Failed to save preset', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadPreset = (preset: ToolPreset) => {
    onLoadPreset(preset.style);
    setOpen(false);
  };

  const handleDeletePreset = async (presetId: string) => {
    try {
      const res = await fetch(`/api/markup/tool-presets/${presetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete preset');
      await fetchPresets();
    } catch (error) {
      logger.error('TOOL_PRESET_MANAGER', 'Failed to delete preset', error);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Tool Presets
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-3 text-sm">Save Current Settings</h4>
            <div className="flex gap-2">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePreset();
                }}
              />
              <Button size="sm" onClick={handleSavePreset} disabled={!presetName.trim() || saving}>
                <Save className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3 text-sm">Saved Presets</h4>
            {presets.length === 0 ? (
              <p className="text-sm text-gray-500">No presets saved</p>
            ) : (
              <div className="space-y-2">
                {presets.map((preset) => (
                  <div key={preset.id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                    <button
                      onClick={() => handleLoadPreset(preset)}
                      className="flex-1 text-left text-sm font-medium"
                    >
                      {preset.name}
                    </button>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: preset.style.color }}
                      />
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
