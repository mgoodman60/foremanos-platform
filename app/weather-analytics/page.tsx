'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Cloud, DollarSign, TrendingDown, TrendingUp, AlertTriangle, ArrowLeft, Users, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WeatherSnapshot {
  id: string;
  snapshotTime: string;
  temperature: number;
  conditions: string;
  precipitation: number;
  windSpeed: number;
  humidity: number;
}

interface WeatherImpact {
  id: string;
  reportDate: string;
  avgTemperature: number;
  precipitation: number;
  windSpeed: number;
  conditions: string;
  workStopped: boolean;
  delayHours: number | null;
  affectedTrades: string[] | null;
  totalCost: number | null;
  productivityPercent: number | null;
  notes: string | null;
  alternativeWork: string | null;
}

interface WeatherAlert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
  dismissed: boolean;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  locationCity: string | null;
  locationState: string | null;
}

export default function WeatherAnalyticsPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<WeatherSnapshot[]>([]);
  const [impacts, setImpacts] = useState<WeatherImpact[]>([]);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch projects
  useEffect(() => {
    if (status === 'authenticated') {
      fetchProjects();
    }
  }, [status]);

  // Fetch data when project selected
  useEffect(() => {
    if (selectedProjectId) {
      fetchWeatherData();
    }
  }, [selectedProjectId, timeRange]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        if (data.projects && data.projects.length > 0) {
          setSelectedProjectId(data.projects[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchWeatherData = async () => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      
      // Fetch weather snapshots
      const snapshotsRes = await fetch(
        `/api/weather/snapshots?projectId=${selectedProjectId}&days=${daysAgo}`
      );
      if (snapshotsRes.ok) {
        const data = await snapshotsRes.json();
        setSnapshots(data.snapshots || []);
      }

      // Fetch weather impacts
      const impactsRes = await fetch(
        `/api/weather/impacts?projectId=${selectedProjectId}&days=${daysAgo}`
      );
      if (impactsRes.ok) {
        const data = await impactsRes.json();
        setImpacts(data.impacts || []);
      }

      // Fetch weather alerts
      const alertsRes = await fetch(
        `/api/weather/alerts?projectId=${selectedProjectId}&days=${daysAgo}`
      );
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const totalDelayHours = impacts.reduce((sum, impact) => sum + (impact.delayHours || 0), 0);
  const totalDelayDays = Math.round(totalDelayHours / 8);
  const totalCost = impacts.reduce((sum, impact) => sum + (impact.totalCost || 0), 0);
  const avgProductivity = impacts.length > 0 
    ? impacts.reduce((sum, impact) => sum + (impact.productivityPercent || 100), 0) / impacts.length
    : 100;
  const workStoppageDays = impacts.filter(i => i.workStopped).length;

  // Group impacts by trade
  const impactsByTrade: Record<string, number> = {};
  impacts.forEach(impact => {
    if (impact.affectedTrades && Array.isArray(impact.affectedTrades)) {
      impact.affectedTrades.forEach(trade => {
        impactsByTrade[trade] = (impactsByTrade[trade] || 0) + (impact.delayHours || 0) / 8;
      });
    }
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-gray-400">Loading weather analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-700 bg-dark-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-200">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-100 flex items-center space-x-2">
                  <Cloud className="h-6 w-6 text-blue-400" />
                  <span>Weather Analytics</span>
                </h1>
                {selectedProject && (
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedProject.name} • {selectedProject.locationCity}, {selectedProject.locationState}
                  </p>
                )}
              </div>
            </div>
            
            {/* Project & Time Range Selection */}
            <div className="flex items-center space-x-4">
              <select
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="px-3 py-2 bg-dark-card border border-gray-700 rounded-md text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              
              <div className="flex items-center space-x-2 bg-dark-card rounded-md p-1">
                <button
                  onClick={() => setTimeRange('7d')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    timeRange === '7d'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setTimeRange('30d')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    timeRange === '30d'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  30 Days
                </button>
                <button
                  onClick={() => setTimeRange('90d')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    timeRange === '90d'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  90 Days
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-dark-card border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Delays</p>
                <p className="text-3xl font-bold text-orange-400">{totalDelayDays}</p>
                <p className="text-xs text-gray-500 mt-1">{totalDelayHours} hours</p>
              </div>
              <Clock className="h-10 w-10 text-orange-400 opacity-20" />
            </div>
          </Card>

          <Card className="bg-dark-card border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Work Stoppages</p>
                <p className="text-3xl font-bold text-red-400">{workStoppageDays}</p>
                <p className="text-xs text-gray-500 mt-1">full days</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-red-400 opacity-20" />
            </div>
          </Card>

          <Card className="bg-dark-card border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Cost Impact</p>
                <p className="text-3xl font-bold text-yellow-400">
                  ${(totalCost / 1000).toFixed(1)}k
                </p>
                <p className="text-xs text-gray-500 mt-1">weather-related</p>
              </div>
              <DollarSign className="h-10 w-10 text-yellow-400 opacity-20" />
            </div>
          </Card>

          <Card className="bg-dark-card border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Avg Productivity</p>
                <p className="text-3xl font-bold text-green-400">
                  {avgProductivity.toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">of normal</p>
              </div>
              {avgProductivity >= 90 ? (
                <TrendingUp className="h-10 w-10 text-green-400 opacity-20" />
              ) : (
                <TrendingDown className="h-10 w-10 text-yellow-400 opacity-20" />
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Productivity Impact Timeline */}
          <Card className="bg-dark-card border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-400" />
              <span>Productivity Impact Timeline</span>
            </h2>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {impacts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No weather impacts recorded in this period
                </p>
              ) : (
                impacts.map(impact => (
                  <div
                    key={impact.id}
                    className="bg-dark-surface border border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {new Date(impact.reportDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {impact.conditions} • {impact.avgTemperature}°F
                        </p>
                      </div>
                      {impact.workStopped && (
                        <span className="px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded-full">
                          Work Stopped
                        </span>
                      )}
                    </div>
                    
                    {impact.delayHours && impact.delayHours > 0 && (
                      <p className="text-sm text-orange-400 mb-2">
                        ⏱️ {impact.delayHours} hours delayed ({(impact.delayHours / 8).toFixed(1)} days)
                      </p>
                    )}
                    
                    {impact.affectedTrades && impact.affectedTrades.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {impact.affectedTrades.map((trade, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                          >
                            {trade}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {impact.productivityPercent !== null && (
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${impact.productivityPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">
                          {impact.productivityPercent}%
                        </span>
                      </div>
                    )}
                    
                    {impact.notes && (
                      <p className="text-xs text-gray-400 mt-2">{impact.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Impact by Trade */}
          <Card className="bg-dark-card border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-400" />
              <span>Delays by Trade/Sub</span>
            </h2>
            <div className="space-y-3">
              {Object.keys(impactsByTrade).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No trade-specific impacts recorded
                </p>
              ) : (
                Object.entries(impactsByTrade)
                  .sort(([, a], [, b]) => b - a)
                  .map(([trade, days]) => (
                    <div key={trade} className="bg-dark-surface border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-200">{trade}</span>
                        <span className="text-sm font-semibold text-orange-400">
                          {days.toFixed(1)} days
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, (days / totalDelayDays) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  ))
              )}
            </div>
            
            {/* Summary Box */}
            {Object.keys(impactsByTrade).length > 0 && (
              <div className="mt-6 bg-dark-surface border border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Summary</h3>
                <p className="text-xs text-gray-400">
                  Total weather delays: <strong className="text-orange-400">{totalDelayDays} days</strong>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Affected trades: <strong className="text-blue-400">{Object.keys(impactsByTrade).length}</strong>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Cost impact: <strong className="text-yellow-400">${totalCost.toLocaleString()}</strong>
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Recent Weather Alerts */}
        <Card className="bg-dark-card border-gray-700 p-6 mt-8">
          <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <span>Recent Weather Alerts</span>
          </h2>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No weather alerts in this period
              </p>
            ) : (
              alerts.slice(0, 10).map(alert => {
                const severityColors = {
                  high: 'bg-red-900/30 border-red-700 text-red-400',
                  medium: 'bg-yellow-900/30 border-yellow-700 text-yellow-400',
                  low: 'bg-blue-900/30 border-blue-700 text-blue-400'
                };
                const colorClass = severityColors[alert.severity as keyof typeof severityColors] || severityColors.low;

                return (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 ${colorClass} ${alert.dismissed ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold">{alert.title}</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs px-2 py-1 bg-gray-700 rounded">
                          {alert.severity}
                        </span>
                        {alert.dismissed && (
                          <span className="text-xs px-2 py-1 bg-gray-600 text-gray-300 rounded">
                            Dismissed
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs mb-2">{alert.message}</p>
                    <p className="text-xs opacity-70">
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
