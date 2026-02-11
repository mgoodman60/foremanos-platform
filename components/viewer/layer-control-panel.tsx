'use client';

import { useState, useEffect, useCallback } from 'react';
import { Layers, Eye, EyeOff, ChevronDown, ChevronRight, Search, Palette, Sliders, RotateCcw, Filter, Check, Square, CheckSquare } from 'lucide-react';
import type { ViewerHandle } from './forge-viewer-enhanced';
import { semanticColors, chartColors, primaryColors, neutralColors } from '@/lib/design-tokens';

interface LayerInfo {
  name: string;
  visible: boolean;
  color?: string;
  elementCount: number;
  category?: string;
}

interface LayerControlPanelProps {
  viewerRef: React.RefObject<ViewerHandle>;
  modelId: string;
  projectSlug: string;
  layerCategories?: Record<string, number>;
  totalLayers?: number;
  className?: string;
}

// Layer category colors for visual coding
const CATEGORY_COLORS: Record<string, string> = {
  'Contours': semanticColors.success[400],
  'Grading': semanticColors.warning[500],
  'Erosion': semanticColors.error[500],
  'Utilities': chartColors.palette[4],
  'Structures': chartColors.neutral,
  'Text': chartColors.palette[4],
  'Dimensions': primaryColors.orange[500],
  'Boundaries': chartColors.palette[5],
  'Hatches': chartColors.palette[4],
  'Other': neutralColors.slate[400],
};

// Common layer name patterns for auto-categorization
const LAYER_PATTERNS: Record<string, RegExp[]> = {
  'Contours': [/contour/i, /elev/i, /topo/i, /c-topo/i],
  'Grading': [/grad/i, /slope/i, /cut/i, /fill/i, /c-grad/i],
  'Erosion': [/erosion/i, /silt/i, /fence/i, /swppp/i, /bmp/i, /sediment/i],
  'Utilities': [/util/i, /pipe/i, /water/i, /sewer/i, /storm/i, /elec/i, /gas/i, /u-/i],
  'Structures': [/bldg/i, /struct/i, /found/i, /wall/i, /a-wall/i, /s-/i],
  'Text': [/text/i, /note/i, /label/i, /anno/i, /t-/i],
  'Dimensions': [/dim/i, /defpoints/i, /d-/i],
  'Boundaries': [/bound/i, /prop/i, /lot/i, /ease/i, /row/i, /v-/i],
  'Hatches': [/hatch/i, /patt/i, /fill/i],
};

function categorizeLayer(layerName: string): string {
  for (const [category, patterns] of Object.entries(LAYER_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(layerName))) {
      return category;
    }
  }
  return 'Other';
}

export default function LayerControlPanel({
  viewerRef,
  modelId,
  projectSlug,
  layerCategories,
  totalLayers,
  className = '',
}: LayerControlPanelProps) {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Contours', 'Grading', 'Erosion']));
  const [globalOpacity, setGlobalOpacity] = useState(100);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set());

  // Fetch layers from model
  const fetchLayers = useCallback(async () => {
    if (!viewerRef.current?.viewer) {
      // If viewer not ready, try to get layers from API
      try {
        const response = await fetch(`/api/autodesk/models/${modelId}/layers?projectSlug=${projectSlug}`);
        if (response.ok) {
          const data = await response.json();
          const layerList: LayerInfo[] = (data.layers || []).map((name: string) => ({
            name,
            visible: true,
            category: categorizeLayer(name),
            elementCount: layerCategories?.[name] || 0,
            color: CATEGORY_COLORS[categorizeLayer(name)],
          }));
          setLayers(layerList);
        }
      } catch (error) {
        console.error('[LayerControl] Failed to fetch layers:', error);
      }
      setLoading(false);
      return;
    }

    const viewer = viewerRef.current.viewer;
    
    try {
      // Try to get layers from the model's layer extension
      const ext = await viewer.loadExtension('Autodesk.AEC.LevelsExtension');
      if (ext) {
        // For DWG files, layers are handled differently
        // We'll use the model tree to enumerate layers
      }
      
      // Try getting layers from model tree
      const tree = await viewerRef.current.getModelTree();
      const layerMap = new Map<string, number>();
      
      // Traverse tree and collect layer info
      const collectLayers = (node: any) => {
        if (node.name && node.name.includes('Layer:')) {
          const layerName = node.name.replace('Layer:', '').trim();
          layerMap.set(layerName, (layerMap.get(layerName) || 0) + 1);
        }
        if (node.children) {
          node.children.forEach(collectLayers);
        }
      };
      
      if (tree) {
        collectLayers(tree);
      }

      // Convert to layer list
      const layerList: LayerInfo[] = Array.from(layerMap.entries()).map(([name, count]) => ({
        name,
        visible: true,
        category: categorizeLayer(name),
        elementCount: count,
        color: CATEGORY_COLORS[categorizeLayer(name)],
      }));

      // If no layers found from tree, use API data
      if (layerList.length === 0 && layerCategories) {
        Object.entries(layerCategories).forEach(([name, count]) => {
          layerList.push({
            name,
            visible: true,
            category: categorizeLayer(name),
            elementCount: count,
            color: CATEGORY_COLORS[categorizeLayer(name)],
          });
        });
      }

      setLayers(layerList);
    } catch (error) {
      console.error('[LayerControl] Error loading layers:', error);
      // Fallback: create layers from categories
      if (layerCategories) {
        const layerList: LayerInfo[] = Object.entries(layerCategories).map(([name, count]) => ({
          name,
          visible: true,
          category: categorizeLayer(name),
          elementCount: count,
          color: CATEGORY_COLORS[categorizeLayer(name)],
        }));
        setLayers(layerList);
      }
    } finally {
      setLoading(false);
    }
  }, [viewerRef, modelId, projectSlug, layerCategories]);

  useEffect(() => {
    fetchLayers();
  }, [fetchLayers]);

  // Toggle layer visibility
  const toggleLayer = useCallback(async (layerName: string) => {
    if (!viewerRef.current?.viewer) return;

    const viewer = viewerRef.current.viewer;
    const layer = layers.find(l => l.name === layerName);
    if (!layer) return;

    try {
      // Search for objects on this layer and toggle visibility
      const dbIds = await new Promise<number[]>((resolve) => {
        viewer.search(layerName, (ids) => resolve(ids), () => resolve([]), ['Layer']);
      });

      if (dbIds.length > 0) {
        if (layer.visible) {
          viewer.hide(dbIds);
        } else {
          viewer.show(dbIds);
        }
      }

      // Update local state
      setLayers(prev => prev.map(l => 
        l.name === layerName ? { ...l, visible: !l.visible } : l
      ));
    } catch (error) {
      console.error('[LayerControl] Toggle layer error:', error);
    }
  }, [viewerRef, layers]);

  // Toggle category visibility
  const toggleCategory = useCallback(async (category: string) => {
    const categoryLayers = layers.filter(l => l.category === category);
    const allVisible = categoryLayers.every(l => l.visible);

    // Toggle all layers in category
    for (const layer of categoryLayers) {
      if ((allVisible && layer.visible) || (!allVisible && !layer.visible)) {
        await toggleLayer(layer.name);
      }
    }
  }, [layers, toggleLayer]);

  // Show all layers
  const showAllLayers = useCallback(() => {
    if (viewerRef.current?.viewer) {
      viewerRef.current.viewer.showAll();
    }
    setLayers(prev => prev.map(l => ({ ...l, visible: true })));
  }, [viewerRef]);

  // Hide all layers
  const hideAllLayers = useCallback(() => {
    if (viewerRef.current?.viewer) {
      viewerRef.current.viewer.hideAll();
    }
    setLayers(prev => prev.map(l => ({ ...l, visible: false })));
  }, [viewerRef]);

  // Isolate selected layers (show only these)
  const isolateSelected = useCallback(async () => {
    if (selectedLayers.size === 0) return;
    
    // Hide all first
    hideAllLayers();
    
    // Show only selected
    for (const layerName of selectedLayers) {
      const layer = layers.find(l => l.name === layerName);
      if (layer && !layer.visible) {
        await toggleLayer(layerName);
      }
    }
  }, [selectedLayers, layers, hideAllLayers, toggleLayer]);

  // Filter layers by search
  const filteredLayers = layers.filter(layer =>
    layer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group layers by category
  const groupedLayers = filteredLayers.reduce((acc, layer) => {
    const cat = layer.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(layer);
    return acc;
  }, {} as Record<string, LayerInfo[]>);

  // Sort categories by element count
  const sortedCategories = Object.entries(groupedLayers)
    .sort(([, a], [, b]) => b.reduce((sum, l) => sum + l.elementCount, 0) - a.reduce((sum, l) => sum + l.elementCount, 0));

  const toggleCategoryExpand = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleLayerSelection = (layerName: string) => {
    setSelectedLayers(prev => {
      const next = new Set(prev);
      if (next.has(layerName)) {
        next.delete(layerName);
      } else {
        next.add(layerName);
      }
      return next;
    });
  };

  return (
    <div className={`bg-gray-800/95 backdrop-blur rounded-lg border border-gray-700 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-white">Layer Controls</h3>
          </div>
          <span className="text-xs text-gray-400">
            {layers.length} layers
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search layers..."
            className="w-full bg-gray-900 border border-gray-600 rounded pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-2 border-b border-gray-700 flex items-center gap-2 flex-wrap">
        <button
          onClick={showAllLayers}
          className="flex items-center gap-1 px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded text-xs transition-colors"
        >
          <Eye className="w-3 h-3" aria-hidden="true" />
          Show All
        </button>
        <button
          onClick={hideAllLayers}
          className="flex items-center gap-1 px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs transition-colors"
        >
          <EyeOff className="w-3 h-3" aria-hidden="true" />
          Hide All
        </button>
        {selectedLayers.size > 0 && (
          <button
            onClick={isolateSelected}
            className="flex items-center gap-1 px-2 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded text-xs transition-colors"
          >
            <Filter className="w-3 h-3" aria-hidden="true" />
            Isolate ({selectedLayers.size})
          </button>
        )}
        <button
          onClick={() => setSelectedLayers(new Set())}
          className="flex items-center gap-1 px-2 py-1 bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 rounded text-xs transition-colors"
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          Reset
        </button>
      </div>

      {/* Global Opacity Control */}
      <div className="p-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Sliders className="w-3 h-3 text-gray-400" aria-hidden="true" />
          <span className="text-xs text-gray-400">Opacity</span>
          <input
            type="range"
            min="0"
            max="100"
            value={globalOpacity}
            onChange={(e) => setGlobalOpacity(parseInt(e.target.value))}
            className="flex-1 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
          />
          <span className="text-xs text-gray-300 w-8 text-right">{globalOpacity}%</span>
        </div>
      </div>

      {/* Layer List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedCategories.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No layers found
          </div>
        ) : (
          sortedCategories.map(([category, categoryLayers]) => {
            const allVisible = categoryLayers.every(l => l.visible);
            const someVisible = categoryLayers.some(l => l.visible);
            const isExpanded = expandedCategories.has(category);
            const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
            const totalElements = categoryLayers.reduce((sum, l) => sum + l.elementCount, 0);

            return (
              <div key={category} className="rounded border border-gray-700 overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategoryExpand(category)}
                  className="w-full flex items-center gap-2 p-2 bg-gray-700/50 hover:bg-gray-700 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  )}
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: categoryColor }}
                  />
                  <span className="text-sm font-medium text-white flex-1 text-left">
                    {category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {categoryLayers.length} layers
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCategory(category);
                    }}
                    className={`p-1 rounded hover:bg-gray-600 transition-colors ${
                      allVisible ? 'text-green-400' : someVisible ? 'text-yellow-400' : 'text-gray-400'
                    }`}
                    title={allVisible ? 'Hide category' : 'Show category'}
                  >
                    {allVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </button>

                {/* Category Layers */}
                {isExpanded && (
                  <div className="bg-gray-800/50">
                    {categoryLayers.map((layer) => (
                      <div
                        key={layer.name}
                        className={`flex items-center gap-2 p-2 hover:bg-gray-700/50 transition-colors border-t border-gray-700/50 ${
                          selectedLayers.has(layer.name) ? 'bg-cyan-900/20' : ''
                        }`}
                      >
                        {/* Selection checkbox */}
                        <button
                          onClick={() => toggleLayerSelection(layer.name)}
                          className="text-gray-400 hover:text-cyan-400"
                        >
                          {selectedLayers.has(layer.name) ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        {/* Color indicator */}
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: layer.color || categoryColor, opacity: layer.visible ? 1 : 0.3 }}
                        />

                        {/* Layer name */}
                        <span className={`text-xs flex-1 truncate ${
                          layer.visible ? 'text-gray-200' : 'text-gray-400'
                        }`}>
                          {layer.name}
                        </span>

                        {/* Element count */}
                        {layer.elementCount > 0 && (
                          <span className="text-xs text-gray-400">
                            {layer.elementCount}
                          </span>
                        )}

                        {/* Visibility toggle */}
                        <button
                          onClick={() => toggleLayer(layer.name)}
                          className={`p-1 rounded hover:bg-gray-600 transition-colors ${
                            layer.visible ? 'text-green-400' : 'text-gray-400'
                          }`}
                        >
                          {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Overlay Legend */}
      <div className="p-2 border-t border-gray-700">
        <div className="text-xs text-gray-400 mb-2">Color Legend</div>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(CATEGORY_COLORS).slice(0, 6).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-400 truncate">{cat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
