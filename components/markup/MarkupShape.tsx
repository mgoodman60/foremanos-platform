'use client';

import React from 'react';
import { Line, Rect, Circle, Text as KonvaText, Arrow } from 'react-konva';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { useMarkupState } from '@/hooks/markup/useMarkupState';
import { pdfToKonva, getDashPattern } from '@/lib/markup/geometry-utils';

interface MarkupShapeProps {
  shape: MarkupRecord;
}

export function MarkupShape({ shape }: MarkupShapeProps) {
  const { pageHeight, zoom, selectedIds, selectShape, updateShape } = useMarkupState();
  const isSelected = selectedIds.has(shape.id);

  const { geometry, style, shapeType } = shape;
  const { color, strokeWidth, fillColor, fillOpacity, opacity, lineStyle } = style;

  // Get dash pattern
  const dash = getDashPattern(lineStyle, strokeWidth);

  // Common event handlers
  const handleClick = () => {
    selectShape(shape.id);
  };

  const handleDragEnd = (e: any) => {
    const node = e.target;
    const updatedGeometry = { ...geometry };

    if (shapeType === 'rectangle' || shapeType === 'ellipse' || shapeType === 'text_box') {
      updatedGeometry.x = node.x() / zoom;
      updatedGeometry.y = (pageHeight * zoom - node.y()) / zoom;
    }

    updateShape(shape.id, { geometry: updatedGeometry });
  };

  // Line shapes
  if (shapeType === 'line' && geometry.points && geometry.points.length >= 2) {
    const konvaPoints: number[] = [];
    for (let i = 0; i < geometry.points.length; i += 2) {
      const konva = pdfToKonva(geometry.points[i], geometry.points[i + 1], pageHeight, zoom);
      konvaPoints.push(konva.x, konva.y);
    }

    return (
      <Line
        points={konvaPoints}
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={opacity}
        dash={dash}
        lineCap="round"
        lineJoin="round"
        onClick={handleClick}
        strokeScaleEnabled={false}
      />
    );
  }

  // Arrow shapes
  if (shapeType === 'arrow' && geometry.points && geometry.points.length >= 2) {
    const konvaPoints: number[] = [];
    for (let i = 0; i < geometry.points.length; i += 2) {
      const konva = pdfToKonva(geometry.points[i], geometry.points[i + 1], pageHeight, zoom);
      konvaPoints.push(konva.x, konva.y);
    }

    return (
      <Arrow
        points={konvaPoints}
        stroke={color}
        strokeWidth={strokeWidth}
        fill={color}
        opacity={opacity}
        dash={dash}
        lineCap="round"
        lineJoin="round"
        pointerLength={10}
        pointerWidth={8}
        onClick={handleClick}
        strokeScaleEnabled={false}
      />
    );
  }

  // Polyline/Polygon/Freehand
  if (
    (shapeType === 'polyline' || shapeType === 'polygon' || shapeType === 'freehand') &&
    geometry.points &&
    geometry.points.length >= 2
  ) {
    const konvaPoints: number[] = [];
    for (let i = 0; i < geometry.points.length; i += 2) {
      const konva = pdfToKonva(geometry.points[i], geometry.points[i + 1], pageHeight, zoom);
      konvaPoints.push(konva.x, konva.y);
    }

    return (
      <Line
        points={konvaPoints}
        stroke={color}
        strokeWidth={strokeWidth}
        fill={fillColor}
        fillEnabled={!!fillColor}
        opacity={opacity}
        dash={dash}
        lineCap="round"
        lineJoin="round"
        tension={shapeType === 'freehand' ? 0.5 : 0}
        closed={shapeType === 'polygon'}
        onClick={handleClick}
        strokeScaleEnabled={false}
      />
    );
  }

  // Rectangle
  if (
    shapeType === 'rectangle' &&
    geometry.x != null &&
    geometry.y != null &&
    geometry.width != null &&
    geometry.height != null
  ) {
    const konva = pdfToKonva(geometry.x, geometry.y, pageHeight, zoom);

    return (
      <Rect
        x={konva.x}
        y={konva.y - geometry.height * zoom}
        width={geometry.width * zoom}
        height={geometry.height * zoom}
        stroke={color}
        strokeWidth={strokeWidth}
        fill={fillColor}
        fillEnabled={!!fillColor}
        opacity={opacity}
        dash={dash}
        onClick={handleClick}
        draggable={isSelected}
        onDragEnd={handleDragEnd}
        strokeScaleEnabled={false}
      />
    );
  }

  // Ellipse
  if (
    shapeType === 'ellipse' &&
    geometry.x != null &&
    geometry.y != null &&
    geometry.width != null &&
    geometry.height != null
  ) {
    const konva = pdfToKonva(
      geometry.x + geometry.width / 2,
      geometry.y + geometry.height / 2,
      pageHeight,
      zoom
    );

    return (
      <Circle
        x={konva.x}
        y={konva.y}
        radiusX={(geometry.width * zoom) / 2}
        radiusY={(geometry.height * zoom) / 2}
        stroke={color}
        strokeWidth={strokeWidth}
        fill={fillColor}
        fillEnabled={!!fillColor}
        opacity={opacity}
        dash={dash}
        onClick={handleClick}
        draggable={isSelected}
        onDragEnd={handleDragEnd}
        strokeScaleEnabled={false}
      />
    );
  }

  // Text box
  if (
    shapeType === 'text_box' &&
    geometry.x != null &&
    geometry.y != null &&
    geometry.width != null &&
    geometry.height != null
  ) {
    const konva = pdfToKonva(geometry.x, geometry.y, pageHeight, zoom);

    return (
      <>
        <Rect
          x={konva.x}
          y={konva.y - geometry.height * zoom}
          width={geometry.width * zoom}
          height={geometry.height * zoom}
          stroke={color}
          strokeWidth={strokeWidth}
          fill={fillColor || '#FFFFFF'}
          opacity={fillOpacity || 0.9}
          onClick={handleClick}
          draggable={isSelected}
          onDragEnd={handleDragEnd}
          strokeScaleEnabled={false}
        />
        <KonvaText
          x={konva.x + 4}
          y={konva.y - geometry.height * zoom + 4}
          width={geometry.width * zoom - 8}
          height={geometry.height * zoom - 8}
          text={shape.content || ''}
          fontSize={style.fontSize || 14}
          fontFamily={style.fontFamily || 'Arial'}
          fontStyle={style.fontStyle || 'normal'}
          fill={color}
          opacity={opacity}
          onClick={handleClick}
          draggable={isSelected}
          onDragEnd={handleDragEnd}
        />
      </>
    );
  }

  // Highlighter (semi-transparent rectangle)
  if (
    shapeType === 'highlighter' &&
    geometry.x != null &&
    geometry.y != null &&
    geometry.width != null &&
    geometry.height != null
  ) {
    const konva = pdfToKonva(geometry.x, geometry.y, pageHeight, zoom);

    return (
      <Rect
        x={konva.x}
        y={konva.y - geometry.height * zoom}
        width={geometry.width * zoom}
        height={geometry.height * zoom}
        fill={color}
        opacity={0.3}
        onClick={handleClick}
        draggable={isSelected}
        onDragEnd={handleDragEnd}
      />
    );
  }

  // Default: render nothing for unsupported shapes
  return null;
}
