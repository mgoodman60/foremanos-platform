'use client';

import React from 'react';
import type { MarkupRecord } from '@/lib/markup/markup-types';
import { RectangleShape } from './RectangleShape';
import { EllipseShape } from './EllipseShape';
import { LineShape } from './LineShape';
import { PolylineShape } from './PolylineShape';
import { PolygonShape } from './PolygonShape';
import { CloudShape } from './CloudShape';
import { FreehandShape } from './FreehandShape';
import { TextBoxShape } from './TextBoxShape';
import { StampShape } from './StampShape';
import { MeasurementShape } from './MeasurementShape';

interface MarkupShapeProps {
  markup: MarkupRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pageHeight: number;
  scale: number;
}

export function MarkupShape({
  markup,
  isSelected,
  onSelect,
  pageHeight,
  scale,
}: MarkupShapeProps) {
  const sharedProps = {
    markup,
    isSelected,
    onSelect,
    pageHeight,
    scale,
  };

  switch (markup.shapeType) {
    case 'rectangle':
      return <RectangleShape {...sharedProps} />;

    case 'ellipse':
      return <EllipseShape {...sharedProps} />;

    case 'line':
    case 'arrow':
      return <LineShape {...sharedProps} />;

    case 'polyline':
      return <PolylineShape {...sharedProps} />;

    case 'polygon':
      return <PolygonShape {...sharedProps} />;

    case 'cloud':
      return <CloudShape {...sharedProps} />;

    case 'freehand':
    case 'highlighter':
      return <FreehandShape {...sharedProps} />;

    case 'text_box':
    case 'callout':
    case 'typewriter':
      return <TextBoxShape {...sharedProps} />;

    case 'stamp':
    case 'count_marker':
      return <StampShape {...sharedProps} />;

    case 'distance_measurement':
    case 'area_measurement':
    case 'perimeter_measurement':
    case 'angle_measurement':
    case 'diameter_measurement':
    case 'volume_measurement':
      return <MeasurementShape {...sharedProps} />;

    default:
      // Fallback for unknown shape types
      return null;
  }
}
