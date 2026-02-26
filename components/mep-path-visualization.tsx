'use client';

import { useState } from 'react';
import { ArrowRight, AlertCircle, Route, Zap, CheckCircle2 } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface PathSegment {
  from: {
    id: string;
    callout: string;
    equipmentType: string;
    trade: string;
  };
  to: {
    id: string;
    callout: string;
    equipmentType: string;
    trade: string;
  };
  distance: number;
  route: 'horizontal' | 'vertical' | 'diagonal';
  conflicts: PathConflict[];
}

interface PathConflict {
  type: 'crossing' | 'clearance' | 'structural';
  severity: 'low' | 'medium' | 'high';
  description: string;
  location: string;
}

interface MEPPathData {
  id: string;
  equipment: Array<{
    id: string;
    callout: string;
    equipmentType: string;
    trade: string;
  }>;
  segments: PathSegment[];
  totalDistance: number;
  conflicts: PathConflict[];
  efficiency: number;
}

interface MEPPathVisualizationProps {
  pathData: MEPPathData;
  compact?: boolean;
}

export function MEPPathVisualization({ pathData, compact = false }: MEPPathVisualizationProps) {
  const [expanded, setExpanded] = useState(!compact);

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'low':
        return 'text-yellow-400';
      case 'medium':
        return 'text-orange-400';
      case 'high':
        return 'text-red-400';
    }
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return 'text-green-400';
    if (efficiency >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRouteIcon = (_route: string) => {
    return <Route className="h-3 w-3" aria-hidden="true" />;
  };

  if (compact && !expanded) {
    return (
      <Card className="my-2 bg-dark-card border-gray-700">
        <button
          onClick={() => setExpanded(true)}
          className="w-full p-3 text-left hover:bg-dark-surface transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-blue-400" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-200">
                MEP Path Analysis: {pathData.equipment.length} equipment
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {pathData.totalDistance.toFixed(1)}&apos; total
              </span>
              <span className={`text-xs font-medium ${getEfficiencyColor(pathData.efficiency)}`}>
                {pathData.efficiency}% efficient
              </span>
            </div>
          </div>
        </button>
      </Card>
    );
  }

  return (
    <Card className="my-3 bg-dark-card border-gray-700">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-blue-400" aria-hidden="true" />
            <h3 className="font-semibold text-gray-200">MEP Path Analysis</h3>
          </div>
          {compact && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              Collapse
            </Button>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-dark-surface rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-1">Equipment</div>
            <div className="text-lg font-semibold text-gray-200">{pathData.equipment.length}</div>
          </div>
          <div className="bg-dark-surface rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-1">Total Distance</div>
            <div className="text-lg font-semibold text-gray-200">
              {pathData.totalDistance.toFixed(1)}&apos;
            </div>
          </div>
          <div className="bg-dark-surface rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-1">Conflicts</div>
            <div className={`text-lg font-semibold ${
              pathData.conflicts.length === 0 ? 'text-green-400' : 'text-orange-400'
            }`}>
              {pathData.conflicts.length}
            </div>
          </div>
          <div className="bg-dark-surface rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-1">Efficiency</div>
            <div className={`text-lg font-semibold ${getEfficiencyColor(pathData.efficiency)}`}>
              {pathData.efficiency}%
            </div>
          </div>
        </div>

        {/* Path Segments */}
        <div className="space-y-2 mb-4">
          <div className="text-sm font-medium text-gray-300 mb-2">Path Route</div>
          {pathData.segments.map((segment, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {/* From Equipment */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Badge variant="outline" className="text-xs border-blue-500 text-blue-400">
                  {segment.from.callout}
                </Badge>
                <span className="text-xs text-gray-400 truncate">
                  {segment.from.equipmentType}
                </span>
              </div>

              {/* Arrow & Distance */}
              <div className="flex items-center gap-1 text-gray-400">
                {getRouteIcon(segment.route)}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                <span className="text-xs">{segment.distance.toFixed(1)}&apos;</span>
              </div>

              {/* To Equipment */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Badge variant="outline" className="text-xs border-blue-500 text-blue-400">
                  {segment.to.callout}
                </Badge>
                <span className="text-xs text-gray-400 truncate">
                  {segment.to.equipmentType}
                </span>
              </div>

              {/* Conflict Indicator */}
              {segment.conflicts.length > 0 && (
                <AlertCircle className="h-4 w-4 text-orange-400 flex-shrink-0" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        {/* Conflicts */}
        {pathData.conflicts.length > 0 && (
          <div className="border-t border-gray-700 pt-3">
            <div className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-400" aria-hidden="true" />
              Conflicts Detected ({pathData.conflicts.length})
            </div>
            <div className="space-y-1.5">
              {pathData.conflicts.slice(0, 3).map((conflict, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs bg-dark-surface rounded p-2">
                  <span className={`font-medium ${getSeverityColor(conflict.severity)} uppercase`}>
                    {conflict.severity}
                  </span>
                  <div className="flex-1">
                    <div className="text-gray-300">{conflict.description}</div>
                    <div className="text-gray-400 mt-0.5">{conflict.location}</div>
                  </div>
                </div>
              ))}
              {pathData.conflicts.length > 3 && (
                <div className="text-xs text-gray-400 text-center py-1">
                  +{pathData.conflicts.length - 3} more conflicts
                </div>
              )}
            </div>
          </div>
        )}

        {/* Efficiency Note */}
        {pathData.efficiency < 70 && (
          <div className="mt-3 bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs text-gray-300">
                <span className="font-medium">Optimization Suggested:</span> This path could be more
                efficient. Consider reordering equipment or adjusting routing.
              </div>
            </div>
          </div>
        )}

        {pathData.efficiency >= 80 && (
          <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-lg p-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs text-gray-300">
                <span className="font-medium">Optimal Path:</span> This routing is highly efficient
                with minimal conflicts.
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
