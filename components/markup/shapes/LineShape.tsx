'use client';

import React, { useCallback } from 'react';
import { Line, Arrow } from 'react-konva';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { pdfToKonva, getDashPattern } from '@/lib/markup/geometry-utils';

interface LineShapeProps {
  markup: MarkupRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pageHeight: number;
  scale: number;
}

export function LineShape({
  markup,
  isSelected,
  onSelect,
  pageHeight,
  scale,
}: LineShapeProps) {
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

  const dashPattern = getDashPattern(style.lineStyle, style.strokeWidth);

  const handleClick = useCallback(() => {
    onSelect(markup.id);
  }, [onSelect, markup.id]);

  const sharedProps = {
    points: konvaPoints,
    stroke: style.color,
    strokeWidth: style.strokeWidth,
    opacity: style.opacity,
    dash: dashPattern,
    draggable: isSelected,
    onClick: handleClick,
    onTap: handleClick,
    strokeScaleEnabled: false,
  };

  if (shapeType === 'arrow') {
    const arrowStart = geometry.arrowStart !== 'none';
    const arrowEnd = geometry.arrowEnd !== 'none';

    return (
      <Arrow
        {...sharedProps}
        pointerAtBeginning={arrowStart}
        pointerAtEnding={arrowEnd}
        pointerLength={10}
        pointerWidth={8}
      />
    );
  }

  return <Line {...sharedProps} />;
}
