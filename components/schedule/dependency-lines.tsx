"use client";

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  taskId: string;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  predecessors: string[];
  successors: string[];
  isCritical?: boolean;
}

interface DependencyLinesProps {
  tasks: Task[];
  taskPositions: Map<string, { left: number; width: number; top: number; height: number }>;
  containerWidth: number;
  containerOffset: number; // Offset for task info column
  showCriticalPath?: boolean;
  dependencyType?: 'FS' | 'SS' | 'FF' | 'SF'; // Finish-Start, Start-Start, etc.
}

interface DependencyLine {
  id: string;
  fromTask: Task;
  toTask: Task;
  isCritical: boolean;
  type: 'FS' | 'SS' | 'FF' | 'SF';
}

export function DependencyLines({
  tasks,
  taskPositions,
  containerWidth,
  containerOffset,
  showCriticalPath = true,
  dependencyType = 'FS'
}: DependencyLinesProps) {
  const dependencies = useMemo(() => {
    const lines: DependencyLine[] = [];
    const taskMap = new Map(tasks.map(t => [t.taskId, t]));
    
    tasks.forEach(task => {
      task.successors.forEach(successorId => {
        const successor = taskMap.get(successorId);
        if (successor) {
          lines.push({
            id: `${task.taskId}-${successorId}`,
            fromTask: task,
            toTask: successor,
            isCritical: task.isCritical && successor.isCritical,
            type: dependencyType
          });
        }
      });
    });
    
    return lines;
  }, [tasks, dependencyType]);

  const renderPath = (dep: DependencyLine): string | null => {
    const fromPos = taskPositions.get(dep.fromTask.taskId);
    const toPos = taskPositions.get(dep.toTask.taskId);
    
    if (!fromPos || !toPos) return null;
    
    // Calculate connection points based on dependency type
    let startX: number, startY: number, endX: number, endY: number;
    
    switch (dep.type) {
      case 'FS': // Finish-to-Start (most common)
        startX = containerOffset + (fromPos.left + fromPos.width) * (containerWidth - containerOffset) / 100;
        startY = fromPos.top + fromPos.height / 2;
        endX = containerOffset + (toPos.left) * (containerWidth - containerOffset) / 100;
        endY = toPos.top + toPos.height / 2;
        break;
      case 'SS': // Start-to-Start
        startX = containerOffset + (fromPos.left) * (containerWidth - containerOffset) / 100;
        startY = fromPos.top + fromPos.height / 2;
        endX = containerOffset + (toPos.left) * (containerWidth - containerOffset) / 100;
        endY = toPos.top + toPos.height / 2;
        break;
      case 'FF': // Finish-to-Finish
        startX = containerOffset + (fromPos.left + fromPos.width) * (containerWidth - containerOffset) / 100;
        startY = fromPos.top + fromPos.height / 2;
        endX = containerOffset + (toPos.left + toPos.width) * (containerWidth - containerOffset) / 100;
        endY = toPos.top + toPos.height / 2;
        break;
      case 'SF': // Start-to-Finish
        startX = containerOffset + (fromPos.left) * (containerWidth - containerOffset) / 100;
        startY = fromPos.top + fromPos.height / 2;
        endX = containerOffset + (toPos.left + toPos.width) * (containerWidth - containerOffset) / 100;
        endY = toPos.top + toPos.height / 2;
        break;
      default:
        return null;
    }
    
    // Create smooth path with bezier curves
    const midX = (startX + endX) / 2;
    const controlOffset = Math.min(Math.abs(endX - startX) * 0.3, 50);
    
    // If tasks are on different rows, create an S-curve
    if (Math.abs(startY - endY) > 10) {
      return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
    }
    
    // Same row - simple curve
    return `M ${startX} ${startY} Q ${midX} ${startY - 20}, ${endX} ${endY}`;
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        {/* Arrow marker for dependency lines */}
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
        </marker>
        <marker
          id="arrowhead-critical"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
        </marker>
      </defs>
      
      {dependencies.map(dep => {
        const path = renderPath(dep);
        if (!path) return null;
        
        const isCriticalLine = showCriticalPath && dep.isCritical;
        
        return (
          <g key={dep.id}>
            {/* Shadow/glow for critical path */}
            {isCriticalLine && (
              <path
                d={path}
                fill="none"
                stroke="#EF4444"
                strokeWidth="4"
                strokeOpacity="0.3"
                className="animate-pulse"
              />
            )}
            
            {/* Main line */}
            <path
              d={path}
              fill="none"
              stroke={isCriticalLine ? '#EF4444' : '#6B7280'}
              strokeWidth={isCriticalLine ? 2 : 1.5}
              strokeDasharray={isCriticalLine ? undefined : '4,2'}
              markerEnd={isCriticalLine ? 'url(#arrowhead-critical)' : 'url(#arrowhead)'}
              className="transition-all"
            />
          </g>
        );
      })}
    </svg>
  );
}

// Hook to calculate task positions for dependency rendering
export function useTaskPositions(
  tasks: Task[],
  rowHeight: number = 56
): Map<string, { left: number; width: number; top: number; height: number }> {
  return useMemo(() => {
    const positions = new Map();
    
    tasks.forEach((task, index) => {
      // These values should be passed from the Gantt chart's calculateBarPosition
      positions.set(task.taskId, {
        left: 0, // Will be calculated by parent
        width: 0, // Will be calculated by parent
        top: (index * rowHeight) + (rowHeight / 2),
        height: rowHeight
      });
    });
    
    return positions;
  }, [tasks, rowHeight]);
}

// Dependency type selector component
export function DependencyTypeSelector({
  value,
  onChange
}: {
  value: 'FS' | 'SS' | 'FF' | 'SF';
  onChange: (type: 'FS' | 'SS' | 'FF' | 'SF') => void;
}) {
  const types = [
    { value: 'FS' as const, label: 'Finish-Start', description: 'Successor starts after predecessor finishes' },
    { value: 'SS' as const, label: 'Start-Start', description: 'Both tasks start together' },
    { value: 'FF' as const, label: 'Finish-Finish', description: 'Both tasks finish together' },
    { value: 'SF' as const, label: 'Start-Finish', description: 'Successor finishes when predecessor starts' }
  ];

  return (
    <div className="flex gap-2">
      {types.map(type => (
        <button
          key={type.value}
          onClick={() => onChange(type.value)}
          className={cn(
            'px-3 py-1.5 text-xs rounded border transition-colors',
            value === type.value
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
          )}
          title={type.description}
        >
          {type.value}
        </button>
      ))}
    </div>
  );
}
