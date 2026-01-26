'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Image as ImageIcon, Loader2, Download, RefreshCw, Settings2, Palette, TreePine, Building2, Car, Sun, Moon, CloudRain, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface AIRenderPanelProps {
  modelId: string;
  projectSlug: string;
  modelName: string;
  className?: string;
}

interface RenderSettings {
  style: 'realistic' | 'architectural' | 'sketch' | 'aerial';
  timeOfDay: 'morning' | 'noon' | 'evening' | 'night';
  weather: 'clear' | 'cloudy' | 'rainy';
  vegetation: 'none' | 'light' | 'heavy';
  includeVehicles: boolean;
  includePeople: boolean;
  materialOverrides: {
    grass: boolean;
    concrete: boolean;
    asphalt: boolean;
    water: boolean;
    gravel: boolean;
  };
}

interface GeneratedRender {
  id: string;
  imageUrl: string;
  prompt: string;
  settings: RenderSettings;
  createdAt: string;
}

const DEFAULT_SETTINGS: RenderSettings = {
  style: 'realistic',
  timeOfDay: 'noon',
  weather: 'clear',
  vegetation: 'light',
  includeVehicles: false,
  includePeople: false,
  materialOverrides: {
    grass: true,
    concrete: true,
    asphalt: true,
    water: true,
    gravel: true,
  },
};

const STYLE_OPTIONS = [
  { value: 'realistic', label: 'Photorealistic', icon: ImageIcon },
  { value: 'architectural', label: 'Architectural', icon: Building2 },
  { value: 'sketch', label: 'Sketch Style', icon: Palette },
  { value: 'aerial', label: 'Aerial View', icon: Sun },
];

const TIME_OPTIONS = [
  { value: 'morning', label: 'Morning', icon: Sun },
  { value: 'noon', label: 'Noon', icon: Sun },
  { value: 'evening', label: 'Evening', icon: Sun },
  { value: 'night', label: 'Night', icon: Moon },
];

const WEATHER_OPTIONS = [
  { value: 'clear', label: 'Clear' },
  { value: 'cloudy', label: 'Cloudy' },
  { value: 'rainy', label: 'Rainy' },
];

export default function AIRenderPanel({
  modelId,
  projectSlug,
  modelName,
  className = '',
}: AIRenderPanelProps) {
  const [settings, setSettings] = useState<RenderSettings>(DEFAULT_SETTINGS);
  const [generating, setGenerating] = useState(false);
  const [renders, setRenders] = useState<GeneratedRender[]>([]);
  const [selectedRender, setSelectedRender] = useState<GeneratedRender | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');

  // Build the prompt based on settings
  const buildPrompt = useCallback(() => {
    const parts: string[] = [];
    
    // Base description
    parts.push(`A ${settings.style === 'realistic' ? 'photorealistic' : settings.style} rendering of a construction site grading plan`);
    
    // Time of day
    const timeDescriptions = {
      morning: 'in early morning golden hour light',
      noon: 'under bright midday sun',
      evening: 'during golden sunset',
      night: 'at night with construction lighting',
    };
    parts.push(timeDescriptions[settings.timeOfDay]);
    
    // Weather
    if (settings.weather === 'cloudy') parts.push('with overcast skies');
    if (settings.weather === 'rainy') parts.push('with rain and wet surfaces');
    
    // Materials
    const materials: string[] = [];
    if (settings.materialOverrides.grass) materials.push('lush green grass lawns');
    if (settings.materialOverrides.concrete) materials.push('smooth concrete sidewalks and curbs');
    if (settings.materialOverrides.asphalt) materials.push('dark asphalt driveways and parking areas');
    if (settings.materialOverrides.water) materials.push('retention ponds with water');
    if (settings.materialOverrides.gravel) materials.push('gravel construction access roads');
    
    if (materials.length > 0) {
      parts.push(`showing ${materials.join(', ')}`);
    }
    
    // Vegetation
    if (settings.vegetation === 'light') parts.push('with sparse landscaping and young trees');
    if (settings.vegetation === 'heavy') parts.push('with mature trees and full landscaping');
    
    // Extras
    if (settings.includeVehicles) parts.push('with parked cars and construction vehicles');
    if (settings.includePeople) parts.push('with workers and pedestrians');
    
    // Style specifics
    if (settings.style === 'architectural') parts.push('. Clean architectural visualization style with crisp lines');
    if (settings.style === 'sketch') parts.push('. Hand-drawn sketch rendering style with pencil textures');
    if (settings.style === 'aerial') parts.push('. Bird\'s eye aerial drone photography perspective');
    
    // Quality tags
    parts.push('. High quality, detailed, professional construction visualization');
    
    return parts.join(' ');
  }, [settings]);

  // Generate render
  const handleGenerate = async () => {
    setGenerating(true);
    const prompt = customPrompt || buildPrompt();
    
    try {
      const response = await fetch('/api/ai/generate-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          projectSlug,
          prompt,
          settings,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate render');
      }

      const data = await response.json();
      
      const newRender: GeneratedRender = {
        id: data.id || Date.now().toString(),
        imageUrl: data.imageUrl,
        prompt,
        settings: { ...settings },
        createdAt: new Date().toISOString(),
      };

      setRenders(prev => [newRender, ...prev]);
      setSelectedRender(newRender);
      toast.success('Render generated successfully!');
    } catch (error) {
      console.error('[AIRender] Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate render');
    } finally {
      setGenerating(false);
    }
  };

  // Download render
  const handleDownload = async (render: GeneratedRender) => {
    try {
      const response = await fetch(render.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${modelName.replace(/\.[^/.]+$/, '')}-render-${render.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Render downloaded!');
    } catch (error) {
      toast.error('Failed to download render');
    }
  };

  // Delete render
  const handleDelete = (renderId: string) => {
    setRenders(prev => prev.filter(r => r.id !== renderId));
    if (selectedRender?.id === renderId) {
      setSelectedRender(null);
    }
    toast.success('Render deleted');
  };

  return (
    <div className={`bg-gray-800/95 backdrop-blur rounded-lg border border-gray-700 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">AI Realistic Render</h3>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded transition-colors ${showSettings ? 'bg-purple-600/20 text-purple-400' : 'text-gray-400 hover:text-white'}`}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Generate photorealistic site visualizations
        </p>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-3 border-b border-gray-700 space-y-3 max-h-[400px] overflow-y-auto">
          {/* Render Style */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Render Style</label>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSettings(s => ({ ...s, style: opt.value as any }))}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    settings.style === opt.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <opt.icon className="w-3 h-3" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time of Day */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Time of Day</label>
            <div className="grid grid-cols-4 gap-1">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSettings(s => ({ ...s, timeOfDay: opt.value as any }))}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    settings.timeOfDay === opt.value
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Weather */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Weather</label>
            <div className="flex gap-1">
              {WEATHER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSettings(s => ({ ...s, weather: opt.value as any }))}
                  className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                    settings.weather === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Materials */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Surface Materials</label>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(settings.materialOverrides).map(([key, enabled]) => (
                <button
                  key={key}
                  onClick={() => setSettings(s => ({
                    ...s,
                    materialOverrides: { ...s.materialOverrides, [key]: !enabled }
                  }))}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    enabled
                      ? 'bg-green-600/20 text-green-400 border border-green-600/50'
                      : 'bg-gray-700 text-gray-400 border border-transparent'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-400' : 'bg-gray-500'}`} />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Vegetation */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Vegetation</label>
            <div className="flex gap-1">
              {(['none', 'light', 'heavy'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setSettings(s => ({ ...s, vegetation: opt }))}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    settings.vegetation === opt
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <TreePine className="w-3 h-3" />
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Extras */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Include</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSettings(s => ({ ...s, includeVehicles: !s.includeVehicles }))}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  settings.includeVehicles
                    ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/50'
                    : 'bg-gray-700 text-gray-400 border border-transparent'
                }`}
              >
                <Car className="w-3 h-3" />
                Vehicles
              </button>
              <button
                onClick={() => setSettings(s => ({ ...s, includePeople: !s.includePeople }))}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  settings.includePeople
                    ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/50'
                    : 'bg-gray-700 text-gray-400 border border-transparent'
                }`}
              >
                👤 People
              </button>
            </div>
          </div>

          {/* Custom Prompt */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Custom Prompt (optional)</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Override with your own description..."
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 resize-none"
              rows={2}
            />
          </div>

          {/* Generated Prompt Preview */}
          {!customPrompt && (
            <div className="bg-gray-900/50 rounded p-2">
              <label className="text-xs text-gray-500 block mb-1">Generated Prompt:</label>
              <p className="text-xs text-gray-400 italic">{buildPrompt()}</p>
            </div>
          )}
        </div>
      )}

      {/* Generate Button */}
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg font-medium transition-all"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Render
            </>
          )}
        </button>
      </div>

      {/* Generated Renders */}
      <div className="flex-1 overflow-y-auto p-3">
        {renders.length === 0 ? (
          <div className="text-center py-8">
            <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No renders yet</p>
            <p className="text-xs text-gray-600 mt-1">
              Configure settings and click Generate
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {renders.map((render) => (
              <div
                key={render.id}
                className={`rounded-lg border overflow-hidden transition-all cursor-pointer ${
                  selectedRender?.id === render.id
                    ? 'border-purple-500 ring-2 ring-purple-500/20'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => setSelectedRender(render)}
              >
                <div className="relative aspect-video bg-gray-900">
                  <Image
                    src={render.imageUrl}
                    alt="Generated render"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-2 bg-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {new Date(render.createdAt).toLocaleTimeString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(render);
                        }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                        title="Download"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(render.id);
                        }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {render.settings.style} • {render.settings.timeOfDay}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Render Preview Modal */}
      {selectedRender && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedRender(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-gray-900 rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video">
              <Image
                src={selectedRender.imageUrl}
                alt="Generated render preview"
                fill
                className="object-contain"
              />
            </div>
            <div className="p-4 border-t border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white font-medium">Render Preview</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(selectedRender)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={() => {
                      setSettings(selectedRender.settings);
                      setSelectedRender(null);
                      toast.success('Settings restored');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Use Settings
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 line-clamp-3">{selectedRender.prompt}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
