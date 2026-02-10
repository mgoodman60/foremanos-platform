'use client';

import React, { useCallback } from 'react';
import { Line } from 'react-konva';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { pdfToKonva } from '@/lib/markup/geometry-utils';

interface FreehandShapeProps {
  markup: MarkupRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pageHeight: number;
  scale: number;
}

export function FreehandShape({
  markup,
  isSelected,
  onSelect,
  pageHeight,
  scale,
}: FreehandShapeProps) {
  const { geometry, style, shapeType } = markup;

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

  const handleClick = useCallback(() => {
    onSelect(markup.id);
  }, [onSelect, markup.id]);

  // Highlighter: wide stroke, semi-transparent
  const isHighlighter = shapeType === 'highlighter';
  const strokeWidth = isHighlighter ? style.strokeWidth * 5 : style.strokeWidth;
  const opacity = isHighlighter ? 0.4 : style.opacity;

  return (
    <Line
      points={konvaPoints}
      stroke={style.color}
      strokeWidth={strokeWidth}
      opacity={opacity}
      tension={geometry.tension ?? 0.5}
      lineCap="round"
      lineJoin="round"
      draggable={isSelected}
      onClick={handleClick}
      onTap={handleClick}
      strokeScaleEnabled={false}
    />
  );
}
