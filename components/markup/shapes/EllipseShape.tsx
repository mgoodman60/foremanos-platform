'use client';

import React, { useCallback } from 'react';
import { Ellipse } from 'react-konva';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { pdfToKonva, getDashPattern } from '@/lib/markup/geometry-utils';

interface EllipseShapeProps {
  markup: MarkupRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pageHeight: number;
  scale: number;
}

export function EllipseShape({
  markup,
  isSelected,
  onSelect,
  pageHeight,
  scale,
}: EllipseShapeProps) {
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

  // Center at x + w/2, y + h/2
  const centerPdfX = geometry.x + geometry.width / 2;
  const centerPdfY = geometry.y + geometry.height / 2;
  const center = pdfToKonva(centerPdfX, centerPdfY, pageHeight, scale);

  const radiusX = (geometry.width * scale) / 2;
  const radiusY = (geometry.height * scale) / 2;

  const dashPattern = getDashPattern(style.lineStyle, style.strokeWidth);

  return (
    <Ellipse
      x={center.x}
      y={center.y}
      radiusX={radiusX}
      radiusY={radiusY}
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
