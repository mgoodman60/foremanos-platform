'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import {
  Activity, Target, GitBranch, AlertTriangle, CheckCircle,
  Clock, Calendar, RefreshCw, Link, TrendingUp, TrendingDown,
  ArrowRight, Save
} from 'lucide-react';

interface CPMResult {
  criticalPath: string[];
  projectDuration: number;
  totalFloat: number;
  tasks: any[];
}

interface ScheduleForecast {
  projectedEndDate: string;
  originalEndDate: string;
  varianceDays: number;
  schedulePerformanceIndex: number;
  completionConfidence: number;
  riskLevel: string;
  riskFactors: string[];
  recoveryActions: string[];
}

interface Baseline {
  id: string;
  baselineNumber: number;
  name: string;
  capturedAt: string;
  totalTasks: number;
  isActive: boolean;
}

export default function ScheduleAnalysis() {
  const params = useParams();
  const slug = params?.slug as string;

  const [loading, setLoading] = useState(true);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [cpm, setCpm] = useState<CPMResult | null>(null);
  const [forecast, setForecast] = useState<ScheduleForecast | null>(null);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [baselineComparison, setBaselineComparison] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [scheduleCosts, setScheduleCosts] = useState<any>(null);
  
  const [analyzing, setAnalyzing] = useState(false);
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const [baselineName, setBaselineName] = useState('');
  const [baselineDesc, setBaselineDesc] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/schedule-analysis`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      
      setHasSchedule(data.hasSchedule);
      if (data.hasSchedule) {
        setSchedule(data.schedule);
        setCpm(data.cpm);
        setForecast(data.forecast);
        setBaselines(data.baselines || []);
        setBaselineComparison(data.baselineComparison);
        setResources(data.resources || []);
        setScheduleCosts(data.scheduleDrivenCosts);
      }
    } catch (err) {
      toast.error('Failed to load schedule analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [slug]);

  const runAction = async (action: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/projects/${slug}/schedule-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error('Failed to run action');
      const data = await res.json();

      switch (action) {
        case 'calculate_cpm':
          setCpm(data.cpm);
          toast.success('CPM analysis updated');
          break;
        case 'generate_forecast':
          setForecast(data.forecast);
          toast.success('Schedule forecast generated');
          break;
        case 'level_resources':
          toast.success(data.message);
          fetchData();
          break;
        case 'link_to_budget':
          toast.success(`Linked ${data.linked} tasks to budget items`);
          fetchData();
          break;
      }
    } catch (err) {
      toast.error('Action failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const createBaseline = async () => {
    if (!baselineName) {
      toast.error('Please enter a baseline name');
      return;
    }

    try {
      const res = await fetch(`/api/projects/${slug}/schedule-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_baseline',
          baselineName,
          baselineDescription: baselineDesc
        })
      });
      if (!res.ok) throw new Error('Failed to create baseline');
      
      toast.success('Baseline created');
      setShowBaselineModal(false);
      setBaselineName('');
      setBaselineDesc('');
      fetchData();
    } catch (err) {
      toast.error('Failed to create baseline');
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-green-600';
      case 'MEDIUM': return 'bg-yellow-600';
      case 'HIGH': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-[#2d333b] border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3" />
          <div className="h-32 bg-gray-700 rounded" />
        </div>
      </Card>
    );
  }

  if (!hasSchedule) {
    return (
      <Card className="p-8 bg-[#2d333b] border-gray-700 text-center">
        <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-500" />
        <h3 className="text-lg font-semibold text-white mb-2">No Active Schedule</h3>
        <p className="text-gray-400">Create a schedule to enable analysis features</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Schedule Overview */}
      <Card className="p-4 bg-[#2d333b] border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{schedule?.name}</h3>
              <p className="text-sm text-gray-400">
                {format(new Date(schedule?.startDate), 'MMM d, yyyy')} - {format(new Date(schedule?.endDate), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => runAction('calculate_cpm')} disabled={analyzing}>
              <Activity className="h-4 w-4 mr-2" />
              Run CPM
            </Button>
            <Button size="sm" onClick={() => runAction('generate_forecast')} disabled={analyzing}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Forecast
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowBaselineModal(true)}>
              <Save className="h-4 w-4 mr-2" />
              Save Baseline
            </Button>
          </div>
        </div>
      </Card>

      {/* CPM Analysis */}
      {cpm && (
        <Card className="p-4 bg-[#2d333b] border-gray-700">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-purple-400" />
            Critical Path Analysis
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-[#1F2328] p-3 rounded-lg">
              <div className="text-sm text-gray-400">Project Duration</div>
              <div className="text-xl font-bold text-white">{cpm.projectDuration} days</div>
            </div>
            <div className="bg-[#1F2328] p-3 rounded-lg">
              <div className="text-sm text-gray-400">Critical Tasks</div>
              <div className="text-xl font-bold text-red-400">{cpm.criticalPath.length}</div>
            </div>
            <div className="bg-[#1F2328] p-3 rounded-lg">
              <div className="text-sm text-gray-400">Total Float</div>
              <div className="text-xl font-bold text-green-400">{cpm.totalFloat} days</div>
            </div>
            <div className="bg-[#1F2328] p-3 rounded-lg">
              <div className="text-sm text-gray-400">Total Tasks</div>
              <div className="text-xl font-bold text-blue-400">{cpm.tasks.length}</div>
            </div>
          </div>

          {cpm.criticalPath.length > 0 && (
            <div>
              <div className="text-sm text-gray-400 mb-2">Critical Path</div>
              <div className="flex flex-wrap items-center gap-2">
                {cpm.criticalPath.slice(0, 6).map((taskId, i) => {
                  const task = cpm.tasks.find(t => t.taskId === taskId);
                  return (
                    <div key={taskId} className="flex items-center">
                      <Badge className="bg-red-600 text-white">
                        {task?.name || taskId}
                      </Badge>
                      {i < Math.min(5, cpm.criticalPath.length - 1) && (
                        <ArrowRight className="h-4 w-4 text-gray-500 mx-1" />
                      )}
                    </div>
                  );
                })}
                {cpm.criticalPath.length > 6 && (
                  <span className="text-gray-400 text-sm">+{cpm.criticalPath.length - 6} more</span>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Forecast */}
      {forecast && (
        <Card className="p-4 bg-[#2d333b] border-gray-700">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-yellow-400" />
            Schedule Forecast
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-[#1F2328] p-3 rounded-lg">
              <div className="text-sm text-gray-400">Projected End</div>
              <div className="text-lg font-bold text-white">
                {format(new Date(forecast.projectedEndDate), 'MMM d, yyyy')}
              </div>
            </div>
            <div className="bg-[#1F2328] p-3 rounded-lg">
              <div className="text-sm text-gray-400">Variance</div>
              <div className={`text-lg font-bold ${forecast.varianceDays > 0 ? 'text-red-400' : forecast.varianceDays < 0 ? 'text-green-400' : 'text-white'}`}>
                {forecast.varianceDays > 0 ? '+' : ''}{forecast.varianceDays} days
              </div>
            </div>
            <div className="bg-[#1F2328] p-3 rounded-lg">
              <div className="text-sm text-gray-400">SPI</div>
              <div className={`text-lg font-bold ${forecast.schedulePerformanceIndex >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                {forecast.schedulePerformanceIndex.toFixed(2)}
              </div>
            </div>
            <div className="bg-[#1F2328] p-3 rounded-lg">
              <div className="text-sm text-gray-400">Confidence</div>
              <div className="text-lg font-bold text-blue-400">
                {forecast.completionConfidence.toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <Badge className={getRiskColor(forecast.riskLevel)}>
              Risk: {forecast.riskLevel}
            </Badge>
          </div>

          {forecast.riskFactors.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">Risk Factors</div>
              <ul className="space-y-1">
                {forecast.riskFactors.map((factor, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {forecast.recoveryActions.length > 0 && (
            <div>
              <div className="text-sm text-gray-400 mb-2">Recommended Actions</div>
              <ul className="space-y-1">
                {forecast.recoveryActions.map((action, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Baseline Comparison */}
      {baselineComparison?.hasBaseline && (
        <Card className="p-4 bg-[#2d333b] border-gray-700">
          <h3 className="font-semibold text-white mb-4">Baseline Comparison</h3>
          
          <div className="flex items-center gap-4 mb-4">
            <Badge variant="outline">
              Baseline: {baselineComparison.baseline.name}
            </Badge>
            <span className="text-sm text-gray-400">
              Captured: {format(new Date(baselineComparison.baseline.capturedAt), 'MMM d, yyyy')}
            </span>
          </div>

          {baselineComparison.comparison && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-[#1F2328] p-3 rounded-lg">
                <div className="text-sm text-gray-400">Total Tasks</div>
                <div className="text-lg font-bold text-white">
                  {baselineComparison.comparison.summary.totalTasks}
                </div>
              </div>
              <div className="bg-[#1F2328] p-3 rounded-lg">
                <div className="text-sm text-gray-400">On Track</div>
                <div className="text-lg font-bold text-green-400">
                  {baselineComparison.comparison.summary.tasksOnTrack}
                </div>
              </div>
              <div className="bg-[#1F2328] p-3 rounded-lg">
                <div className="text-sm text-gray-400">Ahead</div>
                <div className="text-lg font-bold text-blue-400">
                  {baselineComparison.comparison.summary.tasksAhead}
                </div>
              </div>
              <div className="bg-[#1F2328] p-3 rounded-lg">
                <div className="text-sm text-gray-400">Behind</div>
                <div className="text-lg font-bold text-red-400">
                  {baselineComparison.comparison.summary.tasksBehind}
                </div>
              </div>
              <div className="bg-[#1F2328] p-3 rounded-lg">
                <div className="text-sm text-gray-400">Project Variance</div>
                <div className={`text-lg font-bold ${baselineComparison.comparison.summary.projectEndVariance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {baselineComparison.comparison.summary.projectEndVariance > 0 ? '+' : ''}
                  {baselineComparison.comparison.summary.projectEndVariance} days
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Baselines List */}
      {baselines.length > 0 && (
        <Card className="p-4 bg-[#2d333b] border-gray-700">
          <h3 className="font-semibold text-white mb-4">Saved Baselines</h3>
          <div className="space-y-2">
            {baselines.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-[#1F2328] rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{b.name}</span>
                    {b.isActive && <Badge className="bg-green-600">Active</Badge>}
                  </div>
                  <div className="text-sm text-gray-400">
                    {format(new Date(b.capturedAt), 'MMM d, yyyy')} • {b.totalTasks} tasks
                  </div>
                </div>
                <span className="text-gray-500">#{b.baselineNumber}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Resource Summary */}
      {resources.length > 0 && (
        <Card className="p-4 bg-[#2d333b] border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Resource Utilization</h3>
            <Button size="sm" variant="outline" onClick={() => runAction('level_resources')} disabled={analyzing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${analyzing ? 'animate-spin' : ''}`} />
              Level Resources
            </Button>
          </div>
          
          <div className="space-y-3">
            {resources.map((r, i) => (
              <div key={i} className="p-3 bg-[#1F2328] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{r.resourceName}</span>
                    <Badge variant="outline">{r.resourceType}</Badge>
                    {r.isOverallocated && (
                      <Badge className="bg-red-600">Overallocated</Badge>
                    )}
                  </div>
                  <span className={`font-bold ${r.utilizationPercent > 100 ? 'text-red-400' : 'text-green-400'}`}>
                    {r.utilizationPercent.toFixed(0)}%
                  </span>
                </div>
                <Progress 
                  value={Math.min(100, r.utilizationPercent)} 
                  className={`h-2 ${r.utilizationPercent > 100 ? 'bg-red-900' : ''}`}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Schedule-Budget Link */}
      <Card className="p-4 bg-[#2d333b] border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Link className="h-5 w-5 text-blue-400" />
            Schedule-Budget Integration
          </h3>
          <Button size="sm" onClick={() => runAction('link_to_budget')} disabled={analyzing}>
            <Link className="h-4 w-4 mr-2" />
            Link Tasks to Budget
          </Button>
        </div>

        {scheduleCosts && scheduleCosts.items.length > 0 && (
          <div className="space-y-2">
            {scheduleCosts.items.slice(0, 5).map((item: any) => (
              <div key={item.budgetItemId} className="p-3 bg-[#1F2328] rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-white font-medium">{item.name}</div>
                    <div className="text-sm text-gray-400">
                      {item.linkedTasks} tasks linked • {item.avgTaskProgress.toFixed(0)}% progress
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={item.variance >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {item.variance >= 0 ? 'Under' : 'Over'} ${Math.abs(item.variance).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Baseline Modal */}
      <Dialog open={showBaselineModal} onOpenChange={setShowBaselineModal}>
        <DialogContent className="bg-[#2d333b] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Create Schedule Baseline</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Baseline Name *</Label>
              <Input
                value={baselineName}
                onChange={(e) => setBaselineName(e.target.value)}
                className="bg-[#1F2328] border-gray-600"
                placeholder="e.g., Pre-Construction Baseline"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={baselineDesc}
                onChange={(e) => setBaselineDesc(e.target.value)}
                className="bg-[#1F2328] border-gray-600"
                placeholder="Optional notes about this baseline"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBaselineModal(false)}>
              Cancel
            </Button>
            <Button onClick={createBaseline}>
              Create Baseline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
