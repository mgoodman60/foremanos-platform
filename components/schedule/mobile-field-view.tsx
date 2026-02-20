"use client";

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Play,
  Pause,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  MapPin,
  MoreVertical,
  Flag,
  Wrench,
  Zap
} from 'lucide-react';
import { format, isToday, isPast, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface FieldTask {
  id: string;
  taskId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  percentComplete: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'blocked';
  isCritical: boolean;
  assignedTo?: string;
  location?: string;
  subcontractor?: {
    id: string;
    companyName: string;
    tradeType: string;
  };
  actualStartDate?: string | null;
  actualEndDate?: string | null;
}

interface MobileFieldViewProps {
  projectSlug: string;
  scheduleId?: string;
  tasks: FieldTask[];
  onTaskUpdate: (taskId: string, updates: Partial<FieldTask>) => Promise<void>;
  onRefresh: () => void;
}

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', icon: Circle, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  in_progress: { label: 'In Progress', icon: Play, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  completed: { label: 'Complete', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/20' },
  delayed: { label: 'Delayed', icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  blocked: { label: 'Blocked', icon: Pause, color: 'text-red-400', bg: 'bg-red-500/20' }
};

const QUICK_PROGRESS = [0, 25, 50, 75, 100];

export function MobileFieldView({
  projectSlug: _projectSlug,
  scheduleId: _scheduleId,
  tasks,
  onTaskUpdate,
  onRefresh
}: MobileFieldViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('today');
  const [selectedTask, setSelectedTask] = useState<FieldTask | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [updateNotes, setUpdateNotes] = useState('');
  const [newProgress, setNewProgress] = useState(0);
  const [newStatus, setNewStatus] = useState<string>('');

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        task.name.toLowerCase().includes(query) ||
        task.taskId.toLowerCase().includes(query) ||
        task.location?.toLowerCase().includes(query) ||
        task.subcontractor?.companyName.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    
    // Period filter
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);
    const today = new Date();
    
    switch (filterPeriod) {
      case 'today':
        return isToday(taskStart) || isToday(taskEnd) || (taskStart <= today && taskEnd >= today);
      case 'week':
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return taskStart <= weekFromNow && taskEnd >= today;
      case 'overdue':
        return isPast(taskEnd) && task.status !== 'completed';
      case 'critical':
        return task.isCritical;
      default:
        return true;
    }
  });

  // Sort by priority: critical first, then by end date
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });

  const handleQuickStatusChange = async (task: FieldTask, newStatus: string) => {
    setUpdating(task.id);
    try {
      await onTaskUpdate(task.id, { 
        status: newStatus as FieldTask['status'],
        actualStartDate: newStatus === 'in_progress' && !task.actualStartDate ? new Date().toISOString() : task.actualStartDate,
        actualEndDate: newStatus === 'completed' ? new Date().toISOString() : null,
        percentComplete: newStatus === 'completed' ? 100 : task.percentComplete
      });
      toast.success(`Task marked as ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}`);
    } catch (err) {
      toast.error('Failed to update task');
    } finally {
      setUpdating(null);
    }
  };

  const handleQuickProgress = async (task: FieldTask, progress: number) => {
    setUpdating(task.id);
    try {
      const updates: Partial<FieldTask> = { percentComplete: progress };
      
      // Auto-update status based on progress
      if (progress === 100 && task.status !== 'completed') {
        updates.status = 'completed';
        updates.actualEndDate = new Date().toISOString();
      } else if (progress > 0 && task.status === 'not_started') {
        updates.status = 'in_progress';
        updates.actualStartDate = new Date().toISOString();
      }
      
      await onTaskUpdate(task.id, updates);
      toast.success(`Progress updated to ${progress}%`);
    } catch (err) {
      toast.error('Failed to update progress');
    } finally {
      setUpdating(null);
    }
  };

  const openUpdateModal = (task: FieldTask) => {
    setSelectedTask(task);
    setNewProgress(task.percentComplete);
    setNewStatus(task.status);
    setUpdateNotes('');
    setShowUpdateModal(true);
  };

  const handleDetailedUpdate = async () => {
    if (!selectedTask) return;
    
    setUpdating(selectedTask.id);
    try {
      const updates: Partial<FieldTask> = {
        percentComplete: newProgress,
        status: newStatus as FieldTask['status']
      };
      
      if (newStatus === 'in_progress' && !selectedTask.actualStartDate) {
        updates.actualStartDate = new Date().toISOString();
      }
      if (newStatus === 'completed') {
        updates.actualEndDate = new Date().toISOString();
        updates.percentComplete = 100;
      }
      
      await onTaskUpdate(selectedTask.id, updates);
      toast.success('Task updated successfully');
      setShowUpdateModal(false);
    } catch (err) {
      toast.error('Failed to update task');
    } finally {
      setUpdating(null);
    }
  };

  const getTaskUrgency = (task: FieldTask) => {
    if (task.status === 'completed') return 'complete';
    const endDate = new Date(task.endDate);
    const today = new Date();
    const daysLeft = differenceInDays(endDate, today);
    
    if (daysLeft < 0) return 'overdue';
    if (daysLeft === 0) return 'due-today';
    if (daysLeft <= 2) return 'due-soon';
    return 'normal';
  };

  return (
    <div className="space-y-4">
      {/* Header with Search and Filters */}
      <div className="sticky top-0 z-10 bg-dark-surface pb-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tasks, locations, subs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-dark-card border-gray-700 h-12 text-base"
          />
        </div>
        
        {/* Quick Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {['today', 'week', 'overdue', 'critical', 'all'].map(period => (
            <Button
              key={period}
              variant={filterPeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterPeriod(period)}
              className={cn(
                'whitespace-nowrap flex-shrink-0',
                filterPeriod === period 
                  ? 'bg-orange-500 text-white hover:bg-orange-600' 
                  : 'bg-dark-card border-gray-700'
              )}
            >
              {period === 'today' && <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />}
              {period === 'critical' && <Flag className="h-3 w-3 mr-1" aria-hidden="true" />}
              {period === 'overdue' && <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />}
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Button>
          ))}
        </div>
        
        {/* Status Filter */}
        <div className="flex items-center justify-between">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px] bg-dark-card border-gray-700 h-10">
              <Filter className="h-4 w-4 mr-2 text-gray-400" aria-hidden="true" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="delayed">Delayed</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Results Count */}
        <p className="text-sm text-gray-400">
          {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}
          {filterPeriod !== 'all' && ` for ${filterPeriod}`}
        </p>
      </div>

      {/* Task Cards */}
      <div className="space-y-3">
        {sortedTasks.length === 0 ? (
          <Card className="bg-dark-card border-gray-700 p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-300">No tasks match your filters</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
          </Card>
        ) : (
          sortedTasks.map(task => {
            const urgency = getTaskUrgency(task);
            const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
            const StatusIcon = statusConfig.icon;
            const isUpdating = updating === task.id;
            
            return (
              <Card
                key={task.id}
                className={cn(
                  'bg-dark-card border-gray-700 p-4 transition-all',
                  task.isCritical && 'border-l-4 border-l-red-500',
                  urgency === 'overdue' && 'border-l-4 border-l-orange-500',
                  urgency === 'due-today' && 'border-l-4 border-l-yellow-500'
                )}
              >
                {/* Task Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {task.isCritical && (
                        <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1">
                          CRITICAL
                        </Badge>
                      )}
                      <span className="text-xs text-gray-400">{task.taskId}</span>
                    </div>
                    <h3 className="font-medium text-gray-200 text-base leading-tight">{task.name}</h3>
                    
                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
                      {task.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {task.location}
                        </span>
                      )}
                      {task.subcontractor && (
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" aria-hidden="true" />
                          {task.subcontractor.companyName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        {format(new Date(task.endDate), 'M/d')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <Badge 
                    variant="outline" 
                    className={cn('flex-shrink-0', statusConfig.bg, statusConfig.color, 'border-0')}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                    {statusConfig.label}
                  </Badge>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-gray-300 font-medium">{task.percentComplete}%</span>
                  </div>
                  <Progress value={task.percentComplete} className="h-2" />
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                  {/* Quick Progress Buttons */}
                  <div className="flex gap-1">
                    {QUICK_PROGRESS.map(progress => (
                      <Button
                        key={progress}
                        variant={task.percentComplete === progress ? 'default' : 'outline'}
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => handleQuickProgress(task, progress)}
                        className={cn(
                          'flex-1 text-xs h-9',
                          task.percentComplete === progress 
                            ? 'bg-orange-500 hover:bg-orange-600' 
                            : 'bg-dark-surface border-gray-600 hover:bg-dark-card'
                        )}
                      >
                        {progress}%
                      </Button>
                    ))}
                  </div>
                  
                  {/* Quick Status Buttons */}
                  <div className="flex gap-2">
                    {task.status !== 'in_progress' && task.status !== 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => handleQuickStatusChange(task, 'in_progress')}
                        className="flex-1 bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 h-10"
                      >
                        <Play className="h-4 w-4 mr-1" aria-hidden="true" />
                        Start
                      </Button>
                    )}
                    {task.status !== 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => handleQuickStatusChange(task, 'completed')}
                        className="flex-1 bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 h-10"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" aria-hidden="true" />
                        Complete
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isUpdating}
                      onClick={() => openUpdateModal(task)}
                      className="bg-dark-surface border-gray-600 hover:bg-dark-card h-10"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Urgency Warning */}
                {urgency === 'overdue' && (
                  <div className="mt-3 p-2 bg-orange-500/10 border border-orange-500/30 rounded text-xs text-orange-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span>Overdue by {Math.abs(differenceInDays(new Date(task.endDate), new Date()))} day(s)</span>
                  </div>
                )}
                {urgency === 'due-today' && task.status !== 'completed' && (
                  <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400 flex items-center gap-2">
                    <Zap className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span>Due today!</span>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Detailed Update Modal */}
      <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
        <DialogContent className="bg-dark-card border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-200">Update Task</DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4 py-2">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-1">{selectedTask.name}</p>
                <p className="text-xs text-gray-400">{selectedTask.taskId}</p>
              </div>
              
              {/* Status Select */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="bg-dark-surface border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Progress Slider */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Progress: {newProgress}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={newProgress}
                  onChange={(e) => setNewProgress(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
              
              {/* Notes */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Notes (optional)</label>
                <Textarea
                  placeholder="Add notes about this update..."
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  className="bg-dark-surface border-gray-600 min-h-[80px]"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateModal(false)} className="border-gray-600">
              Cancel
            </Button>
            <Button 
              onClick={handleDetailedUpdate} 
              disabled={updating === selectedTask?.id}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {updating === selectedTask?.id ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> Saving...</>
              ) : (
                'Save Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
