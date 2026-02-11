'use client';

import { useState, useEffect } from 'react';
import { Scissors, Box, Eye, EyeOff, RotateCcw, X, Plus, ChevronDown } from 'lucide-react';
import type { ViewerHandle } from './forge-viewer-enhanced';

interface SectionPlane {
  id: string;
  name: string;
  axis: 'x' | 'y' | 'z';
  position: number;
  visible: boolean;
  flipped: boolean;
}

interface SectionToolsProps {
  viewerRef: React.RefObject<ViewerHandle>;
  onSectionChange?: (sections: SectionPlane[]) => void;
}

export default function SectionTools({
  viewerRef,
  onSectionChange,
}: SectionToolsProps) {
  const [sections, setSections] = useState<SectionPlane[]>([]);
  const [showPanel, setShowPanel] = useState(true);
  const [sectionExtension, setSectionExtension] = useState<any>(null);
  const [isExtensionLoaded, setIsExtensionLoaded] = useState(false);

  // Load section extension
  useEffect(() => {
    const loadExtension = async () => {
      const viewer = viewerRef.current?.viewer;
      if (!viewer) return;

      try {
        const ext = await viewer.loadExtension('Autodesk.Section');
        setSectionExtension(ext);
        setIsExtensionLoaded(true);
      } catch (error) {
        console.error('Failed to load section extension:', error);
        setIsExtensionLoaded(true);
      }
    };

    loadExtension();
  }, [viewerRef]);

  const addSection = (axis: 'x' | 'y' | 'z') => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;

    const newSection: SectionPlane = {
      id: `section-${Date.now()}`,
      name: `${axis.toUpperCase()} Section ${sections.filter(s => s.axis === axis).length + 1}`,
      axis,
      position: 0,
      visible: true,
      flipped: false,
    };

    setSections(prev => [...prev, newSection]);
    
    // Apply to viewer
    if (sectionExtension) {
      const normal = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
      sectionExtension.setSectionPlane?.({ normal, position: 0 });
    }

    onSectionChange?.([...sections, newSection]);
  };

  const updateSectionPosition = (id: string, position: number) => {
    setSections(prev => {
      const updated = prev.map(s => 
        s.id === id ? { ...s, position } : s
      );
      onSectionChange?.(updated);
      return updated;
    });

    // Update viewer
    const section = sections.find(s => s.id === id);
    if (section && sectionExtension) {
      const normal = section.axis === 'x' ? [1, 0, 0] : section.axis === 'y' ? [0, 1, 0] : [0, 0, 1];
      sectionExtension.setSectionPlane?.({ normal, position });
    }
  };

  const toggleSectionVisibility = (id: string) => {
    setSections(prev => {
      const updated = prev.map(s => 
        s.id === id ? { ...s, visible: !s.visible } : s
      );
      onSectionChange?.(updated);
      return updated;
    });
  };

  const flipSection = (id: string) => {
    setSections(prev => {
      const updated = prev.map(s => 
        s.id === id ? { ...s, flipped: !s.flipped } : s
      );
      onSectionChange?.(updated);
      return updated;
    });
  };

  const deleteSection = (id: string) => {
    setSections(prev => {
      const updated = prev.filter(s => s.id !== id);
      onSectionChange?.(updated);
      return updated;
    });
  };

  const clearAllSections = () => {
    setSections([]);
    sectionExtension?.clearSectionPlanes?.();
    onSectionChange?.([]);
  };

  const applyBoxSection = () => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer) return;

    // Get model bounds and create a section box
    if (sectionExtension) {
      sectionExtension.setSectionBox?.();
    }
  };

  return (
    <div className="bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-purple-400" aria-hidden="true" />
          <h3 className="text-white font-medium">Section / Clipping</h3>
        </div>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="text-gray-400 hover:text-white"
        >
          <ChevronDown className={`w-5 h-5 transition-transform ${showPanel ? '' : '-rotate-90'}`} aria-hidden="true" />
        </button>
      </div>

      {showPanel && (
        <>
          {/* Quick Add Buttons */}
          <div className="p-3 grid grid-cols-4 gap-2">
            <button
              onClick={() => addSection('x')}
              className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-all"
              title="Add X Section (Left/Right)"
            >
              <span className="text-xs font-bold">X</span>
            </button>
            <button
              onClick={() => addSection('y')}
              className="p-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/30 transition-all"
              title="Add Y Section (Front/Back)"
            >
              <span className="text-xs font-bold">Y</span>
            </button>
            <button
              onClick={() => addSection('z')}
              className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/30 transition-all"
              title="Add Z Section (Top/Bottom)"
            >
              <span className="text-xs font-bold">Z</span>
            </button>
            <button
              onClick={applyBoxSection}
              className="p-2 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-400 hover:bg-purple-500/30 transition-all"
              title="Section Box"
            >
              <Box className="w-4 h-4 mx-auto" />
            </button>
          </div>

          {/* Section List */}
          {sections.length > 0 && (
            <div className="border-t border-gray-700">
              <div className="p-2 flex items-center justify-between border-b border-gray-800">
                <span className="text-sm text-gray-400">{sections.length} section plane(s)</span>
                <button
                  onClick={clearAllSections}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear All
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {sections.map(section => (
                  <div
                    key={section.id}
                    className="p-3 border-b border-gray-800 last:border-b-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                          section.axis === 'x' ? 'bg-red-500/20 text-red-400' :
                          section.axis === 'y' ? 'bg-green-500/20 text-green-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {section.axis.toUpperCase()}
                        </span>
                        <span className="text-white text-sm">{section.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleSectionVisibility(section.id)}
                          className="p-1 text-gray-400 hover:text-white"
                          title={section.visible ? 'Hide' : 'Show'}
                        >
                          {section.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => flipSection(section.id)}
                          className="p-1 text-gray-400 hover:text-white"
                          title="Flip Direction"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSection(section.id)}
                          className="p-1 text-gray-400 hover:text-red-400"
                          title="Delete"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Position Slider */}
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={section.position}
                        onChange={(e) => updateSectionPosition(section.id, parseInt(e.target.value))}
                        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-gray-400 text-xs w-10 text-right font-mono">
                        {section.position}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {sections.length === 0 && (
            <div className="p-4 text-center text-gray-400 text-sm">
              <p>No section planes active</p>
              <p className="text-xs mt-1">Click X, Y, or Z to add a cutting plane</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
