'use client';

import React, { useCallback } from 'react';
import { Line } from 'react-konva';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { pdfToKonva, getDashPattern } from '@/lib/markup/geometry-utils';

interface PolylineShapeProps {
  markup: MarkupRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pageHeight: number;
  scale: number;
}

export function PolylineShape({
  markup,
  isSelected,
  onSelect,
  pageHeight,
  scale,
}: PolylineShapeProps) {
  const { geometry, style } = markup;

  const handleClick = useCallback(() => {
    onSelect(markup.id);
  }, [onSelect, markup.id]);

  if (!geometry.points || geometry.points.length < 4) {
    return null;
  }

  // Convert points from PDF space to Konva space
  const konvaPoints: number[] = [];
  for (let i = 0; i < geometry.points.length; i += 2) {
    const pdfX = geometry.points[i];
    const pdfY = geometry.points[i + 1];
    const konvaPoint = pdfToKonva(pdfX, pdfY, pageHeight, scale);
    konvaPoints.push(konvaPoint.x, konvaPoint.y);
  }

  const dashPattern = getDashPattern(style.lineStyle, style.strokeWidth);

  return (
    <Line
      points={konvaPoints}
      stroke={style.color}
      strokeWidth={style.strokeWidth}
      opacity={style.opacity}
      dash={dashPattern}
      closed={false}
      draggable={isSelected}
      onClick={handleClick}
      onTap={handleClick}
      strokeScaleEnabled={false}
      tension={geometry.tension ?? 0}
      lineCap="round"
      lineJoin="round"
    />
  );
}
