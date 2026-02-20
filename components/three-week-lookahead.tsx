'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { QuickActionMenu } from '@/components/ui/header-action-menu';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  Plus,
  CloudRain,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import {
  format,
  addWeeks,
  startOfWeek,
  addDays,
  parseISO,
  isWithinInterval
} from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
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

interface Task {
  id: string;
  taskId?: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed' | 'weather-day' | 'meeting';
  trade?: string;
  subcontractorId?: string;
  subcontractor?: {
    id: string;
    companyName: string;
    tradeType: string;
  };
  percentComplete?: number;
  budgetedCost?: number;
  actualCost?: number;
  budgetItemId?: string;
  budgetItemName?: string;
}

interface WeatherDay {
  date: string;
  condition: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';
  temp: number;
  workImpact: 'none' | 'low' | 'moderate' | 'high' | 'severe';
  icon: string;
}

interface Subcontractor {
  id: string;
  companyName: string;
  tradeType: string;
}

interface ThreeWeekLookaheadProps {
  projectSlug: string;
  onTaskClick?: (taskId: string) => void;
}

type TaskStatus = Task['status'];

const STATUS_COLORS: Record<TaskStatus, { bg: string; text: string; label: string }> = {
  'completed': { bg: 'bg-green-600', text: 'text-white', label: 'Projected and Completed' },
  'in-progress': { bg: 'bg-yellow-500', text: 'text-black', label: 'Projected not Completed' },
  'not-started': { bg: 'bg-blue-600', text: 'text-white', label: 'Not Started' },
  'meeting': { bg: 'bg-purple-600', text: 'text-white', label: 'Zoom Subcontractor Meeting' },
  'weather-day': { bg: 'bg-gray-500', text: 'text-white', label: 'Weather Day' },
  'delayed': { bg: 'bg-red-600', text: 'text-white', label: 'Delayed' }
};

const DAY_HEADERS = ['M', 'T', 'W', 'TH', 'F', 'Sa', 'Su'];

export default function ThreeWeekLookahead({ projectSlug, onTaskClick }: ThreeWeekLookaheadProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [projectName, setProjectName] = useState('');
  const [jobNumber, setJobNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [onDeckNotes, setOnDeckNotes] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showWeather, setShowWeather] = useState(true);
  const [showCosts, setShowCosts] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherDay[]>([]);
  const [editingProgress, setEditingProgress] = useState<string | null>(null);
  const [autoRoll, setAutoRoll] = useState(true);
  const [newTask, setNewTask] = useState({
    name: '',
    subcontractorId: '',
    startDate: '',
    endDate: '',
    status: 'not-started' as TaskStatus,
    percentComplete: 0
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);
  
  // Toggle group collapse state
  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };
  
  // Expand/collapse all groups
  const expandAllGroups = () => setCollapsedGroups(new Set());
  const collapseAllGroups = (groupIds: string[]) => setCollapsedGroups(new Set(groupIds));
  
  // Auto-roll to current week on mount and weekly
  useEffect(() => {
    if (autoRoll) {
      const today = new Date();
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
      setStartDate(currentWeekStart);
    }
  }, [autoRoll]);

  useEffect(() => {
    fetchData();
    fetchWeather();
  }, [projectSlug, startDate]);

  const fetchWeather = async () => {
    try {
      const endDate = addWeeks(startDate, 3);
      const res = await fetch(`/api/projects/${projectSlug}/weather?start=${startDate.toISOString()}&end=${endDate.toISOString()}`);
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data.forecast || []);
      } else {
        // Generate mock weather data
        const mockWeather: WeatherDay[] = [];
        const conditions: WeatherDay['condition'][] = ['clear', 'cloudy', 'clear', 'rain', 'clear', 'cloudy', 'clear'];
        for (let i = 0; i < 21; i++) {
          const date = addDays(startDate, i);
          const condition = conditions[i % 7];
          mockWeather.push({
            date: date.toISOString().split('T')[0],
            condition,
            temp: 55 + Math.random() * 30,
            workImpact: condition === 'rain' ? 'moderate' : condition === 'storm' ? 'high' : 'none',
            icon: condition === 'clear' ? '☀️' : condition === 'rain' ? '🌧️' : condition === 'cloudy' ? '☁️' : '🌤️'
          });
        }
        setWeatherData(mockWeather);
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
    }
  };

  const updateTaskProgress = async (taskId: string, percentComplete: number) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/schedule/tasks/${taskId}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentComplete })
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, percentComplete } : t));
        toast.success('Progress updated');
      }
    } catch (error) {
      toast.error('Failed to update progress');
    }
    setEditingProgress(null);
  };

  const getWeatherForDate = (date: Date): WeatherDay | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return weatherData.find(w => w.date === dateStr);
  };

  const getWeatherImpactClass = (impact: WeatherDay['workImpact']): string => {
    switch (impact) {
      case 'severe': return 'bg-red-500/30 border-red-500';
      case 'high': return 'bg-orange-500/30 border-orange-500';
      case 'moderate': return 'bg-yellow-500/30 border-yellow-500';
      case 'low': return 'bg-blue-500/20 border-blue-500';
      default: return '';
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch project info
      const projectRes = await fetch(`/api/projects/${projectSlug}`);
      if (projectRes.ok) {
        const project = await projectRes.json();
        setProjectName(project.name || projectSlug);
        setJobNumber(project.jobNumber || '');
      }

      // Fetch subcontractors
      const subRes = await fetch(`/api/projects/${projectSlug}/subcontractors`);
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubcontractors(subData.subcontractors || []);
      }

      // Fetch tasks for 3-week period
      const endDate = addWeeks(startDate, 3);
      const tasksRes = await fetch(
        `/api/projects/${projectSlug}/schedule-lookahead?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
      );
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load 3-week lookahead');
    } finally {
      setLoading(false);
    }
  };

  // Get dates for each week
  const getWeekDates = (weekOffset: number) => {
    const weekStart = addWeeks(startDate, weekOffset);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  };

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

  // Group tasks by subcontractor/trade
  const getTasksBySubcontractor = () => {
    const grouped: Map<string, { name: string; tasks: Task[] }> = new Map();
    
    // Add "General" group for unassigned tasks
    grouped.set('general', { name: 'General Contractor', tasks: [] });
    
    // Add all subcontractors with "Trade - Sub" format
    subcontractors.forEach(sub => {
      grouped.set(sub.id, { name: formatSubcontractorName(sub), tasks: [] });
    });
    
    // Group tasks
    tasks.forEach(task => {
      const key = task.subcontractorId || task.subcontractor?.id || 'general';
      if (grouped.has(key)) {
        grouped.get(key)!.tasks.push(task);
      } else if (task.subcontractor) {
        // Task has subcontractor info but wasn't in our list
        const formattedName = `${formatTrade(task.subcontractor.tradeType)} - ${task.subcontractor.companyName}`;
        if (!grouped.has(task.subcontractor.id)) {
          grouped.set(task.subcontractor.id, { name: formattedName, tasks: [] });
        }
        grouped.get(task.subcontractor.id)!.tasks.push(task);
      } else if (task.trade) {
        // Use trade name if no subcontractor
        const tradeName = formatTrade(task.trade);
        if (!grouped.has(task.trade)) {
          grouped.set(task.trade, { name: tradeName, tasks: [] });
        }
        grouped.get(task.trade)!.tasks.push(task);
      } else {
        grouped.get('general')!.tasks.push(task);
      }
    });
    
    // Filter out empty groups (except general)
    return Array.from(grouped.entries())
      .filter(([key, group]) => group.tasks.length > 0 || key === 'general')
      .map(([key, group]) => ({ id: key, ...group }));
  };

  // Check if task is scheduled on a specific date
  const isTaskOnDate = (task: Task, date: Date) => {
    const taskStart = parseISO(task.startDate);
    const taskEnd = parseISO(task.endDate);
    return isWithinInterval(date, { start: taskStart, end: taskEnd });
  };

  // Get cell content (X or status marker)
  const getCellContent = (task: Task, date: Date) => {
    if (!isTaskOnDate(task, date)) return null;
    
    const statusConfig = STATUS_COLORS[task.status] || STATUS_COLORS['not-started'];
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${statusConfig.bg} ${statusConfig.text} font-bold text-xs cursor-pointer hover:opacity-80`}
        onClick={(e) => {
          e.stopPropagation();
          onTaskClick?.(task.id);
        }}
      >
        X
      </div>
    );
  };

  // Export to CSV (Excel-compatible)
  const handleExportCSV = () => {
    const groups = getTasksBySubcontractor();
    const week1 = getWeekDates(0);
    const week2 = getWeekDates(1);
    const week3 = getWeekDates(2);
    
    // Build CSV
    const rows: string[][] = [];
    
    // Header rows
    rows.push([`JOB #: ${jobNumber} - ${projectName}`]);
    rows.push([]);
    rows.push(['', 'Projected and Completed']);
    rows.push(['', 'Projected not Completed']);
    rows.push(['', 'Zoom Subcontractor Meeting']);
    rows.push(['', 'Weather Day']);
    rows.push([]);
    
    // Week headers
    const weekHeader = [
      'Description of Work', '', '', '', '', '', '', '',
      `Week 1 Start Date: `, '', '', '', format(week1[0], 'MM/dd'), '-', format(week1[6], 'MM/dd'),
      `Week 2 Start Date: `, '', '', '', format(week2[0], 'MM/dd'), '-', format(week2[6], 'MM/dd'),
      `Week 3 Start Date: `, '', '', '', format(week3[0], 'MM/dd'), '-', format(week3[6], 'MM/dd')
    ];
    rows.push(weekHeader);
    
    // Day headers
    const dayRow = [
      '', '', '', '', '', '', '', '',
      ...DAY_HEADERS,
      ...DAY_HEADERS,
      ...DAY_HEADERS
    ];
    rows.push(dayRow);
    
    // Tasks by subcontractor
    groups.forEach(group => {
      // Subcontractor header with dates
      const subHeader = [
        group.name, '', '', '', '', '', '', '',
        ...week1.map(d => format(d, 'MM/dd')),
        ...week2.map(d => format(d, 'MM/dd')),
        ...week3.map(d => format(d, 'MM/dd'))
      ];
      rows.push(subHeader);
      
      // Tasks
      group.tasks.forEach(task => {
        const taskRow = [
          task.name, '', '', '', '', '', '', '',
          ...week1.map(d => isTaskOnDate(task, d) ? 'X' : ''),
          ...week2.map(d => isTaskOnDate(task, d) ? 'X' : ''),
          ...week3.map(d => isTaskOnDate(task, d) ? 'X' : '')
        ];
        rows.push(taskRow);
      });
      
      rows.push([]); // Empty row between groups
    });
    
    // Notes
    rows.push([]);
    rows.push(['Notes', '', '', '', '', '', '', '', 'On-deck']);
    rows.push([notes, '', '', '', '', '', '', '', onDeckNotes]);
    
    // Convert to CSV
    const csv = rows.map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3-week-lookahead-${projectSlug}-${format(startDate, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('3-week lookahead exported to CSV');
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Add new task
  const handleAddTask = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/schedule/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTask.name,
          startDate: newTask.startDate,
          endDate: newTask.endDate,
          status: newTask.status,
          subcontractorId: newTask.subcontractorId || undefined
        })
      });
      
      if (!res.ok) throw new Error('Failed to add task');
      
      toast.success('Task added');
      setShowAddModal(false);
      setNewTask({ name: '', subcontractorId: '', startDate: '', endDate: '', status: 'not-started', percentComplete: 0 });
      fetchData();
    } catch (error) {
      toast.error('Failed to add task');
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-dark-surface border-gray-700">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
          <span className="ml-2 text-gray-400">Loading 3-week lookahead...</span>
        </div>
      </Card>
    );
  }

  const groups = getTasksBySubcontractor();
  const week1Dates = getWeekDates(0);
  const week2Dates = getWeekDates(1);
  const week3Dates = getWeekDates(2);

  return (
    <Card className="bg-dark-surface border-gray-700 overflow-hidden">
      {/* Header Controls (not printed) */}
      <div className="p-4 border-b border-gray-700 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStartDate(addWeeks(startDate, -3))}
            className="border-gray-600 text-gray-200 hover:bg-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="border-gray-600 text-gray-200 hover:bg-gray-700"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStartDate(addWeeks(startDate, 3))}
            className="border-gray-600 text-gray-200 hover:bg-gray-700"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          {/* Rolling Date Toggle */}
          <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-gray-800/50 rounded">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRoll}
                onChange={(e) => setAutoRoll(e.target.checked)}
                className="rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-xs text-gray-400">Auto-roll weekly</span>
            </label>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Weather Toggle */}
          <Button
            variant={showWeather ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowWeather(!showWeather)}
            className={showWeather ? 'bg-blue-600' : 'border-gray-600 text-gray-200'}
          >
            <CloudRain className="h-4 w-4 mr-1" />
            Weather
          </Button>
          
          {/* Costs Toggle */}
          <Button
            variant={showCosts ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowCosts(!showCosts)}
            className={showCosts ? 'bg-green-600' : 'border-gray-600 text-gray-200'}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Costs
          </Button>
          
          {/* Tasks Dropdown */}
          <QuickActionMenu
            label="Tasks"
            icon={Plus}
            variant="outline"
            items={[
              { id: 'add-task', label: 'Add Task', icon: Plus, onClick: () => setShowAddModal(true) },
              { id: 'import-csv', label: 'Import from CSV', icon: Upload, onClick: () => setShowImportModal(true) },
            ]}
          />
          
          {/* Export Dropdown */}
          <QuickActionMenu
            label="Export"
            icon={Download}
            variant="outline"
            items={[
              { id: 'export-csv', label: 'Export to CSV', icon: FileSpreadsheet, onClick: handleExportCSV, variant: 'success' },
              { id: 'print', label: 'Print Schedule', icon: Printer, onClick: handlePrint },
            ]}
          />
          
          {/* Expand/Collapse All */}
          <div className="flex items-center gap-1 border-l border-gray-600 pl-3 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={expandAllGroups}
              className="text-gray-300 hover:text-white px-2"
              title="Expand all groups"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const groups = getTasksBySubcontractor();
                collapseAllGroups(groups.map(g => g.id));
              }}
              className="text-gray-300 hover:text-white px-2"
              title="Collapse all groups"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Content */}
      <div ref={printRef} className="p-4 print:p-2 print:text-black print:bg-white">
        {/* Job Header */}
        <div className="text-center mb-4 print:mb-2">
          <h2 className="text-lg font-bold text-white print:text-black">
            JOB #: {jobNumber || 'N/A'} - {projectName}
          </h2>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 print:mb-2 print:gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-green-600 print:border print:border-green-600"></div>
            <span className="text-sm text-gray-300 print:text-black">Projected and Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-yellow-500 print:border print:border-yellow-500"></div>
            <span className="text-sm text-gray-300 print:text-black">Projected not Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-purple-600 print:border print:border-purple-600"></div>
            <span className="text-sm text-gray-300 print:text-black">Zoom Subcontractor Meeting</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-gray-500 print:border print:border-gray-500"></div>
            <span className="text-sm text-gray-300 print:text-black">Weather Day</span>
          </div>
        </div>

        {/* Main Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs print:text-[10px]">
            <thead>
              {/* Week Headers Row */}
              <tr className="bg-dark-card print:bg-gray-100">
                <th className="border border-gray-600 print:border-gray-400 p-2 text-left w-48 text-white print:text-black">
                  Description of Work
                </th>
                <th colSpan={7} className="border border-gray-600 print:border-gray-400 p-2 text-center bg-blue-900/30 print:bg-blue-100 text-white print:text-black">
                  <div>Week 1</div>
                  <div className="text-xs font-normal">{format(week1Dates[0], 'MM/dd')} - {format(week1Dates[6], 'MM/dd')}</div>
                </th>
                <th colSpan={7} className="border border-gray-600 print:border-gray-400 p-2 text-center bg-indigo-900/30 print:bg-indigo-100 text-white print:text-black">
                  <div>Week 2</div>
                  <div className="text-xs font-normal">{format(week2Dates[0], 'MM/dd')} - {format(week2Dates[6], 'MM/dd')}</div>
                </th>
                <th colSpan={7} className="border border-gray-600 print:border-gray-400 p-2 text-center bg-purple-900/30 print:bg-purple-100 text-white print:text-black">
                  <div>Week 3</div>
                  <div className="text-xs font-normal">{format(week3Dates[0], 'MM/dd')} - {format(week3Dates[6], 'MM/dd')}</div>
                </th>
              </tr>
              {/* Day Headers Row */}
              <tr className="bg-dark-surface print:bg-white">
                <th className="border border-gray-600 print:border-gray-400 p-1"></th>
                {DAY_HEADERS.map((day, i) => (
                  <th key={`w1-${i}`} className="border border-gray-600 print:border-gray-400 p-1 text-center text-gray-300 print:text-black w-8">
                    {day}
                  </th>
                ))}
                {DAY_HEADERS.map((day, i) => (
                  <th key={`w2-${i}`} className="border border-gray-600 print:border-gray-400 p-1 text-center text-gray-300 print:text-black w-8">
                    {day}
                  </th>
                ))}
                {DAY_HEADERS.map((day, i) => (
                  <th key={`w3-${i}`} className="border border-gray-600 print:border-gray-400 p-1 text-center text-gray-300 print:text-black w-8">
                    {day}
                  </th>
                ))}
              </tr>
              {/* Date Numbers Row */}
              <tr className="bg-dark-card print:bg-gray-50">
                <th className="border border-gray-600 print:border-gray-400 p-1"></th>
                {week1Dates.map((date, i) => (
                  <th key={`d1-${i}`} className="border border-gray-600 print:border-gray-400 p-1 text-center text-gray-400 print:text-gray-600 text-[10px]">
                    {format(date, 'M/d')}
                  </th>
                ))}
                {week2Dates.map((date, i) => (
                  <th key={`d2-${i}`} className="border border-gray-600 print:border-gray-400 p-1 text-center text-gray-400 print:text-gray-600 text-[10px]">
                    {format(date, 'M/d')}
                  </th>
                ))}
                {week3Dates.map((date, i) => (
                  <th key={`d3-${i}`} className="border border-gray-600 print:border-gray-400 p-1 text-center text-gray-400 print:text-gray-600 text-[10px]">
                    {format(date, 'M/d')}
                  </th>
                ))}
              </tr>
              {/* Weather Row */}
              {showWeather && weatherData.length > 0 && (
                <tr className="bg-dark-surface print:bg-gray-100">
                  <th className="border border-gray-600 print:border-gray-400 p-1 text-xs text-gray-400">
                    <CloudRain className="h-3 w-3 inline mr-1" />
                    Weather
                  </th>
                  {[...week1Dates, ...week2Dates, ...week3Dates].map((date, i) => {
                    const weather = getWeatherForDate(date);
                    return (
                      <th 
                        key={`weather-${i}`} 
                        className={`border border-gray-600 print:border-gray-400 p-1 text-center text-xs ${
                          weather && weather.workImpact !== 'none' ? getWeatherImpactClass(weather.workImpact) : ''
                        }`}
                        title={weather ? `${weather.condition} - ${Math.round(weather.temp)}°F - Impact: ${weather.workImpact}` : ''}
                      >
                        {weather?.icon || ''}
                      </th>
                    );
                  })}
                </tr>
              )}
            </thead>
            <tbody>
              {groups.map((group) => {
                const isCollapsed = collapsedGroups.has(group.id);
                return (
                <>
                  {/* Subcontractor Header - Collapsible */}
                  <tr 
                    key={`${group.id}-header`} 
                    className="bg-gray-700 print:bg-gray-200 cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => toggleGroupCollapse(group.id)}
                  >
                    <td className="border border-gray-600 print:border-gray-400 p-2 font-bold text-blue-400 print:text-blue-800">
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        )}
                        <span>{group.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs text-gray-400 border-gray-500">
                          {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </td>
                    {[...week1Dates, ...week2Dates, ...week3Dates].map((date, i) => (
                      <td key={`${group.id}-date-${i}`} className="border border-gray-600 print:border-gray-400 p-1 text-center text-gray-400 print:text-gray-400 text-[10px]">
                        {format(date, 'M/d')}
                      </td>
                    ))}
                  </tr>
                  {/* Tasks - Only show if not collapsed */}
                  {!isCollapsed && group.tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-dark-card print:hover:bg-transparent group">
                      <td className="border border-gray-600 print:border-gray-400 p-2 text-white print:text-black">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{task.name}</span>
                          {/* Percent Complete Entry */}
                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            {editingProgress === task.id ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                defaultValue={task.percentComplete || 0}
                                className="w-12 px-1 py-0.5 text-xs bg-gray-700 border border-gray-500 rounded text-center"
                                autoFocus
                                onBlur={(e) => updateTaskProgress(task.id, parseInt(e.target.value) || 0)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateTaskProgress(task.id, parseInt((e.target as HTMLInputElement).value) || 0);
                                  }
                                  if (e.key === 'Escape') setEditingProgress(null);
                                }}
                              />
                            ) : (
                              <button
                                onClick={() => setEditingProgress(task.id)}
                                className={`px-1.5 py-0.5 text-xs rounded ${
                                  (task.percentComplete || 0) === 100 
                                    ? 'bg-green-600 text-white' 
                                    : (task.percentComplete || 0) > 0 
                                      ? 'bg-yellow-600 text-white' 
                                      : 'bg-gray-600 text-gray-300'
                                }`}
                                title="Click to edit progress"
                              >
                                {task.percentComplete || 0}%
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      {week1Dates.map((date, i) => {
                        const weather = showWeather ? getWeatherForDate(date) : null;
                        return (
                          <td 
                            key={`${task.id}-w1-${i}`} 
                            className={`border border-gray-600 print:border-gray-400 p-0 h-6 w-8 ${
                              weather && weather.workImpact !== 'none' ? getWeatherImpactClass(weather.workImpact) : ''
                            }`}
                          >
                            {getCellContent(task, date)}
                          </td>
                        );
                      })}
                      {week2Dates.map((date, i) => {
                        const weather = showWeather ? getWeatherForDate(date) : null;
                        return (
                          <td 
                            key={`${task.id}-w2-${i}`} 
                            className={`border border-gray-600 print:border-gray-400 p-0 h-6 w-8 ${
                              weather && weather.workImpact !== 'none' ? getWeatherImpactClass(weather.workImpact) : ''
                            }`}
                          >
                            {getCellContent(task, date)}
                          </td>
                        );
                      })}
                      {week3Dates.map((date, i) => {
                        const weather = showWeather ? getWeatherForDate(date) : null;
                        return (
                          <td 
                            key={`${task.id}-w3-${i}`} 
                            className={`border border-gray-600 print:border-gray-400 p-0 h-6 w-8 ${
                              weather && weather.workImpact !== 'none' ? getWeatherImpactClass(weather.workImpact) : ''
                            }`}
                          >
                            {getCellContent(task, date)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Empty row if no tasks and not collapsed */}
                  {!isCollapsed && group.tasks.length === 0 && (
                    <tr key={`${group.id}-empty`}>
                      <td className="border border-gray-600 print:border-gray-400 p-2 text-gray-400 italic">
                        No tasks scheduled
                      </td>
                      {[...Array(21)].map((_, i) => (
                        <td key={`empty-${i}`} className="border border-gray-600 print:border-gray-400"></td>
                      ))}
                    </tr>
                  )}
                </>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Notes Section */}
        <div className="mt-4 grid grid-cols-2 gap-4 print:mt-2 print:gap-2">
          <div>
            <h4 className="font-bold text-white print:text-black mb-2">Notes</h4>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="General notes for the 3-week lookahead..."
              className="bg-dark-card border-gray-600 text-white print:bg-white print:text-black print:border-gray-400 min-h-[100px]"
            />
          </div>
          <div>
            <h4 className="font-bold text-white print:text-black mb-2">On-Deck</h4>
            <Textarea
              value={onDeckNotes}
              onChange={(e) => setOnDeckNotes(e.target.value)}
              placeholder="Upcoming work and subcontractors on-deck..."
              className="bg-dark-card border-gray-600 text-white print:bg-white print:text-black print:border-gray-400 min-h-[100px]"
            />
          </div>
        </div>
      </div>

      {/* Cost Summary Section */}
      {showCosts && (
        <div className="mt-4 p-4 bg-dark-card rounded-lg print:bg-gray-100 print:border print:border-gray-300">
          <h4 className="font-bold text-white print:text-black mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-400 print:text-green-600" />
            3-Week Cost Forecast
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              // Calculate totals from tasks
              const totalBudgeted = tasks.reduce((sum, t) => sum + (t.budgetedCost || 0), 0);
              const totalActual = tasks.reduce((sum, t) => sum + (t.actualCost || 0), 0);
              const variance = totalBudgeted - totalActual;
              const tasksWithCosts = tasks.filter(t => t.budgetedCost || t.actualCost).length;
              
              return (
                <>
                  <div className="bg-dark-surface rounded p-3 print:bg-white print:border print:border-gray-200">
                    <p className="text-xs text-gray-400 print:text-gray-600">Budgeted Cost</p>
                    <p className="text-xl font-bold text-blue-400 print:text-blue-600">
                      ${totalBudgeted.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400">{tasksWithCosts} tasks with budget</p>
                  </div>
                  <div className="bg-dark-surface rounded p-3 print:bg-white print:border print:border-gray-200">
                    <p className="text-xs text-gray-400 print:text-gray-600">Actual Cost</p>
                    <p className="text-xl font-bold text-green-400 print:text-green-600">
                      ${totalActual.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400">Incurred to date</p>
                  </div>
                  <div className="bg-dark-surface rounded p-3 print:bg-white print:border print:border-gray-200">
                    <p className="text-xs text-gray-400 print:text-gray-600">Variance</p>
                    <p className={`text-xl font-bold ${variance >= 0 ? 'text-green-400 print:text-green-600' : 'text-red-400 print:text-red-600'}`}>
                      {variance >= 0 ? '+' : ''} ${variance.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400">{variance >= 0 ? 'Under budget' : 'Over budget'}</p>
                  </div>
                  <div className="bg-dark-surface rounded p-3 print:bg-white print:border print:border-gray-200">
                    <p className="text-xs text-gray-400 print:text-gray-600">Cost % Complete</p>
                    <p className="text-xl font-bold text-yellow-400 print:text-yellow-600">
                      {totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0}%
                    </p>
                    <p className="text-[10px] text-gray-400">Of budgeted amount</p>
                  </div>
                </>
              );
            })()}
          </div>
          
          {/* Cost by Subcontractor */}
          {groups.length > 0 && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-300 print:text-gray-700 mb-2">Cost by Subcontractor</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {groups.map(group => {
                  const groupBudget = group.tasks.reduce((sum, t) => sum + (t.budgetedCost || 0), 0);
                  const groupActual = group.tasks.reduce((sum, t) => sum + (t.actualCost || 0), 0);
                  if (groupBudget === 0 && groupActual === 0) return null;
                  return (
                    <div key={group.id} className="bg-dark-surface rounded p-2 print:bg-white print:border print:border-gray-200">
                      <p className="text-xs text-gray-400 print:text-gray-600 truncate">{group.name}</p>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-medium text-white print:text-black">${groupActual.toLocaleString()}</span>
                        <span className="text-[10px] text-gray-400">/ ${groupBudget.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Task Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-dark-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Add Task to 3-Week Lookahead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Task Name</label>
              <Input
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                placeholder="e.g., Form/Pour remaining stem walls"
                className="bg-dark-surface border-gray-600"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Subcontractor</label>
              <Select
                value={newTask.subcontractorId}
                onValueChange={(v) => setNewTask({ ...newTask, subcontractorId: v })}
              >
                <SelectTrigger className="bg-dark-surface border-gray-600">
                  <SelectValue placeholder="Select subcontractor" />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-700">
                  <SelectItem value="">General Contractor</SelectItem>
                  {subcontractors.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {formatSubcontractorName(sub)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400">Start Date</label>
                <Input
                  type="date"
                  value={newTask.startDate}
                  onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">End Date</label>
                <Input
                  type="date"
                  value={newTask.endDate}
                  onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400">Status</label>
              <Select
                value={newTask.status}
                onValueChange={(v) => setNewTask({ ...newTask, status: v as TaskStatus })}
              >
                <SelectTrigger className="bg-dark-surface border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-700">
                  <SelectItem value="not-started">Not Started</SelectItem>
                  <SelectItem value="in-progress">In Progress (Projected not Completed)</SelectItem>
                  <SelectItem value="completed">Completed (Projected and Completed)</SelectItem>
                  <SelectItem value="meeting">Zoom Subcontractor Meeting</SelectItem>
                  <SelectItem value="weather-day">Weather Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddTask} className="w-full">
              Add Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="bg-dark-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Import 3-Week Lookahead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Upload a 3-week lookahead Excel file (.xlsx) to import tasks.
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="bg-dark-surface border-gray-600"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                const formData = new FormData();
                formData.append('file', file);
                
                try {
                  toast.loading('Importing lookahead...');
                  const res = await fetch(`/api/projects/${projectSlug}/schedule/import-lookahead`, {
                    method: 'POST',
                    body: formData
                  });
                  
                  toast.dismiss();
                  if (!res.ok) throw new Error('Import failed');
                  
                  const data = await res.json();
                  toast.success(`Imported ${data.tasksCreated} tasks`);
                  setShowImportModal(false);
                  fetchData();
                } catch (error) {
                  toast.dismiss();
                  toast.error('Failed to import file');
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\:hidden {
            display: none !important;
          }
          #__next > div > div > div > div:has([ref="printRef"]) * {
            visibility: visible;
          }
          [ref="printRef"] {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: landscape;
            margin: 0.5in;
          }
        }
      `}</style>
    </Card>
  );
}
