'use client';

import React, { useCallback, useMemo } from 'react';
import { Group, Line, Text } from 'react-konva';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { pdfToKonva, polygonArea, polygonPerimeter } from '@/lib/markup/geometry-utils';

interface MeasurementShapeProps {
  markup: MarkupRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pageHeight: number;
  scale: number;
}

export function MeasurementShape({
  markup,
  isSelected,
  onSelect,
  pageHeight,
  scale,
}: MeasurementShapeProps) {
  const { geometry, style, shapeType, measurementValue, measurementUnit } = markup;

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

  // Calculate measurement display
  const measurementText = useMemo(() => {
    if (measurementValue != null && measurementUnit) {
      return `${measurementValue.toFixed(2)} ${measurementUnit}`;
    }

    // Fallback calculations
    if (shapeType === 'distance_measurement' && geometry.points.length >= 4) {
      const dx = geometry.points[2] - geometry.points[0];
      const dy = geometry.points[3] - geometry.points[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      return `${distance.toFixed(2)} units`;
    }

    if (shapeType === 'area_measurement' && geometry.points.length >= 6) {
      const area = polygonArea(geometry.points);
      return `${area.toFixed(2)} sq units`;
    }

    if (shapeType === 'perimeter_measurement' && geometry.points.length >= 6) {
      const perimeter = polygonPerimeter(geometry.points);
      return `${perimeter.toFixed(2)} units`;
    }

    return '';
  }, [shapeType, measurementValue, measurementUnit, geometry.points]);

  // Label position (midpoint for line, centroid for polygon)
  const labelPos = useMemo(() => {
    if (konvaPoints.length === 4) {
      return {
        x: (konvaPoints[0] + konvaPoints[2]) / 2,
        y: (konvaPoints[1] + konvaPoints[3]) / 2,
      };
    }

    let sumX = 0;
    let sumY = 0;
    const n = konvaPoints.length / 2;
    for (let i = 0; i < konvaPoints.length; i += 2) {
      sumX += konvaPoints[i];
      sumY += konvaPoints[i + 1];
    }
    return { x: sumX / n, y: sumY / n };
  }, [konvaPoints]);

  return (
    <Group draggable={isSelected} onClick={handleClick} onTap={handleClick}>
      <Line
        points={konvaPoints}
        stroke={style.color}
        strokeWidth={style.strokeWidth}
        opacity={style.opacity}
        lineCap="round"
        lineJoin="round"
        strokeScaleEnabled={false}
      />

      {/* Draw tick marks for distance measurement */}
      {shapeType === 'distance_measurement' && konvaPoints.length >= 4 && (
        <>
          <Line
            points={[
              konvaPoints[0] - 5,
              konvaPoints[1] - 5,
              konvaPoints[0] + 5,
              konvaPoints[1] + 5,
            ]}
            stroke={style.color}
            strokeWidth={style.strokeWidth}
          />
          <Line
            points={[
              konvaPoints[2] - 5,
              konvaPoints[3] - 5,
              konvaPoints[2] + 5,
              konvaPoints[3] + 5,
            ]}
            stroke={style.color}
            strokeWidth={style.strokeWidth}
          />
        </>
      )}

      {/* Label */}
      <Text
        x={labelPos.x - 40}
        y={labelPos.y - 20}
        text={measurementText}
        fontSize={12}
        fontFamily="Arial"
        fill={style.color}
        padding={4}
        align="center"
      />
    </Group>
  );
}
