'use client';

import React from 'react';
import { Layer, Line, Rect, Circle, Text } from 'react-konva';
import { useMarkupState } from '@/hooks/markup/useMarkupState';
import { getDashPattern } from '@/lib/markup/geometry-utils';

interface CursorPreviewLayerProps {
  cursorX?: number;
  cursorY?: number;
}

export function CursorPreviewLayer({ cursorX = 0, cursorY = 0 }: CursorPreviewLayerProps) {
  const { activeTool, isDrawing, drawingPoints, activeStyle } = useMarkupState();

  // Only show preview when drawing
  if (!isDrawing || drawingPoints.length === 0) {
    return <Layer />;
  }

  const { color, strokeWidth, lineStyle, opacity } = activeStyle;
  const previewOpacity = opacity * 0.5; // 50% opacity for preview

  // Get dash pattern if applicable
  const dash = getDashPattern(lineStyle, strokeWidth);

  return (
    <Layer>
      {/* Line/Arrow preview */}
      {(activeTool === 'line' || activeTool === 'arrow') && drawingPoints.length >= 2 && (
        <Line
          points={drawingPoints}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={previewOpacity}
          dash={dash}
          lineCap="round"
          lineJoin="round"
        />
      )}

      {/* Rectangle preview */}
      {activeTool === 'rectangle' && drawingPoints.length >= 4 && (
        <Rect
          x={Math.min(drawingPoints[0], drawingPoints[2])}
          y={Math.min(drawingPoints[1], drawingPoints[3])}
          width={Math.abs(drawingPoints[2] - drawingPoints[0])}
          height={Math.abs(drawingPoints[3] - drawingPoints[1])}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={previewOpacity}
          dash={dash}
        />
      )}

      {/* Ellipse preview */}
      {activeTool === 'ellipse' && drawingPoints.length >= 4 && (
        <Circle
          x={(drawingPoints[0] + drawingPoints[2]) / 2}
          y={(drawingPoints[1] + drawingPoints[3]) / 2}
          radiusX={Math.abs(drawingPoints[2] - drawingPoints[0]) / 2}
          radiusY={Math.abs(drawingPoints[3] - drawingPoints[1]) / 2}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={previewOpacity}
          dash={dash}
        />
      )}

      {/* Freehand preview */}
      {activeTool === 'freehand' && drawingPoints.length >= 2 && (
        <Line
          points={drawingPoints}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={previewOpacity}
          lineCap="round"
          lineJoin="round"
          tension={0.5}
        />
      )}

      {/* Polyline preview */}
      {activeTool === 'polyline' && drawingPoints.length >= 2 && (
        <>
          <Line
            points={drawingPoints}
            stroke={color}
            strokeWidth={strokeWidth}
            opacity={previewOpacity}
            dash={dash}
            lineCap="round"
            lineJoin="round"
          />
          {/* Show vertex markers */}
          {drawingPoints.map((_, i) => {
            if (i % 2 === 0) {
              return (
                <Circle
                  key={i}
                  x={drawingPoints[i]}
                  y={drawingPoints[i + 1]}
                  radius={4}
                  fill={color}
                  opacity={previewOpacity}
                />
              );
            }
            return null;
          })}
        </>
      )}

      {/* Cursor position indicator */}
      <Circle
        x={cursorX}
        y={cursorY}
        radius={3}
        fill={color}
        opacity={0.5}
      />
    </Layer>
  );
}
