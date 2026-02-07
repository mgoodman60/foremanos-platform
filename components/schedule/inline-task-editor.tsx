"use client";

import React, { useState, useRef, useEffect } from 'react';
import { format, parse, addDays, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Calendar, X, Check, Pencil, Clock, Percent, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Task {
  id: string;
  taskId: string;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  duration: number;
  percentComplete: number;
  status: string;
}

interface InlineTaskEditorProps {
  task: Task;
  onSave: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onCancel: () => void;
}

export function InlineTaskEditor({ task, onSave, onCancel }: InlineTaskEditorProps) {
  const [name, setName] = useState(task.name);
  const [startDate, setStartDate] = useState(format(new Date(task.startDate), 'yyyy-MM-dd'));
  const [duration, setDuration] = useState(task.duration);
  const [percentComplete, setPercentComplete] = useState(task.percentComplete);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const calculatedEndDate = addDays(parse(startDate, 'yyyy-MM-dd', new Date()), duration - 1);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Task name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      await onSave(task.taskId, {
        name: name.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: calculatedEndDate.toISOString(),
        duration,
        percentComplete,
        status: percentComplete >= 100 ? 'completed' : percentComplete > 0 ? 'in_progress' : task.status
      });
      toast.success('Task updated');
    } catch (error) {
      toast.error('Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="bg-dark-surface border border-gray-600 rounded-lg p-4 shadow-xl space-y-4 min-w-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 pb-3">
        <span className="text-sm font-medium text-gray-200 flex items-center gap-2">
          <Pencil className="h-4 w-4 text-orange-400" />
          Edit Task
        </span>
        <span className="text-xs text-gray-500 font-mono">{task.taskId}</span>
      </div>

      {/* Task Name */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Task Name</label>
        <Input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-dark-card border-gray-600 text-sm"
          placeholder="Enter task name"
        />
      </div>

      {/* Dates Row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Start Date
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-dark-card border-gray-600 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Duration (days)
          </label>
          <Input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
            onKeyDown={handleKeyDown}
            className="bg-dark-card border-gray-600 text-sm"
          />
        </div>
      </div>

      {/* End Date Display */}
      <div className="text-xs text-gray-400 flex items-center justify-between bg-dark-card/50 px-2 py-1.5 rounded">
        <span>End Date:</span>
        <span className="text-gray-200 font-medium">{format(calculatedEndDate, 'MMM d, yyyy')}</span>
      </div>

      {/* Progress Slider */}
      <div>
        <label className="text-xs text-gray-400 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Percent className="h-3 w-3" />
            Progress
          </span>
          <span className={cn(
            "font-mono font-medium",
            percentComplete >= 100 ? 'text-green-400' :
            percentComplete >= 50 ? 'text-blue-400' :
            percentComplete > 0 ? 'text-amber-400' : 'text-gray-400'
          )}>
            {percentComplete}%
          </span>
        </label>
        <Slider
          value={[percentComplete]}
          onValueChange={(v) => setPercentComplete(v[0])}
          max={100}
          step={5}
          className="my-2"
        />
        {/* Quick select buttons */}
        <div className="flex gap-1 mt-2">
          {[0, 25, 50, 75, 100].map((val) => (
            <button
              key={val}
              onClick={() => setPercentComplete(val)}
              className={cn(
                "flex-1 text-xs py-1 rounded border transition-colors",
                percentComplete === val
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                  : 'bg-dark-card border-gray-600 text-gray-400 hover:bg-dark-hover'
              )}
            >
              {val}%
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-700">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="flex-1 text-gray-400 hover:text-gray-200"
          disabled={saving}
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          className="flex-1 bg-orange-500 hover:bg-orange-600"
          disabled={saving}
        >
          {saving ? (
            <span className="animate-spin mr-1">⏳</span>
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}

// Quick Progress Slider for inline use on task bars
interface QuickProgressSliderProps {
  taskId: string;
  currentProgress: number;
  onProgressChange: (taskId: string, progress: number) => Promise<void>;
}

export function QuickProgressSlider({ taskId, currentProgress, onProgressChange }: QuickProgressSliderProps) {
  const [progress, setProgress] = useState(currentProgress);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = async (newProgress: number) => {
    setProgress(newProgress);
    setSaving(true);
    try {
      await onProgressChange(taskId, newProgress);
    } catch (error) {
      setProgress(currentProgress); // Revert on error
      toast.error('Failed to update progress');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center bg-black/70 rounded z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3">
        <Slider
          value={[progress]}
          onValueChange={(v) => setProgress(v[0])}
          onValueCommit={(v) => handleChange(v[0])}
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={() => setIsDragging(false)}
          max={100}
          step={5}
          className="w-24"
          disabled={saving}
        />
        <span className={cn(
          "text-xs font-bold min-w-[3ch] text-right",
          saving && 'animate-pulse'
        )}>
          {progress}%
        </span>
      </div>
    </div>
  );
}
