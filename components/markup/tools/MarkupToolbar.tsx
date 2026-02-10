'use client';

import React from 'react';
import {
  MousePointer2,
  Hand,
  Minus,
  ArrowRight,
  Spline,
  Pentagon,
  Cloud,
  Square,
  Circle,
  Pen,
  Type,
  Ruler,
  Box,
  Highlighter,
  Eraser,
  Stamp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MarkupShapeType } from '@/lib/markup/markup-types';

interface ToolConfig {
  id: string;
  icon: LucideIcon;
  label: string;
  shapeType?: MarkupShapeType;
  group: 'select' | 'drawing' | 'text' | 'measurement' | 'other';
}

const TOOLS: ToolConfig[] = [
  // Select group
  { id: 'select', icon: MousePointer2, label: 'Select', group: 'select' },
  { id: 'pan', icon: Hand, label: 'Pan', group: 'select' },

  // Drawing group
  { id: 'line', icon: Minus, label: 'Line', shapeType: 'line', group: 'drawing' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow', shapeType: 'arrow', group: 'drawing' },
  { id: 'polyline', icon: Spline, label: 'Polyline', shapeType: 'polyline', group: 'drawing' },
  { id: 'polygon', icon: Pentagon, label: 'Polygon', shapeType: 'polygon', group: 'drawing' },
  { id: 'cloud', icon: Cloud, label: 'Cloud', shapeType: 'cloud', group: 'drawing' },
  { id: 'rectangle', icon: Square, label: 'Rectangle', shapeType: 'rectangle', group: 'drawing' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse', shapeType: 'ellipse', group: 'drawing' },
  { id: 'freehand', icon: Pen, label: 'Freehand', shapeType: 'freehand', group: 'drawing' },

  // Text group
  { id: 'text', icon: Type, label: 'Text Box', shapeType: 'text_box', group: 'text' },

  // Measurement group
  {
    id: 'distance',
    icon: Ruler,
    label: 'Distance',
    shapeType: 'distance_measurement',
    group: 'measurement',
  },
  {
    id: 'area',
    icon: Box,
    label: 'Area',
    shapeType: 'area_measurement',
    group: 'measurement',
  },

  // Other group
  {
    id: 'highlighter',
    icon: Highlighter,
    label: 'Highlighter',
    shapeType: 'highlighter',
    group: 'other',
  },
  { id: 'eraser', icon: Eraser, label: 'Eraser', group: 'other' },
  { id: 'stamp', icon: Stamp, label: 'Stamp', shapeType: 'stamp', group: 'other' },
];

interface MarkupToolbarProps {
  activeTool: string;
  onToolChange: (toolId: string) => void;
}

export function MarkupToolbar({ activeTool, onToolChange }: MarkupToolbarProps) {
  const groupedTools = TOOLS.reduce((acc, tool) => {
    if (!acc[tool.group]) {
      acc[tool.group] = [];
    }
    acc[tool.group].push(tool);
    return acc;
  }, {} as Record<string, ToolConfig[]>);

  return (
    <div className="w-12 bg-gray-900 border-r border-gray-700 flex flex-col gap-1 py-2">
      {Object.entries(groupedTools).map(([groupName, tools]) => (
        <div key={groupName} className="flex flex-col gap-1 px-1.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;

            return (
              <button
                key={tool.id}
                onClick={() => onToolChange(tool.id)}
                className={`
                  w-9 h-9 rounded flex items-center justify-center
                  transition-colors
                  ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
                title={tool.label}
                aria-label={tool.label}
              >
                <Icon size={18} />
              </button>
            );
          })}
          {/* Divider after each group except the last */}
          {groupName !== 'other' && (
            <div className="h-px bg-gray-700 my-1" />
          )}
        </div>
      ))}
    </div>
  );
}
