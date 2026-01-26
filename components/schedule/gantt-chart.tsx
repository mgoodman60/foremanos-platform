"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, AlertTriangle, CheckCircle2, Clock, ChevronRight, ChevronDown, Flag, GripVertical, Layers, Eye, EyeOff, Link2, Activity, Zap, Timer, TrendingDown, PlayCircle, Beaker, Undo2, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TradeFilter, TradeOption } from './trade-filter';
import { DependencyLines, DependencyTypeSelector } from './dependency-lines';
import { InlineTaskEditor } from './inline-task-editor';
import { WhatIfScenarios, TaskChange, WhatIfScenario, useWhatIfScenarios } from './what-if-scenarios';

// Task categorization for color coding
type TaskCategory = 'critical' | 'whats-next' | 'at-risk' | 'behind' | 'on-track' | 'completed';

function getTaskCategory(task: GanttTask, today: Date = new Date()): TaskCategory {
  // Completed tasks
  if (task.status === 'completed' || task.percentComplete >= 100) {
    return 'completed';
  }
  
  // Critical path always takes precedence for in-progress/upcoming
  if (task.isCritical) {
    return 'critical';
  }
  
  // Check if task is behind schedule
  const taskStart = new Date(task.startDate);
  const plannedStart = task.baselineStartDate ? new Date(task.baselineStartDate) : taskStart;
  if (task.actualStartDate) {
    const actualStart = new Date(task.actualStartDate);
    if (actualStart > plannedStart) {
      return 'behind';
    }
  } else if (taskStart < today && task.percentComplete === 0) {
    // Should have started but hasn't
    return 'behind';
  }
  
  // At risk - low float (0-3 days)
  if (task.totalFloat !== undefined && task.totalFloat !== null && task.totalFloat <= 3) {
    return 'at-risk';
  }
  
  // What's Next - starting within next 7 days and not started
  const daysUntilStart = Math.ceil((taskStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilStart >= 0 && daysUntilStart <= 7 && task.percentComplete === 0) {
    return 'whats-next';
  }
  
  return 'on-track';
}

// Category colors and styles
const categoryStyles: Record<TaskCategory, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
  'critical': {
    bg: 'bg-red-600',
    border: 'ring-2 ring-red-400 ring-offset-1 ring-offset-[#2d333b]',
    text: 'text-red-400',
    icon: <Zap className="h-3 w-3" />,
    label: 'Critical Path'
  },
  'whats-next': {
    bg: 'bg-amber-500',
    border: 'ring-2 ring-amber-400/50 ring-offset-1 ring-offset-[#2d333b]',
    text: 'text-amber-400',
    icon: <PlayCircle className="h-3 w-3" />,
    label: "What's Next"
  },
  'at-risk': {
    bg: 'bg-orange-500',
    border: 'ring-1 ring-orange-400/50',
    text: 'text-orange-400',
    icon: <Timer className="h-3 w-3" />,
    label: 'At Risk'
  },
  'behind': {
    bg: 'bg-rose-600',
    border: 'ring-2 ring-rose-400/70 ring-offset-1 ring-offset-[#2d333b]',
    text: 'text-rose-400',
    icon: <TrendingDown className="h-3 w-3" />,
    label: 'Behind Schedule'
  },
  'on-track': {
    bg: 'bg-blue-500',
    border: '',
    text: 'text-blue-400',
    icon: null,
    label: 'On Track'
  },
  'completed': {
    bg: 'bg-green-500',
    border: '',
    text: 'text-green-400',
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: 'Completed'
  }
};

interface GanttTask {
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
  assignedTo?: string;
  subcontractor?: {
    id: string;
    companyName: string;
    tradeType: string;
  };
  location?: string;
  wbsCode?: string;
  totalFloat?: number;
  // Actual dates from daily reports
  actualStartDate?: Date | string | null;
  actualEndDate?: Date | string | null;
  baselineStartDate?: Date | string | null;
  baselineEndDate?: Date | string | null;
}

interface Milestone {
  id: string;
  name: string;
  date: Date | string;
  type: string;
  importance: string;
}

interface GanttChartProps {
  tasks: GanttTask[];
  milestones?: Milestone[];
  onTaskClick?: (task: GanttTask) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<GanttTask>) => Promise<void>;
  showCriticalPath?: boolean;
  showBaseline?: boolean;
  actualProgressPercent?: number; // Overall actual % complete from daily reports
}

export function GanttChart({ tasks, milestones = [], onTaskClick, onTaskUpdate, showCriticalPath = true, showBaseline: initialShowBaseline = true, actualProgressPercent }: GanttChartProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [draggedTask, setDraggedTask] = useState<GanttTask | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [showBaseline, setShowBaseline] = useState(initialShowBaseline);
  const [showP6Columns, setShowP6Columns] = useState(true);
  const [showDependencyLines, setShowDependencyLines] = useState(true); // Default ON now
  const [dependencyType, setDependencyType] = useState<'FS' | 'SS' | 'FF' | 'SF'>('FS');
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [taskPositions, setTaskPositions] = useState<Map<string, { left: number; width: number; top: number; height: number }>>(new Map());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [progressEditingTaskId, setProgressEditingTaskId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const taskRowsRef = useRef<HTMLDivElement>(null);
  
  // What-If Mode State
  const [isWhatIfMode, setIsWhatIfMode] = useState(false);
  const [whatIfChanges, setWhatIfChanges] = useState<TaskChange[]>([]);
  const [simulatedTasks, setSimulatedTasks] = useState<GanttTask[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<WhatIfScenario[]>([]);
  const [originalTasksSnapshot, setOriginalTasksSnapshot] = useState<GanttTask[]>([]);
  
  // Enhanced Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [dragDaysDelta, setDragDaysDelta] = useState(0);
  const [snapToWeek, setSnapToWeek] = useState(false);
  const [dragHistory, setDragHistory] = useState<{ taskId: string; originalStart: string; originalEnd: string }[]>([]);
  
  // Row height for dependency line calculations
  const ROW_HEIGHT = 56;

  // Initialize what-if mode with current tasks
  useEffect(() => {
    if (isWhatIfMode && originalTasksSnapshot.length === 0) {
      setOriginalTasksSnapshot([...tasks]);
      setSimulatedTasks([...tasks]);
    }
  }, [isWhatIfMode, tasks, originalTasksSnapshot.length]);

  // Get active tasks (simulated if in what-if mode)
  const activeTasks = useMemo(() => {
    return isWhatIfMode && simulatedTasks.length > 0 ? simulatedTasks : tasks;
  }, [isWhatIfMode, simulatedTasks, tasks]);

  // Handle task editing
  const handleTaskEdit = (taskId: string) => {
    setEditingTaskId(taskId);
  };

  const handleTaskSave = async (taskId: string, updates: Partial<GanttTask>) => {
    if (onTaskUpdate) {
      await onTaskUpdate(taskId, updates);
    }
    setEditingTaskId(null);
  };

  // Handle quick progress update
  const handleProgressUpdate = async (taskId: string, progress: number) => {
    if (onTaskUpdate) {
      await onTaskUpdate(taskId, { 
        percentComplete: progress,
        status: progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started'
      });
    }
    setProgressEditingTaskId(null);
  };

  // Extract unique trades from tasks
  const trades: TradeOption[] = useMemo(() => {
    const tradeMap = new Map<string, TradeOption>();
    tasks.forEach(task => {
      if (task.subcontractor) {
        const key = task.subcontractor.id;
        if (!tradeMap.has(key)) {
          tradeMap.set(key, {
            id: key,
            name: task.subcontractor.companyName,
            companyName: task.subcontractor.companyName,
            tradeType: task.subcontractor.tradeType,
            taskCount: 1
          });
        } else {
          const existing = tradeMap.get(key)!;
          existing.taskCount = (existing.taskCount || 0) + 1;
        }
      }
    });
    return Array.from(tradeMap.values());
  }, [tasks]);

  // Filter tasks by selected trades (use activeTasks for what-if mode)
  const filteredTasks = useMemo(() => {
    const baseTasks = activeTasks;
    if (selectedTrades.length === 0) return baseTasks;
    return baseTasks.filter(task => {
      if (!task.subcontractor) return false;
      return selectedTrades.includes(task.subcontractor.id);
    });
  }, [activeTasks, selectedTrades]);
  
  // Check if any tasks have baseline or actual dates
  const hasBaselineData = tasks.some(t => t.baselineStartDate || t.baselineEndDate);
  const hasActualData = tasks.some(t => t.actualStartDate || t.actualEndDate);

  // Format assignee as "Trade - Subcontractor" (P6 style)
  const formatAssignee = (task: GanttTask) => {
    if (!task.subcontractor) {
      return task.assignedTo || null;
    }
    
    // Format trade type for display (e.g., "ELECTRICAL" -> "Electrical")
    const formatTrade = (tradeType: string) => {
      return tradeType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };
    
    const trade = formatTrade(task.subcontractor.tradeType);
    const subName = task.subcontractor.companyName;
    
    // Return "Trade - Sub" format (e.g., "Electrical - KHI")
    return `${trade} - ${subName}`;
  };

  // Get just the trade portion for compact displays
  const getTradeLabel = (task: GanttTask) => {
    if (!task.subcontractor?.tradeType) return null;
    return task.subcontractor.tradeType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Get float color based on days
  const getFloatColor = (totalFloat?: number) => {
    if (totalFloat === undefined || totalFloat === null) return 'text-gray-400';
    if (totalFloat === 0) return 'text-red-500';
    if (totalFloat <= 5) return 'text-amber-500';
    return 'text-green-500';
  };

  const getFloatBg = (totalFloat?: number) => {
    if (totalFloat === undefined || totalFloat === null) return 'bg-gray-500/10';
    if (totalFloat === 0) return 'bg-red-500/20';
    if (totalFloat <= 5) return 'bg-amber-500/20';
    return 'bg-green-500/20';
  };

  // Calculate date range
  const { startDate, endDate, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      return {
        startDate: now,
        endDate: addDays(now, 30),
        totalDays: 30
      };
    }

    const dates = tasks.map(t => new Date(t.startDate));
    const endDates = tasks.map(t => new Date(t.endDate));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...endDates.map(d => d.getTime())));
    
    return {
      startDate: startOfWeek(minDate),
      endDate: endOfWeek(maxDate),
      totalDays: differenceInDays(maxDate, minDate) + 1
    };
  }, [tasks]);

  // Calculate today marker position
  const todayPosition = useMemo(() => {
    const today = new Date();
    if (today < startDate || today > endDate) return null;
    const totalMs = endDate.getTime() - startDate.getTime();
    if (totalMs <= 0) return null;
    const todayMs = today.getTime() - startDate.getTime();
    return (todayMs / totalMs) * 100;
  }, [startDate, endDate]);

  // Calculate overall progress from tasks (weighted by duration)
  const overallProgress = useMemo(() => {
    if (actualProgressPercent !== undefined) {
      return actualProgressPercent;
    }
    // Calculate weighted average of task completion
    let totalWeightedProgress = 0;
    let totalDuration = 0;
    filteredTasks.forEach(task => {
      const duration = task.duration || 1;
      totalWeightedProgress += (task.percentComplete || 0) * duration;
      totalDuration += duration;
    });
    return totalDuration > 0 ? totalWeightedProgress / totalDuration : 0;
  }, [filteredTasks, actualProgressPercent]);

  // Calculate actual progress marker position (where we actually are based on completion)
  const actualProgressPosition = useMemo(() => {
    if (overallProgress <= 0) return null;
    // Progress position is based on percentage of total timeline
    return Math.min(overallProgress, 100);
  }, [overallProgress]);

  // Memoized task positions for dependency lines
  const calculatedTaskPositions = useMemo(() => {
    const positions = new Map<string, { left: number; width: number; top: number; height: number }>();
    
    const chartStart = new Date(startDate);
    const chartEnd = new Date(endDate);
    const totalWidth = differenceInDays(chartEnd, chartStart);
    
    if (totalWidth <= 0) return positions;
    
    filteredTasks.forEach((task, index) => {
      const taskStart = new Date(task.startDate);
      const taskEnd = new Date(task.endDate);
      const startOffset = differenceInDays(taskStart, chartStart);
      const taskWidth = differenceInDays(taskEnd, taskStart) + 1;
      
      positions.set(task.taskId, {
        left: Math.max(0, (startOffset / totalWidth) * 100),
        width: Math.min(100, (taskWidth / totalWidth) * 100),
        top: (index * ROW_HEIGHT) + 100, // Account for header + legend
        height: ROW_HEIGHT
      });
    });
    
    return positions;
  }, [filteredTasks, startDate, endDate]);

  // Generate timeline headers
  const timelineHeaders = useMemo(() => {
    const headers: Date[] = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      headers.push(new Date(current));
      if (viewMode === 'day') {
        current = addDays(current, 1);
      } else if (viewMode === 'week') {
        current = addDays(current, 7);
      } else {
        current = addDays(current, 30);
      }
    }

    return headers;
  }, [startDate, endDate, viewMode]);

  const toggleTask = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // What-If Mode Handlers
  const toggleWhatIfMode = useCallback(() => {
    setIsWhatIfMode(prev => {
      if (prev) {
        // Exiting what-if mode - reset everything
        setSimulatedTasks([]);
        setWhatIfChanges([]);
        setOriginalTasksSnapshot([]);
        setDragHistory([]);
      }
      return !prev;
    });
  }, []);

  const applyWhatIfChanges = useCallback(async () => {
    if (!onTaskUpdate || whatIfChanges.length === 0) return;
    
    // Apply all changes to actual schedule
    for (const change of whatIfChanges) {
      const task = simulatedTasks.find(t => t.taskId === change.taskId);
      if (task) {
        await onTaskUpdate(change.taskId, {
          startDate: task.startDate,
          endDate: task.endDate
        });
      }
    }
    
    // Exit what-if mode
    setIsWhatIfMode(false);
    setSimulatedTasks([]);
    setWhatIfChanges([]);
    setOriginalTasksSnapshot([]);
    setDragHistory([]);
  }, [onTaskUpdate, whatIfChanges, simulatedTasks]);

  const discardWhatIfChanges = useCallback(() => {
    setSimulatedTasks([...originalTasksSnapshot]);
    setWhatIfChanges([]);
    setDragHistory([]);
  }, [originalTasksSnapshot]);

  const saveWhatIfScenario = useCallback((name: string, description?: string) => {
    if (whatIfChanges.length === 0) return;

    const endDates = simulatedTasks.map(t => new Date(t.endDate));
    const newEndDate = new Date(Math.max(...endDates.map(d => d.getTime())));

    const criticalTasks = simulatedTasks.filter(t => t.isCritical);
    const affectedCriticalTasks = criticalTasks.filter(t =>
      whatIfChanges.some(c => c.taskId === t.taskId)
    );
    const criticalPathImpact = affectedCriticalTasks.reduce((max, task) => {
      const change = whatIfChanges.find(c => c.taskId === task.taskId);
      return change ? Math.max(max, Math.abs(change.daysDelta)) : max;
    }, 0);

    const scenario: WhatIfScenario = {
      id: `scenario-${Date.now()}`,
      name,
      description,
      createdAt: new Date(),
      changes: [...whatIfChanges],
      impactSummary: {
        tasksAffected: new Set(whatIfChanges.map(c => c.taskId)).size,
        criticalPathImpact,
        totalDaysShifted: whatIfChanges.reduce((sum, c) => sum + Math.abs(c.daysDelta), 0),
        newEndDate
      }
    };

    setSavedScenarios(prev => [scenario, ...prev]);
  }, [whatIfChanges, simulatedTasks]);

  const loadWhatIfScenario = useCallback((scenario: WhatIfScenario) => {
    setIsWhatIfMode(true);
    setWhatIfChanges([...scenario.changes]);
    setOriginalTasksSnapshot([...tasks]);

    // Apply changes to create simulated tasks
    const newSimulated = tasks.map(task => {
      const changes = scenario.changes.filter(c => c.taskId === task.taskId);
      if (changes.length === 0) return task;

      let updated = { ...task };
      changes.forEach(change => {
        updated = {
          ...updated,
          [change.field]: change.newValue,
          ...(change.field === 'startDate' && {
            endDate: addDays(new Date(change.newValue as string), task.duration - 1).toISOString()
          })
        };
      });
      return updated;
    });

    setSimulatedTasks(newSimulated);
  }, [tasks]);

  const deleteWhatIfScenario = useCallback((id: string) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
  }, []);

  // Undo last drag
  const undoLastDrag = useCallback(() => {
    if (dragHistory.length === 0) return;
    
    const lastDrag = dragHistory[dragHistory.length - 1];
    
    if (isWhatIfMode) {
      // In what-if mode, restore the simulated task
      setSimulatedTasks(prev => prev.map(task => {
        if (task.taskId !== lastDrag.taskId) return task;
        return {
          ...task,
          startDate: lastDrag.originalStart,
          endDate: lastDrag.originalEnd
        };
      }));
      
      // Remove the change from whatIfChanges
      setWhatIfChanges(prev => prev.filter(c => c.taskId !== lastDrag.taskId));
    }
    
    // Remove from history
    setDragHistory(prev => prev.slice(0, -1));
    toast.info('Undo: Task restored to previous position');
  }, [dragHistory, isWhatIfMode]);

  // Enhanced Drag and drop handlers
  const handleDragStart = (task: GanttTask, e: React.MouseEvent) => {
    setDraggedTask(task);
    setDragStartX(e.clientX);
    setDragOffset(0);
    setIsDragging(true);
    setDragDaysDelta(0);
    
    // Save to history for undo
    setDragHistory(prev => [...prev, {
      taskId: task.taskId,
      originalStart: typeof task.startDate === 'string' ? task.startDate : task.startDate.toISOString(),
      originalEnd: typeof task.endDate === 'string' ? task.endDate : task.endDate.toISOString()
    }]);
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!draggedTask || !timelineRef.current) return;
    
    const offset = e.clientX - dragStartX;
    const timelineWidth = timelineRef.current.offsetWidth;
    const chartStart = new Date(startDate);
    const chartEnd = new Date(endDate);
    const totalDays = differenceInDays(chartEnd, chartStart);
    
    let daysMoved = Math.round((offset / timelineWidth) * totalDays);
    
    // Snap to week if enabled
    if (snapToWeek) {
      daysMoved = Math.round(daysMoved / 7) * 7;
    }
    
    setDragDaysDelta(daysMoved);
    setDragOffset(offset);
  };

  const handleDragEnd = async () => {
    if (!draggedTask || !timelineRef.current) {
      resetDragState();
      return;
    }

    try {
      const timelineWidth = timelineRef.current.offsetWidth;
      const chartStart = new Date(startDate);
      const chartEnd = new Date(endDate);
      const totalDays = differenceInDays(chartEnd, chartStart);
      
      let daysMoved = Math.round((dragOffset / timelineWidth) * totalDays);
      
      // Snap to week if enabled
      if (snapToWeek) {
        daysMoved = Math.round(daysMoved / 7) * 7;
      }
      
      if (daysMoved !== 0) {
        const taskStart = new Date(draggedTask.startDate);
        const newStartDate = addDays(taskStart, daysMoved);
        const newEndDate = addDays(new Date(draggedTask.endDate), daysMoved);

        if (isWhatIfMode) {
          // In what-if mode, update simulated tasks
          setSimulatedTasks(prev => prev.map(task => {
            if (task.taskId !== draggedTask.taskId) return task;
            return {
              ...task,
              startDate: newStartDate.toISOString(),
              endDate: newEndDate.toISOString()
            };
          }));
          
          // Record the change
          const newChange: TaskChange = {
            taskId: draggedTask.taskId,
            taskName: draggedTask.name,
            field: 'startDate',
            originalValue: draggedTask.startDate,
            newValue: newStartDate.toISOString(),
            daysDelta: daysMoved
          };
          
          setWhatIfChanges(prev => {
            const filtered = prev.filter(c => c.taskId !== draggedTask.taskId);
            return [...filtered, newChange];
          });
          
          toast.success(`Simulated: ${daysMoved > 0 ? '+' : ''}${daysMoved} day${Math.abs(daysMoved) > 1 ? 's' : ''}`, {
            description: 'Changes are in What-If mode. Apply to save.',
            icon: <Beaker className="h-4 w-4 text-purple-400" />
          });
        } else if (onTaskUpdate) {
          // Normal mode - actually update
          await onTaskUpdate(draggedTask.taskId, {
            startDate: newStartDate.toISOString(),
            endDate: newEndDate.toISOString()
          });
          
          toast.success(`Task rescheduled by ${Math.abs(daysMoved)} day${Math.abs(daysMoved) > 1 ? 's' : ''}`);
        }
      } else {
        // No change - remove from history
        setDragHistory(prev => prev.slice(0, -1));
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to reschedule task');
      // Remove from history on error
      setDragHistory(prev => prev.slice(0, -1));
    } finally {
      resetDragState();
    }
  };
  
  const resetDragState = () => {
    setDraggedTask(null);
    setDragOffset(0);
    setIsDragging(false);
    setDragDaysDelta(0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'delayed': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'delayed': return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  const calculateBarPosition = (task: GanttTask) => {
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);
    const chartStart = new Date(startDate);
    const chartEnd = new Date(endDate);

    const totalWidth = differenceInDays(chartEnd, chartStart);
    const startOffset = differenceInDays(taskStart, chartStart);
    const taskWidth = differenceInDays(taskEnd, taskStart) + 1;

    const left = (startOffset / totalWidth) * 100;
    const width = (taskWidth / totalWidth) * 100;

    return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` };
  };

  // Calculate baseline bar position (original plan)
  const calculateBaselinePosition = (task: GanttTask) => {
    const baseStart = task.baselineStartDate ? new Date(task.baselineStartDate) : new Date(task.startDate);
    const baseEnd = task.baselineEndDate ? new Date(task.baselineEndDate) : new Date(task.endDate);
    const chartStart = new Date(startDate);
    const chartEnd = new Date(endDate);

    const totalWidth = differenceInDays(chartEnd, chartStart);
    const startOffset = differenceInDays(baseStart, chartStart);
    const taskWidth = differenceInDays(baseEnd, baseStart) + 1;

    const left = (startOffset / totalWidth) * 100;
    const width = (taskWidth / totalWidth) * 100;

    return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` };
  };

  // Calculate actual bar position (from daily reports)
  const calculateActualPosition = (task: GanttTask) => {
    if (!task.actualStartDate) return null;
    
    const actualStart = new Date(task.actualStartDate);
    const actualEnd = task.actualEndDate ? new Date(task.actualEndDate) : new Date(); // Use today if not completed
    const chartStart = new Date(startDate);
    const chartEnd = new Date(endDate);

    const totalWidth = differenceInDays(chartEnd, chartStart);
    const startOffset = differenceInDays(actualStart, chartStart);
    const taskWidth = differenceInDays(actualEnd, actualStart) + 1;

    const left = (startOffset / totalWidth) * 100;
    const width = (taskWidth / totalWidth) * 100;

    return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` };
  };

  // Calculate schedule variance in days
  const getScheduleVariance = (task: GanttTask) => {
    if (!task.actualStartDate && !task.baselineStartDate) return null;
    
    const plannedStart = task.baselineStartDate ? new Date(task.baselineStartDate) : new Date(task.startDate);
    const actualStart = task.actualStartDate ? new Date(task.actualStartDate) : new Date(task.startDate);
    
    return differenceInDays(actualStart, plannedStart);
  };

  return (
    <TooltipProvider>
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-300">
            {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Baseline Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2d333b] rounded-lg border border-gray-600">
            <Switch
              id="show-baseline"
              checked={showBaseline}
              onCheckedChange={setShowBaseline}
              className="data-[state=checked]:bg-orange-500"
            />
            <Label htmlFor="show-baseline" className={cn(
              "text-sm flex items-center gap-1.5 cursor-pointer",
              showBaseline ? "text-orange-400" : "text-gray-400"
            )}>
              <Layers className="h-4 w-4" />
              Baseline
            </Label>
          </div>

          {/* P6 Columns Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2d333b] rounded-lg border border-gray-600">
            <Switch
              id="show-p6"
              checked={showP6Columns}
              onCheckedChange={setShowP6Columns}
              className="data-[state=checked]:bg-orange-500"
            />
            <Label htmlFor="show-p6" className={cn(
              "text-sm flex items-center gap-1.5 cursor-pointer",
              showP6Columns ? "text-orange-400" : "text-gray-400"
            )}>
              {showP6Columns ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              P6 View
            </Label>
          </div>

          {/* Dependency Lines Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2d333b] rounded-lg border border-gray-600">
            <Switch
              id="show-dependencies"
              checked={showDependencyLines}
              onCheckedChange={setShowDependencyLines}
              className="data-[state=checked]:bg-blue-500"
            />
            <Label htmlFor="show-dependencies" className={cn(
              "text-sm flex items-center gap-1.5 cursor-pointer",
              showDependencyLines ? "text-blue-400" : "text-gray-400"
            )}>
              <Link2 className="h-4 w-4" />
              Dependencies
            </Label>
            {/* Dependency Type Selector (only visible when enabled) */}
            {showDependencyLines && (
              <div className="ml-2 border-l border-gray-600 pl-2">
                <DependencyTypeSelector value={dependencyType} onChange={setDependencyType} />
              </div>
            )}
          </div>

          {/* Trade Filter */}
          {trades.length > 0 && (
            <TradeFilter
              trades={trades}
              selectedTrades={selectedTrades}
              onSelectionChange={setSelectedTrades}
            />
          )}

          {/* View Mode Buttons */}
          <div className="flex gap-1 p-1 bg-[#1F2328] rounded-lg border border-gray-600">
            <Button
              variant={viewMode === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('day')}
              className={cn(
                "transition-all",
                viewMode === 'day' 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-[#3d444d]'
              )}
            >
              Day
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className={cn(
                "transition-all",
                viewMode === 'week' 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-[#3d444d]'
              )}
            >
              Week
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              className={cn(
                "transition-all",
                viewMode === 'month' 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-[#3d444d]'
              )}
            >
              Month
            </Button>
          </div>
        </div>
      </div>

      {/* What-If Mode Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* What-If Toggle */}
        <Button
          variant={isWhatIfMode ? "default" : "outline"}
          size="sm"
          onClick={toggleWhatIfMode}
          className={cn(
            "gap-2 transition-all",
            isWhatIfMode
              ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
              : "border-gray-600 hover:border-purple-500 hover:text-purple-400"
          )}
        >
          <Beaker className={cn("h-4 w-4", isWhatIfMode && "animate-pulse")} />
          What-If Mode
          {isWhatIfMode && (
            <Badge variant="secondary" className="bg-purple-800 text-purple-200 ml-1 text-[10px]">
              Active
            </Badge>
          )}
        </Button>

        {/* Snap to Week Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2d333b] rounded-lg border border-gray-600">
          <Switch
            id="snap-week"
            checked={snapToWeek}
            onCheckedChange={setSnapToWeek}
            className="data-[state=checked]:bg-green-500"
          />
          <Label htmlFor="snap-week" className={cn(
            "text-sm flex items-center gap-1.5 cursor-pointer",
            snapToWeek ? "text-green-400" : "text-gray-400"
          )}>
            <Move className="h-4 w-4" />
            Snap to Week
          </Label>
        </div>

        {/* Undo Button */}
        {dragHistory.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={undoLastDrag}
            className="gap-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
          >
            <Undo2 className="h-4 w-4" />
            Undo
            <Badge variant="outline" className="border-amber-500/50 text-amber-400 ml-1 text-[10px]">
              {dragHistory.length}
            </Badge>
          </Button>
        )}

        {/* What-If Change Count */}
        {isWhatIfMode && whatIfChanges.length > 0 && (
          <Badge variant="outline" className="border-amber-500 text-amber-400">
            {whatIfChanges.length} change{whatIfChanges.length !== 1 ? 's' : ''} pending
          </Badge>
        )}
      </div>

      {/* What-If Scenarios Panel */}
      {(isWhatIfMode || savedScenarios.length > 0) && (
        <WhatIfScenarios
          tasks={activeTasks}
          originalTasks={originalTasksSnapshot.length > 0 ? originalTasksSnapshot : tasks}
          isActive={isWhatIfMode}
          onToggle={toggleWhatIfMode}
          pendingChanges={whatIfChanges}
          onApplyChanges={applyWhatIfChanges}
          onDiscardChanges={discardWhatIfChanges}
          onSaveScenario={saveWhatIfScenario}
          savedScenarios={savedScenarios}
          onLoadScenario={loadWhatIfScenario}
          onDeleteScenario={deleteWhatIfScenario}
        />
      )}

      {/* Drag Preview Indicator */}
      {isDragging && draggedTask && dragDaysDelta !== 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className={cn(
            "bg-[#1a1f24] rounded-lg px-4 py-2 shadow-xl border flex items-center gap-3",
            isWhatIfMode ? "border-purple-500" : "border-orange-500"
          )}>
            <span className="text-sm text-gray-300 truncate max-w-[200px]">
              {draggedTask.name}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-sm font-semibold",
                dragDaysDelta > 0
                  ? "border-amber-400 text-amber-300"
                  : "border-green-400 text-green-300"
              )}
            >
              {dragDaysDelta > 0 ? '+' : ''}{dragDaysDelta}d
            </Badge>
            {isWhatIfMode && (
              <span className="text-[10px] text-purple-400">(Simulated)</span>
            )}
          </div>
        </div>
      )}

      {/* Gantt Chart */}
      <Card className="bg-[#2d333b] border-gray-700">
        <div className="overflow-x-auto">
          <div className="min-w-[1200px] relative">
            {/* Today Marker */}
            {todayPosition !== null && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                style={{ left: showP6Columns 
                  ? `calc(440px + (100% - 440px) * ${todayPosition / 100})` 
                  : `calc(300px + (100% - 300px) * ${todayPosition / 100})` 
                }}
              >
                <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-medium shadow-lg">
                  Today
                </div>
              </div>
            )}

            {/* Actual Progress Marker - Where we actually are based on % complete */}
            {actualProgressPosition !== null && actualProgressPosition > 0 && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-25 pointer-events-none"
                style={{ left: showP6Columns 
                  ? `calc(440px + (100% - 440px) * ${actualProgressPosition / 100})` 
                  : `calc(300px + (100% - 300px) * ${actualProgressPosition / 100})` 
                }}
              >
                <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-medium shadow-lg flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  Actual {Math.round(overallProgress)}%
                </div>
                {/* Dashed line extension */}
                <div className="absolute top-8 bottom-0 left-0 w-0.5 border-l-2 border-dashed border-emerald-500/50" />
              </div>
            )}

            {/* Timeline Header - P6 Style */}
            <div className={cn(
              "grid border-b border-gray-700",
              showP6Columns ? "grid-cols-[60px_80px_200px_50px_50px_1fr]" : "grid-cols-[300px_1fr]"
            )}>
              {showP6Columns ? (
                <>
                  <div className="px-2 py-3 bg-[#1F2328] border-r border-gray-700 text-center">
                    <span className="text-xs font-semibold text-gray-400">ID</span>
                  </div>
                  <div className="px-2 py-3 bg-[#1F2328] border-r border-gray-700 text-center">
                    <span className="text-xs font-semibold text-gray-400">WBS</span>
                  </div>
                  <div className="px-2 py-3 bg-[#1F2328] border-r border-gray-700">
                    <span className="text-xs font-semibold text-gray-400">Task Name</span>
                  </div>
                  <div className="px-2 py-3 bg-[#1F2328] border-r border-gray-700 text-center">
                    <span className="text-xs font-semibold text-gray-400">Dur</span>
                  </div>
                  <div className="px-2 py-3 bg-[#1F2328] border-r border-gray-700 text-center">
                    <span className="text-xs font-semibold text-gray-400">Float</span>
                  </div>
                </>
              ) : (
                <div className="px-4 py-3 bg-[#1F2328] border-r border-gray-700">
                  <span className="text-sm font-semibold text-gray-200">Task</span>
                </div>
              )}
              <div className="flex relative">
                {timelineHeaders.map((date, idx) => (
                  <div
                    key={idx}
                    className="flex-1 px-2 py-3 text-center border-r border-gray-700 bg-[#1F2328]"
                  >
                    <span className="text-xs font-medium text-gray-300">
                      {viewMode === 'day' && format(date, 'MMM d')}
                      {viewMode === 'week' && format(date, 'MMM d')}
                      {viewMode === 'month' && format(date, 'MMM yyyy')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend for baseline vs actual and markers */}
            <div className="flex items-center gap-4 px-4 py-2 bg-[#1F2328]/50 border-b border-gray-700 text-xs flex-wrap">
              {showBaseline && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-2 bg-gray-600 rounded opacity-60" />
                    <span className="text-gray-400">Baseline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-2 bg-blue-500 rounded" />
                    <span className="text-gray-400">Current Plan</span>
                  </div>
                  {hasActualData && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-2 bg-emerald-500 rounded border-2 border-emerald-300" />
                      <span className="text-gray-400">Actual Work</span>
                    </div>
                  )}
                </>
              )}
              {/* Marker legend */}
              <div className="flex items-center gap-1 ml-auto border-l border-gray-600 pl-4">
                <span className="text-gray-500 mr-2">Markers:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-0.5 h-4 bg-red-500 rounded" />
                  <span className="text-gray-400">Today</span>
                </div>
                <div className="flex items-center gap-1.5 ml-3">
                  <div className="w-0.5 h-4 bg-emerald-500 rounded" />
                  <span className="text-gray-400">Actual Progress ({Math.round(overallProgress)}%)</span>
                </div>
                {/* Show ahead/behind status */}
                {todayPosition !== null && actualProgressPosition !== null && (
                  <div className="ml-3 flex items-center gap-1">
                    {actualProgressPosition >= todayPosition ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                        {Math.round(actualProgressPosition - todayPosition)}% ahead
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                        {Math.round(todayPosition - actualProgressPosition)}% behind
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Task Rows */}
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                {tasks.length === 0 
                  ? 'No tasks found. Parse a schedule document to get started.'
                  : 'No tasks match the current filters.'}
              </div>
            ) : (
              filteredTasks.map((task, index) => {
                const isExpanded = expandedTasks.has(task.id);
                const hasRelations = task.predecessors.length > 0 || task.successors.length > 0;
                const barPosition = calculateBarPosition(task);
                const baselinePosition = calculateBaselinePosition(task);
                const actualPosition = calculateActualPosition(task);
                const scheduleVariance = getScheduleVariance(task);

                return (
                  <div key={task.id} className="border-b border-gray-700">
                    {/* Main Task Row */}
                    <div className={cn(
                      "grid hover:bg-[#1F2328]/50 transition-colors",
                      showP6Columns ? "grid-cols-[60px_80px_200px_50px_50px_1fr]" : "grid-cols-[300px_1fr]"
                    )}>
                      {/* P6 Style Columns */}
                      {showP6Columns ? (
                        <>
                          {/* Task ID */}
                          <div className="px-2 py-3 border-r border-gray-700 flex items-center justify-center">
                            <span className="text-xs font-mono text-gray-400">{task.taskId}</span>
                          </div>
                          {/* WBS Code */}
                          <div className="px-2 py-3 border-r border-gray-700 flex items-center justify-center">
                            <span className="text-xs font-mono text-gray-500">{task.wbsCode || '-'}</span>
                          </div>
                          {/* Task Name */}
                          <div className="px-2 py-3 border-r border-gray-700 flex items-center gap-1">
                            {hasRelations && (
                              <button
                                onClick={() => toggleTask(task.id)}
                                className="text-gray-400 hover:text-gray-200 flex-shrink-0"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </button>
                            )}
                            {(() => {
                              const category = getTaskCategory(task);
                              const catStyles = categoryStyles[category];
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => onTaskClick?.(task)}
                                      className={cn(
                                        "text-xs hover:text-orange-400 truncate text-left flex items-center gap-1.5",
                                        category === 'critical' ? 'text-red-300 font-medium' :
                                        category === 'behind' ? 'text-rose-300' :
                                        category === 'whats-next' ? 'text-amber-200' :
                                        'text-gray-200'
                                      )}
                                    >
                                      {task.name}
                                      {/* Category indicator */}
                                      {category !== 'on-track' && (
                                        <span className={cn(
                                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                          category === 'critical' && 'bg-red-500 animate-pulse',
                                          category === 'behind' && 'bg-rose-500',
                                          category === 'whats-next' && 'bg-amber-400',
                                          category === 'at-risk' && 'bg-orange-400',
                                          category === 'completed' && 'bg-green-500'
                                        )} />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="bg-[#1F2328] border-gray-700 max-w-xs">
                                    <p className="font-medium">{task.name}</p>
                                    {/* Category badge */}
                                    <div className={cn(
                                      "text-[10px] px-1.5 py-0.5 rounded mt-1 inline-flex items-center gap-1",
                                      catStyles.bg
                                    )}>
                                      {catStyles.icon}
                                      <span className="text-white">{catStyles.label}</span>
                                    </div>
                                    {formatAssignee(task) && (
                                      <p className="text-xs text-orange-400 font-medium mt-1">{formatAssignee(task)}</p>
                                    )}
                                    {scheduleVariance !== null && scheduleVariance !== 0 && (
                                      <p className={cn("text-xs mt-1", scheduleVariance > 0 ? "text-red-400" : "text-green-400")}>
                                        {scheduleVariance > 0 ? `+${scheduleVariance}d late` : `${Math.abs(scheduleVariance)}d early`}
                                      </p>
                                    )}
                                    {task.totalFloat !== undefined && task.totalFloat !== null && (
                                      <p className={cn("text-xs mt-0.5", getFloatColor(task.totalFloat))}>
                                        Float: {task.totalFloat}d
                                      </p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}
                          </div>
                          {/* Duration */}
                          <div className="px-2 py-3 border-r border-gray-700 flex items-center justify-center">
                            <span className="text-xs text-gray-300">{task.duration}d</span>
                          </div>
                          {/* Float with color coding */}
                          <div className="px-2 py-3 border-r border-gray-700 flex items-center justify-center">
                            <span className={cn(
                              "text-xs font-medium px-1.5 py-0.5 rounded",
                              getFloatBg(task.totalFloat),
                              getFloatColor(task.totalFloat)
                            )}>
                              {task.totalFloat !== undefined && task.totalFloat !== null ? `${task.totalFloat}d` : '-'}
                            </span>
                          </div>
                        </>
                      ) : (
                        /* Standard Task Info Column */
                        <div className="px-4 py-3 border-r border-gray-700 flex items-center gap-2">
                          {hasRelations && (
                            <button
                              onClick={() => toggleTask(task.id)}
                              className="text-gray-400 hover:text-gray-200"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onTaskClick?.(task)}
                                className="text-sm font-medium text-gray-200 hover:text-orange-400 truncate text-left"
                              >
                                {task.taskId}: {task.name}
                              </button>
                              {task.isCritical && (
                                <Badge variant="destructive" className="text-xs">
                                  Critical
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400">{task.duration}d</span>
                              {task.totalFloat !== undefined && task.totalFloat !== null && (
                                <span className={cn("text-xs", getFloatColor(task.totalFloat))}>
                                  Float: {task.totalFloat}d
                                </span>
                              )}
                              {formatAssignee(task) && (
                                <span className="text-xs text-orange-400">
                                  • {formatAssignee(task)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Timeline Bar Section */}
                      <div 
                        ref={task.id === draggedTask?.id ? timelineRef : undefined}
                        className="relative py-3 px-2"
                        onMouseMove={handleDragMove}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                      >
                        <div className="relative h-10">
                          {/* Baseline Bar (gray, behind) */}
                          {showBaseline && (task.baselineStartDate || task.baselineEndDate) && (
                            <div
                              className="absolute h-2 top-0 rounded bg-gray-600/50 opacity-60"
                              style={baselinePosition}
                            >
                              <span className="sr-only">Baseline</span>
                            </div>
                          )}

                          {/* Current Plan Bar (colored by category) */}
                          {(() => {
                            const category = getTaskCategory(task);
                            const styles = categoryStyles[category];
                            const isEditingProgress = progressEditingTaskId === task.taskId;
                            const isModifiedInWhatIf = isWhatIfMode && whatIfChanges.some(c => c.taskId === task.taskId);
                            return (
                              <div
                                className={cn(
                                  'absolute h-6 top-2 rounded flex items-center px-2 cursor-move transition-all group shadow-md',
                                  styles.bg,
                                  // Use purple styling for what-if modified tasks
                                  isModifiedInWhatIf 
                                    ? 'ring-2 ring-purple-400 ring-offset-1 ring-offset-[#2d333b] shadow-lg shadow-purple-500/30'
                                    : styles.border,
                                  !isModifiedInWhatIf && category === 'critical' && 'shadow-lg shadow-red-500/30',
                                  !isModifiedInWhatIf && category === 'whats-next' && 'shadow-lg shadow-amber-500/20',
                                  !isModifiedInWhatIf && category === 'behind' && 'shadow-lg shadow-rose-500/20',
                                  draggedTask?.id === task.id && 'opacity-70 scale-105'
                                )}
                                style={{
                                  ...barPosition,
                                  ...(draggedTask?.id === task.id && { transform: `translateX(${dragOffset}px)` })
                                }}
                                onMouseDown={(e) => handleDragStart(task, e)}
                                onClick={() => onTaskClick?.(task)}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleTaskEdit(task.taskId);
                                }}
                              >
                                {/* Progress fill inside bar (interactive) */}
                                {isEditingProgress ? (
                                  <div 
                                    className="absolute inset-0 flex items-center px-2 bg-black/70 rounded z-20"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="range"
                                      min={0}
                                      max={100}
                                      step={5}
                                      value={task.percentComplete}
                                      onChange={(e) => handleProgressUpdate(task.taskId, parseInt(e.target.value))}
                                      className="w-full h-2 accent-orange-500 cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="ml-2 text-[10px] font-bold text-white min-w-[3ch]">
                                      {task.percentComplete}%
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProgressEditingTaskId(null);
                                      }}
                                      className="ml-1 text-gray-400 hover:text-white"
                                    >
                                      ✓
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div 
                                      className="absolute inset-y-0 left-0 bg-white/25 rounded-l"
                                      style={{ width: `${task.percentComplete}%` }}
                                    />
                                    <GripVertical className="h-3 w-3 text-white/50 absolute left-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="flex items-center gap-1 w-full pl-3 relative z-10">
                                      {/* Category icon */}
                                      {styles.icon}
                                      {/* Clickable progress percentage */}
                                      <button
                                        className="text-[10px] font-medium text-white truncate hover:bg-white/20 px-1 rounded transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setProgressEditingTaskId(task.taskId);
                                        }}
                                        title="Click to adjust progress"
                                      >
                                        {task.percentComplete}%
                                      </button>
                                    </div>
                                  </>
                                )}
                                {/* What-If modified indicator */}
                                {!isEditingProgress && isModifiedInWhatIf && (
                                  <div className="absolute -top-1 -right-1 flex items-center gap-0.5">
                                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                                    <Beaker className="h-3 w-3 text-purple-300" />
                                  </div>
                                )}
                                {/* Category indicator pulse (only if not modified in what-if) */}
                                {!isEditingProgress && !isModifiedInWhatIf && (category === 'critical' || category === 'behind') && (
                                  <div className={cn(
                                    "absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse",
                                    category === 'critical' ? 'bg-red-400' : 'bg-rose-400'
                                  )} />
                                )}
                                {!isEditingProgress && !isModifiedInWhatIf && category === 'whats-next' && (
                                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
                                )}
                              </div>
                            );
                          })()}

                          {/* Actual Bar (from daily reports, front layer) */}
                          {actualPosition && (
                            <div
                              className="absolute h-2 bottom-0 rounded bg-emerald-500 border border-emerald-300"
                              style={actualPosition}
                            >
                              <span className="sr-only">Actual Progress</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-[#1F2328]/30 border-t border-gray-700">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {task.predecessors.length > 0 && (
                            <div>
                              <span className="text-gray-400">Depends on:</span>
                              <div className="mt-1 text-gray-300">
                                {task.predecessors.join(', ')}
                              </div>
                            </div>
                          )}
                          {task.successors.length > 0 && (
                            <div>
                              <span className="text-gray-400">Blocks:</span>
                              <div className="mt-1 text-gray-300">
                                {task.successors.join(', ')}
                              </div>
                            </div>
                          )}
                          {task.location && (
                            <div>
                              <span className="text-gray-400">Location:</span>
                              <div className="mt-1 text-gray-300">{task.location}</div>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-400">Progress:</span>
                            <Progress value={task.percentComplete} className="mt-2" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Inline Task Editor (shown on double-click) */}
                    {editingTaskId === task.taskId && (
                      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditingTaskId(null)}>
                        <div onClick={(e) => e.stopPropagation()}>
                          <InlineTaskEditor
                            task={task}
                            onSave={handleTaskSave}
                            onCancel={() => setEditingTaskId(null)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Dependency Lines Layer (SVG overlay) */}
            {showDependencyLines && filteredTasks.length > 0 && (
              <DependencyLines
                tasks={filteredTasks}
                taskPositions={calculatedTaskPositions}
                containerWidth={1200} // min-width of container
                containerOffset={showP6Columns ? 440 : 300}
                showCriticalPath={showCriticalPath}
                dependencyType={dependencyType}
              />
            )}

            {/* Milestones Layer (rendered on top of tasks) */}
            {milestones.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="grid grid-cols-[300px_1fr]">
                  <div />
                  <div className="relative h-full">
                    {milestones.map((milestone) => {
                      const milestoneDate = new Date(milestone.date);
                      const chartStart = new Date(startDate);
                      const chartEnd = new Date(endDate);
                      const totalWidth = differenceInDays(chartEnd, chartStart);
                      const daysFromStart = differenceInDays(milestoneDate, chartStart);
                      const position = (daysFromStart / totalWidth) * 100;

                      if (position < 0 || position > 100) return null;

                      return (
                        <div
                          key={milestone.id}
                          className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-auto"
                          style={{ left: `${position}%` }}
                        >
                          {/* Milestone Diamond */}
                          <div className="relative group cursor-pointer">
                            <Flag 
                              className={cn(
                                "h-5 w-5 mt-2",
                                milestone.importance === 'CRITICAL' ? 'text-red-500' :
                                milestone.importance === 'IMPORTANT' ? 'text-orange-500' :
                                'text-blue-500'
                              )}
                              fill="currentColor"
                            />
                            
                            {/* Tooltip */}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 bg-[#1F2328] rounded-lg shadow-xl border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                              <div className="text-sm font-semibold text-gray-100">{milestone.name}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {format(milestoneDate, 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">{milestone.type}</div>
                            </div>
                          </div>
                          
                          {/* Vertical Line */}
                          <div 
                            className={cn(
                              "w-0.5 flex-1",
                              milestone.importance === 'CRITICAL' ? 'bg-red-500/30' :
                              milestone.importance === 'IMPORTANT' ? 'bg-orange-500/30' :
                              'bg-blue-500/30'
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Enhanced Legend with Task Categories */}
      <div className="flex flex-wrap items-center gap-3 text-sm bg-[#2d333b]/50 p-3 rounded-lg border border-gray-700">
        <span className="text-gray-400 text-xs font-medium mr-1">Task Status:</span>
        
        {/* Critical Path */}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-600 ring-2 ring-red-400/50 flex items-center justify-center">
            <Zap className="h-2.5 w-2.5 text-white" />
          </div>
          <span className="text-gray-300 text-xs">Critical Path</span>
        </div>
        
        {/* What's Next */}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-500 ring-2 ring-amber-400/50 flex items-center justify-center">
            <PlayCircle className="h-2.5 w-2.5 text-white" />
          </div>
          <span className="text-gray-300 text-xs">What&apos;s Next (7d)</span>
        </div>
        
        {/* At Risk */}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-orange-500 flex items-center justify-center">
            <Timer className="h-2.5 w-2.5 text-white" />
          </div>
          <span className="text-gray-300 text-xs">At Risk (Low Float)</span>
        </div>
        
        {/* Behind Schedule */}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-rose-600 ring-2 ring-rose-400/50 flex items-center justify-center">
            <TrendingDown className="h-2.5 w-2.5 text-white" />
          </div>
          <span className="text-gray-300 text-xs">Behind Schedule</span>
        </div>
        
        {/* On Track */}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-500" />
          <span className="text-gray-300 text-xs">On Track</span>
        </div>
        
        {/* Completed */}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center">
            <CheckCircle2 className="h-2.5 w-2.5 text-white" />
          </div>
          <span className="text-gray-300 text-xs">Completed</span>
        </div>

        {/* Dependency Lines Legend */}
        {showDependencyLines && (
          <div className="flex items-center gap-3 border-l border-gray-600 pl-3 ml-1">
            <span className="text-gray-400 text-xs font-medium">Dependencies:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-gray-500" style={{ borderBottom: '2px dashed #6B7280' }} />
              <span className="text-gray-400 text-xs">Normal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-red-500" />
              <span className="text-red-400 text-xs">Critical</span>
            </div>
          </div>
        )}

        {/* Float Legend */}
        <div className="flex items-center gap-2 border-l border-gray-600 pl-3 ml-1">
          <span className="text-gray-400 text-xs font-medium">Float:</span>
          <span className="text-xs text-red-500 bg-red-500/20 px-1.5 py-0.5 rounded">0d</span>
          <span className="text-xs text-amber-500 bg-amber-500/20 px-1.5 py-0.5 rounded">1-5d</span>
          <span className="text-xs text-green-500 bg-green-500/20 px-1.5 py-0.5 rounded">&gt;5d</span>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
