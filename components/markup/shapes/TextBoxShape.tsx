'use client';

import React, { useCallback, useState, useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { pdfToKonva } from '@/lib/markup/geometry-utils';

interface TextBoxShapeProps {
  markup: MarkupRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pageHeight: number;
  scale: number;
}

export function TextBoxShape({
  markup,
  isSelected,
  onSelect,
  pageHeight,
  scale,
}: TextBoxShapeProps) {
  const { geometry, style, content } = markup;
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const handleClick = useCallback(() => {
    onSelect(markup.id);
  }, [onSelect, markup.id]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    // In a full implementation, create a textarea overlay
    // For now, just toggle editing state
  }, []);

  const fontSize = (style.fontSize ?? 12) * scale;
  const fontFamily = style.fontFamily ?? 'Arial';
  const fontStyle = `${style.fontStyle ?? 'normal'} ${style.fontWeight ?? 'normal'}`;

  return (
    <Group
      x={topLeft.x}
      y={topLeft.y}
      draggable={isSelected}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDoubleClick}
      onDblTap={handleDoubleClick}
    >
      <Rect
        width={width}
        height={height}
        stroke={style.color}
        strokeWidth={style.strokeWidth}
        fill={style.fillColor ?? '#ffffff'}
        fillEnabled={true}
        opacity={style.fillOpacity ?? 1}
      />
      <Text
        text={content ?? ''}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontStyle={fontStyle}
        fill={style.color}
        width={width - 8}
        height={height - 8}
        padding={4}
        align="left"
        verticalAlign="top"
        wrap="word"
      />
    </Group>
  );
}
