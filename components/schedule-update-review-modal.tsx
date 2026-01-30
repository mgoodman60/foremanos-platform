"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle, CheckCircle2, TrendingUp, Clock,
  Check, X
} from 'lucide-react';
import { toast } from 'sonner';

interface ScheduleUpdateSuggestion {
  taskId: string;
  taskName: string;
  scheduleId?: string;
  currentStatus: string;
  currentPercentComplete: number;
  suggestedStatus: string;
  suggestedPercentComplete: number;
  confidence: number;
  reasoning: string;
  impactType: 'progress' | 'delay' | 'completion' | 'acceleration';
  severity: 'low' | 'medium' | 'high';
}

interface ScheduleAnalysis {
  hasScheduleImpact: boolean;
  suggestions: ScheduleUpdateSuggestion[];
  summary: string;
}

interface ScheduleUpdateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: ScheduleAnalysis | null;
  projectSlug: string;
}

export default function ScheduleUpdateReviewModal({
  isOpen,
  onClose,
  analysis,
  projectSlug,
}: ScheduleUpdateReviewModalProps) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const toggleSuggestion = (taskId: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedSuggestions(newSelected);
  };

  const selectAll = () => {
    if (analysis) {
      setSelectedSuggestions(new Set(analysis.suggestions.map(s => s.taskId)));
    }
  };

  const deselectAll = () => {
    setSelectedSuggestions(new Set());
  };

  const applyUpdates = async () => {
    if (!analysis || selectedSuggestions.size === 0) {
      toast.error('No suggestions selected');
      return;
    }

    setApplying(true);
    const toastId = toast.loading('Applying schedule updates...');
    
    try {
      const applicableSuggestions = analysis.suggestions.filter(s => 
        selectedSuggestions.has(s.taskId)
      );

      // Call batch update API
      const response = await fetch(`/api/projects/${projectSlug}/schedule/batch-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          updates: applicableSuggestions.map(s => ({
            taskId: s.taskId,
            scheduleId: s.scheduleId || '', // Will be filled from schedule context
            newStatus: s.suggestedStatus,
            newPercentComplete: s.suggestedPercentComplete,
            reasoning: s.reasoning,
            confidence: s.confidence,
            impactType: s.impactType,
            severity: s.severity,
          })),
          source: 'daily_report',
          sourceId: undefined, // Can be passed if available
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to apply updates');
      }

      const result = await response.json();
      
      toast.success(
        `Successfully applied ${result.applied} update(s)${result.failed > 0 ? `. ${result.failed} failed.` : ''}`,
        { id: toastId }
      );

      // Trigger schedule updated event for UI refresh
      window.dispatchEvent(new CustomEvent('scheduleUpdated', {
        detail: { projectSlug, updateCount: result.applied, source: 'manual' }
      }));
      
      onClose();
    } catch (error) {
      console.error('Error applying schedule updates:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to apply schedule updates',
        { id: toastId }
      );
    } finally {
      setApplying(false);
    }
  };

  const getImpactIcon = (impactType: string) => {
    switch (impactType) {
      case 'completion':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'delay':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'acceleration':
        return <TrendingUp className="w-5 h-5 text-blue-400" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge className="bg-red-500">High Impact</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium Impact</Badge>;
      default:
        return <Badge variant="outline">Low Impact</Badge>;
    }
  };

  if (!analysis || !analysis.hasScheduleImpact) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-card border-gray-700 text-[#F8FAFC] max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC] text-xl">
            AI-Detected Schedule Impacts
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {analysis.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Bulk Actions */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <p className="text-sm text-gray-400">
              {selectedSuggestions.size} of {analysis.suggestions.length} suggestion(s) selected
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={selectAll}
                className="border-gray-700"
              >
                Select All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={deselectAll}
                className="border-gray-700"
              >
                Deselect All
              </Button>
            </div>
          </div>

          {/* Suggestions List */}
          {analysis.suggestions.map((suggestion) => (
            <Card
              key={suggestion.taskId}
              className={`bg-dark-surface border-2 transition-colors cursor-pointer ${
                selectedSuggestions.has(suggestion.taskId)
                  ? 'border-blue-500'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => toggleSuggestion(suggestion.taskId)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedSuggestions.has(suggestion.taskId)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-600'
                      }`}
                    >
                      {selectedSuggestions.has(suggestion.taskId) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {getImpactIcon(suggestion.impactType)}
                        <div>
                          <h4 className="font-semibold text-[#F8FAFC]">
                            {suggestion.taskName}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Task ID: {suggestion.taskId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(suggestion.severity)}
                        <Badge variant="outline" className="text-xs">
                          {suggestion.confidence}% confident
                        </Badge>
                      </div>
                    </div>

                    {/* Changes */}
                    <div className="grid grid-cols-2 gap-4 p-3 bg-dark-card rounded-lg">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Current Status</p>
                        <p className="text-sm text-gray-300">
                          {suggestion.currentStatus} at {suggestion.currentPercentComplete}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Suggested Update</p>
                        <p className="text-sm text-green-400 font-medium">
                          {suggestion.suggestedStatus} at {suggestion.suggestedPercentComplete}%
                        </p>
                      </div>
                    </div>

                    {/* Reasoning */}
                    <div className="p-3 bg-dark-card rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">AI Reasoning</p>
                      <p className="text-sm text-gray-300">{suggestion.reasoning}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <p className="font-medium mb-1">Review before applying</p>
              <p className="text-yellow-300/80">
                These are AI-generated suggestions. Review each suggestion carefully before
                applying updates to your project schedule.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={applying}
            className="border-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={applyUpdates}
            disabled={applying || selectedSuggestions.size === 0}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            {applying ? 'Applying...' : `Apply ${selectedSuggestions.size} Update(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
