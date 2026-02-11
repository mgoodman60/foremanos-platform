'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  Rocket,
  Upload,
  Zap,
  MessageSquare,
  FileCheck,
  Calendar,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '@/components/layout/project-context';
import { useProjectModals } from '@/hooks/use-project-modals';

interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  completedAt: Date | null;
  icon: React.ComponentType<{ className?: string }>;
  action?: () => void;
  actionLabel?: string;
}

interface OnboardingChecklistProps {
  projectSlug: string;
  onRefresh?: () => void;
  onOpenDocumentLibrary?: () => void;
}

export default function OnboardingChecklist({ projectSlug, onRefresh, onOpenDocumentLibrary }: OnboardingChecklistProps) {
  const { refreshProject, setAiDrawerOpen } = useProject();
  const { setShowDocumentLibrary } = useProjectModals();

  const handleOpenDocumentLibrary = onOpenDocumentLibrary ?? (() => setShowDocumentLibrary(true));
  const handleRefresh = onRefresh ?? (() => refreshProject());
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchOnboardingProgress();
  }, [projectSlug]);

  const fetchOnboardingProgress = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectSlug}/onboarding-progress`);
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      
      if (data.dismissed) {
        setDismissed(true);
        return;
      }

      const stepsData: OnboardingStep[] = [
        {
          id: 'createdProject',
          label: 'Create Your Project',
          description: 'Set up your first construction project',
          completed: data.createdProject || true, // Always true if they're on this page
          completedAt: data.createdProjectAt ? new Date(data.createdProjectAt) : null,
          icon: Rocket,
        },
        {
          id: 'uploadedDocuments',
          label: 'Upload Documents',
          description: 'Upload project plans, specs, or schedules',
          completed: data.uploadedDocuments,
          completedAt: data.uploadedDocumentsAt ? new Date(data.uploadedDocumentsAt) : null,
          icon: Upload,
          action: handleOpenDocumentLibrary,
          actionLabel: 'Upload Now'
        },
        {
          id: 'processedDocuments',
          label: 'Process Documents',
          description: 'Wait for AI to analyze your documents',
          completed: data.processedDocuments,
          completedAt: data.processedDocumentsAt ? new Date(data.processedDocumentsAt) : null,
          icon: Zap,
        },
        {
          id: 'startedFirstChat',
          label: 'Start Your First Chat',
          description: 'Ask questions about your project documents',
          completed: data.startedFirstChat,
          completedAt: data.startedFirstChatAt ? new Date(data.startedFirstChatAt) : null,
          icon: MessageSquare,
          action: () => setAiDrawerOpen(true),
          actionLabel: 'Start Chatting'
        },
        {
          id: 'finalizedFirstReport',
          label: 'Finalize Your First Daily Report',
          description: 'Complete and submit your first daily report',
          completed: data.finalizedFirstReport,
          completedAt: data.finalizedFirstReportAt ? new Date(data.finalizedFirstReportAt) : null,
          icon: FileCheck,
          action: () => router.push(`/project/${projectSlug}/field-ops/daily-reports`),
          actionLabel: 'Create Report'
        },
        {
          id: 'reviewedScheduleUpdates',
          label: 'Review Schedule Updates',
          description: 'Check and approve AI-generated schedule changes',
          completed: data.reviewedScheduleUpdates,
          completedAt: data.reviewedScheduleUpdatesAt ? new Date(data.reviewedScheduleUpdatesAt) : null,
          icon: Calendar,
          action: () => router.push(`/project/${projectSlug}/schedule-updates`),
          actionLabel: 'Review Updates'
        },
      ];

      setSteps(stepsData);
      
      const completedCount = stepsData.filter(s => s.completed).length;
      const percentage = Math.round((completedCount / stepsData.length) * 100);
      setCompletionPercentage(percentage);
      
      // Auto-collapse if 100% complete
      if (percentage === 100) {
        setCollapsed(true);
      }
    } catch (error) {
      console.error('Error fetching onboarding progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/onboarding-progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      });
      
      if (!res.ok) throw new Error('Failed to dismiss');
      
      setDismissed(true);
      toast.success('Onboarding guide dismissed');
      handleRefresh();
    } catch (error) {
      console.error('Error dismissing:', error);
      toast.error('Failed to dismiss guide');
    }
  };

  if (loading) {
    return (
      <Card className="p-4 bg-dark-card border-gray-700 animate-pulse">
        <div className="h-20 bg-dark-surface rounded"></div>
      </Card>
    );
  }

  if (dismissed || completionPercentage === 100) {
    return null; // Don't show if dismissed or 100% complete
  }

  return (
    <Card className="p-3 bg-gradient-to-r from-orange-600/10 via-orange-500/10 to-yellow-500/10 border-orange-500/30 shadow-lg">
      <div className="space-y-2">
        {/* Header with Progress Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-orange-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                Getting Started with ForemanOS
                <span className="text-[10px] font-normal text-orange-400">
                  {completionPercentage}% Complete
                </span>
              </h3>
              <p className="text-[10px] text-gray-400">
                {steps.filter(s => s.completed).length} of {steps.length} steps completed
              </p>
            </div>
          </div>
          {/* Progress Bar - inline */}
          <div className="flex-1 max-w-md">
            <Progress value={completionPercentage} className="h-1.5 bg-gray-700">
              <div
                className="h-full bg-gradient-to-r from-orange-600 to-yellow-500 transition-all duration-500 rounded-full"
                style={{ width: `${completionPercentage}%` }}
              />
            </Progress>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="text-gray-400 hover:text-orange-500 hover:bg-dark-surface h-7 w-7 p-0"
            >
              {collapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-gray-400 hover:text-red-500 hover:bg-dark-surface h-7 w-7 p-0"
              title="Dismiss guide"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Steps List - Compact 6-column grid */}
        {!collapsed && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`p-2 rounded-lg border transition-all ${
                  step.completed
                    ? 'bg-green-900/20 border-green-500/30'
                    : 'bg-dark-surface border-gray-700 hover:border-orange-500/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {step.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <step.icon className={`h-3 w-3 flex-shrink-0 ${
                        step.completed ? 'text-green-500' : 'text-orange-500'
                      }`} />
                      <h4 className={`font-medium text-[11px] leading-tight ${
                        step.completed ? 'text-gray-300' : 'text-gray-100'
                      }`}>
                        {step.label}
                      </h4>
                    </div>
                    <p className="text-[9px] text-gray-400 leading-tight mt-0.5 line-clamp-2">
                      {step.description}
                    </p>
                    <div className="mt-1.5">
                      {!step.completed && step.action && (
                        <Button
                          size="sm"
                          onClick={step.action}
                          className="text-[9px] h-5 px-2 bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          {step.actionLabel}
                        </Button>
                      )}
                      {step.completed && step.completedAt && (
                        <span className="text-[9px] text-green-500">
                          ✓ {step.completedAt.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
