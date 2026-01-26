"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Route,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Navigation,
  Maximize2
} from 'lucide-react';
import { toast } from 'sonner';

interface MEPPathTracingProps {
  open: boolean;
  onClose: () => void;
  projectSlug: string;
  preselectedEquipment?: string[];
}

interface PathSegment {
  from: any;
  to: any;
  distance: number;
  route: 'horizontal' | 'vertical' | 'diagonal';
  conflicts: any[];
}

interface PathTrace {
  id: string;
  equipment: any[];
  segments: PathSegment[];
  totalDistance: number;
  conflicts: any[];
  efficiency: number;
}

interface RouteOptimization {
  originalPath: PathTrace;
  optimizedPath: PathTrace;
  savings: {
    distance: number;
    conflictsReduced: number;
    efficiencyGain: number;
  };
  suggestions: string[];
}

export function MEPPathTracing({
  open,
  onClose,
  projectSlug,
  preselectedEquipment = []
}: MEPPathTracingProps) {
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(preselectedEquipment);
  const [availableEquipment, setAvailableEquipment] = useState<any[]>([]);
  const [currentPath, setCurrentPath] = useState<PathTrace | null>(null);
  const [optimization, setOptimization] = useState<RouteOptimization | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'select' | 'trace' | 'optimize'>('select');

  useEffect(() => {
    if (open && projectSlug) {
      loadEquipment();
    }
  }, [open, projectSlug]);

  useEffect(() => {
    if (preselectedEquipment.length > 0) {
      setSelectedEquipment(preselectedEquipment);
      if (preselectedEquipment.length >= 2) {
        handleTracePath();
      }
    }
  }, [preselectedEquipment]);

  const loadEquipment = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/mep`);
      if (response.ok) {
        const data = await response.json();
        setAvailableEquipment(data.equipment || []);
      }
    } catch (error) {
      console.error('Failed to load equipment:', error);
      toast.error('Failed to load MEP equipment');
    }
  };

  const toggleEquipmentSelection = (id: string) => {
    setSelectedEquipment(prev =>
      prev.includes(id)
        ? prev.filter(eid => eid !== id)
        : [...prev, id]
    );
  };

  const handleTracePath = async () => {
    if (selectedEquipment.length < 2) {
      toast.error('Please select at least 2 equipment items');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/mep/path-tracing`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentIds: selectedEquipment,
            action: 'trace'
          })
        }
      );

      if (response.ok) {
        const path = await response.json();
        setCurrentPath(path);
        setView('trace');
        toast.success('Path traced successfully');
      } else {
        throw new Error('Path tracing failed');
      }
    } catch (error) {
      console.error('Path tracing error:', error);
      toast.error('Failed to trace path');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizePath = async () => {
    if (!currentPath) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/mep/path-tracing`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentIds: selectedEquipment,
            action: 'optimize'
          })
        }
      );

      if (response.ok) {
        const opt = await response.json();
        setOptimization(opt);
        setView('optimize');
        toast.success('Path optimized');
      } else {
        throw new Error('Optimization failed');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      toast.error('Failed to optimize path');
    } finally {
      setLoading(false);
    }
  };

  const getRouteIcon = (route: string) => {
    switch (route) {
      case 'horizontal':
        return <ArrowRight className="h-4 w-4" />;
      case 'vertical':
        return <TrendingUp className="h-4 w-4 rotate-90" />;
      case 'diagonal':
        return <Navigation className="h-4 w-4" />;
      default:
        return <Route className="h-4 w-4" />;
    }
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return 'text-green-500';
    if (efficiency >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/10 text-red-500';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'low':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-orange-500" />
            MEP Path Tracing & Optimization
          </DialogTitle>
          <DialogDescription>
            Analyze routing paths between MEP equipment and optimize for efficiency
          </DialogDescription>
        </DialogHeader>

        {/* View Tabs */}
        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={view === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('select')}
          >
            Select Equipment
          </Button>
          <Button
            variant={view === 'trace' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('trace')}
            disabled={!currentPath}
          >
            Path Analysis
          </Button>
          <Button
            variant={view === 'optimize' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('optimize')}
            disabled={!optimization}
          >
            Optimization
          </Button>
        </div>

        <ScrollArea className="h-[500px] pr-4">
          {/* Equipment Selection View */}
          {view === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Selected: {selectedEquipment.length} equipment items
                </p>
                <Button
                  onClick={handleTracePath}
                  disabled={selectedEquipment.length < 2 || loading}
                  size="sm"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Route className="h-4 w-4" />
                  )}
                  <span className="ml-2">Trace Path</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {availableEquipment.map((eq) => (
                  <Card
                    key={eq.id}
                    className={`cursor-pointer transition-all ${
                      selectedEquipment.includes(eq.id)
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10'
                        : 'hover:border-gray-400'
                    }`}
                    onClick={() => toggleEquipmentSelection(eq.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-sm">{eq.callout}</div>
                          <div className="text-xs text-gray-500">{eq.equipmentType}</div>
                          {eq.location && (
                            <div className="text-xs text-gray-400 mt-1">
                              {eq.location}
                            </div>
                          )}
                        </div>
                        {selectedEquipment.includes(eq.id) && (
                          <CheckCircle2 className="h-5 w-5 text-orange-500 flex-shrink-0" />
                        )}
                      </div>
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {eq.trade}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Path Trace View */}
          {view === 'trace' && currentPath && (
            <div className="space-y-4">
              {/* Path Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Path Analysis</span>
                    <Button
                      onClick={handleOptimizePath}
                      disabled={loading}
                      size="sm"
                      variant="outline"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      <span className="ml-2">Optimize</span>
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">
                        {currentPath.totalDistance.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">Total Distance</div>
                    </div>
                    <div>
                      <div
                        className={`text-2xl font-bold ${getEfficiencyColor(
                          currentPath.efficiency
                        )}`}
                      >
                        {currentPath.efficiency.toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">Efficiency</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-500">
                        {currentPath.conflicts.length}
                      </div>
                      <div className="text-xs text-gray-500">Conflicts</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Path Segments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Route Segments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentPath.segments.map((segment, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex-shrink-0">{getRouteIcon(segment.route)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {segment.from.callout} → {segment.to.callout}
                          </div>
                          <div className="text-xs text-gray-500">
                            {segment.distance.toFixed(1)} units • {segment.route}
                          </div>
                        </div>
                        {segment.conflicts.length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {segment.conflicts.length} conflicts
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Conflicts */}
              {currentPath.conflicts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Path Conflicts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {currentPath.conflicts.map((conflict, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg ${getSeverityColor(conflict.severity)}`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-sm">{conflict.type}</div>
                              <div className="text-xs mt-1">{conflict.description}</div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {conflict.severity}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Optimization View */}
          {view === 'optimize' && optimization && (
            <div className="space-y-4">
              {/* Savings Summary */}
              <Card className="border-green-500 bg-green-50 dark:bg-green-900/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Zap className="h-5 w-5" />
                    Optimization Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {optimization.savings.distance > 0 ? '-' : ''}
                        {Math.abs(optimization.savings.distance).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-600">Distance Saved</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {optimization.savings.conflictsReduced > 0 ? '-' : ''}
                        {optimization.savings.conflictsReduced}
                      </div>
                      <div className="text-xs text-gray-600">Conflicts Reduced</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        +{optimization.savings.efficiencyGain.toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-600">Efficiency Gain</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Suggestions */}
              {optimization.suggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {optimization.suggestions.map((suggestion, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Original Path</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Distance:</span>
                        <span className="font-medium">
                          {optimization.originalPath.totalDistance.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Efficiency:</span>
                        <span
                          className={`font-medium ${getEfficiencyColor(
                            optimization.originalPath.efficiency
                          )}`}
                        >
                          {optimization.originalPath.efficiency.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Conflicts:</span>
                        <span className="font-medium text-red-500">
                          {optimization.originalPath.conflicts.length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-green-500">
                  <CardHeader>
                    <CardTitle className="text-sm text-green-600">Optimized Path</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Distance:</span>
                        <span className="font-medium text-green-600">
                          {optimization.optimizedPath.totalDistance.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Efficiency:</span>
                        <span className="font-medium text-green-600">
                          {optimization.optimizedPath.efficiency.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Conflicts:</span>
                        <span className="font-medium text-green-600">
                          {optimization.optimizedPath.conflicts.length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
