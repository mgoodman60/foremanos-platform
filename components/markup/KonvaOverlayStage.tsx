'use client';

import React, { useRef } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';

interface KonvaOverlayStageProps {
  width: number;
  height: number;
  zoom: number;
  panX: number;
  panY: number;
  children?: React.ReactNode;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function KonvaOverlayStage({
  width,
  height,
  zoom,
  panX,
  panY,
  children,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDoubleClick,
}: KonvaOverlayStageProps) {
  const stageRef = useRef<Konva.Stage>(null);

  return (
    <div
      className="absolute inset-0 pointer-events-auto"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onDoubleClick={onDoubleClick}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={zoom}
        scaleY={zoom}
        x={panX}
        y={panY}
      >
        {children || <Layer />}
      </Stage>
    </div>
  );
}
