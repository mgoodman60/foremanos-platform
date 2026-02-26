'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar,
  Users,
  CloudRain,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  Sparkles,
  ClipboardCopy
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { createScopedLogger } from '@/lib/logger';
import VoiceRecorder from '@/components/daily-reports/VoiceRecorder';
import CrewTemplateSelector from '@/components/daily-reports/CrewTemplateSelector';
import SyncStatusIndicator from '@/components/daily-reports/SyncStatusIndicator';
import { saveDraft, isOnline } from '@/lib/offline-store';

const log = createScopedLogger('DAILY_REPORT_TEMPLATE');

interface Task {
  id: string;
  name: string;
  status: string;
}

interface DailyReportTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DailyReportData) => void;
  projectSlug: string;
}

export interface DailyReportData {
  date: string;
  crewSize: number;
  weatherCondition: string;
  weatherDelay: boolean;
  weatherDelayReason?: string;
  tasksCompleted: string[];
  tasksInProgress: string[];
  delays: { reason: string; description: string }[];
  notes: string;
  tomorrowPlan: string;
}

const WEATHER_CONDITIONS = [
  'Clear',
  'Partly Cloudy',
  'Cloudy',
  'Light Rain',
  'Heavy Rain',
  'Snow',
  'High Winds',
  'Extreme Heat',
  'Extreme Cold'
];

const DELAY_REASONS = [
  'Weather',
  'Material Shortage',
  'Equipment Breakdown',
  'Labor Shortage',
  'Design Changes',
  'Permitting Issues',
  'Site Access',
  'Safety Concern',
  'Other'
];

export default function DailyReportTemplate({
  isOpen,
  onClose,
  onSubmit,
  projectSlug
}: DailyReportTemplateProps) {
  const [_loading, _setLoading] = useState(false);
  const [loadingCarryover, setLoadingCarryover] = useState(false);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [currentWeather, setCurrentWeather] = useState<string>('');
  const [carryoverAvailable, setCarryoverAvailable] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'syncing' | 'saved-locally'>('online');

  // Form state
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [crewSize, setCrewSize] = useState<number>(0);
  const [weatherCondition, setWeatherCondition] = useState<string>('');
  const [weatherDelay, setWeatherDelay] = useState(false);
  const [weatherDelayReason, setWeatherDelayReason] = useState('');
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [inProgressTasks, setInProgressTasks] = useState<Set<string>>(new Set());
  const [delays, setDelays] = useState<{ reason: string; description: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchTodayTasks();
      fetchCurrentWeather();
      fetchCarryover();
    }
  }, [isOpen, projectSlug]);

  useEffect(() => {
    const handleOnline = () => setSyncStatus('online');
    const handleOffline = () => setSyncStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setSyncStatus(navigator.onLine ? 'online' : 'offline');
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch yesterday's carryover data
  const fetchCarryover = async () => {
    setLoadingCarryover(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/daily-reports/carryover`);
      if (response.ok) {
        const data = await response.json();
        if (data.carryover) {
          setCarryoverAvailable(true);
          // Pre-fill from carryover if fields are empty
          if (data.carryover.workPlanned && !notes) {
            setNotes(`From yesterday's plan:\n${data.carryover.workPlanned}`);
          }
          if (data.carryover.crewSize && crewSize === 0) {
            setCrewSize(data.carryover.crewSize);
          }
        }
      }
    } catch (error) {
      log.error('Failed to fetch carryover', error as Error);
    } finally {
      setLoadingCarryover(false);
    }
  };

  // Explicit "Same as Yesterday" — fetch and fill all fields
  const handleSameAsYesterday = async () => {
    setLoadingCarryover(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/daily-reports/carryover`);
      if (!response.ok) {
        toast.error('No previous report found');
        return;
      }
      const data = await response.json();
      if (!data.carryover) {
        toast.error('No previous report found');
        return;
      }
      const c = data.carryover;
      if (c.crewSize) setCrewSize(c.crewSize);
      if (c.weatherCondition) setWeatherCondition(c.weatherCondition);
      if (c.workPerformed) setWorkPerformed(c.workPerformed);
      if (c.workPlanned) setTomorrowPlan(c.workPlanned);
      if (c.notes) setNotes(c.notes);
      if (c.delays && Array.isArray(c.delays)) setDelays(c.delays);
      toast.success('Pre-filled from yesterday\'s report');
    } catch (error) {
      toast.error('Failed to load yesterday\'s report');
    } finally {
      setLoadingCarryover(false);
    }
  };

  // Quick entry — load yesterday's data into the form
  const handleQuickEntry = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/daily-reports/carryover`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.carryover) {
        setCrewSize(data.carryover.crewSize || crewSize);
        setNotes(data.carryover.notes || notes);
        setWorkPerformed(data.carryover.workPlanned || '');
        setWeatherCondition(data.carryover.weatherCondition || weatherCondition);
        toast.success('Loaded yesterday\'s data — review and submit');
      }
    } catch {
      toast.error('Failed to load carryover data');
    }
  };

  // Handle crew template selection
  const handleCrewTemplateSelect = (entries: Array<{ tradeName: string; workerCount: number; hourlyRate?: number }>) => {
    const totalWorkers = entries.reduce((sum, e) => sum + e.workerCount, 0);
    setCrewSize(totalWorkers);
  };

  // Handle voice transcription results
  const handleVoiceTranscription = (result: {
    transcription: string;
    structured: {
      workPerformed?: string;
      workPlanned?: string;
      delays?: string;
      safety?: string;
      materials?: string;
      notes?: string;
    };
  }) => {
    const { structured } = result;
    
    // Append transcribed content to existing fields
    if (structured.workPerformed) {
      setWorkPerformed(prev => 
        prev ? `${prev}\n${structured.workPerformed}` : structured.workPerformed || ''
      );
    }
    if (structured.workPlanned) {
      setTomorrowPlan(prev => 
        prev ? `${prev}\n${structured.workPlanned}` : structured.workPlanned || ''
      );
    }
    if (structured.notes) {
      setNotes(prev => 
        prev ? `${prev}\n${structured.notes}` : structured.notes || ''
      );
    }
    if (structured.delays) {
      setDelays(prev => [...prev, { reason: 'Voice Note', description: structured.delays || '' }]);
    }
  };

  const fetchTodayTasks = async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await fetch(
        `/api/projects/${projectSlug}/schedule-lookahead?start=${today.toISOString()}&end=${tomorrow.toISOString()}`
      );
      if (response.ok) {
        const data = await response.json();
        setTodayTasks(data.tasks || []);
      }
    } catch (error) {
      log.error('Failed to fetch today tasks', error as Error);
    }
  };

  const fetchCurrentWeather = async () => {
    try {
      const response = await fetch(`/api/weather?project=${projectSlug}`);
      if (response.ok) {
        const data = await response.json();
        if (data.current) {
          setCurrentWeather(data.current.condition || '');
          setWeatherCondition(data.current.condition || '');
        }
      }
    } catch (error) {
      log.error('Failed to fetch current weather', error as Error);
    }
  };

  const handleTaskCheckbox = (taskId: string, type: 'completed' | 'inProgress') => {
    if (type === 'completed') {
      const newSet = new Set(completedTasks);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      setCompletedTasks(newSet);
      // Remove from in-progress if marking completed
      if (newSet.has(taskId)) {
        const inProgressSet = new Set(inProgressTasks);
        inProgressSet.delete(taskId);
        setInProgressTasks(inProgressSet);
      }
    } else {
      const newSet = new Set(inProgressTasks);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      setInProgressTasks(newSet);
      // Remove from completed if marking in-progress
      if (newSet.has(taskId)) {
        const completedSet = new Set(completedTasks);
        completedSet.delete(taskId);
        setCompletedTasks(completedSet);
      }
    }
  };

  const addDelay = () => {
    setDelays([...delays, { reason: '', description: '' }]);
  };

  const updateDelay = (index: number, field: 'reason' | 'description', value: string) => {
    const newDelays = [...delays];
    newDelays[index][field] = value;
    setDelays(newDelays);
  };

  const removeDelay = (index: number) => {
    setDelays(delays.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (crewSize <= 0) {
      toast.error('Please enter crew size');
      return;
    }

    if (!weatherCondition) {
      toast.error('Please select weather condition');
      return;
    }

    const reportData: DailyReportData = {
      date: reportDate,
      crewSize,
      weatherCondition,
      weatherDelay,
      weatherDelayReason: weatherDelay ? weatherDelayReason : undefined,
      tasksCompleted: Array.from(completedTasks),
      tasksInProgress: Array.from(inProgressTasks),
      delays: delays.filter(d => d.reason && d.description),
      notes,
      tomorrowPlan
    };

    // If offline, save draft locally
    if (!isOnline()) {
      try {
        await saveDraft({
          id: `${projectSlug}-${reportDate}`,
          projectId: projectSlug,
          projectSlug,
          date: reportDate,
          data: reportData as unknown as Record<string, unknown>,
        });
        setSyncStatus('saved-locally');
        toast.success('Saved locally — will sync when online');
        onClose();
        return;
      } catch {
        toast.error('Failed to save draft locally');
        return;
      }
    }

    onSubmit(reportData);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setReportDate(format(new Date(), 'yyyy-MM-dd'));
    setCrewSize(0);
    setWeatherCondition('');
    setWeatherDelay(false);
    setWeatherDelayReason('');
    setCompletedTasks(new Set());
    setInProgressTasks(new Set());
    setDelays([]);
    setNotes('');
    setTomorrowPlan('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-dark-card border-gray-700 text-gray-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-50 flex items-center gap-2">
            <Calendar aria-hidden="true" className="h-6 w-6 text-blue-400" />
            Daily Report Template
            <SyncStatusIndicator status={syncStatus} className="ml-2" />
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Fill out today&apos;s progress report with structured data
          </DialogDescription>
        </DialogHeader>

        {/* Quick Entry Button */}
        {carryoverAvailable && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full sm:w-auto min-h-[44px] border-gray-700 text-gray-300 hover:bg-dark-surface"
            onClick={handleQuickEntry}
          >
            <ClipboardCopy aria-hidden="true" className="w-4 h-4 mr-2" />
            Same as yesterday
          </Button>
        )}

        {/* Voice Recorder & Carryover Indicator */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-2 mb-4">
          <VoiceRecorder
            projectSlug={projectSlug}
            onTranscription={handleVoiceTranscription}
            currentReport={{ workPerformed, workPlanned: tomorrowPlan, notes }}
          />
          
          {loadingCarryover ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading yesterday&apos;s data...
            </div>
          ) : carryoverAvailable ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Sparkles aria-hidden="true" className="w-4 h-4" />
              Pre-filled from yesterday
            </div>
          ) : null}
        </div>

        <div className="space-y-6 mt-4">
          {/* Date & Crew */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Report Date</Label>
              <Input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="bg-dark-surface border-gray-700 text-gray-100 mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300 flex items-center gap-2">
                <Users aria-hidden="true" className="h-4 w-4" />
                Crew Size
              </Label>
              <Input
                type="number"
                min="1"
                value={crewSize || ''}
                onChange={(e) => setCrewSize(parseInt(e.target.value) || 0)}
                placeholder="Enter number of workers"
                className="bg-dark-surface border-gray-700 text-gray-100 mt-1"
              />
            </div>
          </div>

          {/* Same as Yesterday & Crew Template */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSameAsYesterday}
              disabled={loadingCarryover}
              className="border-gray-700 text-gray-300 hover:bg-dark-surface min-h-[44px] p-3 sm:p-2 sm:min-h-0"
            >
              {loadingCarryover ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ClipboardCopy aria-hidden="true" className="w-4 h-4 mr-2" />
              )}
              Same as Yesterday
            </Button>
            <div className="flex-1 min-w-[200px]">
              <CrewTemplateSelector
                projectSlug={projectSlug}
                onSelect={handleCrewTemplateSelect}
                currentEntries={crewSize > 0 ? [{ tradeName: 'General', workerCount: crewSize }] : []}
              />
            </div>
          </div>

          {/* Weather */}
          <div className="space-y-3">
            <Label className="text-gray-300 flex items-center gap-2">
              <CloudRain aria-hidden="true" className="h-4 w-4" />
              Weather Conditions
            </Label>
            {currentWeather && (
              <div className="text-sm text-blue-400 mb-2">
                Current: {currentWeather}
              </div>
            )}
            <Select value={weatherCondition} onValueChange={setWeatherCondition}>
              <SelectTrigger className="bg-dark-surface border-gray-700 text-gray-100">
                <SelectValue placeholder="Select weather condition" />
              </SelectTrigger>
              <SelectContent className="bg-dark-card border-gray-700">
                {WEATHER_CONDITIONS.map((condition) => (
                  <SelectItem key={condition} value={condition} className="text-gray-100">
                    {condition}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 mt-3">
              <Checkbox
                checked={weatherDelay}
                onCheckedChange={(checked) => setWeatherDelay(checked as boolean)}
                className="border-gray-700"
              />
              <Label className="text-gray-300">Weather caused delay</Label>
            </div>

            {weatherDelay && (
              <Textarea
                value={weatherDelayReason}
                onChange={(e) => setWeatherDelayReason(e.target.value)}
                placeholder="Describe weather delay impact..."
                className="bg-dark-surface border-gray-700 text-gray-100 mt-2"
                rows={2}
              />
            )}
          </div>

          {/* Tasks */}
          <div className="space-y-3">
            <Label className="text-gray-300 font-semibold">Today&apos;s Scheduled Tasks</Label>
            {todayTasks.length === 0 ? (
              <div className="text-gray-400 text-sm py-4 text-center border border-dashed border-gray-700 rounded">
                No tasks scheduled for today
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-700 rounded p-3 bg-dark-surface">
                {todayTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-2 hover:bg-dark-card rounded">
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox
                        checked={completedTasks.has(task.id)}
                        onCheckedChange={() => handleTaskCheckbox(task.id, 'completed')}
                        className="border-gray-700"
                      />
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-300 flex-1">{task.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={inProgressTasks.has(task.id)}
                        onCheckedChange={() => handleTaskCheckbox(task.id, 'inProgress')}
                        className="border-gray-700"
                      />
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-xs text-gray-400">In Progress</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2">
              Tip: Check completed tasks or mark as in-progress
            </div>
          </div>

          {/* Work Performed */}
          <div className="space-y-3">
            <Label className="text-gray-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Work Performed Today
            </Label>
            <Textarea
              value={workPerformed}
              onChange={(e) => setWorkPerformed(e.target.value)}
              placeholder="Describe work completed today... (or use voice recorder above)"
              className="bg-dark-surface border-gray-700 text-gray-100"
              rows={3}
            />
          </div>

          {/* Delays/Issues */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 flex items-center gap-2">
                <AlertTriangle aria-hidden="true" className="h-4 w-4 text-orange-500" />
                Delays & Issues
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDelay}
                className="border-gray-700 text-gray-300 hover:bg-dark-surface min-h-[44px] min-w-[44px] p-3 sm:p-2 sm:min-h-0 sm:min-w-0"
              >
                Add Delay
              </Button>
            </div>

            {delays.map((delay, index) => (
              <div key={index} className="border border-gray-700 rounded p-3 space-y-2 bg-dark-surface">
                <div className="flex items-center gap-2">
                  <Select
                    value={delay.reason}
                    onValueChange={(value) => updateDelay(index, 'reason', value)}
                  >
                    <SelectTrigger className="bg-dark-card border-gray-700 text-gray-100">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent className="bg-dark-card border-gray-700">
                      {DELAY_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason} className="text-gray-100">
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDelay(index)}
                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px] p-3 sm:p-2 sm:min-h-0 sm:min-w-0"
                  >
                    Remove
                  </Button>
                </div>
                <Textarea
                  value={delay.description}
                  onChange={(e) => updateDelay(index, 'description', e.target.value)}
                  placeholder="Describe the delay or issue..."
                  className="bg-dark-card border-gray-700 text-gray-100"
                  rows={2}
                />
              </div>
            ))}
          </div>

          {/* Additional Notes */}
          <div>
            <Label className="text-gray-300">Additional Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any other observations, safety issues, or important notes..."
              className="bg-dark-surface border-gray-700 text-gray-100 mt-1"
              rows={3}
            />
          </div>

          {/* Tomorrow's Plan */}
          <div>
            <Label className="text-gray-300">Tomorrow&apos;s Plan</Label>
            <Textarea
              value={tomorrowPlan}
              onChange={(e) => setTomorrowPlan(e.target.value)}
              placeholder="What tasks are planned for tomorrow?..."
              className="bg-dark-surface border-gray-700 text-gray-100 mt-1"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-700 text-gray-300 hover:bg-dark-surface min-h-[44px] p-3 sm:p-2 sm:min-h-0"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 min-h-[44px] p-3 sm:p-2 sm:min-h-0"
          >
            <Send aria-hidden="true" className="h-4 w-4" />
            Submit Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}