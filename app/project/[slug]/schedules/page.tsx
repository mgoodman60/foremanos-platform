"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GanttChart } from '@/components/schedule/gantt-chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, FileText, Plus, Trash2, Edit, CheckCircle2, AlertTriangle, Clock, BarChart3, CalendarDays, ListTodo, Activity, History, Bookmark, MoreVertical, RefreshCw, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ThreeWeekLookahead from '@/components/three-week-lookahead';
import TradeClarificationPanel from '@/components/trade-clarification-panel';
import { ScheduleStatsBar } from '@/components/schedule/schedule-stats-bar';
import { ScheduleFilters, defaultFilters, type ScheduleFilters as FiltersType } from '@/components/schedule/schedule-filters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ScheduleHealthAnalyzer from '@/components/schedule/schedule-health-analyzer';
import { ScheduleFAB } from '@/components/schedule/schedule-fab';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '@/components/schedule/keyboard-shortcuts';
import { HeartPulse } from 'lucide-react';
import { ScheduleAICoach } from '@/components/schedule-ai-coach';
import { ResourceHistogram, type LaborEntry, type EquipmentEntry, type TaskResource } from '@/components/schedule/resource-histogram';
import { EarnedValueChart, type ScheduleTask as EVScheduleTask, type CostEntry } from '@/components/schedule/earned-value-chart';
import { WeatherScheduleOverlay, type ScheduleTask as WeatherScheduleTask } from '@/components/schedule/weather-schedule-overlay';
import { DelayImpactAnalyzer, type ScheduleTask as DelayScheduleTask } from '@/components/schedule/delay-impact-analyzer';
import { MobileFieldView, type FieldTask } from '@/components/schedule/mobile-field-view';
import { Cloud, Smartphone } from 'lucide-react';

interface Schedule {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  version: number;
  document?: {
    id: string;
    name: string;
  };
  creator: {
    username: string;
  };
  progress: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    delayedTasks: number;
    overallProgress: number;
  };
  _count: {
    tasks: number;
  };
}

interface Task {
  id: string;
  taskId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  duration: number;
  percentComplete: number;
  status: string;
  isCritical: boolean;
  predecessors: string[];
  successors: string[];
  assignedTo?: string;
  subcontractorId?: string;
  subcontractor?: {
    id: string;
    companyName: string;
    tradeType: string;
  };
  location?: string;
  actualCost?: number;
  budgetedCost?: number;
  wbsCode?: string;
  totalFloat?: number;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  baselineStartDate?: string | null;
  baselineEndDate?: string | null;
}

interface Subcontractor {
  id: string;
  companyName: string;
  tradeType: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  isActive: boolean;
}

interface ScheduleDocument {
  id: string;
  name: string;
  fileName: string;
  category: string;
  processed: boolean;
  uploadedAt: string;
}

export default function SchedulesPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const slug = params.slug as string;

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [scheduleDocuments, setScheduleDocuments] = useState<ScheduleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsingDocumentId, setParsingDocumentId] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [updating, setUpdating] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<Record<string, number>>({});
  const [reprocessingDocumentId, setReprocessingDocumentId] = useState<string | null>(null);
  const [pendingUpdatesCount, setPendingUpdatesCount] = useState<number>(0);
  const [baselineLoading, setBaselineLoading] = useState(false);
  
  // Tab and filter state
  const [activeTab, setActiveTab] = useState('gantt');
  const [filters, setFilters] = useState<FiltersType>(defaultFilters);
  
  // Resource histogram and earned value data
  const [resourceData, setResourceData] = useState<{
    laborEntries: LaborEntry[];
    equipmentEntries: EquipmentEntry[];
    taskResources: TaskResource[];
    projectStartDate: Date;
    projectEndDate: Date;
    projectBudget: number;
    evTasks: EVScheduleTask[];
    costEntries: CostEntry[];
  } | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);

  // Baseline management handlers
  const handleSetBaseline = async () => {
    if (!selectedSchedule) {
      toast.error('No schedule selected');
      return;
    }
    
    setBaselineLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/schedule/actuals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setBaseline' }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || 'Baseline set successfully');
        // Reload tasks to show baseline bars
        loadTasks(selectedSchedule.id);
      } else {
        toast.error(data.error || 'Failed to set baseline');
      }
    } catch (error) {
      console.error('Error setting baseline:', error);
      toast.error('Failed to set baseline');
    } finally {
      setBaselineLoading(false);
    }
  };

  const handleBackfillActuals = async () => {
    setBaselineLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/schedule/actuals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backfill' }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || 'Actuals backfilled from daily reports');
        // Reload tasks to show actual bars
        if (selectedSchedule) {
          loadTasks(selectedSchedule.id);
        }
      } else {
        toast.error(data.error || 'Failed to backfill actuals');
      }
    } catch (error) {
      console.error('Error backfilling actuals:', error);
      toast.error('Failed to backfill actuals');
    } finally {
      setBaselineLoading(false);
    }
  };

  // Keyboard shortcuts
  const { showHelp: showKeyboardHelp, setShowHelp: setShowKeyboardHelp } = useKeyboardShortcuts({
    onJumpToToday: () => {
      setActiveTab('gantt');
      toast.success('Jumped to today');
    },
    onFocusSearch: () => {
      const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    },
    onRefresh: () => {
      loadSchedules();
      if (selectedSchedule) {
        loadTasks(selectedSchedule.id);
      }
      toast.success('Schedule refreshed');
    },
    onCloseModal: () => {
      setShowTaskModal(false);
    },
    onSwitchTab: (tab: string) => {
      setActiveTab(tab);
    },
    enabled: !showTaskModal // Disable when modal is open
  });

  // Format trade type for display (e.g., "ELECTRICAL" -> "Electrical")
  const formatTrade = (tradeType: string) => {
    return tradeType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Format name as "Trade - Subcontractor" (P6 style)
  const formatSubcontractorName = (sub: Subcontractor) => {
    const trade = formatTrade(sub.tradeType);
    return `${trade} - ${sub.companyName}`;
  };

  // Get unique trades and assignees for filter dropdowns
  const availableTrades = [...new Set(tasks.map(t => t.subcontractor?.tradeType).filter(Boolean))] as string[];
  const availableAssignees = [...new Set(tasks.map(t => t.assignedTo || t.subcontractor?.companyName).filter(Boolean))] as string[];

  // Apply filters to tasks
  const filteredTasks = tasks.filter(task => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        task.name.toLowerCase().includes(searchLower) ||
        task.taskId.toLowerCase().includes(searchLower) ||
        (task.description || '').toLowerCase().includes(searchLower) ||
        (task.assignedTo || '').toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
      return false;
    }
    
    // Trade filter
    if (filters.trades.length > 0) {
      const taskTrade = task.subcontractor?.tradeType;
      if (!taskTrade || !filters.trades.includes(taskTrade)) return false;
    }
    
    // Assignee filter
    if (filters.assignees.length > 0) {
      const taskAssignee = task.assignedTo || task.subcontractor?.companyName;
      if (!taskAssignee || !filters.assignees.includes(taskAssignee)) return false;
    }
    
    // Critical path filter
    if (filters.criticalPathOnly && !task.isCritical) {
      return false;
    }
    
    return true;
  });

  // Load schedules, subcontractors, schedule documents, and pending updates count
  useEffect(() => {
    loadSchedules();
    loadSubcontractors();
    loadScheduleDocuments();
    loadPendingUpdatesCount();
  }, [slug]);

  // Load tasks when schedule selected
  useEffect(() => {
    if (selectedSchedule) {
      loadTasks(selectedSchedule.id);
    }
  }, [selectedSchedule]);

  // Load resource data when analysis tab is active
  useEffect(() => {
    if (activeTab === 'analysis' && !resourceData && !resourceLoading) {
      loadResourceData();
    }
  }, [activeTab, resourceData, resourceLoading]);

  // Poll processing status for unprocessed documents
  useEffect(() => {
    const unprocessedDocs = scheduleDocuments.filter(doc => !doc.processed);
    
    if (unprocessedDocs.length === 0) return;

    const pollProcessingStatus = async () => {
      const progressUpdates: Record<string, number> = {};
      let shouldReload = false;
      
      for (const doc of unprocessedDocs) {
        const progress = await fetchProcessingStatus(doc.id);
        if (progress !== null) {
          progressUpdates[doc.id] = progress;
          
          // If a document just completed processing, trigger reload
          if (progress >= 100 && processingProgress[doc.id] < 100) {
            shouldReload = true;
          }
        }
      }
      
      setProcessingProgress(prev => ({ ...prev, ...progressUpdates }));
      
      // Reload documents list if any document completed
      if (shouldReload) {
        setTimeout(() => loadScheduleDocuments(), 1000);
      }
    };

    // Initial poll
    pollProcessingStatus();

    // Set up interval for polling (every 3 seconds)
    const intervalId = setInterval(pollProcessingStatus, 3000);

    return () => clearInterval(intervalId);
  }, [scheduleDocuments, processingProgress]);

  const loadSubcontractors = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/subcontractors`);
      if (!res.ok) throw new Error('Failed to load subcontractors');
      const data = await res.json();
      setSubcontractors(data.subcontractors || []);
    } catch (error) {
      console.error('Error loading subcontractors:', error);
      setSubcontractors([]);
    }
  };

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${slug}/schedules`);
      if (!res.ok) throw new Error('Failed to load schedules');
      const data = await res.json();
      setSchedules(data.schedules);

      // Auto-select active schedule
      const active = data.schedules.find((s: Schedule) => s.isActive);
      if (active) {
        setSelectedSchedule(active);
      } else if (data.schedules.length > 0) {
        setSelectedSchedule(data.schedules[0]);
      }
    } catch (error: any) {
      console.error('Error loading schedules:', error);
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadScheduleDocuments = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/documents`);
      if (!res.ok) throw new Error('Failed to load documents');
      const data = await res.json();
      
      // Filter for schedule-related documents
      const schedDocs = data.documents.filter((doc: any) => 
        doc.category === 'schedule' ||
        doc.name.toLowerCase().includes('schedule') ||
        doc.name.toLowerCase().includes('plan') ||
        doc.name.toLowerCase().includes('timeline') ||
        doc.name.toLowerCase().includes('gantt')
      );
      
      setScheduleDocuments(schedDocs);
    } catch (error) {
      console.error('Error loading schedule documents:', error);
      setScheduleDocuments([]);
    }
  };

  const loadPendingUpdatesCount = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/schedule-updates/pending-count`);
      if (!res.ok) throw new Error('Failed to load pending count');
      const data = await res.json();
      setPendingUpdatesCount(data.count || 0);
    } catch (error) {
      console.error('Error loading pending updates count:', error);
      setPendingUpdatesCount(0);
    }
  };

  const fetchProcessingStatus = async (documentId: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}/processing-status`);
      if (!res.ok) return null;
      const data = await res.json();
      
      if (data.queue && data.queue.progress !== undefined) {
        return data.queue.progress;
      }
      
      // If no queue info but document is processed, return 100
      if (data.Document?.processed) {
        return 100;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching processing status:', error);
      return null;
    }
  };

  const handleReprocessDocument = async (documentId: string, documentName: string) => {
    try {
      setReprocessingDocumentId(documentId);
      
      const toastId = toast.loading(`Reprocessing ${documentName}...`);
      
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reprocess document');
      }
      
      toast.success(`Document reprocessing started!`, { id: toastId });
      
      // Reload documents list
      await loadScheduleDocuments();
    } catch (error: any) {
      console.error('Error reprocessing document:', error);
      toast.error(error.message || 'Failed to reprocess document');
    } finally {
      setReprocessingDocumentId(null);
    }
  };

  const handleParseSchedule = async (documentId: string, documentName: string) => {
    try {
      setParsingDocumentId(documentId);
      
      const toastId = toast.loading(`Extracting tasks from ${documentName}...`);
      
      const res = await fetch(`/api/documents/${documentId}/parse-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse schedule');
      }
      
      toast.success(`Successfully extracted ${data.summary.totalTasks} tasks!`, { id: toastId });
      
      // Reload schedules and select the new one
      const schedulesRes = await fetch(`/api/projects/${slug}/schedules`);
      if (schedulesRes.ok) {
        const schedulesData = await schedulesRes.json();
        setSchedules(schedulesData.schedules);
        
        // Find and select the newly created schedule (it should be active)
        const newSchedule = schedulesData.schedules.find((s: Schedule) => s.isActive);
        if (newSchedule) {
          setSelectedSchedule(newSchedule);
          // Explicitly load tasks for the new schedule
          await loadTasks(newSchedule.id);
        }
      }
      
      // Trigger schedule update event for progress ribbon
      window.dispatchEvent(new CustomEvent('scheduleUpdated'));
      
    } catch (error: any) {
      console.error('Error parsing schedule:', error);
      toast.error(error.message || 'Failed to parse schedule');
    } finally {
      setParsingDocumentId(null);
    }
  };

  const loadTasks = async (scheduleId: string) => {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/tasks`);
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = await res.json();
      setTasks(data.tasks);
      setMilestones(data.milestones || []);
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    }
  };

  // Load resource histogram and earned value data
  const loadResourceData = async () => {
    if (!slug) return;
    
    try {
      setResourceLoading(true);
      const res = await fetch(`/api/projects/${slug}/schedules/resources`);
      if (!res.ok) {
        console.warn('Resource data not available');
        return;
      }
      
      const data = await res.json();
      
      setResourceData({
        laborEntries: data.histogram?.laborEntries || [],
        equipmentEntries: data.histogram?.equipmentEntries || [],
        taskResources: data.histogram?.taskResources || [],
        projectStartDate: new Date(data.project?.startDate || Date.now()),
        projectEndDate: new Date(data.project?.endDate || Date.now()),
        projectBudget: data.project?.budget || 1000000,
        evTasks: data.earnedValue?.tasks || [],
        costEntries: data.earnedValue?.costEntries || []
      });
    } catch (error) {
      console.error('Error loading resource data:', error);
    } finally {
      setResourceLoading(false);
    }
  };

  const handleTaskClick = (task: any) => {
    // Convert GanttTask format to Task format if needed
    const taskData: Task = {
      id: task.id,
      taskId: task.taskId,
      name: task.name,
      description: task.description,
      startDate: typeof task.startDate === 'string' ? task.startDate : task.startDate.toISOString(),
      endDate: typeof task.endDate === 'string' ? task.endDate : task.endDate.toISOString(),
      duration: task.duration,
      percentComplete: task.percentComplete,
      status: task.status,
      isCritical: task.isCritical,
      predecessors: task.predecessors,
      successors: task.successors,
      assignedTo: task.assignedTo,
      location: task.location,
      actualCost: task.actualCost,
      budgetedCost: task.budgetedCost
    };
    setSelectedTask(taskData);
    setShowTaskModal(true);
  };

  const handleUpdateTask = async (taskId: string, updates: any) => {
    if (!selectedSchedule) return;

    try {
      setUpdating(true);
      const res = await fetch(`/api/schedules/${selectedSchedule.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, ...updates })
      });

      if (!res.ok) throw new Error('Failed to update task');

      toast.success('Task updated successfully');
      await loadTasks(selectedSchedule.id);
      await loadSchedules(); // Refresh schedule progress
      setShowTaskModal(false);
      
      // Trigger schedule update event for progress ribbon
      window.dispatchEvent(new CustomEvent('scheduleUpdated'));
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1F2328]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1F2328] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Project Schedule</h1>
            <p className="text-gray-400 mt-1">
              View and manage project timelines, tasks, and dependencies
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Parse Schedule from Documents */}
            {scheduleDocuments.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                    <FileText className="h-4 w-4 mr-2" />
                    Parse Schedule
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#2d333b] border-gray-700 w-80">
                  <div className="px-3 py-2 border-b border-gray-700">
                    <p className="text-sm font-medium text-gray-200">Schedule Documents</p>
                    <p className="text-xs text-gray-400 mt-1">Extract tasks from uploaded schedules</p>
                  </div>
                  {scheduleDocuments.map((doc) => (
                    <DropdownMenuItem 
                      key={doc.id}
                      onClick={() => doc.processed && handleParseSchedule(doc.id, doc.name)}
                      disabled={!doc.processed || parsingDocumentId === doc.id}
                      className="text-gray-200 hover:bg-[#1F2328] cursor-pointer flex items-center justify-between py-3"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        <span className="truncate">{doc.name}</span>
                      </div>
                      {!doc.processed ? (
                        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs ml-2">
                          Processing...
                        </Badge>
                      ) : parsingDocumentId === doc.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 ml-2" />
                      ) : (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/30 text-xs ml-2">
                          Ready
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem 
                    onClick={() => router.push(`/project/${slug}`)}
                    className="text-gray-400 hover:bg-[#1F2328] cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Upload New Schedule...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {pendingUpdatesCount > 0 && (
              <Button
                onClick={() => router.push(`/project/${slug}/schedule-updates`)}
                className="bg-orange-600 hover:bg-orange-700 text-white border-orange-500"
              >
                <Clock className="h-4 w-4 mr-2" />
                Review {pendingUpdatesCount} Pending Update{pendingUpdatesCount !== 1 ? 's' : ''}
              </Button>
            )}
            <Button
              onClick={() => router.push(`/project/${slug}`)}
              variant="outline"
            >
              Back to Project
            </Button>
          </div>
        </div>

        {/* Quick Stats Dashboard */}
        {schedules.length > 0 && (
          <ScheduleStatsBar 
            projectSlug={slug} 
            onFilterClick={(filter) => {
              // Future: implement filter functionality
              toast.info(`Filter by ${filter} - coming soon!`);
            }}
          />
        )}

        {schedules.length === 0 ? (
          <div className="space-y-6">
            <Card className="bg-[#2d333b] border-gray-700 p-8">
              <div className="text-center space-y-4">
                <Calendar className="h-16 w-16 text-gray-400 mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-200">No Schedules Yet</h3>
                  <p className="text-gray-400 mt-2">
                    {scheduleDocuments.length > 0 
                      ? 'Found schedule documents below. Click "Parse Schedule" to extract tasks.'
                      : 'Upload a schedule PDF to get started. Schedule documents are automatically detected.'}
                  </p>
                </div>
                <Button onClick={() => router.push(`/project/${slug}`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Go to Documents
                </Button>
              </div>
            </Card>

            {/* Schedule Documents Available for Parsing */}
            {scheduleDocuments.length > 0 && (
              <Card className="bg-[#2d333b] border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-500" />
                  Schedule Documents
                </h3>
                <div className="space-y-3">
                  {scheduleDocuments.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-4 bg-[#1F2328] rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-8 w-8 text-orange-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-200 truncate">{doc.name}</p>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                            <span>{doc.fileName}</span>
                            {doc.processed ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                                Processed
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                                Processing...
                              </Badge>
                            )}
                          </div>
                          {/* Progress bar for processing documents */}
                          {!doc.processed && (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-400">Processing progress</span>
                                <span className="text-orange-400 font-medium">
                                  {processingProgress[doc.id] !== undefined 
                                    ? `${processingProgress[doc.id]}%` 
                                    : 'Initializing...'}
                                </span>
                              </div>
                              <Progress 
                                value={processingProgress[doc.id] || 0} 
                                className="h-2 bg-gray-700 [&>div]:bg-orange-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {/* Reprocess button - shows when document seems stuck */}
                        {!doc.processed && processingProgress[doc.id] === undefined && (
                          <Button
                            onClick={() => handleReprocessDocument(doc.id, doc.name)}
                            disabled={reprocessingDocumentId === doc.id}
                            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500"
                            size="sm"
                            title="Document appears stuck. Click to restart processing."
                          >
                            {reprocessingDocumentId === doc.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Reprocessing...
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Reprocess
                              </>
                            )}
                          </Button>
                        )}
                        
                        {/* Parse Schedule button - shows when document is processed */}
                        <Button
                          onClick={() => handleParseSchedule(doc.id, doc.name)}
                          disabled={!doc.processed || parsingDocumentId === doc.id}
                          className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500"
                          size="sm"
                        >
                          {parsingDocumentId === doc.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                              Parsing...
                            </>
                          ) : (
                            <>
                              <Calendar className="h-4 w-4 mr-2" />
                              Parse Schedule
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  💡 AI-powered extraction automatically detects tasks, dates, dependencies, and critical path information from your schedule documents.
                </p>
              </Card>
            )}
          </div>
        ) : (
          <>
            {/* Schedule Selector */}
            <div className="flex items-center gap-3 flex-wrap p-3 bg-[#2d333b]/50 rounded-lg border border-gray-700">
              <span className="text-sm text-gray-400 font-medium mr-2">Schedules:</span>
              {schedules.map((schedule) => (
                <Button
                  key={schedule.id}
                  variant={selectedSchedule?.id === schedule.id ? 'default' : 'outline'}
                  onClick={() => setSelectedSchedule(schedule)}
                  className={cn(
                    "relative transition-all",
                    selectedSchedule?.id === schedule.id 
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20" 
                      : "bg-[#3d444d] border-gray-500 text-gray-200 hover:bg-[#4d555e] hover:border-gray-400"
                  )}
                >
                  {schedule.name}
                  {schedule.isActive && (
                    <Badge className="ml-2 bg-green-500/90 text-white border-green-400 text-xs">Active</Badge>
                  )}
                </Button>
              ))}
            </div>

            {selectedSchedule && (
              <>
                {/* Schedule Info */}
                <Card className="bg-[#2d333b] border-gray-700 p-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">Schedule Details</h3>
                      <p className="text-lg font-semibold text-gray-200">{selectedSchedule.name}</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {format(new Date(selectedSchedule.startDate), 'MMM d, yyyy')} - {format(new Date(selectedSchedule.endDate), 'MMM d, yyyy')}
                      </p>
                      {selectedSchedule.document && (
                        <p className="text-xs text-gray-500 mt-2">
                          Source: {selectedSchedule.document.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">Progress</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Overall:</span>
                          <span className="font-semibold text-gray-200">
                            {selectedSchedule.progress.overallProgress}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Completed:</span>
                          <span className="text-green-400">
                            {selectedSchedule.progress.completedTasks} / {selectedSchedule.progress.totalTasks}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">In Progress:</span>
                          <span className="text-blue-400">
                            {selectedSchedule.progress.inProgressTasks}
                          </span>
                        </div>
                        {selectedSchedule.progress.delayedTasks > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Delayed:</span>
                            <span className="text-red-400">
                              {selectedSchedule.progress.delayedTasks}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">Quick Stats</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Total Tasks:</span>
                          <span className="font-semibold text-gray-200">
                            {selectedSchedule._count.tasks}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Version:</span>
                          <span className="text-gray-300">{selectedSchedule.version}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Created by:</span>
                          <span className="text-gray-300">{selectedSchedule.creator?.username || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Filters */}
                <ScheduleFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableTrades={availableTrades}
                  availableAssignees={availableAssignees}
                />

                {/* Tab Navigation */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <TabsList className="bg-[#2d333b] border border-gray-600 p-1 justify-start gap-1">
                      <TabsTrigger 
                        value="gantt" 
                        className="text-gray-300 bg-[#3d444d] hover:bg-[#4d555e] data-[state=active]:bg-orange-500 data-[state=active]:text-white gap-2 border border-gray-500 data-[state=active]:border-orange-500"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Gantt Chart
                      </TabsTrigger>
                      <TabsTrigger 
                        value="lookahead" 
                        className="text-gray-300 bg-[#3d444d] hover:bg-[#4d555e] data-[state=active]:bg-orange-500 data-[state=active]:text-white gap-2 border border-gray-500 data-[state=active]:border-orange-500"
                      >
                        <CalendarDays className="h-4 w-4" />
                        3-Week Lookahead
                      </TabsTrigger>
                      <TabsTrigger 
                        value="analysis" 
                        className="text-gray-300 bg-[#3d444d] hover:bg-[#4d555e] data-[state=active]:bg-orange-500 data-[state=active]:text-white gap-2 border border-gray-500 data-[state=active]:border-orange-500"
                      >
                        <Activity className="h-4 w-4" />
                        Analysis
                      </TabsTrigger>
                      <TabsTrigger 
                        value="health" 
                        className="text-gray-300 bg-[#3d444d] hover:bg-[#4d555e] data-[state=active]:bg-orange-500 data-[state=active]:text-white gap-2 border border-gray-500 data-[state=active]:border-orange-500"
                      >
                        <HeartPulse className="h-4 w-4" />
                        Health Check
                      </TabsTrigger>
                      <TabsTrigger 
                        value="weather" 
                        className="text-gray-300 bg-[#3d444d] hover:bg-[#4d555e] data-[state=active]:bg-blue-500 data-[state=active]:text-white gap-2 border border-gray-500 data-[state=active]:border-blue-500"
                      >
                        <Cloud className="h-4 w-4" />
                        Weather
                      </TabsTrigger>
                      <TabsTrigger 
                        value="field" 
                        className="text-gray-300 bg-[#3d444d] hover:bg-[#4d555e] data-[state=active]:bg-green-500 data-[state=active]:text-white gap-2 border border-gray-500 data-[state=active]:border-green-500"
                      >
                        <Smartphone className="h-4 w-4" />
                        Field View
                      </TabsTrigger>
                      <TabsTrigger 
                        value="ai-coach" 
                        className="text-gray-300 bg-[#3d444d] hover:bg-[#4d555e] data-[state=active]:bg-purple-600 data-[state=active]:text-white gap-2 border border-gray-500 data-[state=active]:border-purple-500"
                      >
                        <Brain className="h-4 w-4" />
                        AI Coach
                      </TabsTrigger>
                    </TabsList>
                    
                    {/* Baseline & Actuals Management */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-[#3d444d] border-gray-500 text-gray-200 hover:bg-[#4d555e] hover:border-gray-400"
                          disabled={baselineLoading}
                        >
                          {baselineLoading ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin text-orange-400" />
                          ) : (
                            <Bookmark className="h-4 w-4 mr-2 text-blue-400" />
                          )}
                          Baseline & Actuals
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#2d333b] border-gray-700">
                        <DropdownMenuItem 
                          onClick={handleSetBaseline}
                          className="text-gray-200 hover:bg-[#1F2328] cursor-pointer"
                        >
                          <Bookmark className="h-4 w-4 mr-2 text-blue-400" />
                          Set Baseline
                          <span className="text-xs text-gray-500 ml-2">Snapshot current schedule</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-700" />
                        <DropdownMenuItem 
                          onClick={handleBackfillActuals}
                          className="text-gray-200 hover:bg-[#1F2328] cursor-pointer"
                        >
                          <History className="h-4 w-4 mr-2 text-emerald-400" />
                          Backfill from Daily Reports
                          <span className="text-xs text-gray-500 ml-2">Extract actual dates</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Gantt Tab */}
                  <TabsContent value="gantt" className="mt-4">
                    <GanttChart
                      tasks={filteredTasks}
                      milestones={milestones}
                      onTaskClick={handleTaskClick}
                      onTaskUpdate={handleUpdateTask}
                      showCriticalPath={true}
                    />
                    {filteredTasks.length !== tasks.length && (
                      <p className="text-sm text-gray-500 mt-2">
                        Showing {filteredTasks.length} of {tasks.length} tasks
                      </p>
                    )}
                  </TabsContent>

                  {/* 3-Week Lookahead Tab */}
                  <TabsContent value="lookahead" className="mt-4">
                    <ThreeWeekLookahead
                      projectSlug={slug}
                      onTaskClick={(taskId) => {
                        const task = tasks.find(t => t.id === taskId);
                        if (task) {
                          setSelectedTask(task);
                          setShowTaskModal(true);
                        }
                      }}
                    />
                  </TabsContent>

                  {/* Analysis Tab */}
                  <TabsContent value="analysis" className="mt-4 space-y-6">
                    {/* Resource Histogram - Labor and Equipment allocation */}
                    {resourceLoading ? (
                      <Card className="bg-[#2d333b] border-gray-700 p-8 flex items-center justify-center">
                        <div className="flex items-center gap-3 text-gray-400">
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          <span>Loading resource data...</span>
                        </div>
                      </Card>
                    ) : resourceData ? (
                      <>
                        <ResourceHistogram
                          laborEntries={resourceData.laborEntries}
                          equipmentEntries={resourceData.equipmentEntries}
                          taskResources={resourceData.taskResources}
                          startDate={resourceData.projectStartDate}
                          endDate={resourceData.projectEndDate}
                        />
                        
                        {/* Earned Value Chart - S-Curve Analysis */}
                        <EarnedValueChart
                          tasks={resourceData.evTasks}
                          costEntries={resourceData.costEntries}
                          projectStartDate={resourceData.projectStartDate}
                          projectEndDate={resourceData.projectEndDate}
                          projectBudget={resourceData.projectBudget}
                        />
                      </>
                    ) : (
                      <Card className="bg-[#2d333b] border-gray-700 p-8 text-center">
                        <BarChart3 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">
                          No resource data available. Submit daily reports to track labor and equipment usage.
                        </p>
                      </Card>
                    )}
                    
                    {/* Trade Clarification Panel */}
                    <TradeClarificationPanel 
                      projectSlug={slug} 
                      onUpdate={() => selectedSchedule && loadTasks(selectedSchedule.id)}
                    />
                    
                    {/* Schedule Summary */}
                    <Card className="bg-[#2d333b] border-gray-700 p-6">
                      <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                        <ListTodo className="h-5 w-5 text-orange-500" />
                        Task Summary
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
                          <p className="text-sm text-gray-400">Total Tasks</p>
                          <p className="text-2xl font-bold text-gray-200">{tasks.length}</p>
                        </div>
                        <div className="bg-[#1F2328] rounded-lg p-4 border border-green-500/30">
                          <p className="text-sm text-gray-400">Completed</p>
                          <p className="text-2xl font-bold text-green-400">
                            {tasks.filter(t => t.status === 'completed').length}
                          </p>
                        </div>
                        <div className="bg-[#1F2328] rounded-lg p-4 border border-blue-500/30">
                          <p className="text-sm text-gray-400">In Progress</p>
                          <p className="text-2xl font-bold text-blue-400">
                            {tasks.filter(t => t.status === 'in_progress').length}
                          </p>
                        </div>
                        <div className="bg-[#1F2328] rounded-lg p-4 border border-red-500/30">
                          <p className="text-sm text-gray-400">Delayed</p>
                          <p className="text-2xl font-bold text-red-400">
                            {tasks.filter(t => t.status === 'delayed').length}
                          </p>
                        </div>
                      </div>
                      
                      {/* Critical Path Summary */}
                      <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-5 w-5 text-red-400" />
                          <h4 className="font-medium text-red-400">Critical Path</h4>
                        </div>
                        <p className="text-sm text-gray-300">
                          {tasks.filter(t => t.isCritical).length} tasks on critical path
                          {tasks.filter(t => t.isCritical && t.status === 'delayed').length > 0 && (
                            <span className="text-red-400 font-medium ml-2">
                              ({tasks.filter(t => t.isCritical && t.status === 'delayed').length} delayed!)
                            </span>
                          )}
                        </p>
                      </div>
                    </Card>
                  </TabsContent>

                  {/* Health Check Tab */}
                  <TabsContent value="health" className="mt-4">
                    <ScheduleHealthAnalyzer projectSlug={slug} />
                  </TabsContent>

                  {/* Weather Tab */}
                  <TabsContent value="weather" className="mt-4 space-y-6">
                    {/* Weather Forecast Overlay */}
                    <WeatherScheduleOverlay
                      projectSlug={slug}
                      tasks={tasks.map(t => ({
                        id: t.id,
                        name: t.name,
                        startDate: t.startDate,
                        endDate: t.endDate,
                        status: t.status,
                        isCritical: t.isCritical,
                        isOutdoorTask: true, // Assume outdoor unless specified
                        location: t.location,
                        percentComplete: t.percentComplete
                      } as WeatherScheduleTask))}
                      startDate={selectedSchedule ? new Date(selectedSchedule.startDate) : undefined}
                      endDate={selectedSchedule ? new Date(selectedSchedule.endDate) : undefined}
                    />
                    
                    {/* Delay Impact Analyzer */}
                    <DelayImpactAnalyzer
                      projectSlug={slug}
                      tasks={tasks.map(t => ({
                        id: t.id,
                        taskId: t.taskId,
                        name: t.name,
                        startDate: t.startDate,
                        endDate: t.endDate,
                        baselineStartDate: t.baselineStartDate,
                        baselineEndDate: t.baselineEndDate,
                        actualStartDate: t.actualStartDate,
                        actualEndDate: t.actualEndDate,
                        status: t.status,
                        isCritical: t.isCritical,
                        percentComplete: t.percentComplete,
                        totalFloat: t.totalFloat
                      } as DelayScheduleTask))}
                      projectStartDate={selectedSchedule ? new Date(selectedSchedule.startDate) : undefined}
                      projectEndDate={selectedSchedule ? new Date(selectedSchedule.endDate) : undefined}
                    />
                  </TabsContent>

                  {/* Field View Tab - Mobile Optimized */}
                  <TabsContent value="field" className="mt-4">
                    <MobileFieldView
                      projectSlug={slug}
                      scheduleId={selectedSchedule?.id}
                      tasks={tasks.map(t => ({
                        id: t.id,
                        taskId: t.taskId,
                        name: t.name,
                        description: t.description,
                        startDate: t.startDate,
                        endDate: t.endDate,
                        percentComplete: t.percentComplete,
                        status: t.status as FieldTask['status'],
                        isCritical: t.isCritical,
                        assignedTo: t.assignedTo,
                        location: t.location,
                        subcontractor: t.subcontractor,
                        actualStartDate: t.actualStartDate,
                        actualEndDate: t.actualEndDate
                      }))}
                      onTaskUpdate={async (taskId, updates) => {
                        const response = await fetch(`/api/projects/${slug}/schedules/tasks/${taskId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(updates)
                        });
                        if (!response.ok) {
                          throw new Error('Failed to update task');
                        }
                        // Reload tasks after update
                        if (selectedSchedule) {
                          loadTasks(selectedSchedule.id);
                        }
                      }}
                      onRefresh={() => {
                        if (selectedSchedule) {
                          loadTasks(selectedSchedule.id);
                        }
                      }}
                    />
                  </TabsContent>

                  {/* AI Coach Tab */}
                  <TabsContent value="ai-coach" className="mt-4">
                    <ScheduleAICoach
                      projectSlug={slug}
                      scheduleId={selectedSchedule?.id}
                      tasks={tasks}
                      onTasksAdded={() => {
                        if (selectedSchedule) {
                          loadTasks(selectedSchedule.id);
                        }
                        loadSchedules();
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}

        {/* Keyboard Shortcuts Help */}
        <KeyboardShortcutsHelp 
          open={showKeyboardHelp} 
          onOpenChange={setShowKeyboardHelp} 
        />

        {/* Floating Action Button */}
        <ScheduleFAB
          onAddTask={() => {
            // Create a new empty task for editing
            setSelectedTask({
              id: '',
              taskId: `NEW-${Date.now()}`,
              name: '',
              description: '',
              startDate: new Date().toISOString(),
              endDate: new Date().toISOString(),
              duration: 1,
              percentComplete: 0,
              status: 'not_started',
              isCritical: false,
              predecessors: [],
              successors: [],
            });
            setShowTaskModal(true);
          }}
          onJumpToToday={() => {
            // Switch to Gantt tab and scroll to today
            setActiveTab('gantt');
            toast.success('Jumped to today\'s date');
          }}
          onExportGantt={async () => {
            toast.loading('Exporting Gantt chart...');
            try {
              // Simple export - trigger print
              window.print();
              toast.success('Gantt export initiated');
            } catch (error) {
              toast.error('Failed to export Gantt chart');
            }
          }}
          onExportLookahead={async () => {
            setActiveTab('lookahead');
            toast.info('Switch to 3-Week Lookahead tab to export');
          }}
          onRefresh={() => {
            loadSchedules();
            if (selectedSchedule) {
              loadTasks(selectedSchedule.id);
            }
            toast.success('Schedule data refreshed');
          }}
        />

        {/* Task Update Modal */}
        {selectedTask && (
          <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
            <DialogContent className="bg-[#2d333b] border-gray-700 text-gray-100">
              <DialogHeader>
                <DialogTitle>{selectedTask.taskId}: {selectedTask.name}</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Update task progress, status, and details
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Progress */}
                <div>
                  <Label>Progress (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={selectedTask.percentComplete}
                    onChange={(e) => {
                      selectedTask.percentComplete = parseFloat(e.target.value);
                    }}
                    className="bg-[#1F2328] border-gray-700 text-gray-100"
                  />
                </div>

                {/* Status */}
                <div>
                  <Label>Status</Label>
                  <Select
                    defaultValue={selectedTask.status}
                    onValueChange={(value) => {
                      selectedTask.status = value;
                    }}
                  >
                    <SelectTrigger className="bg-[#1F2328] border-gray-700 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2d333b] border-gray-700">
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="delayed">Delayed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div>
                  <Label>Location</Label>
                  <Input
                    defaultValue={selectedTask.location || ''}
                    onChange={(e) => {
                      selectedTask.location = e.target.value;
                    }}
                    placeholder="e.g., Building A - Floor 2"
                    className="bg-[#1F2328] border-gray-700 text-gray-100"
                  />
                </div>

                {/* Assigned To Subcontractor */}
                <div>
                  <Label>Assigned To Subcontractor/Company</Label>
                  <Select
                    defaultValue={selectedTask.subcontractorId || 'none'}
                    onValueChange={(value) => {
                      if (value === 'none') {
                        selectedTask.subcontractorId = undefined;
                        selectedTask.assignedTo = undefined;
                      } else {
                        selectedTask.subcontractorId = value;
                        const sub = subcontractors.find(s => s.id === value);
                        selectedTask.assignedTo = sub?.companyName;
                      }
                    }}
                  >
                    <SelectTrigger className="bg-[#1F2328] border-gray-700 text-gray-100">
                      <SelectValue placeholder="Select subcontractor..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2d333b] border-gray-700 max-h-[300px]">
                      <SelectItem value="none">
                        <span className="text-gray-400">No assignment</span>
                      </SelectItem>
                      {subcontractors.filter(s => s.isActive).map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          <span className="font-medium">{formatSubcontractorName(sub)}</span>
                        </SelectItem>
                      ))}
                      {subcontractors.filter(s => s.isActive).length === 0 && (
                        <div className="px-2 py-3 text-sm text-gray-400 text-center">
                          No active subcontractors found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedTask.subcontractor && (
                    <p className="text-xs text-orange-400 mt-1">
                      Currently: {formatTrade(selectedTask.subcontractor.tradeType)} - {selectedTask.subcontractor.companyName}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowTaskModal(false)}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleUpdateTask(selectedTask.taskId, {
                    percentComplete: selectedTask.percentComplete,
                    status: selectedTask.status,
                    location: selectedTask.location,
                    assignedTo: selectedTask.assignedTo,
                    subcontractorId: selectedTask.subcontractorId
                  })}
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Update Task'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
