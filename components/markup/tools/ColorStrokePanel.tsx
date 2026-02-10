'use client';

import React from 'react';
import type { MarkupStyle, LineStyle, ArrowheadStyle } from '@/lib/markup/markup-types';

const PRESET_COLORS = [
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#000000', // Black
  '#FFFFFF', // White
  '#808080', // Gray
  '#FFA500', // Orange
  '#800080', // Purple
  '#FFC0CB', // Pink
];

const LINE_STYLES: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'dash_dot', label: 'Dash-Dot' },
];

const ARROWHEAD_STYLES: { value: ArrowheadStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'circle', label: 'Circle' },
];

interface ColorStrokePanelProps {
  style: MarkupStyle;
  onStyleChange: (updates: Partial<MarkupStyle>) => void;
  showArrowheads?: boolean;
  showFill?: boolean;
  showFont?: boolean;
}

export function ColorStrokePanel({
  style,
  onStyleChange,
  showArrowheads = false,
  showFill = false,
  showFont = false,
}: ColorStrokePanelProps) {
  return (
    <div className="w-64 bg-gray-100 border-l border-gray-300 p-4 space-y-4 overflow-y-auto">
      {/* Color Swatches */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Stroke Color</label>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onStyleChange({ color })}
              className={`
                w-8 h-8 rounded border-2 transition-transform hover:scale-110
                ${style.color === color ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300'}
              `}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>

      {/* Stroke Width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Stroke Width: {style.strokeWidth}px
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={style.strokeWidth}
          onChange={(e) => onStyleChange({ strokeWidth: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Opacity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Opacity: {Math.round(style.opacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={style.opacity * 100}
          onChange={(e) => onStyleChange({ opacity: Number(e.target.value) / 100 })}
          className="w-full"
        />
      </div>

      {/* Line Style */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Line Style</label>
        <div className="grid grid-cols-2 gap-2">
          {LINE_STYLES.map((ls) => (
            <button
              key={ls.value}
              onClick={() => onStyleChange({ lineStyle: ls.value })}
              className={`
                px-3 py-2 text-sm rounded border
                ${
                  style.lineStyle === ls.value
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              {ls.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fill Color (conditional) */}
      {showFill && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fill Color</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onStyleChange({ fillColor: color })}
                  className={`
                    w-8 h-8 rounded border-2 transition-transform hover:scale-110
                    ${
                      style.fillColor === color
                        ? 'border-blue-500 ring-2 ring-blue-300'
                        : 'border-gray-300'
                    }
                  `}
                  style={{ backgroundColor: color }}
                  aria-label={`Select fill color ${color}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fill Opacity: {Math.round((style.fillOpacity ?? 0.5) * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={(style.fillOpacity ?? 0.5) * 100}
              onChange={(e) => onStyleChange({ fillOpacity: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </div>
        </>
      )}

      {/* Font Controls (conditional) */}
      {showFont && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Font Size</label>
            <input
              type="number"
              min="8"
              max="72"
              value={style.fontSize ?? 12}
              onChange={(e) => onStyleChange({ fontSize: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
            <select
              value={style.fontFamily ?? 'Arial'}
              onChange={(e) => onStyleChange({ fontFamily: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                onStyleChange({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' })
              }
              className={`
                flex-1 px-3 py-2 text-sm rounded border
                ${
                  style.fontWeight === 'bold'
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700'
                }
              `}
            >
              Bold
            </button>
            <button
              onClick={() =>
                onStyleChange({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })
              }
              className={`
                flex-1 px-3 py-2 text-sm rounded border
                ${
                  style.fontStyle === 'italic'
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700'
                }
              `}
            >
              Italic
            </button>
          </div>
        </>
      )}

      {/* Arrowhead Controls (conditional) */}
      {showArrowheads && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Arrow Start</label>
            <select
              value={style.dashPattern?.[0] ?? 'none'}
              onChange={(e) => {
                // Store arrowhead style in geometry, not style
                // This is a simplified implementation
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              {ARROWHEAD_STYLES.map((ah) => (
                <option key={ah.value} value={ah.value}>
                  {ah.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Arrow End</label>
            <select
              value={style.dashPattern?.[1] ?? 'none'}
              onChange={(e) => {
                // Store arrowhead style in geometry, not style
                // This is a simplified implementation
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              {ARROWHEAD_STYLES.map((ah) => (
                <option key={ah.value} value={ah.value}>
                  {ah.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
