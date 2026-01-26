'use client';

import { useState, useEffect } from 'react';
import {
  Pencil, Type, Circle, Square, ArrowRight, Trash2, Save, Download,
  Undo, Redo, Palette, ChevronDown, MessageSquare, AlertTriangle,
  CheckCircle2, Pin
} from 'lucide-react';
import type { ViewerHandle } from './forge-viewer-enhanced';

interface Markup {
  id: string;
  type: 'freehand' | 'text' | 'circle' | 'rectangle' | 'arrow' | 'cloud' | 'pin';
  data: any;
  color: string;
  label?: string;
  category?: 'rfi' | 'issue' | 'note' | 'approval';
  createdAt: Date;
  createdBy?: string;
}

interface MarkupToolsProps {
  viewerRef: React.RefObject<ViewerHandle>;
  projectSlug: string;
  modelId?: string;
  onMarkupSave?: (markups: Markup[]) => void;
}

const COLORS = [
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'White', value: '#FFFFFF' },
];

const CATEGORIES = [
  { id: 'rfi', name: 'RFI', icon: MessageSquare, color: 'text-blue-400' },
  { id: 'issue', name: 'Issue', icon: AlertTriangle, color: 'text-red-400' },
  { id: 'note', name: 'Note', icon: Type, color: 'text-yellow-400' },
  { id: 'approval', name: 'Approved', icon: CheckCircle2, color: 'text-green-400' },
];

export default function MarkupTools({
  viewerRef,
  projectSlug,
  modelId,
  onMarkupSave,
}: MarkupToolsProps) {
  const [activeTool, setActiveTool] = useState<Markup['type'] | null>(null);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [showPanel, setShowPanel] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('note');
  const [markupExtension, setMarkupExtension] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextDialog, setShowTextDialog] = useState(false);

  // Load markup extension
  useEffect(() => {
    const loadExtension = async () => {
      const viewer = viewerRef.current?.viewer;
      if (!viewer) return;

      try {
        const ext = await viewer.loadExtension('Autodesk.Viewing.MarkupsCore');
        setMarkupExtension(ext);

        // Also try loading MarkupsGui for built-in tools
        try {
          await viewer.loadExtension('Autodesk.Viewing.MarkupsGui');
        } catch {
          // MarkupsGui may not be available
        }
      } catch (error) {
        console.error('Failed to load markup extension:', error);
      }
    };

    loadExtension();
  }, [viewerRef]);

  // Load existing markups
  useEffect(() => {
    if (!modelId || !projectSlug) return;

    const loadMarkups = async () => {
      try {
        const res = await fetch(`/api/projects/${projectSlug}/models/${modelId}/markups`);
        if (res.ok) {
          const data = await res.json();
          setMarkups(data.markups || []);
        }
      } catch (error) {
        console.error('Failed to load markups:', error);
      }
    };

    loadMarkups();
  }, [modelId, projectSlug]);

  const activateDrawTool = (tool: Markup['type']) => {
    if (activeTool === tool) {
      setActiveTool(null);
      markupExtension?.leaveEditMode?.();
      return;
    }

    setActiveTool(tool);

    if (markupExtension) {
      markupExtension.enterEditMode?.();
      // Set the drawing tool based on type
      const toolMap: Record<string, string> = {
        freehand: 'freehand',
        circle: 'circle',
        rectangle: 'rectangle',
        arrow: 'arrow',
        cloud: 'cloud',
        text: 'callout',
        pin: 'dimension',
      };
      markupExtension.changeEditMode?.(new markupExtension.constructor.EditModes[toolMap[tool] || 'freehand']());
    }

    if (tool === 'text') {
      setShowTextDialog(true);
    }
  };

  const addTextMarkup = () => {
    if (!textInput.trim()) return;

    const newMarkup: Markup = {
      id: `markup-${Date.now()}`,
      type: 'text',
      data: { text: textInput },
      color: selectedColor,
      label: textInput.substring(0, 30),
      category: selectedCategory as Markup['category'],
      createdAt: new Date(),
    };

    setMarkups(prev => [...prev, newMarkup]);
    setTextInput('');
    setShowTextDialog(false);
  };

  const deleteMarkup = (id: string) => {
    setMarkups(prev => prev.filter(m => m.id !== id));
  };

  const saveMarkups = async () => {
    if (!modelId) return;

    setIsLoading(true);
    try {
      // Get markup data from extension if available
      let markupSvg = '';
      if (markupExtension) {
        markupSvg = markupExtension.generateData?.() || '';
      }

      await fetch(`/api/projects/${projectSlug}/models/${modelId}/markups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markups, svg: markupSvg }),
      });

      onMarkupSave?.(markups);
    } catch (error) {
      console.error('Failed to save markups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportMarkups = () => {
    // Export as SVG/image
    if (markupExtension) {
      const svgData = markupExtension.generateData?.();
      if (svgData) {
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `markups-${modelId || 'model'}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const clearAllMarkups = () => {
    setMarkups([]);
    markupExtension?.clear?.();
  };

  const ToolButton = ({
    tool,
    icon: Icon,
    label,
  }: {
    tool: Markup['type'];
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }) => (
    <button
      onClick={() => activateDrawTool(tool)}
      className={`p-2 rounded-lg transition-all ${
        activeTool === tool
          ? 'bg-orange-500 text-white shadow-lg'
          : 'bg-gray-800 hover:bg-gray-700 text-white'
      }`}
      title={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );

  return (
    <div className="bg-[#161B22] border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pencil className="w-5 h-5 text-orange-400" />
          <h3 className="text-white font-medium">Markup & Annotations</h3>
        </div>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="text-gray-400 hover:text-white"
        >
          <ChevronDown className={`w-5 h-5 transition-transform ${showPanel ? '' : '-rotate-90'}`} />
        </button>
      </div>

      {showPanel && (
        <>
          {/* Tool Buttons */}
          <div className="p-3 grid grid-cols-7 gap-2">
            <ToolButton tool="freehand" icon={Pencil} label="Freehand" />
            <ToolButton tool="text" icon={Type} label="Text" />
            <ToolButton tool="circle" icon={Circle} label="Circle" />
            <ToolButton tool="rectangle" icon={Square} label="Rectangle" />
            <ToolButton tool="arrow" icon={ArrowRight} label="Arrow" />
            <ToolButton tool="cloud" icon={MessageSquare} label="Cloud" />
            <ToolButton tool="pin" icon={Pin} label="Pin" />
          </div>

          {/* Color Picker */}
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg hover:bg-gray-700"
              >
                <div
                  className="w-4 h-4 rounded-full border border-gray-600"
                  style={{ backgroundColor: selectedColor }}
                />
                <Palette className="w-4 h-4 text-gray-400" />
              </button>

              {showColorPicker && (
                <div className="flex gap-1">
                  {COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => {
                        setSelectedColor(color.value);
                        setShowColorPicker(false);
                      }}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        selectedColor === color.value ? 'border-white scale-110' : 'border-gray-600'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category Selector */}
          <div className="px-3 pb-3">
            <div className="flex gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-gray-700 ring-1 ring-gray-500'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <cat.icon className={`w-3 h-3 ${cat.color}`} />
                  <span className="text-gray-300">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-3 pb-3 flex gap-2">
            <button
              onClick={saveMarkups}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span className="text-sm">Save</span>
            </button>
            <button
              onClick={exportMarkups}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={clearAllMarkups}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Markups List */}
          {markups.length > 0 && (
            <div className="border-t border-gray-700 max-h-48 overflow-y-auto">
              {markups.map((markup, idx) => (
                <div
                  key={markup.id}
                  className="px-3 py-2 border-b border-gray-800 last:border-b-0 flex items-center justify-between hover:bg-gray-800/50"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: markup.color }}
                    />
                    <span className="text-gray-300 text-sm">
                      {markup.label || `${markup.type} #${idx + 1}`}
                    </span>
                    {markup.category && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        markup.category === 'rfi' ? 'bg-blue-500/20 text-blue-400' :
                        markup.category === 'issue' ? 'bg-red-500/20 text-red-400' :
                        markup.category === 'approval' ? 'bg-green-500/20 text-green-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {markup.category.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMarkup(markup.id)}
                    className="p-1 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Active Tool Indicator */}
          {activeTool && (
            <div className="p-3 bg-orange-500/10 border-t border-orange-500/30">
              <p className="text-orange-400 text-sm text-center">
                Draw on the model view with your mouse
              </p>
            </div>
          )}
        </>
      )}

      {/* Text Input Dialog */}
      {showTextDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1F2328] border border-gray-700 rounded-xl p-4 w-96">
            <h4 className="text-white font-medium mb-3">Add Text Annotation</h4>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter annotation text..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowTextDialog(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={addTextMarkup}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-400"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
