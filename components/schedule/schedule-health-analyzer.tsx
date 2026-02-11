'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  RefreshCw,
  Wrench,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  BarChart3,
  Lightbulb,
  Zap,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface HealthIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  title: string;
  description: string;
  affectedTasks: string[];
  suggestedFix?: string;
  autoFixable: boolean;
  impact: string;
}

interface HealthMetric {
  name: string;
  value: number;
  target: number;
  status: 'good' | 'warning' | 'critical';
  trend?: 'improving' | 'stable' | 'declining';
}

interface ScheduleHealthReport {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'Healthy' | 'At Risk' | 'Critical';
  metrics: HealthMetric[];
  issues: HealthIssue[];
  recommendations: string[];
  benchmarkComparison: {
    metric: string;
    yourValue: number;
    industryAvg: number;
    percentile: number;
  }[];
  generatedAt: string;
}

interface ScheduleHealthAnalyzerProps {
  projectSlug: string;
}

export default function ScheduleHealthAnalyzer({ projectSlug }: ScheduleHealthAnalyzerProps) {
  const [report, setReport] = useState<ScheduleHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthReport();
  }, [projectSlug]);

  const fetchHealthReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/schedule-health`);
      if (!response.ok) throw new Error('Failed to fetch health report');
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Error fetching health report:', error);
      toast.error('Failed to analyze schedule health');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFix = async (issueId: string) => {
    try {
      setApplyingFix(issueId);
      const response = await fetch(`/api/projects/${projectSlug}/schedule-health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto-fix', issueId }),
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        // Refresh the report
        fetchHealthReport();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error applying fix:', error);
      toast.error('Failed to apply fix');
    } finally {
      setApplyingFix(null);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-400 bg-green-500/20 border-green-500/50';
      case 'B': return 'text-blue-400 bg-blue-500/20 border-blue-500/50';
      case 'C': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
      case 'D': return 'text-orange-400 bg-orange-500/20 border-orange-500/50';
      case 'F': return 'text-red-400 bg-red-500/20 border-red-500/50';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy': return 'text-green-400';
      case 'At Risk': return 'text-yellow-400';
      case 'Critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getMetricStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />;
      case 'info': return <Info className="h-5 w-5 text-blue-400" aria-hidden="true" />;
      default: return <Info className="h-5 w-5 text-gray-400" aria-hidden="true" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 border-red-500/30';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
      case 'info': return 'bg-blue-500/10 border-blue-500/30';
      default: return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-400" aria-hidden="true" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-400" aria-hidden="true" />;
      default: return <Minus className="h-4 w-4 text-gray-400" aria-hidden="true" />;
    }
  };

  if (loading) {
    return (
      <Card className="p-8 bg-dark-subtle border-gray-700">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          <span className="ml-3 text-gray-400">Analyzing schedule health...</span>
        </div>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-8 bg-dark-subtle border-gray-700">
        <div className="text-center text-gray-400">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" aria-hidden="true" />
          <p>Unable to generate health report</p>
          <Button onClick={fetchHealthReport} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" /> Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Health Score */}
      <Card className="p-6 bg-dark-subtle border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-6">
            {/* Score Circle */}
            <div className="relative">
              <div className={`w-28 h-28 rounded-full border-4 ${getGradeColor(report.grade)} flex items-center justify-center`}>
                <div className="text-center">
                  <div className="text-4xl font-bold">{report.grade}</div>
                  <div className="text-xs opacity-70">{report.overallScore}%</div>
                </div>
              </div>
              <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)} bg-dark-base`}>
                {report.status}
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-400" aria-hidden="true" />
                Schedule Health Analysis
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Last analyzed: {new Date(report.generatedAt).toLocaleString()}
              </p>
              <div className="flex gap-4 mt-3">
                <span className="text-sm text-red-400">
                  {report.issues.filter(i => i.severity === 'critical').length} Critical
                </span>
                <span className="text-sm text-yellow-400">
                  {report.issues.filter(i => i.severity === 'warning').length} Warnings
                </span>
                <span className="text-sm text-blue-400">
                  {report.issues.filter(i => i.severity === 'info').length} Info
                </span>
              </div>
            </div>
          </div>
          
          <Button onClick={fetchHealthReport} variant="outline" size="sm" className="border-gray-600">
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" /> Refresh
          </Button>
        </div>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {report.metrics.map((metric, idx) => (
          <Card key={idx} className="p-4 bg-dark-subtle border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">{metric.name}</span>
              {getTrendIcon(metric.trend)}
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-white">{metric.value}%</span>
              <span className="text-xs text-gray-400 mb-1">/ {metric.target}%</span>
            </div>
            <div className="mt-2">
              <Progress
                value={Math.min(metric.value, 100)}
                className="h-1.5 bg-gray-700"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Badge className={`${getMetricStatusColor(metric.status)} text-white text-xs px-2 py-0`}>
                {metric.status}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Issues Section */}
      {report.issues.length > 0 && (
        <Card className="bg-dark-subtle border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              Issues Detected ({report.issues.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-700">
            {report.issues.map((issue, idx) => (
              <div key={idx} className={`p-4 ${getSeverityBg(issue.severity)} border-l-4 ${issue.severity === 'critical' ? 'border-l-red-500' : issue.severity === 'warning' ? 'border-l-yellow-500' : 'border-l-blue-500'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(issue.severity)}
                    <div>
                      <h4 className="font-medium text-white">{issue.title}</h4>
                      <p className="text-sm text-gray-400 mt-1">{issue.description}</p>

                      {issue.affectedTasks.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs text-gray-400">Affected: </span>
                          <span className="text-xs text-gray-300">
                            {issue.affectedTasks.slice(0, 3).join(', ')}
                            {issue.affectedTasks.length > 3 && ` +${issue.affectedTasks.length - 3} more`}
                          </span>
                        </div>
                      )}

                      {issue.suggestedFix && (
                        <div className="mt-2 p-2 bg-dark-base rounded text-sm">
                          <span className="text-orange-400 flex items-center gap-1">
                            <Lightbulb className="h-3 w-3" aria-hidden="true" /> Suggestion:
                          </span>
                          <span className="text-gray-300 ml-4">{issue.suggestedFix}</span>
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-gray-400">
                        <span className="font-medium">Impact:</span> {issue.impact}
                      </div>
                    </div>
                  </div>
                  
                  {issue.autoFixable && (
                    <Button
                      size="sm"
                      onClick={() => handleAutoFix(issue.id)}
                      disabled={applyingFix === issue.id}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {applyingFix === issue.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <><Zap className="h-3 w-3 mr-1" aria-hidden="true" /> Auto-Fix</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recommendations & Benchmarks */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recommendations */}
        <Card className="p-4 bg-dark-subtle border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            Recommendations
          </h3>
          <div className="space-y-3">
            {report.recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <ArrowRight className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-gray-300">{rec}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Industry Benchmarks */}
        <Card className="p-4 bg-dark-subtle border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-blue-400" aria-hidden="true" />
            Industry Benchmarks
          </h3>
          <div className="space-y-4">
            {report.benchmarkComparison.map((benchmark, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-400">{benchmark.metric}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">{benchmark.yourValue}%</span>
                    <span className="text-gray-400">vs {benchmark.industryAvg}% avg</span>
                  </div>
                </div>
                <div className="relative h-2 bg-gray-700 rounded">
                  <div 
                    className="absolute h-full bg-blue-500/50 rounded"
                    style={{ width: `${benchmark.industryAvg}%` }}
                  />
                  <div 
                    className={`absolute h-full ${benchmark.yourValue >= benchmark.industryAvg ? 'bg-green-500' : 'bg-orange-500'} rounded`}
                    style={{ width: `${Math.min(benchmark.yourValue, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1 text-right">
                  {benchmark.percentile}th percentile
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
