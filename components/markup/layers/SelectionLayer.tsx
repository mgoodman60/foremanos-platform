'use client';

import React, { useRef, useEffect } from 'react';
import { Layer, Rect, Transformer } from 'react-konva';
import { useMarkupState } from '@/hooks/markup/useMarkupState';
import { secondaryColors, backgroundColors } from '@/lib/design-tokens';
import type Konva from 'konva';

interface SelectionLayerProps {
  isDragging?: boolean;
  dragStartX?: number;
  dragStartY?: number;
  dragCurrentX?: number;
  dragCurrentY?: number;
}

export function SelectionLayer({
  isDragging,
  dragStartX = 0,
  dragStartY = 0,
  dragCurrentX = 0,
  dragCurrentY = 0,
}: SelectionLayerProps) {
  const { selectedIds, shapesById: _shapesById, activeTool } = useMarkupState();
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectionRectRef = useRef<Konva.Rect>(null);

  // Attach transformer to selected shapes
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer || activeTool !== 'select') return;

    const selectedNodes: Konva.Node[] = [];

    // Get Konva nodes for selected shapes
    // Note: In a real implementation, you would maintain refs to the actual Konva shape nodes
    // For now, this is a placeholder that demonstrates the pattern

    transformer.nodes(selectedNodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, activeTool]);

  // Only show in select mode
  if (activeTool !== 'select') {
    return <Layer />;
  }

  // Calculate drag-select rectangle
  const selectionX = Math.min(dragStartX, dragCurrentX);
  const selectionY = Math.min(dragStartY, dragCurrentY);
  const selectionWidth = Math.abs(dragCurrentX - dragStartX);
  const selectionHeight = Math.abs(dragCurrentY - dragStartY);

  return (
    <Layer>
      {/* Drag-select rectangle */}
      {isDragging && (
        <Rect
          ref={selectionRectRef}
          x={selectionX}
          y={selectionY}
          width={selectionWidth}
          height={selectionHeight}
          fill="rgba(59, 130, 246, 0.1)"
          stroke={secondaryColors.blue[500]}
          strokeWidth={1}
          dash={[4, 4]}
        />
      )}

      {/* Transformer for selected shapes */}
      <Transformer
        ref={transformerRef}
        boundBoxFunc={(oldBox, newBox) => {
          // Limit resize
          if (newBox.width < 5 || newBox.height < 5) {
            return oldBox;
          }
          return newBox;
        }}
        enabledAnchors={[
          'top-left',
          'top-right',
          'bottom-left',
          'bottom-right',
          'top-center',
          'bottom-center',
          'middle-left',
          'middle-right',
        ]}
        rotateEnabled={true}
        borderStroke={secondaryColors.blue[500]}
        borderStrokeWidth={2}
        anchorStroke={secondaryColors.blue[500]}
        anchorFill={backgroundColors.light.base}
        anchorSize={8}
        anchorCornerRadius={2}
      />
    </Layer>
  );
}
