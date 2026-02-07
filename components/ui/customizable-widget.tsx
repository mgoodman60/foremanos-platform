"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, X, Maximize2, Minimize2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WidgetConfig {
  id: string;
  title: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  isCollapsed?: boolean;
  isVisible?: boolean;
}

interface CustomizableWidgetProps {
  config: WidgetConfig;
  children: React.ReactNode;
  onMove?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onRemove?: (id: string) => void;
  onToggleCollapse?: (id: string) => void;
  isEditing?: boolean;
  className?: string;
}

export function CustomizableWidget({
  config,
  children,
  onMove,
  onResize,
  onRemove,
  onToggleCollapse,
  isEditing = false,
  className
}: CustomizableWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [localPos, setLocalPos] = useState({ x: config.x, y: config.y });
  const [localSize, setLocalSize] = useState({ width: config.width, height: config.height });
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalPos({ x: config.x, y: config.y });
    setLocalSize({ width: config.width, height: config.height });
  }, [config.x, config.y, config.width, config.height]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - localPos.x, y: e.clientY - localPos.y });
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = Math.max(0, e.clientX - dragStart.x);
    const newY = Math.max(0, e.clientY - dragStart.y);
    setLocalPos({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    if (isDragging && onMove) {
      onMove(config.id, localPos.x, localPos.y);
    }
    setIsDragging(false);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleResize = (e: React.MouseEvent) => {
    if (!isResizing) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    const newWidth = Math.max(config.minWidth || 200, localSize.width + deltaX);
    const newHeight = Math.max(config.minHeight || 150, localSize.height + deltaY);
    setLocalSize({ width: newWidth, height: newHeight });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleResizeEnd = () => {
    if (isResizing && onResize) {
      onResize(config.id, localSize.width, localSize.height);
    }
    setIsResizing(false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, e.clientX - dragStart.x);
        const newY = Math.max(0, e.clientY - dragStart.y);
        setLocalPos({ x: newX, y: newY });
      }
      if (isResizing) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        const newWidth = Math.max(config.minWidth || 200, localSize.width + deltaX);
        const newHeight = Math.max(config.minHeight || 150, localSize.height + deltaY);
        setLocalSize({ width: newWidth, height: newHeight });
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging && onMove) {
        onMove(config.id, localPos.x, localPos.y);
      }
      if (isResizing && onResize) {
        onResize(config.id, localSize.width, localSize.height);
      }
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, localPos, localSize, config, onMove, onResize]);

  if (config.isVisible === false) return null;

  return (
    <Card
      ref={widgetRef}
      className={cn(
        'bg-dark-card border-gray-700 overflow-hidden transition-shadow',
        isEditing && 'ring-2 ring-blue-500/50',
        isDragging && 'shadow-xl cursor-grabbing',
        className
      )}
      style={{
        position: isEditing ? 'absolute' : 'relative',
        left: isEditing ? localPos.x : undefined,
        top: isEditing ? localPos.y : undefined,
        width: localSize.width,
        height: config.isCollapsed ? 48 : localSize.height,
        zIndex: isDragging || isResizing ? 100 : 1,
      }}
    >
      {/* Widget Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-dark-surface',
          isEditing && 'cursor-grab'
        )}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          {isEditing && (
            <GripVertical className="h-4 w-4 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-200">{config.title}</span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-300 hover:text-white"
              onClick={() => onToggleCollapse(config.id)}
            >
              {config.isCollapsed ? (
                <Maximize2 className="h-3 w-3" />
              ) : (
                <Minimize2 className="h-3 w-3" />
              )}
            </Button>
          )}
          {isEditing && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-300 hover:text-red-400"
              onClick={() => onRemove(config.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      {!config.isCollapsed && (
        <div className="p-3 h-[calc(100%-48px)] overflow-auto">
          {children}
        </div>
      )}

      {/* Resize Handle */}
      {isEditing && !config.isCollapsed && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
        >
          <svg
            className="w-4 h-4 text-gray-400"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      )}
    </Card>
  );
}

// Widget layout manager
export interface DashboardLayout {
  widgets: WidgetConfig[];
  columns: number;
  gap: number;
}

export function getDefaultDashboardLayout(): DashboardLayout {
  return {
    widgets: [
      { id: 'schedule-health', title: 'Schedule Health', type: 'schedule-health', x: 0, y: 0, width: 400, height: 300, minWidth: 300, minHeight: 200 },
      { id: 'budget-summary', title: 'Budget Summary', type: 'budget-summary', x: 420, y: 0, width: 400, height: 300, minWidth: 300, minHeight: 200 },
      { id: 'weather', title: 'Weather Forecast', type: 'weather', x: 840, y: 0, width: 300, height: 200, minWidth: 250, minHeight: 150 },
      { id: 'recent-activity', title: 'Recent Activity', type: 'activity', x: 0, y: 320, width: 600, height: 250, minWidth: 400, minHeight: 200 },
      { id: 'alerts', title: 'Alerts & Notifications', type: 'alerts', x: 620, y: 320, width: 400, height: 250, minWidth: 300, minHeight: 200 },
    ],
    columns: 3,
    gap: 16
  };
}

export function saveDashboardLayout(userId: string, layout: DashboardLayout): void {
  try {
    localStorage.setItem(`dashboard-layout-${userId}`, JSON.stringify(layout));
  } catch (e) {
    console.error('Failed to save dashboard layout:', e);
  }
}

export function loadDashboardLayout(userId: string): DashboardLayout | null {
  try {
    const saved = localStorage.getItem(`dashboard-layout-${userId}`);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error('Failed to load dashboard layout:', e);
    return null;
  }
}
