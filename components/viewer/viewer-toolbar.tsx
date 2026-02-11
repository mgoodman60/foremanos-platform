'use client';

import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut,
  Layers, Scissors, Ruler, Move3d, Target, Grid3x3, Sun, Moon,
  Focus, Home, Camera, Crosshair, Box, Cuboid, ChevronDown
} from 'lucide-react';
import type { ViewerHandle } from './forge-viewer-enhanced';

interface ViewerExtension {
  activate(): void;
  deactivate(): void;
}

interface ViewerToolbarProps {
  viewerRef: React.RefObject<ViewerHandle>;
  onToolChange?: (tool: string | null) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso';

export default function ViewerToolbar({
  viewerRef,
  onToolChange,
  isFullscreen,
  onToggleFullscreen,
}: ViewerToolbarProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [sectionActive, setSectionActive] = useState(false);
  const [measureActive, setMeasureActive] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [ghostingEnabled, setGhostingEnabled] = useState(true);

  // Tool button component
  const ToolButton = ({
    icon: Icon,
    label,
    onClick,
    active = false,
    disabled = false,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-2 rounded-lg transition-all ${active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
        : 'bg-gray-800/90 hover:bg-gray-700 text-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );

  // Camera/View controls
  const handleFitToView = () => viewerRef.current?.fitToView();
  const handleShowAll = () => viewerRef.current?.showAll();
  const handleClearIsolation = () => viewerRef.current?.isolate();

  // View presets
  const setViewPreset = (preset: ViewPreset) => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;

    const distance = 100;
    const presets: Record<ViewPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
      front: { pos: [0, -distance, 0], target: [0, 0, 0] },
      back: { pos: [0, distance, 0], target: [0, 0, 0] },
      left: { pos: [-distance, 0, 0], target: [0, 0, 0] },
      right: { pos: [distance, 0, 0], target: [0, 0, 0] },
      top: { pos: [0, 0, distance], target: [0, 0, 0] },
      bottom: { pos: [0, 0, -distance], target: [0, 0, 0] },
      iso: { pos: [distance * 0.7, -distance * 0.7, distance * 0.7], target: [0, 0, 0] },
    };

    const { pos, target } = presets[preset];
    viewerRef.current?.setCamera(
      { x: pos[0], y: pos[1], z: pos[2] },
      { x: target[0], y: target[1], z: target[2] }
    );
    viewer.fitToView(undefined, undefined, true);
    setShowViewMenu(false);
  };

  // Section plane toggle
  const toggleSectionPlane = async () => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;

    try {
      const ext = await viewer.getExtension('Autodesk.Section') as ViewerExtension | null;
      if (ext) {
        if (sectionActive) {
          ext.deactivate();
          setSectionActive(false);
          setActiveTool(null);
          onToolChange?.(null);
        } else {
          ext.activate();
          setSectionActive(true);
          setMeasureActive(false);
          setActiveTool('section');
          onToolChange?.('section');
        }
      }
    } catch (e) {
      console.error('[ViewerToolbar] Section extension error:', e);
    }
  };

  // Measurement tool toggle
  const toggleMeasure = async () => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;

    try {
      const ext = await viewer.getExtension('Autodesk.Measure') as ViewerExtension | null;
      if (ext) {
        if (measureActive) {
          ext.deactivate();
          setMeasureActive(false);
          setActiveTool(null);
          onToolChange?.(null);
        } else {
          ext.activate();
          setMeasureActive(true);
          setSectionActive(false);
          setActiveTool('measure');
          onToolChange?.('measure');
        }
      }
    } catch (e) {
      console.error('[ViewerToolbar] Measure extension error:', e);
    }
  };

  // Toggle ghosting
  const toggleGhosting = () => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;
    viewer.setGhosting(!ghostingEnabled);
    setGhostingEnabled(!ghostingEnabled);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => setShowViewMenu(false);
    if (showViewMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showViewMenu]);

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
      {/* View Controls Group */}
      <div className="flex flex-col gap-1 bg-gray-900/80 backdrop-blur-sm rounded-xl p-1">
        <ToolButton icon={Home} label="Fit to View" onClick={handleFitToView} />
        <ToolButton icon={Eye} label="Show All" onClick={handleShowAll} />
        <ToolButton icon={Layers} label="Clear Isolation" onClick={handleClearIsolation} />
        
        {/* View Preset Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowViewMenu(!showViewMenu);
            }}
            className="p-2 bg-gray-800/90 hover:bg-gray-700 rounded-lg text-white transition-all flex items-center gap-1"
            title="View Presets"
          >
            <Camera className="w-5 h-5" />
            <ChevronDown className="w-3 h-3" />
          </button>
          
          {showViewMenu && (
            <div className="absolute right-full mr-2 top-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden min-w-[140px]">
              <div className="p-2 border-b border-gray-700 text-xs text-gray-400 font-medium">View Presets</div>
              {[
                { preset: 'front' as ViewPreset, label: 'Front', icon: Box },
                { preset: 'back' as ViewPreset, label: 'Back', icon: Box },
                { preset: 'left' as ViewPreset, label: 'Left', icon: Box },
                { preset: 'right' as ViewPreset, label: 'Right', icon: Box },
                { preset: 'top' as ViewPreset, label: 'Top', icon: Cuboid },
                { preset: 'bottom' as ViewPreset, label: 'Bottom', icon: Cuboid },
                { preset: 'iso' as ViewPreset, label: 'Isometric', icon: Grid3x3 },
              ].map(({ preset, label, icon: PresetIcon }) => (
                <button
                  key={preset}
                  onClick={() => setViewPreset(preset)}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                >
                  <PresetIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section & Measure Tools */}
      <div className="flex flex-col gap-1 bg-gray-900/80 backdrop-blur-sm rounded-xl p-1">
        <ToolButton
          icon={Scissors}
          label="Section Plane"
          onClick={toggleSectionPlane}
          active={sectionActive}
        />
        <ToolButton
          icon={Ruler}
          label="Measure"
          onClick={toggleMeasure}
          active={measureActive}
        />
      </div>

      {/* Display Options */}
      <div className="flex flex-col gap-1 bg-gray-900/80 backdrop-blur-sm rounded-xl p-1">
        <ToolButton
          icon={ghostingEnabled ? Sun : Moon}
          label={ghostingEnabled ? 'Disable Ghosting' : 'Enable Ghosting'}
          onClick={toggleGhosting}
          active={ghostingEnabled}
        />
        <ToolButton
          icon={isFullscreen ? Minimize2 : Maximize2}
          label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          onClick={onToggleFullscreen}
        />
      </div>
    </div>
  );
}
