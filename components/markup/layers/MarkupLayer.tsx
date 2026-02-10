'use client';

import React from 'react';
import { Layer } from 'react-konva';
import { useMarkupState } from '@/hooks/markup/useMarkupState';
import { MarkupShape } from '../MarkupShape';

interface MarkupLayerProps {
  layerId: string | null;
  visible?: boolean;
  opacity?: number;
}

export function MarkupLayer({ layerId, visible = true, opacity = 1 }: MarkupLayerProps) {
  const { shapesById, shapeIds, pageNumber } = useMarkupState();

  // Filter shapes for this layer and page
  const layerShapes = shapeIds
    .map((id) => shapesById.get(id))
    .filter((shape) => {
      if (!shape) return false;
      if (shape.pageNumber !== pageNumber) return false;
      if (layerId === null) {
        // Default layer - shapes with no layerId
        return !shape.layerId;
      }
      return shape.layerId === layerId;
    });

  if (!visible) {
    return <Layer visible={false} />;
  }

  return (
    <Layer opacity={opacity}>
      {layerShapes.map((shape) => {
        if (!shape) return null;
        return <MarkupShape key={shape.id} shape={shape} />;
      })}
    </Layer>
  );
}
