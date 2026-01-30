"use client";

import { useState, useEffect } from 'react';
import { X, ChevronRight, Check, AlertCircle, Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowStep {
  id: string;
  question: string;
  stepType: string;
  options: any | null;
  isRequired: boolean;
  helpText: string | null;
  order: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  tradeType: string;
  steps: WorkflowStep[];
}

interface WorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectSlug: string;
  conversationId: string | null;
  onComplete: (summary: string) => void;
}

export function WorkflowModal({
  isOpen,
  onClose,
  projectSlug,
  conversationId,
  onComplete,
}: WorkflowModalProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [currentSteps, setCurrentSteps] = useState<WorkflowStep[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleContext, setScheduleContext] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Load available workflows and auto-select if only one
  useEffect(() => {
    if (isOpen && !selectedWorkflow) {
      loadWorkflows();
      loadWeatherData();
    }
  }, [isOpen]);

  // Fetch current weather for the project
  const loadWeatherData = async () => {
    try {
      setWeatherLoading(true);
      const response = await fetch(`/api/weather/current?projectSlug=${projectSlug}`);
      if (response.ok) {
        const data = await response.json();
        setWeatherData(data);
      } else {
        console.error('Failed to load weather data');
      }
    } catch (error) {
      console.error('Error loading weather:', error);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Auto-select workflow if only one is available
  useEffect(() => {
    if (workflows.length === 1 && !selectedWorkflow) {
      handleWorkflowSelect(workflows[0]);
    }
  }, [workflows, selectedWorkflow]);

  // Load next steps when workflow is selected or responses change
  useEffect(() => {
    if (selectedWorkflow) {
      loadNextSteps();
    }
  }, [selectedWorkflow, Object.keys(responses).length]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/workflows/available?projectSlug=${projectSlug}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load workflows');
      }

      setWorkflows(data.workflows);
    } catch (error: any) {
      console.error('Error loading workflows:', error);
      toast.error(error.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const loadNextSteps = async () => {
    if (!selectedWorkflow) return;

    try {
      const response = await fetch(
        `/api/workflows/${selectedWorkflow.id}/steps`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectSlug,
            conversationId,
            currentResponses: responses,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load next steps');
      }

      setCurrentSteps(data.steps);
      setScheduleContext(data.scheduleContext);
    } catch (error: any) {
      console.error('Error loading next steps:', error);
      toast.error(error.message || 'Failed to load next steps');
    }
  };

  const handleWorkflowSelect = async (workflow: Workflow) => {
    // Load full workflow with all steps
    try {
      setLoading(true);
      const response = await fetch(`/api/workflows/${workflow.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load workflow');
      }

      setSelectedWorkflow(data.workflow);
      setResponses({});
    } catch (error: any) {
      console.error('Error loading workflow:', error);
      toast.error(error.message || 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (stepId: string, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [stepId]: value,
    }));
  };

  const generateDailySummary = () => {
    if (!selectedWorkflow) return '';

    const allSteps = selectedWorkflow.steps;
    let summary = '📋 **DAILY CONSTRUCTION REPORT SUMMARY**\n\n';

    // Add date
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    summary += `**Date:** ${today}\n\n`;

    // Process each response
    allSteps.forEach((step) => {
      const response = responses[step.id];
      if (!response || (Array.isArray(response) && response.length === 0)) {
        return; // Skip empty responses
      }

      // Format based on question type
      if (step.question.toLowerCase().includes('subcontractors')) {
        summary += `**👷 Subcontractors on Site:**\n`;
        if (Array.isArray(response)) {
          response.forEach(sub => summary += `  • ${sub}\n`);
        }
        summary += '\n';
      } else if (step.question.toLowerCase().includes('crew count')) {
        summary += `**👥 Total Crew Count:** ${response}\n\n`;
      } else if (step.question.toLowerCase().includes('work completed')) {
        summary += `**✅ Work Completed:**\n${response}\n\n`;
      } else if (step.question.toLowerCase().includes('photo')) {
        if (response && response.trim()) {
          summary += `**📸 Photos:** ${response}\n\n`;
        }
      } else if (step.question.toLowerCase().includes('delay') && !step.question.toLowerCase().includes('caused')) {
        if (response === 'Yes') {
          summary += `**⚠️ Delays/Issues:** Yes\n`;
        }
      } else if (step.question.toLowerCase().includes('caused the delay')) {
        summary += `**Issue Details:** ${response}\n\n`;
      } else if (step.question.toLowerCase().includes('inspection') && !step.question.toLowerCase().includes('results')) {
        if (response === 'Yes') {
          summary += `**🔍 Inspections:** Conducted\n`;
        }
      } else if (step.question.toLowerCase().includes('inspection results')) {
        summary += `**Result:** ${response}\n`;
      } else if (step.question.toLowerCase().includes('corrections needed')) {
        summary += `**Corrections:** ${response}\n\n`;
      } else if (step.question.toLowerCase().includes('materials delivered')) {
        if (response && response.trim()) {
          summary += `**📦 Materials Delivered:**\n${response}\n\n`;
        }
      } else if (step.question.toLowerCase().includes('materials used')) {
        if (response && response.trim()) {
          summary += `**🔨 Materials Used/Installed:**\n${response}\n\n`;
        }
      } else if (step.question.toLowerCase().includes('equipment')) {
        if (response && response.trim()) {
          summary += `**🚜 Equipment on Site:**\n${response}\n\n`;
        }
      }
    });

    // Add schedule context if available
    if (scheduleContext?.todayTasks && scheduleContext.todayTasks.length > 0) {
      summary += `---\n\n**📅 SCHEDULE COMPARISON**\n\n`;
      summary += `**Planned Activities:**\n`;
      scheduleContext.todayTasks.forEach((task: string) => {
        summary += `  • ${task}\n`;
      });
      summary += '\n';
    }

    summary += `---\n\n**Next Steps:** Review any delays/issues, coordinate upcoming activities, and ensure all materials are ordered for tomorrow's work.`;

    return summary;
  };

  const handleSave = async () => {
    if (!selectedWorkflow || !conversationId) return;

    // Check if required fields are filled
    const requiredSteps = currentSteps.filter((s) => s.isRequired);
    const missingRequired = requiredSteps.filter(
      (s) => !responses[s.id] || responses[s.id] === ''
    );

    if (missingRequired.length > 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/workflows/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: selectedWorkflow.id,
          conversationId,
          responses,
          projectSlug,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save responses');
      }

      toast.success('Report saved successfully!');
      
      // Generate and pass the smart summary
      const summary = generateDailySummary();
      onComplete(summary);
      
      // Trigger PDF generation
      toast.info('Generating daily report PDF...');
      try {
        const pdfResponse = await fetch(`/api/conversations/${conversationId}/generate-daily-report-pdf`, {
          method: 'POST',
        });

        const pdfData = await pdfResponse.json();

        if (pdfResponse.ok) {
          toast.success(`Daily report PDF generated: ${pdfData.fileName}`);
        } else {
          console.error('PDF generation error:', pdfData.error);
          toast.warning('Report saved but PDF generation failed. You can generate it later from the document library.');
        }
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        toast.warning('Report saved but PDF generation failed. You can generate it later from the document library.');
      }
      
      handleClose();
    } catch (error: any) {
      console.error('Error saving responses:', error);
      toast.error(error.message || 'Failed to save responses');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedWorkflow(null);
    setCurrentSteps([]);
    setResponses({});
    setScheduleContext(null);
    onClose();
  };

  const getCompletionPercentage = () => {
    if (!selectedWorkflow) return 0;
    const totalSteps = selectedWorkflow.steps.length;
    const completedSteps = Object.keys(responses).length;
    return Math.round((completedSteps / totalSteps) * 100);
  };

  const renderInput = (step: WorkflowStep) => {
    const value = responses[step.id] || '';

    switch (step.stepType) {
      case 'text':
      case 'number':
        return (
          <input
            type={step.stepType}
            value={value}
            onChange={(e) => handleResponseChange(step.id, e.target.value)}
            className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#F97316] focus:outline-none"
            placeholder={step.helpText || `Enter ${step.question.toLowerCase()}`}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleResponseChange(step.id, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#F97316] focus:outline-none resize-none"
            placeholder={step.helpText || `Enter ${step.question.toLowerCase()}`}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleResponseChange(step.id, e.target.value)}
            className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#F97316] focus:outline-none"
          >
            <option value="">Select an option</option>
            {step.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {step.options?.map((option: string) => (
              <label key={option} className="flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={(value as string[])?.includes(option) || false}
                  onChange={(e) => {
                    const currentValues = (value as string[]) || [];
                    const newValues = e.target.checked
                      ? [...currentValues, option]
                      : currentValues.filter((v) => v !== option);
                    handleResponseChange(step.id, newValues);
                  }}
                  className="w-4 h-4 text-[#F97316] bg-dark-surface border-gray-600 rounded focus:ring-[#F97316]"
                />
                {option}
              </label>
            ))}
          </div>
        );

      case 'yes_no':
        return (
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleResponseChange(step.id, 'Yes')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                value === 'Yes'
                  ? 'bg-green-600 text-white'
                  : 'bg-dark-surface text-gray-300 hover:bg-dark-card border border-gray-600'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => handleResponseChange(step.id, 'No')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                value === 'No'
                  ? 'bg-red-600 text-white'
                  : 'bg-dark-surface text-gray-300 hover:bg-dark-card border border-gray-600'
              }`}
            >
              No
            </button>
          </div>
        );

      case 'photo':
        return (
          <div className="space-y-3">
            <div className="text-sm text-gray-400">
              {step.helpText || 'Select photos from conversation or add note'}
            </div>
            <textarea
              value={value}
              onChange={(e) => handleResponseChange(step.id, e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#F97316] focus:outline-none resize-none"
              placeholder="Note: Photos can be attached to this conversation and will be included in the daily report"
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-modal-title"
        className="bg-dark-card rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-dark-surface px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-[#F97316]" />
            <div>
              <h2 id="workflow-modal-title" className="text-xl font-bold text-white">
                {selectedWorkflow ? selectedWorkflow.name : 'Daily Report Workflows'}
              </h2>
              {selectedWorkflow && (
                <p className="text-sm text-gray-400">
                  {getCompletionPercentage()}% complete ({Object.keys(responses).length}/{selectedWorkflow.steps.length} steps)
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-dark-card rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
            </div>
          ) : !selectedWorkflow ? (
            /* Workflow Selection */
            <div className="space-y-4">
              <p className="text-gray-300 mb-6">
                Choose a workflow template based on your trade or role:
              </p>
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  onClick={() => handleWorkflowSelect(workflow)}
                  className="w-full text-left p-4 bg-dark-surface hover:bg-[#252c35] border border-gray-700 rounded-lg transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-[#F97316] transition-colors">
                        {workflow.name}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {workflow.description}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-[#F97316] transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Workflow Steps */
            <div className="space-y-6">
              {/* Weather Banner */}
              {weatherData && !weatherLoading && (
                <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-blue-300 mb-1">
                        Current Weather
                      </h3>
                      <div className="flex items-center gap-4 text-white">
                        <span className="text-2xl font-bold">{weatherData.temperature}°F</span>
                        <div className="text-sm">
                          <div className="font-medium">{weatherData.conditions}</div>
                          <div className="text-gray-400">{weatherData.description}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-400">
                      <div>Wind: {weatherData.windSpeed} mph</div>
                      <div>Humidity: {weatherData.humidity}%</div>
                      {weatherData.precipitation > 0 && (
                        <div className="text-yellow-400">Rain: {weatherData.precipitation.toFixed(2)}"</div>
                      )}
                    </div>
                  </div>
                  {weatherData.alerts && weatherData.alerts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-700/50">
                      {weatherData.alerts.map((alert: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-yellow-400 text-sm">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{alert.title}: {alert.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Schedule Context */}
              {scheduleContext && scheduleContext.todayTasks && scheduleContext.todayTasks.length > 0 && (
                <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Today's Scheduled Activities
                  </h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    {scheduleContext.todayTasks.slice(0, 3).map((task: any, idx: number) => (
                      <li key={idx}>• {task}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Current Steps (3-5 at a time) */}
              {currentSteps.map((step) => (
                <div key={step.id} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-200">
                    {step.question}
                    {step.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {step.helpText && (
                    <p className="text-xs text-gray-400 mb-2">{step.helpText}</p>
                  )}
                  {renderInput(step)}
                  {responses[step.id] && (
                    <Check className="w-5 h-5 text-green-500 inline-block ml-2" />
                  )}
                </div>
              ))}

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F97316] transition-all duration-300"
                    style={{ width: `${getCompletionPercentage()}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedWorkflow && (
          <div className="bg-dark-surface px-6 py-4 border-t border-gray-700 flex items-center justify-between">
            {workflows.length > 1 && (
              <button
                onClick={() => setSelectedWorkflow(null)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Workflows
              </button>
            )}
            {workflows.length === 1 && <div />}
            <button
              onClick={handleSave}
              disabled={saving || currentSteps.length === 0}
              className="px-6 py-2 bg-[#F97316] hover:bg-[#ea580c] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Continue'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
