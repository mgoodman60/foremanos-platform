"use client";

import { useState, useCallback, useMemo } from 'react';
import { format, differenceInDays, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Beaker,
  Play,
  Pause,
  RotateCcw,
  Save,
  Trash2,
  Clock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  History,
  ArrowRight,
  Sparkles,
  Layers,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Types
export interface GanttTask {
  id: string;
  taskId: string;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  duration: number;
  percentComplete: number;
  status: string;
  isCritical: boolean;
  predecessors: string[];
  successors: string[];
  totalFloat?: number;
}

export interface TaskChange {
  taskId: string;
  taskName: string;
  field: 'startDate' | 'endDate' | 'duration';
  originalValue: Date | string | number;
  newValue: Date | string | number;
  daysDelta: number;
}

export interface WhatIfScenario {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  changes: TaskChange[];
  impactSummary: {
    tasksAffected: number;
    criticalPathImpact: number; // days
    totalDaysShifted: number;
    newEndDate: Date;
  };
}

interface WhatIfScenariosProps {
  tasks: GanttTask[];
  originalTasks: GanttTask[];
  isActive: boolean;
  onToggle: () => void;
  pendingChanges: TaskChange[];
  onApplyChanges: () => Promise<void>;
  onDiscardChanges: () => void;
  onSaveScenario: (name: string, description?: string) => void;
  savedScenarios: WhatIfScenario[];
  onLoadScenario: (scenario: WhatIfScenario) => void;
  onDeleteScenario: (id: string) => void;
}

export function WhatIfScenarios({
  tasks,
  originalTasks,
  isActive,
  onToggle,
  pendingChanges,
  onApplyChanges,
  onDiscardChanges,
  onSaveScenario,
  savedScenarios,
  onLoadScenario,
  onDeleteScenario,
}: WhatIfScenariosProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');

  // Calculate impact summary
  const impactSummary = useMemo(() => {
    if (pendingChanges.length === 0) return null;

    const uniqueTasks = new Set(pendingChanges.map(c => c.taskId));
    const totalDaysShifted = pendingChanges.reduce((sum, c) => sum + Math.abs(c.daysDelta), 0);

    // Calculate critical path impact
    const criticalTasks = tasks.filter(t => t.isCritical);
    const affectedCriticalTasks = criticalTasks.filter(t =>
      pendingChanges.some(c => c.taskId === t.taskId)
    );
    const criticalPathImpact = affectedCriticalTasks.reduce((max, task) => {
      const change = pendingChanges.find(c => c.taskId === task.taskId);
      return change ? Math.max(max, Math.abs(change.daysDelta)) : max;
    }, 0);

    // Calculate new project end date
    const endDates = tasks.map(t => new Date(t.endDate));
    const newEndDate = new Date(Math.max(...endDates.map(d => d.getTime())));

    return {
      tasksAffected: uniqueTasks.size,
      criticalPathImpact,
      totalDaysShifted,
      newEndDate
    };
  }, [pendingChanges, tasks]);

  const handleSave = () => {
    if (!scenarioName.trim()) {
      toast.error('Please enter a scenario name');
      return;
    }
    onSaveScenario(scenarioName.trim(), scenarioDescription.trim() || undefined);
    setScenarioName('');
    setScenarioDescription('');
    setShowSaveDialog(false);
    toast.success(`Scenario "${scenarioName}" saved`);
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApplyChanges();
      toast.success('Changes applied to schedule');
    } catch (error) {
      toast.error('Failed to apply changes');
    } finally {
      setIsApplying(false);
    }
  };

  const handleDiscard = () => {
    onDiscardChanges();
    setShowDiscardDialog(false);
    toast.info('Changes discarded');
  };

  return (
    <div className="space-y-3">
      {/* What-If Mode Toggle */}
      <div className="flex items-center gap-3">
        <Button
          variant={isActive ? "default" : "outline"}
          onClick={onToggle}
          className={cn(
            "gap-2 transition-all",
            isActive
              ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
              : "border-gray-600 hover:border-purple-500 hover:text-purple-400"
          )}
        >
          <Beaker className={cn("h-4 w-4", isActive && "animate-pulse")} />
          What-If Mode
          {isActive && (
            <Badge variant="secondary" className="bg-purple-800 text-purple-200 ml-1">
              Active
            </Badge>
          )}
        </Button>

        {isActive && pendingChanges.length > 0 && (
          <Badge variant="outline" className="border-amber-500 text-amber-400">
            {pendingChanges.length} change{pendingChanges.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Active Mode Panel */}
      {isActive && (
        <Card className="bg-dark-surface border-purple-500/30 p-4">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <span className="text-sm font-medium text-gray-200">Scenario Sandbox</span>
              </div>
              <div className="text-xs text-gray-400">
                Drag tasks to simulate schedule changes
              </div>
            </div>

            {/* Pending Changes */}
            {pendingChanges.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-400 uppercase">Pending Changes</div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                  {pendingChanges.map((change, idx) => (
                    <div
                      key={`${change.taskId}-${idx}`}
                      className="flex items-center gap-2 text-xs bg-dark-card rounded px-2 py-1.5"
                    >
                      <GitBranch className="h-3 w-3 text-purple-400 flex-shrink-0" />
                      <span className="text-gray-300 truncate flex-1">{change.taskName}</span>
                      <ArrowRight className="h-3 w-3 text-gray-500" />
                      <span
                        className={cn(
                          "font-medium",
                          change.daysDelta > 0 ? "text-amber-400" : "text-green-400"
                        )}
                      >
                        {change.daysDelta > 0 ? '+' : ''}{change.daysDelta}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Impact Summary */}
            {impactSummary && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-card rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Layers className="h-3 w-3" />
                    Tasks Affected
                  </div>
                  <div className="text-lg font-semibold text-gray-200">
                    {impactSummary.tasksAffected}
                  </div>
                </div>
                <div className="bg-dark-card rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    {impactSummary.criticalPathImpact > 0 ? (
                      <TrendingUp className="h-3 w-3 text-red-400" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-green-400" />
                    )}
                    Critical Path
                  </div>
                  <div
                    className={cn(
                      "text-lg font-semibold",
                      impactSummary.criticalPathImpact > 0 ? "text-red-400" : "text-green-400"
                    )}
                  >
                    {impactSummary.criticalPathImpact > 0 ? '+' : ''}
                    {impactSummary.criticalPathImpact}d
                  </div>
                </div>
                <div className="bg-dark-card rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Clock className="h-3 w-3" />
                    Total Days Shifted
                  </div>
                  <div className="text-lg font-semibold text-amber-400">
                    {impactSummary.totalDaysShifted}d
                  </div>
                </div>
                <div className="bg-dark-card rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <CalendarDays className="h-3 w-3" />
                    New End Date
                  </div>
                  <div className="text-lg font-semibold text-gray-200">
                    {format(impactSummary.newEndDate, 'MMM d')}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {pendingChanges.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={isApplying}
                  className="bg-green-600 hover:bg-green-700 gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Apply Changes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSaveDialog(true)}
                  className="gap-1 border-gray-600"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Scenario
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDiscardDialog(true)}
                  className="gap-1 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Discard
                </Button>
              </div>
            )}

            {pendingChanges.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                <Beaker className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Drag tasks on the timeline to simulate changes
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <Card className="bg-dark-surface border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Saved Scenarios</span>
          </div>
          <div className="space-y-2">
            {savedScenarios.map((scenario) => (
              <div
                key={scenario.id}
                className="flex items-center justify-between bg-dark-card rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 truncate">
                    {scenario.name}
                  </div>
                  {scenario.description && (
                    <div className="text-xs text-gray-500 truncate">
                      {scenario.description}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{scenario.changes.length} changes</span>
                    <span>•</span>
                    <span>{format(new Date(scenario.createdAt), 'MMM d, h:mm a')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onLoadScenario(scenario)}
                    className="h-8 px-2 text-purple-400 hover:text-purple-300"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteScenario(scenario.id)}
                    className="h-8 px-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Save Scenario Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-dark-surface border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-100">Save Scenario</DialogTitle>
            <DialogDescription className="text-gray-400">
              Save this what-if scenario for future reference or comparison.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scenarioName" className="text-gray-300">Scenario Name</Label>
              <Input
                id="scenarioName"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g., Weather delay scenario"
                className="bg-dark-card border-gray-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenarioDesc" className="text-gray-300">Description (optional)</Label>
              <Input
                id="scenarioDesc"
                value={scenarioDescription}
                onChange={(e) => setScenarioDescription(e.target.value)}
                placeholder="Brief description of the scenario"
                className="bg-dark-card border-gray-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">
              Save Scenario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent className="bg-dark-surface border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will discard all {pendingChanges.length} pending change{pendingChanges.length !== 1 ? 's' : ''}. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              className="bg-red-600 hover:bg-red-700"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Drag Preview Component for enhanced visual feedback
export function DragPreview({
  task,
  daysDelta,
  snapIndicator,
}: {
  task: GanttTask;
  daysDelta: number;
  snapIndicator?: { date: Date; position: number };
}) {
  return (
    <div className="pointer-events-none fixed z-50">
      {/* Task preview */}
      <div className="bg-purple-600/90 rounded px-3 py-1.5 shadow-lg border border-purple-400">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white truncate max-w-[150px]">
            {task.name}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              daysDelta > 0
                ? "border-amber-400 text-amber-300"
                : daysDelta < 0
                ? "border-green-400 text-green-300"
                : "border-gray-400 text-gray-300"
            )}
          >
            {daysDelta > 0 ? '+' : ''}{daysDelta}d
          </Badge>
        </div>
      </div>
      {/* Snap indicator line */}
      {snapIndicator && (
        <div
          className="absolute h-full w-0.5 bg-purple-400"
          style={{ left: snapIndicator.position }}
        />
      )}
    </div>
  );
}

// Hook for managing what-if state
export function useWhatIfScenarios(initialTasks: GanttTask[]) {
  const [isWhatIfMode, setIsWhatIfMode] = useState(false);
  const [originalTasks] = useState<GanttTask[]>(initialTasks);
  const [simulatedTasks, setSimulatedTasks] = useState<GanttTask[]>(initialTasks);
  const [pendingChanges, setPendingChanges] = useState<TaskChange[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<WhatIfScenario[]>([]);

  const toggleWhatIfMode = useCallback(() => {
    setIsWhatIfMode((prev) => {
      if (prev) {
        // Exiting what-if mode, reset to original
        setSimulatedTasks(originalTasks);
        setPendingChanges([]);
      }
      return !prev;
    });
  }, [originalTasks]);

  const addChange = useCallback((change: TaskChange) => {
    setPendingChanges((prev) => {
      // Replace existing change for same task+field, or add new
      const filtered = prev.filter(
        (c) => !(c.taskId === change.taskId && c.field === change.field)
      );
      return [...filtered, change];
    });

    // Update simulated tasks
    setSimulatedTasks((prev) =>
      prev.map((task) => {
        if (task.taskId !== change.taskId) return task;
        return {
          ...task,
          [change.field]: change.newValue,
          // Auto-update end date if start date changes
          ...(change.field === 'startDate' && {
            endDate: addDays(new Date(change.newValue as string), task.duration - 1).toISOString(),
          }),
        };
      })
    );
  }, []);

  const discardChanges = useCallback(() => {
    setSimulatedTasks(originalTasks);
    setPendingChanges([]);
  }, [originalTasks]);

  const saveScenario = useCallback((name: string, description?: string) => {
    if (pendingChanges.length === 0) return;

    const endDates = simulatedTasks.map((t) => new Date(t.endDate));
    const newEndDate = new Date(Math.max(...endDates.map((d) => d.getTime())));

    const criticalTasks = simulatedTasks.filter((t) => t.isCritical);
    const affectedCriticalTasks = criticalTasks.filter((t) =>
      pendingChanges.some((c) => c.taskId === t.taskId)
    );
    const criticalPathImpact = affectedCriticalTasks.reduce((max, task) => {
      const change = pendingChanges.find((c) => c.taskId === task.taskId);
      return change ? Math.max(max, Math.abs(change.daysDelta)) : max;
    }, 0);

    const scenario: WhatIfScenario = {
      id: `scenario-${Date.now()}`,
      name,
      description,
      createdAt: new Date(),
      changes: [...pendingChanges],
      impactSummary: {
        tasksAffected: new Set(pendingChanges.map((c) => c.taskId)).size,
        criticalPathImpact,
        totalDaysShifted: pendingChanges.reduce((sum, c) => sum + Math.abs(c.daysDelta), 0),
        newEndDate,
      },
    };

    setSavedScenarios((prev) => [scenario, ...prev]);
  }, [pendingChanges, simulatedTasks]);

  const loadScenario = useCallback((scenario: WhatIfScenario) => {
    setIsWhatIfMode(true);
    setPendingChanges([...scenario.changes]);

    // Apply changes to original tasks
    const newSimulated = originalTasks.map((task) => {
      const changes = scenario.changes.filter((c) => c.taskId === task.taskId);
      if (changes.length === 0) return task;

      let updated = { ...task };
      changes.forEach((change) => {
        updated = {
          ...updated,
          [change.field]: change.newValue,
          ...(change.field === 'startDate' && {
            endDate: addDays(new Date(change.newValue as string), task.duration - 1).toISOString(),
          }),
        };
      });
      return updated;
    });

    setSimulatedTasks(newSimulated);
  }, [originalTasks]);

  const deleteScenario = useCallback((id: string) => {
    setSavedScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    isWhatIfMode,
    toggleWhatIfMode,
    originalTasks,
    simulatedTasks,
    pendingChanges,
    addChange,
    discardChanges,
    saveScenario,
    savedScenarios,
    loadScenario,
    deleteScenario,
    // Helper to get current tasks (simulated if in what-if mode, original otherwise)
    currentTasks: isWhatIfMode ? simulatedTasks : originalTasks,
  };
}
