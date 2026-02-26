'use client';

import React, { useCallback } from 'react';
import { Shape } from 'react-konva';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { pdfToKonva } from '@/lib/markup/geometry-utils';

interface CloudShapeProps {
  markup: MarkupRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pageHeight: number;
  scale: number;
}

export function CloudShape({
  markup,
  isSelected,
  onSelect,
  pageHeight,
  scale,
}: CloudShapeProps) {
  const { geometry, style } = markup;

  const handleClick = useCallback(() => {
    onSelect(markup.id);
  }, [onSelect, markup.id]);

  const width = (geometry.width ?? 0) * scale;
  const height = (geometry.height ?? 0) * scale;

  const sceneFunc = useCallback(
    (context: any, shape: any) => {
      const x = 0;
      const y = 0;
      const w = width;
      const h = height;

      // Draw scalloped arcs along rectangle edges
      const arcRadius = 12;
      const numArcs = Math.floor(w / (arcRadius * 2));
      const arcSpacing = w / numArcs;

      context.beginPath();

      // Top edge
      for (let i = 0; i < numArcs; i++) {
        const centerX = x + i * arcSpacing + arcSpacing / 2;
        const centerY = y;
        context.arc(centerX, centerY, arcRadius, Math.PI, 0, false);
      }

      // Right edge
      const numArcsV = Math.floor(h / (arcRadius * 2));
      const arcSpacingV = h / numArcsV;
      for (let i = 0; i < numArcsV; i++) {
        const centerX = x + w;
        const centerY = y + i * arcSpacingV + arcSpacingV / 2;
        context.arc(centerX, centerY, arcRadius, Math.PI * 1.5, Math.PI * 0.5, false);
      }

      // Bottom edge
      for (let i = numArcs; i > 0; i--) {
        const centerX = x + i * arcSpacing - arcSpacing / 2;
        const centerY = y + h;
        context.arc(centerX, centerY, arcRadius, 0, Math.PI, false);
      }

      // Left edge
      for (let i = numArcsV; i > 0; i--) {
        const centerX = x;
        const centerY = y + i * arcSpacingV - arcSpacingV / 2;
        context.arc(centerX, centerY, arcRadius, Math.PI * 0.5, Math.PI * 1.5, false);
      }

      context.closePath();
      context.fillStrokeShape(shape);
    },
    [width, height]
  );

  if (
    geometry.x == null ||
    geometry.y == null ||
    geometry.width == null ||
    geometry.height == null
  ) {
    return null;
  }

  const topLeft = pdfToKonva(geometry.x, geometry.y + geometry.height, pageHeight, scale);

  return (
    <Shape
      x={topLeft.x}
      y={topLeft.y}
      sceneFunc={sceneFunc}
      stroke={style.color}
      strokeWidth={style.strokeWidth}
      fill={style.fillColor}
      fillEnabled={!!style.fillColor}
      opacity={style.fillColor ? style.fillOpacity ?? style.opacity : style.opacity}
      draggable={isSelected}
      onClick={handleClick}
      onTap={handleClick}
    />
  );
}
