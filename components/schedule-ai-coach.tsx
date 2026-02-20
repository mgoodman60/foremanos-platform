'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Brain,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Wrench,
  Users,
  TrendingUp,
  Loader2,
  Plus,
  FileText,
  Target,
  Lightbulb,
  Play,
  MessageSquare,
  GitBranch,
  Route
} from 'lucide-react';

interface ScheduleImprovement {
  id: string;
  category: 'sequencing' | 'resource' | 'duration' | 'dependency' | 'risk' | 'trade_breakdown' | 'weather' | 'cost';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  impact: string;
  affectedTasks: string[];
  suggestedAction: string;
  estimatedSavings?: {
    days?: number;
    cost?: number;
  };
  proposedTasks?: ProposedTask[];
}

interface ProposedTask {
  name: string;
  trade: string;
  duration: number;
  predecessors: string[];
  description: string;
  location?: string;
}

interface CriticalPathInfo {
  length: number;
  taskCount: number;
  nearCriticalCount: number;
}

interface TradeBreakdown {
  trade: string;
  taskCount: number;
  totalDays: number;
  criticalTasks: number;
}

interface WhatIfScenario {
  scenarioName: string;
  delayDays: number;
  affectedTasks: string[];
  newEndDate: string;
  impactSummary: string;
  mitigationOptions: string[];
}

interface CoachAnalysis {
  overallHealth: 'good' | 'fair' | 'poor';
  healthScore: number;
  summary: string;
  improvements: ScheduleImprovement[];
  milestoneBreakdowns: MilestoneBreakdown[];
  aiThoughts: string[];
  criticalPath?: CriticalPathInfo;
  tradeBreakdowns?: TradeBreakdown[];
  generatedSchedule?: any;
}

interface MilestoneBreakdown {
  milestoneId: string;
  milestoneName: string;
  currentTasks: number;
  proposedTasks: ProposedTask[];
  tradesInvolved: string[];
  reasoning: string;
}

interface ScheduleAICoachProps {
  projectSlug: string;
  scheduleId?: string;
  tasks: any[];
  onTasksAdded?: () => void;
}

export function ScheduleAICoach({ projectSlug, scheduleId, tasks, onTasksAdded }: ScheduleAICoachProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CoachAnalysis | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['improvements']));
  const [selectedImprovements, setSelectedImprovements] = useState<Set<string>>(new Set());
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [applying, setApplying] = useState(false);
  const [streamingThoughts, setStreamingThoughts] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  
  // What-If Scenario state
  const [showWhatIfDialog, setShowWhatIfDialog] = useState(false);
  const [whatIfTask, setWhatIfTask] = useState<string>('');
  const [whatIfDays, setWhatIfDays] = useState<number>(5);
  const [whatIfReason, setWhatIfReason] = useState<string>('');
  const [whatIfResult, setWhatIfResult] = useState<WhatIfScenario | null>(null);
  const [runningWhatIf, setRunningWhatIf] = useState(false);
  
  // Active tab
  const [_activeTab, _setActiveTab] = useState<string>('analysis');

  const runAnalysis = async () => {
    if (!scheduleId) {
      toast.error('No schedule selected');
      return;
    }

    setAnalyzing(true);
    setStreamingThoughts([]);
    setIsThinking(true);

    try {
      // Show thinking process
      const thoughts = [
        '🔍 Analyzing current schedule structure...',
        '📊 Reviewing task dependencies and sequences...',
        '👷 Identifying trade-specific work packages...',
        '⏱️ Evaluating duration estimates against industry standards...',
        '🔗 Checking for resource conflicts and overlaps...',
        '📋 Scanning project documents for scope details...',
        '🧠 Generating improvement recommendations...'
      ];

      for (let i = 0; i < thoughts.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setStreamingThoughts(prev => [...prev, thoughts[i]]);
      }

      const response = await fetch(`/api/projects/${projectSlug}/schedule-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, action: 'analyze' })
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setIsThinking(false);
      
      toast.success(`Analysis complete - Found ${data.analysis.improvements.length} potential improvements`);
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze schedule');
      setIsThinking(false);
    } finally {
      setAnalyzing(false);
    }
  };

  const generateFromDocuments = async () => {
    setAnalyzing(true);
    setStreamingThoughts([]);
    setIsThinking(true);

    try {
      const thoughts = [
        '📄 Scanning project documents...',
        '🏗️ Extracting scope from plans and specs...',
        '📐 Identifying work areas and phases...',
        '👷 Mapping work to appropriate trades...',
        '⏱️ Estimating durations based on quantities...',
        '🔗 Building logical dependencies...',
        '📋 Generating comprehensive schedule...'
      ];

      for (let i = 0; i < thoughts.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setStreamingThoughts(prev => [...prev, thoughts[i]]);
      }

      const response = await fetch(`/api/projects/${projectSlug}/schedule-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-from-documents' })
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setIsThinking(false);
      
      toast.success(`Generated ${data.analysis.milestoneBreakdowns?.length || 0} phases with tasks`);
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate schedule from documents');
      setIsThinking(false);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const toggleImprovement = (id: string) => {
    const newSelected = new Set(selectedImprovements);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedImprovements(newSelected);
  };

  const applySelectedImprovements = async () => {
    if (selectedImprovements.size === 0) {
      toast.error('No improvements selected');
      return;
    }

    setApplying(true);
    try {
      const improvementsToApply = analysis?.improvements
        .filter(imp => selectedImprovements.has(imp.id)) || [];

      const response = await fetch(`/api/projects/${projectSlug}/schedule-coach`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId,
          improvements: improvementsToApply
        })
      });

      if (!response.ok) {
        throw new Error('Failed to apply improvements');
      }

      const data = await response.json();
      toast.success(`Applied ${data.appliedCount} improvements, added ${data.tasksCreated} tasks`);
      setShowApplyDialog(false);
      setSelectedImprovements(new Set());
      
      if (onTasksAdded) {
        onTasksAdded();
      }
    } catch (error) {
      console.error('Apply error:', error);
      toast.error('Failed to apply improvements');
    } finally {
      setApplying(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sequencing': return <ArrowRight className="h-4 w-4" />;
      case 'resource': return <Users className="h-4 w-4" />;
      case 'duration': return <Clock className="h-4 w-4" />;
      case 'dependency': return <Target className="h-4 w-4" />;
      case 'risk': return <AlertTriangle className="h-4 w-4" />;
      case 'trade_breakdown': return <Wrench className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'sequencing': return 'bg-blue-600';
      case 'resource': return 'bg-purple-600';
      case 'duration': return 'bg-yellow-600';
      case 'dependency': return 'bg-cyan-600';
      case 'risk': return 'bg-red-600';
      case 'trade_breakdown': return 'bg-green-600';
      case 'weather': return 'bg-sky-600';
      case 'cost': return 'bg-emerald-600';
      default: return 'bg-gray-600';
    }
  };

  // Run What-If scenario
  const runWhatIfScenario = async () => {
    if (!scheduleId) {
      toast.error('No schedule selected');
      return;
    }

    setRunningWhatIf(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/schedule-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId,
          action: 'what-if',
          scenarioParams: {
            taskId: whatIfTask || undefined,
            delayDays: whatIfDays,
            delayReason: whatIfReason
          }
        })
      });

      if (!response.ok) throw new Error('Scenario failed');

      const data = await response.json();
      setWhatIfResult(data.scenario);
      toast.success('Scenario analysis complete');
    } catch (error) {
      console.error('What-if error:', error);
      toast.error('Failed to run scenario');
    } finally {
      setRunningWhatIf(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'good': return 'text-green-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-700/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <Brain className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Schedule AI Coach</h3>
              <p className="text-sm text-gray-400">
                AI-powered analysis, What-If scenarios, and task generation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setShowWhatIfDialog(true)}
              disabled={!scheduleId}
              variant="outline"
              className="border-amber-600 text-amber-400 hover:bg-amber-900/30"
            >
              <GitBranch className="mr-2 h-4 w-4" />
              What-If
            </Button>
            <Button
              onClick={generateFromDocuments}
              disabled={analyzing}
              variant="outline"
              className="border-green-600 text-green-400 hover:bg-green-900/30"
            >
              {analyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Generate from Plans
            </Button>
            <Button
              onClick={runAnalysis}
              disabled={analyzing || !scheduleId}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {analyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Analyze Schedule
            </Button>
          </div>
        </div>
      </Card>

      {/* AI Thinking Stream */}
      {isThinking && streamingThoughts.length > 0 && (
        <Card className="p-4 bg-dark-surface border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-purple-400 animate-pulse" />
            <span className="text-sm font-medium text-purple-400">AI is thinking...</span>
          </div>
          <div className="space-y-2">
            {streamingThoughts.map((thought, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm text-gray-300 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CheckCircle2 className="h-3 w-3 text-green-400" />
                {thought}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && !isThinking && (
        <>
          {/* Health Score */}
          <Card className="p-4 bg-dark-surface border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-blue-400" />
                <span className="font-medium">Schedule Health Score</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${getHealthColor(analysis.overallHealth)}`}>
                  {analysis.healthScore}/100
                </span>
                <Badge className={`${getHealthColor(analysis.overallHealth)} bg-opacity-20`}>
                  {analysis.overallHealth.toUpperCase()}
                </Badge>
              </div>
            </div>
            <Progress value={analysis.healthScore} className="h-2 mb-3" />
            <p className="text-sm text-gray-400">{analysis.summary}</p>
          </Card>

          {/* Critical Path & Trade Summary */}
          {(analysis.criticalPath || analysis.tradeBreakdowns) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Critical Path Card */}
              {analysis.criticalPath && (
                <Card className="p-4 bg-dark-surface border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Route className="h-5 w-5 text-red-400" />
                    <span className="font-medium">Critical Path</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-red-400">
                        {analysis.criticalPath.length}
                      </div>
                      <div className="text-xs text-gray-400">Days</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-400">
                        {analysis.criticalPath.taskCount}
                      </div>
                      <div className="text-xs text-gray-400">Critical Tasks</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-400">
                        {analysis.criticalPath.nearCriticalCount}
                      </div>
                      <div className="text-xs text-gray-400">Near-Critical</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Near-critical tasks have ≤5 days float and could become critical with minor delays.
                  </p>
                </Card>
              )}

              {/* Trade Breakdown Summary */}
              {analysis.tradeBreakdowns && analysis.tradeBreakdowns.length > 0 && (
                <Card className="p-4 bg-dark-surface border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-5 w-5 text-purple-400" />
                    <span className="font-medium">Trade Workload</span>
                  </div>
                  <div className="space-y-2">
                    {analysis.tradeBreakdowns.slice(0, 4).map((trade) => (
                      <div key={trade.trade} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300 truncate flex-1">{trade.trade}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400">{trade.taskCount} tasks</span>
                          <span className="text-gray-400">{trade.totalDays}d</span>
                          {trade.criticalTasks > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {trade.criticalTasks} critical
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {analysis.tradeBreakdowns.length > 4 && (
                      <p className="text-xs text-gray-400">
                        +{analysis.tradeBreakdowns.length - 4} more trades
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Improvements Section */}
          <Collapsible
            open={expandedSections.has('improvements')}
            onOpenChange={() => toggleSection('improvements')}
          >
            <Card className="bg-dark-surface border-gray-700">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    {expandedSections.has('improvements') ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Lightbulb className="h-5 w-5 text-yellow-400" />
                    <span className="font-medium">Improvement Recommendations</span>
                    <Badge variant="secondary">{analysis.improvements.length}</Badge>
                  </div>
                  {selectedImprovements.size > 0 && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowApplyDialog(true);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Apply Selected ({selectedImprovements.size})
                    </Button>
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="p-4 pt-0 space-y-3">
                    {analysis.improvements.map((improvement) => (
                      <div
                        key={improvement.id}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedImprovements.has(improvement.id)
                            ? 'bg-purple-900/30 border-purple-600'
                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                        }`}
                        onClick={() => toggleImprovement(improvement.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedImprovements.has(improvement.id)}
                            onCheckedChange={() => toggleImprovement(improvement.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getCategoryColor(improvement.category)}>
                                {getCategoryIcon(improvement.category)}
                                <span className="ml-1 capitalize">{improvement.category.replace('_', ' ')}</span>
                              </Badge>
                              <Badge className={getPriorityColor(improvement.priority)}>
                                {improvement.priority}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-white mb-1">{improvement.title}</h4>
                            <p className="text-sm text-gray-400 mb-2">{improvement.description}</p>
                            
                            {/* AI Reasoning */}
                            <div className="bg-gray-900/50 p-2 rounded text-xs text-gray-300 mb-2">
                              <span className="text-purple-400 font-medium">💭 Reasoning: </span>
                              {improvement.reasoning}
                            </div>

                            {/* Impact & Savings */}
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-blue-400">
                                <TrendingUp className="inline h-3 w-3 mr-1" />
                                {improvement.impact}
                              </span>
                              {improvement.estimatedSavings?.days && (
                                <span className="text-green-400">
                                  <Clock className="inline h-3 w-3 mr-1" />
                                  Save {improvement.estimatedSavings.days} days
                                </span>
                              )}
                              {improvement.estimatedSavings?.cost && (
                                <span className="text-green-400">
                                  ${improvement.estimatedSavings.cost.toLocaleString()} savings
                                </span>
                              )}
                            </div>

                            {/* Proposed Tasks */}
                            {improvement.proposedTasks && improvement.proposedTasks.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-700">
                                <p className="text-xs text-gray-400 mb-2">Proposed Tasks:</p>
                                <div className="space-y-1">
                                  {improvement.proposedTasks.slice(0, 3).map((task, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                      <Plus className="h-3 w-3 text-green-400" />
                                      <span className="text-gray-300">{task.name}</span>
                                      <Badge variant="outline" className="text-[10px]">{task.trade}</Badge>
                                      <span className="text-gray-400">{task.duration}d</span>
                                    </div>
                                  ))}
                                  {improvement.proposedTasks.length > 3 && (
                                    <p className="text-xs text-gray-400">
                                      +{improvement.proposedTasks.length - 3} more tasks
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Milestone Breakdowns */}
          {analysis.milestoneBreakdowns && analysis.milestoneBreakdowns.length > 0 && (
            <Collapsible
              open={expandedSections.has('milestones')}
              onOpenChange={() => toggleSection('milestones')}
            >
              <Card className="bg-dark-surface border-gray-700">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50">
                    <div className="flex items-center gap-2">
                      {expandedSections.has('milestones') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Wrench className="h-5 w-5 text-green-400" />
                      <span className="font-medium">Milestone → Trade Breakdowns</span>
                      <Badge variant="secondary">{analysis.milestoneBreakdowns.length}</Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="max-h-[400px]">
                    <div className="p-4 pt-0 space-y-4">
                      {analysis.milestoneBreakdowns.map((breakdown) => (
                        <div key={breakdown.milestoneId} className="bg-gray-800/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-white">{breakdown.milestoneName}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                Current: {breakdown.currentTasks} tasks
                              </Badge>
                              <Badge className="bg-green-600">
                                +{breakdown.proposedTasks.length} proposed
                              </Badge>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-400 mb-3">{breakdown.reasoning}</p>
                          
                          <div className="flex flex-wrap gap-1 mb-3">
                            {breakdown.tradesInvolved.map((trade) => (
                              <Badge key={trade} variant="secondary" className="text-xs">
                                {trade}
                              </Badge>
                            ))}
                          </div>

                          <div className="space-y-2">
                            {breakdown.proposedTasks.map((task, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 bg-gray-900/50 rounded text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <Plus className="h-3 w-3 text-green-400" />
                                  <span>{task.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <Badge variant="outline">{task.trade}</Badge>
                                  <span>{task.duration}d</span>
                                  {task.location && <span>@ {task.location}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </>
      )}

      {/* Empty State */}
      {!analysis && !analyzing && (
        <Card className="p-8 bg-dark-surface border-gray-700 text-center">
          <Brain className="h-12 w-12 mx-auto text-purple-400 opacity-50 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Schedule Intelligence</h3>
          <p className="text-gray-400 mb-4 max-w-md mx-auto">
            Let AI analyze your schedule for improvements, or generate a detailed schedule 
            from your project documents automatically.
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={generateFromDocuments}
              className="border-green-600 text-green-400 hover:bg-green-900/30"
            >
              <FileText className="mr-2 h-4 w-4" />
              Generate from Plans
            </Button>
            {scheduleId && (
              <Button onClick={runAnalysis} className="bg-purple-600 hover:bg-purple-700">
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze Current Schedule
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Apply Confirmation Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="bg-dark-surface border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Apply Schedule Improvements</DialogTitle>
            <DialogDescription className="text-gray-400">
              Review and confirm the changes before applying them to your schedule.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {analysis?.improvements
              .filter(imp => selectedImprovements.has(imp.id))
              .map(imp => (
                <div key={imp.id} className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={getCategoryColor(imp.category)}>
                      {imp.category.replace('_', ' ')}
                    </Badge>
                    <span className="font-medium">{imp.title}</span>
                  </div>
                  <p className="text-sm text-gray-400">{imp.suggestedAction}</p>
                  {imp.proposedTasks && (
                    <p className="text-xs text-green-400 mt-1">
                      +{imp.proposedTasks.length} tasks will be added
                    </p>
                  )}
                </div>
              ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={applySelectedImprovements}
              disabled={applying}
              className="bg-green-600 hover:bg-green-700"
            >
              {applying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Apply {selectedImprovements.size} Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* What-If Scenario Dialog */}
      <Dialog open={showWhatIfDialog} onOpenChange={setShowWhatIfDialog}>
        <DialogContent className="bg-dark-surface border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-amber-400" />
              What-If Scenario Analysis
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Model the impact of potential delays on your schedule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Scenario Input */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Task (optional)</Label>
                <Select value={whatIfTask} onValueChange={setWhatIfTask}>
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue placeholder="Auto-select critical task" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="">Auto-select critical task</SelectItem>
                    {tasks.filter(t => t.isCritical).slice(0, 10).map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Delay Duration (days)</Label>
                <Input
                  type="number"
                  value={whatIfDays}
                  onChange={(e) => setWhatIfDays(parseInt(e.target.value) || 0)}
                  min={1}
                  max={60}
                  className="bg-gray-800 border-gray-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Delay Reason (optional)</Label>
              <Input
                value={whatIfReason}
                onChange={(e) => setWhatIfReason(e.target.value)}
                placeholder="e.g., Material delivery delay, Weather, Labor shortage"
                className="bg-gray-800 border-gray-600"
              />
            </div>

            <Button
              onClick={runWhatIfScenario}
              disabled={runningWhatIf || whatIfDays < 1}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {runningWhatIf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Scenario Analysis
            </Button>

            {/* Scenario Results */}
            {whatIfResult && (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h4 className="font-medium text-amber-400 mb-2">
                    {whatIfResult.scenarioName}
                  </h4>
                  <p className="text-sm text-gray-300 mb-3">
                    {whatIfResult.impactSummary}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center p-2 bg-gray-900/50 rounded">
                      <div className="text-xl font-bold text-red-400">
                        {whatIfResult.delayDays}
                      </div>
                      <div className="text-xs text-gray-400">Day Delay</div>
                    </div>
                    <div className="text-center p-2 bg-gray-900/50 rounded">
                      <div className="text-xl font-bold text-yellow-400">
                        {whatIfResult.affectedTasks.length}
                      </div>
                      <div className="text-xs text-gray-400">Tasks Affected</div>
                    </div>
                  </div>

                  {whatIfResult.affectedTasks.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Affected Tasks:</p>
                      <div className="flex flex-wrap gap-1">
                        {whatIfResult.affectedTasks.slice(0, 8).map((task, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {task}
                          </Badge>
                        ))}
                        {whatIfResult.affectedTasks.length > 8 && (
                          <Badge variant="outline" className="text-xs">
                            +{whatIfResult.affectedTasks.length - 8} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mitigation Options */}
                  {whatIfResult.mitigationOptions.length > 0 && (
                    <div className="border-t border-gray-700 pt-3">
                      <p className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1">
                        <Lightbulb className="h-4 w-4" />
                        Mitigation Options
                      </p>
                      <ul className="space-y-1">
                        {whatIfResult.mitigationOptions.map((option, idx) => (
                          <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                            <CheckCircle2 className="h-3 w-3 text-green-400 mt-1 flex-shrink-0" />
                            {option}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowWhatIfDialog(false);
              setWhatIfResult(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
