'use client';

import React, { useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { pdfToKonva } from '@/lib/markup/geometry-utils';

interface StampShapeProps {
  markup: MarkupRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pageHeight: number;
  scale: number;
}

export function StampShape({
  markup,
  isSelected,
  onSelect,
  pageHeight,
  scale,
}: StampShapeProps) {
  const { geometry, style, label, shapeType } = markup;

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

  const displayLabel = label ?? (shapeType === 'count_marker' ? '1' : 'STAMP');
  const fontSize = (style.fontSize ?? 14) * scale;

  return (
    <Group
      x={topLeft.x}
      y={topLeft.y}
      draggable={isSelected}
      onClick={handleClick}
      onTap={handleClick}
    >
      <Rect
        width={width}
        height={height}
        stroke={style.color}
        strokeWidth={style.strokeWidth * 2}
        fill={style.fillColor ?? 'transparent'}
        fillEnabled={!!style.fillColor}
        opacity={style.fillOpacity ?? style.opacity}
        cornerRadius={4}
      />
      <Text
        text={displayLabel}
        fontSize={fontSize}
        fontFamily={style.fontFamily ?? 'Arial'}
        fontStyle={`bold ${style.fontStyle ?? 'normal'}`}
        fill={style.color}
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
}
