'use client';

import React, { useCallback } from 'react';
import { Rect } from 'react-konva';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { pdfToKonva, getDashPattern } from '@/lib/markup/geometry-utils';

interface RectangleShapeProps {
  markup: MarkupRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pageHeight: number;
  scale: number;
}

export function RectangleShape({
  markup,
  isSelected,
  onSelect,
  pageHeight,
  scale,
}: RectangleShapeProps) {
  const { geometry, style } = markup;

  const handleClick = useCallback(() => {
    onSelect(markup.id);
  }, [onSelect, markup.id]);

  if (
    geometry.x == null ||
    geometry.y == null ||
    geometry.width == null ||
    geometry.height == null
  ) {
    return null;
  }

  const topLeft = pdfToKonva(geometry.x, geometry.y + geometry.height, pageHeight, scale);
  const width = geometry.width * scale;
  const height = geometry.height * scale;

  const dashPattern = getDashPattern(style.lineStyle, style.strokeWidth);

  return (
    <Rect
      x={topLeft.x}
      y={topLeft.y}
      width={width}
      height={height}
      stroke={style.color}
      strokeWidth={style.strokeWidth}
      fill={style.fillColor}
      fillEnabled={!!style.fillColor}
      opacity={style.fillColor ? style.fillOpacity ?? style.opacity : style.opacity}
      dash={dashPattern}
      rotation={geometry.rotation ?? 0}
      draggable={isSelected}
      onClick={handleClick}
      onTap={handleClick}
      strokeScaleEnabled={false}
    />
  );
}
