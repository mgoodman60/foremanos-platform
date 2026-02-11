"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  HardHat,
  Building2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface TaskNeedingClarification {
  id: string;
  taskId: string;
  name: string;
  inferredTradeType: string | null;
  tradeInferenceConfidence: number | null;
  tradeClarificationNote: string | null;
}

interface TradeType {
  value: string;
  label: string;
}

interface Subcontractor {
  id: string;
  companyName: string;
  tradeType: string;
}

interface TradeClarificationPanelProps {
  projectSlug: string;
  onUpdate?: () => void;
}

export default function TradeClarificationPanel({
  projectSlug,
  onUpdate,
}: TradeClarificationPanelProps) {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [tasks, setTasks] = useState<TaskNeedingClarification[]>([]);
  const [tradeTypes, setTradeTypes] = useState<TradeType[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskNeedingClarification | null>(null);
  const [selectedTrade, setSelectedTrade] = useState('');
  const [selectedSub, setSelectedSub] = useState('');

  useEffect(() => {
    fetchData();
  }, [projectSlug]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/trade-inference`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      setTasks(data.tasksNeedingClarification || []);
      setTradeTypes(data.tradeTypes || []);
      setSubcontractors(data.subcontractors || []);
    } catch (error) {
      console.error('Error fetching trade data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runInference = async () => {
    setRunning(true);
    const toastId = toast.loading('Running trade inference...');
    
    try {
      const response = await fetch(`/api/projects/${projectSlug}/trade-inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_all' }),
      });

      if (!response.ok) throw new Error('Inference failed');
      
      const result = await response.json();
      toast.success(
        `Trade inference complete: ${result.updated} tasks updated${result.needsClarification > 0 ? `, ${result.needsClarification} need review` : ''}`,
        { id: toastId }
      );
      
      fetchData();
      onUpdate?.();
    } catch (error) {
      toast.error('Failed to run trade inference', { id: toastId });
    } finally {
      setRunning(false);
    }
  };

  const saveTradeAssignment = async () => {
    if (!editingTask || !selectedTrade) {
      toast.error('Please select a trade');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectSlug}/trade-inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_trade',
          taskId: editingTask.id,
          tradeType: selectedTrade,
          subcontractorId: selectedSub || undefined,
        }),
      });

      if (!response.ok) throw new Error('Update failed');
      
      toast.success('Trade assignment updated');
      setEditingTask(null);
      setSelectedTrade('');
      setSelectedSub('');
      fetchData();
      onUpdate?.();
    } catch (error) {
      toast.error('Failed to update trade assignment');
    }
  };

  const openEditDialog = (task: TaskNeedingClarification) => {
    setEditingTask(task);
    setSelectedTrade(task.inferredTradeType || '');
    setSelectedSub('');
  };

  // Filter subcontractors based on selected trade
  const filteredSubs = selectedTrade
    ? subcontractors.filter(s => s.tradeType === selectedTrade)
    : subcontractors;

  if (loading) {
    return null;
  }

  // Don't show panel if no tasks need clarification
  if (tasks.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="bg-yellow-900/20 border-yellow-600/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <h4 className="font-medium text-yellow-100">
                {tasks.length} Task{tasks.length !== 1 ? 's' : ''} Need Trade Assignment Review
              </h4>
              <p className="text-sm text-yellow-300/80">
                The AI was unable to confidently determine the responsible trade for these tasks.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runInference}
              disabled={running}
              className="border-yellow-600 text-yellow-100 hover:bg-yellow-900/50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
              Re-run Inference
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-yellow-100 hover:bg-yellow-900/50"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between bg-dark-surface rounded-lg p-3 border border-yellow-600/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{task.name}</div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>Task ID: {task.taskId}</span>
                    {task.inferredTradeType && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <HardHat className="h-3 w-3" />
                          {task.inferredTradeType.replace(/_/g, ' ')}
                          {task.tradeInferenceConfidence && (
                            <span className="text-yellow-500">({task.tradeInferenceConfidence}%)</span>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                  {task.tradeClarificationNote && (
                    <div className="text-xs text-gray-400 mt-1 italic">
                      Note: {task.tradeClarificationNote}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => openEditDialog(task)}
                  className="bg-orange-500 hover:bg-orange-600 text-white ml-3"
                >
                  Assign Trade
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="bg-dark-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-orange-500" />
              Assign Trade to Task
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Select the trade responsible for: {editingTask?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Trade Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Trade Type</label>
              <Select value={selectedTrade} onValueChange={(val) => {
                setSelectedTrade(val);
                setSelectedSub(''); // Reset sub when trade changes
              }}>
                <SelectTrigger className="bg-dark-surface border-gray-600 text-white">
                  <SelectValue placeholder="Select a trade" />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-600">
                  {tradeTypes.map((trade) => (
                    <SelectItem key={trade.value} value={trade.value} className="text-white hover:bg-dark-surface">
                      {trade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcontractor Selection (Optional) */}
            {filteredSubs.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Subcontractor (Optional)
                </label>
                <Select value={selectedSub} onValueChange={setSelectedSub}>
                  <SelectTrigger className="bg-dark-surface border-gray-600 text-white">
                    <SelectValue placeholder="Select a subcontractor" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-card border-gray-600">
                    <SelectItem value="" className="text-gray-400 hover:bg-dark-surface">
                      No specific subcontractor
                    </SelectItem>
                    {filteredSubs.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id} className="text-white hover:bg-dark-surface">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3 w-3" />
                          {sub.companyName}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Info about current inference */}
            {editingTask?.inferredTradeType && (
              <div className="bg-dark-surface rounded-lg p-3 text-sm">
                <div className="text-gray-400 mb-1">AI Suggested:</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-500 text-blue-400">
                    {editingTask.inferredTradeType.replace(/_/g, ' ')}
                  </Badge>
                  {editingTask.tradeInferenceConfidence && (
                    <span className="text-gray-400">
                      {editingTask.tradeInferenceConfidence}% confidence
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingTask(null)}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={saveTradeAssignment}
              disabled={!selectedTrade}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
