'use client';

import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Map,
  Layers,
  Grid3X3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WithTooltip } from '@/components/ui/icon-button';

interface PlanDocument {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  category: string;
  pageCount?: number;
  cloud_storage_path?: string;
}

interface FloorPlan {
  id: string;
  name: string;
  floor: string | null;
  building: string | null;
  cloud_storage_path: string;
  isPublic: boolean;
  imageWidth: number | null;
  imageHeight: number | null;
  isActive: boolean;
}

interface ViewerToolbarProps {
  // Mode flags
  imageUrl: string | null;
  showPlanDocument: boolean;
  showDwg: boolean;
  isCollapsed: boolean;

  // Display data
  currentFloorPlan: FloorPlan | null;
  currentPlanDoc: PlanDocument | null;
  planDocuments: PlanDocument[];
  floorPlans: FloorPlan[];
  floorRoomsCount: number;
  dwgLayerCount: number;

  // Zoom state
  zoom: number;
  showProgressOverlay: boolean;

  // Expand state
  expanded: boolean;
  onToggleExpand?: () => void;

  // Callbacks
  onCollapseToggle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onProgressToggle: () => void;
  onNavigateFloor: (direction: 'prev' | 'next') => void;
  onNavigateDocument: (direction: 'prev' | 'next') => void;
}

export const ViewerToolbar = React.memo(function ViewerToolbar({
  imageUrl,
  showPlanDocument,
  showDwg,
  isCollapsed,
  currentFloorPlan,
  currentPlanDoc,
  planDocuments,
  floorPlans,
  floorRoomsCount,
  dwgLayerCount,
  zoom,
  showProgressOverlay,
  expanded,
  onToggleExpand,
  onCollapseToggle,
  onZoomIn,
  onZoomOut,
  onReset,
  onProgressToggle,
  onNavigateFloor,
  onNavigateDocument,
}: ViewerToolbarProps) {
  const currentDocIndex = planDocuments.findIndex(d => d.id === currentPlanDoc?.id);

  return (
    <div
      className="flex items-center justify-between border-b border-gray-700 px-4 py-2 bg-dark-card cursor-pointer hover:bg-dark-hover transition-colors"
      onClick={onCollapseToggle}
    >
      {/* Left: icon + title + badge */}
      <div className="flex items-center gap-2">
        {imageUrl ? (
          <Map className="h-4 w-4 text-orange-500" />
        ) : showPlanDocument ? (
          <Map className="h-4 w-4 text-blue-500" />
        ) : showDwg ? (
          <Layers className="h-4 w-4 text-orange-500" />
        ) : (
          <Grid3X3 className="h-4 w-4 text-orange-500" />
        )}
        <span className="text-sm font-medium text-white">
          {imageUrl
            ? currentFloorPlan?.name || 'Floor Plan'
            : showPlanDocument
              ? currentPlanDoc?.name || 'Architectural Plans'
              : showDwg
                ? 'CAD Drawing'
                : 'Floor Plan'}
        </span>
        {currentFloorPlan?.floor && imageUrl && (
          <Badge variant="outline" className="text-xs">
            {currentFloorPlan.floor === '1'
              ? '1st Floor'
              : currentFloorPlan.floor === '2'
                ? '2nd Floor'
                : currentFloorPlan.floor === '3'
                  ? '3rd Floor'
                  : `Floor ${currentFloorPlan.floor}`}
          </Badge>
        )}
        {showPlanDocument ? (
          <Badge className="bg-blue-500/20 text-blue-400 text-xs">
            {planDocuments.length} document{planDocuments.length > 1 ? 's' : ''}
          </Badge>
        ) : showDwg ? (
          <Badge className="bg-blue-500/20 text-blue-400 text-xs">{dwgLayerCount} layers</Badge>
        ) : (
          <Badge className="bg-orange-500/20 text-orange-400 text-xs">{floorRoomsCount} rooms</Badge>
        )}
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        {/* Document navigation */}
        {!isCollapsed && showPlanDocument && planDocuments.length > 1 && (
          <>
            <WithTooltip tooltip="Previous document">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={() => onNavigateDocument('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </WithTooltip>
            <span className="text-xs text-gray-400 px-1">
              {currentDocIndex + 1}/{planDocuments.length}
            </span>
            <WithTooltip tooltip="Next document">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={() => onNavigateDocument('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </WithTooltip>
          </>
        )}

        {/* Floor navigation */}
        {!isCollapsed && floorPlans.length > 1 && (
          <>
            <WithTooltip tooltip="Previous floor">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={() => onNavigateFloor('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </WithTooltip>
            <WithTooltip tooltip="Next floor">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={() => onNavigateFloor('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </WithTooltip>
          </>
        )}

        {/* Zoom controls */}
        {!isCollapsed && imageUrl && (
          <>
            <WithTooltip tooltip="Zoom out">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={onZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </WithTooltip>
            <span className="text-xs text-gray-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <WithTooltip tooltip="Zoom in">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={onZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </WithTooltip>
            <WithTooltip tooltip="Reset view">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={onReset}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </WithTooltip>
            <WithTooltip
              tooltip={showProgressOverlay ? 'Hide progress colors' : 'Show progress colors'}
            >
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 hover:bg-gray-700 ${showProgressOverlay ? 'text-green-400' : 'text-gray-400'}`}
                onClick={onProgressToggle}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            </WithTooltip>
          </>
        )}

        {/* Expand/Minimize */}
        {onToggleExpand && !isCollapsed && (
          <WithTooltip tooltip={expanded ? 'Minimize' : 'Expand'}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
              onClick={onToggleExpand}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </WithTooltip>
        )}

        {/* Collapse toggle */}
        <WithTooltip tooltip={isCollapsed ? 'Expand section' : 'Collapse section'}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
            onClick={e => {
              e.stopPropagation();
              onCollapseToggle();
            }}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </WithTooltip>
      </div>
    </div>
  );
});
