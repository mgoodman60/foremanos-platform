'use client';

import { useState, useCallback } from 'react';
import { 
  Sun, Moon, CloudSun, Mountain, Building2, Warehouse,
  Sparkles, Layers, Eye, EyeOff, RefreshCw, Sliders,
  Palette, SunMedium, Lightbulb, Maximize
} from 'lucide-react';
import type { ViewerHandle } from './index';

interface RenderingToolsProps {
  viewerRef: React.RefObject<ViewerHandle>;
}

// Environment presets available in Autodesk Viewer
const ENVIRONMENTS = [
  { id: 'RimHighlights', name: 'Rim Highlights', icon: Sun, category: 'Studio' },
  { id: 'SharpHighlights', name: 'Sharp Highlights', icon: Sparkles, category: 'Studio' },
  { id: 'SoftHighlights', name: 'Soft Highlights', icon: CloudSun, category: 'Studio' },
  { id: 'PhotoBooth', name: 'Photo Booth', icon: SunMedium, category: 'Studio' },
  { id: 'Boardwalk', name: 'Boardwalk', icon: Mountain, category: 'Outdoor' },
  { id: 'Field', name: 'Field', icon: Mountain, category: 'Outdoor' },
  { id: 'Riverbank', name: 'Riverbank', icon: Mountain, category: 'Outdoor' },
  { id: 'Plaza', name: 'Plaza', icon: Building2, category: 'Urban' },
  { id: 'Crossroads', name: 'Crossroads', icon: Building2, category: 'Urban' },
  { id: 'UrbanChic', name: 'Urban Chic', icon: Building2, category: 'Urban' },
  { id: 'Tranquility', name: 'Tranquility', icon: Moon, category: 'Interior' },
  { id: 'InfinityPool', name: 'Infinity Pool', icon: Warehouse, category: 'Interior' },
];

// Quality presets
const QUALITY_PRESETS = [
  { id: 'low', name: 'Performance', description: 'Faster rendering' },
  { id: 'medium', name: 'Balanced', description: 'Good balance' },
  { id: 'high', name: 'Quality', description: 'Best visuals' },
];

export default function RenderingTools({ viewerRef }: RenderingToolsProps) {
  const [currentEnv, setCurrentEnv] = useState('RimHighlights');
  const [groundShadow, setGroundShadow] = useState(true);
  const [groundReflection, setGroundReflection] = useState(false);
  const [ambientOcclusion, setAmbientOcclusion] = useState(true);
  const [ghosting, setGhosting] = useState(true);
  const [envMapBackground, setEnvMapBackground] = useState(false);
  const [lightIntensity, setLightIntensity] = useState(1.0);
  const [exposureValue, setExposureValue] = useState(0);
  const [qualityPreset, setQualityPreset] = useState('medium');
  const [isApplying, setIsApplying] = useState(false);

  // Apply environment to viewer
  const applyEnvironment = useCallback(async (envId: string) => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;

    setIsApplying(true);
    try {
      // Load lighting tools extension if not loaded
      let lightingExtension;
      try {
        lightingExtension = await viewer.getExtension('Autodesk.Viewing.LightPresets');
      } catch {
        lightingExtension = await viewer.loadExtension('Autodesk.Viewing.LightPresets');
      }
      
      // Set environment
      if (lightingExtension?.setLightPreset) {
        lightingExtension.setLightPreset(envId);
      } else {
        // Fallback to direct method
        (viewer as any).setLightPreset?.(ENVIRONMENTS.findIndex(e => e.id === envId));
      }
      
      setCurrentEnv(envId);
    } catch (e) {
      console.warn('[Rendering] Environment change failed:', e);
    } finally {
      setIsApplying(false);
    }
  }, [viewerRef]);

  // Apply ground shadow setting
  const applyGroundShadow = useCallback((enabled: boolean) => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;
    
    try {
      viewer.prefs.set('groundShadow', enabled);
      (viewer as any).impl?.toggleGroundShadow?.(enabled);
      setGroundShadow(enabled);
    } catch (e) {
      console.warn('[Rendering] Ground shadow toggle failed:', e);
    }
  }, [viewerRef]);

  // Apply ground reflection setting
  const applyGroundReflection = useCallback((enabled: boolean) => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;
    
    try {
      viewer.prefs.set('groundReflection', enabled);
      (viewer as any).impl?.toggleGroundReflection?.(enabled);
      setGroundReflection(enabled);
    } catch (e) {
      console.warn('[Rendering] Ground reflection toggle failed:', e);
    }
  }, [viewerRef]);

  // Apply ambient occlusion
  const applyAmbientOcclusion = useCallback((enabled: boolean) => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;
    
    try {
      viewer.prefs.set('ambientShadows', enabled);
      (viewer as any).impl?.setAOEnabled?.(enabled);
      setAmbientOcclusion(enabled);
    } catch (e) {
      console.warn('[Rendering] AO toggle failed:', e);
    }
  }, [viewerRef]);

  // Apply ghosting
  const applyGhosting = useCallback((enabled: boolean) => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;
    
    try {
      viewer.setGhosting(enabled);
      setGhosting(enabled);
    } catch (e) {
      console.warn('[Rendering] Ghosting toggle failed:', e);
    }
  }, [viewerRef]);

  // Apply environment map as background
  const applyEnvMapBackground = useCallback((enabled: boolean) => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;
    
    try {
      viewer.prefs.set('envMapBackground', enabled);
      (viewer as any).impl?.toggleEnvMapBackground?.(enabled);
      setEnvMapBackground(enabled);
    } catch (e) {
      console.warn('[Rendering] Env map background toggle failed:', e);
    }
  }, [viewerRef]);

  // Apply light intensity
  const applyLightIntensity = useCallback((value: number) => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;
    
    try {
      (viewer as any).impl?.setLightMultiplier?.(value);
      setLightIntensity(value);
    } catch (e) {
      console.warn('[Rendering] Light intensity change failed:', e);
    }
  }, [viewerRef]);

  // Apply exposure
  const applyExposure = useCallback((value: number) => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;
    
    try {
      (viewer as any).impl?.setTonemapExposureBias?.(value);
      setExposureValue(value);
    } catch (e) {
      console.warn('[Rendering] Exposure change failed:', e);
    }
  }, [viewerRef]);

  // Apply quality preset
  const applyQualityPreset = useCallback((preset: string) => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;
    
    try {
      switch (preset) {
        case 'low':
          viewer.prefs.set('progressiveRendering', false);
          viewer.prefs.set('ambientShadows', false);
          viewer.prefs.set('groundShadow', false);
          viewer.prefs.set('groundReflection', false);
          break;
        case 'medium':
          viewer.prefs.set('progressiveRendering', true);
          viewer.prefs.set('ambientShadows', true);
          viewer.prefs.set('groundShadow', true);
          viewer.prefs.set('groundReflection', false);
          break;
        case 'high':
          viewer.prefs.set('progressiveRendering', true);
          viewer.prefs.set('ambientShadows', true);
          viewer.prefs.set('groundShadow', true);
          viewer.prefs.set('groundReflection', true);
          break;
      }
      setQualityPreset(preset);
      
      // Refresh viewer
      (viewer as any).impl?.invalidate?.(true, true, true);
    } catch (e) {
      console.warn('[Rendering] Quality preset change failed:', e);
    }
  }, [viewerRef]);

  // Reset to defaults
  const resetDefaults = useCallback(() => {
    applyEnvironment('RimHighlights');
    applyGroundShadow(true);
    applyGroundReflection(false);
    applyAmbientOcclusion(true);
    applyGhosting(true);
    applyEnvMapBackground(false);
    applyLightIntensity(1.0);
    applyExposure(0);
    applyQualityPreset('medium');
  }, [applyEnvironment, applyGroundShadow, applyGroundReflection, applyAmbientOcclusion, applyGhosting, applyEnvMapBackground, applyLightIntensity, applyExposure, applyQualityPreset]);

  // Group environments by category
  const groupedEnvironments = ENVIRONMENTS.reduce((acc, env) => {
    if (!acc[env.category]) acc[env.category] = [];
    acc[env.category].push(env);
    return acc;
  }, {} as Record<string, typeof ENVIRONMENTS>);

  return (
    <div className="bg-gray-800/95 backdrop-blur rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-pink-400" aria-hidden="true" />
          <span className="text-sm font-medium text-white">Rendering</span>
        </div>
        <button
          onClick={resetDefaults}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
          Reset
        </button>
      </div>

      <div className="p-4 space-y-5 max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* Quality Presets */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Quality</h4>
          <div className="grid grid-cols-3 gap-2">
            {QUALITY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyQualityPreset(preset.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  qualityPreset === preset.id
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Environment Presets */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Environment</h4>
          {Object.entries(groupedEnvironments).map(([category, envs]) => (
            <div key={category} className="mb-3">
              <p className="text-[10px] text-gray-400 mb-1.5">{category}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {envs.map((env) => {
                  const Icon = env.icon;
                  return (
                    <button
                      key={env.id}
                      onClick={() => applyEnvironment(env.id)}
                      disabled={isApplying}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-all ${
                        currentEnv === env.id
                          ? 'bg-pink-600/30 text-pink-300 border border-pink-500/50'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="truncate">{env.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Visual Effects Toggles */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Effects</h4>
          <div className="space-y-2">
            <label className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-400" aria-hidden="true" />
                <span className="text-sm text-white">Ground Shadow</span>
              </div>
              <button
                onClick={() => applyGroundShadow(!groundShadow)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  groundShadow ? 'bg-pink-600' : 'bg-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  groundShadow ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>

            <label className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gray-400" aria-hidden="true" />
                <span className="text-sm text-white">Ground Reflection</span>
              </div>
              <button
                onClick={() => applyGroundReflection(!groundReflection)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  groundReflection ? 'bg-pink-600' : 'bg-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  groundReflection ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>

            <label className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-gray-400" aria-hidden="true" />
                <span className="text-sm text-white">Ambient Occlusion</span>
              </div>
              <button
                onClick={() => applyAmbientOcclusion(!ambientOcclusion)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  ambientOcclusion ? 'bg-pink-600' : 'bg-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  ambientOcclusion ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>

            <label className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-2">
                {ghosting ? <Eye className="w-4 h-4 text-gray-400" aria-hidden="true" /> : <EyeOff className="w-4 h-4 text-gray-400" aria-hidden="true" />}
                <span className="text-sm text-white">Ghosting</span>
              </div>
              <button
                onClick={() => applyGhosting(!ghosting)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  ghosting ? 'bg-pink-600' : 'bg-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  ghosting ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>

            <label className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-2">
                <Maximize className="w-4 h-4 text-gray-400" aria-hidden="true" />
                <span className="text-sm text-white">HDR Background</span>
              </div>
              <button
                onClick={() => applyEnvMapBackground(!envMapBackground)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  envMapBackground ? 'bg-pink-600' : 'bg-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  envMapBackground ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>
          </div>
        </div>

        {/* Sliders */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Lighting</h4>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                  <span className="text-xs text-gray-300">Light Intensity</span>
                </div>
                <span className="text-xs text-gray-400">{lightIntensity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={lightIntensity}
                onChange={(e) => applyLightIntensity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-400" aria-hidden="true" />
                  <span className="text-xs text-gray-300">Exposure</span>
                </div>
                <span className="text-xs text-gray-400">{exposureValue > 0 ? '+' : ''}{exposureValue.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.25"
                value={exposureValue}
                onChange={(e) => applyExposure(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
