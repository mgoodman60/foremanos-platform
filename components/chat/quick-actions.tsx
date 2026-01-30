"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Zap,
  FileText,
  ClipboardList,
  Calendar,
  AlertTriangle,
  MessageSquarePlus,
  CheckCircle2,
  Send,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  action: 'create-rfi' | 'add-daily-report' | 'create-task' | 'flag-issue' | 'send-notification';
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'create-rfi',
    label: 'Create RFI',
    icon: <FileText className="h-4 w-4" />,
    description: 'Generate an RFI from this conversation',
    color: 'text-blue-400 hover:bg-blue-500/20',
    action: 'create-rfi'
  },
  {
    id: 'add-daily-report',
    label: 'Add to Daily Report',
    icon: <ClipboardList className="h-4 w-4" />,
    description: 'Include this in today\'s daily report',
    color: 'text-green-400 hover:bg-green-500/20',
    action: 'add-daily-report'
  },
  {
    id: 'create-task',
    label: 'Create Task',
    icon: <Calendar className="h-4 w-4" />,
    description: 'Add a new task to the schedule',
    color: 'text-purple-400 hover:bg-purple-500/20',
    action: 'create-task'
  },
  {
    id: 'flag-issue',
    label: 'Flag Issue',
    icon: <AlertTriangle className="h-4 w-4" />,
    description: 'Flag this as a potential issue',
    color: 'text-orange-400 hover:bg-orange-500/20',
    action: 'flag-issue'
  },
  {
    id: 'send-notification',
    label: 'Notify Team',
    icon: <Send className="h-4 w-4" />,
    description: 'Send notification to team members',
    color: 'text-cyan-400 hover:bg-cyan-500/20',
    action: 'send-notification'
  }
];

interface QuickActionsProps {
  messageContent?: string;
  projectSlug: string;
  conversationId?: string;
  onActionComplete?: (action: string, result: any) => void;
}

export function QuickActions({
  messageContent,
  projectSlug,
  conversationId,
  onActionComplete
}: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: messageContent || '',
    priority: 'normal',
    assignee: '',
    dueDate: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleActionClick = (action: QuickAction) => {
    setActiveAction(action);
    setFormData(prev => ({
      ...prev,
      description: messageContent || ''
    }));
    setIsOpen(false);
  };

  const handleSubmit = async () => {
    if (!activeAction) return;
    
    setIsSubmitting(true);
    try {
      const endpoint = getActionEndpoint(activeAction.action);
      const payload = buildPayload(activeAction.action, formData);
      
      const response = await fetch(`/api/projects/${projectSlug}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          sourceConversationId: conversationId
        })
      });

      if (!response.ok) throw new Error('Action failed');
      
      const result = await response.json();
      toast.success(`${activeAction.label} created successfully`);
      onActionComplete?.(activeAction.action, result);
      setActiveAction(null);
      resetForm();
    } catch (error) {
      console.error('Quick action error:', error);
      toast.error(`Failed to ${activeAction.label.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: messageContent || '',
      priority: 'normal',
      assignee: '',
      dueDate: ''
    });
  };

  const getActionEndpoint = (action: string): string => {
    switch (action) {
      case 'create-rfi': return '/rfis';
      case 'add-daily-report': return '/daily-reports/items';
      case 'create-task': return '/schedule/tasks';
      case 'flag-issue': return '/issues';
      case 'send-notification': return '/notifications/send';
      default: return '/actions';
    }
  };

  const buildPayload = (action: string, data: typeof formData) => {
    switch (action) {
      case 'create-rfi':
        return {
          subject: data.title,
          question: data.description,
          priority: data.priority,
          assignedTo: data.assignee,
          dueDate: data.dueDate
        };
      case 'add-daily-report':
        return {
          content: data.description,
          category: 'observation'
        };
      case 'create-task':
        return {
          name: data.title,
          description: data.description,
          startDate: data.dueDate,
          endDate: data.dueDate
        };
      case 'flag-issue':
        return {
          title: data.title,
          description: data.description,
          severity: data.priority,
          assignee: data.assignee
        };
      case 'send-notification':
        return {
          message: data.description,
          recipients: data.assignee ? [data.assignee] : ['all']
        };
      default:
        return data;
    }
  };

  const renderActionForm = () => {
    if (!activeAction) return null;

    const commonFields = (
      <>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder={`Enter ${activeAction.label.toLowerCase()} title`}
            className="bg-gray-700 border-gray-600"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Description or details..."
            rows={4}
            className="bg-gray-700 border-gray-600"
          />
        </div>
      </>
    );

    return (
      <div className="space-y-4">
        {commonFields}
        
        {/* Action-specific fields */}
        {(activeAction.action === 'create-rfi' || activeAction.action === 'flag-issue') && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white text-sm"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="bg-gray-700 border-gray-600"
              />
            </div>
          </div>
        )}
        
        {activeAction.action === 'create-task' && (
          <div className="space-y-2">
            <Label htmlFor="dueDate">Target Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              className="bg-gray-700 border-gray-600"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Actions</span>
          </Button>
        </PopoverTrigger>
        
        <PopoverContent
          className="w-64 p-2 bg-dark-card border-gray-700"
          align="end"
        >
          <div className="space-y-1">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors',
                  action.color
                )}
              >
                {action.icon}
                <div>
                  <div className="text-sm font-medium text-gray-200">{action.label}</div>
                  <div className="text-xs text-gray-500">{action.description}</div>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Action Dialog */}
      <Dialog open={!!activeAction} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent className="bg-dark-card border-gray-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeAction?.icon}
              {activeAction?.label}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {activeAction?.description}
            </DialogDescription>
          </DialogHeader>
          
          {renderActionForm()}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setActiveAction(null)}
              className="border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.title}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Create
                </span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Inline quick action buttons for message responses
export function MessageQuickActions({
  content,
  projectSlug,
  className
}: {
  content: string;
  projectSlug: string;
  className?: string;
}) {
  const [processing, setProcessing] = useState<string | null>(null);

  const handleQuickAction = async (action: string) => {
    setProcessing(action);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success(`Added to ${action.replace('-', ' ')}`);
    } catch (error) {
      toast.error('Action failed');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className={cn('flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity', className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-gray-500 hover:text-blue-400"
        onClick={() => handleQuickAction('rfi')}
        disabled={!!processing}
      >
        {processing === 'rfi' ? '...' : 'RFI'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-gray-500 hover:text-green-400"
        onClick={() => handleQuickAction('daily-report')}
        disabled={!!processing}
      >
        {processing === 'daily-report' ? '...' : 'Daily'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-gray-500 hover:text-orange-400"
        onClick={() => handleQuickAction('issue')}
        disabled={!!processing}
      >
        {processing === 'issue' ? '...' : 'Issue'}
      </Button>
    </div>
  );
}
