'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, Shield,
  Cloud, Wrench, Users, RefreshCw, CloudRain
} from 'lucide-react';
import { toast } from 'sonner';
import { semanticColors, neutralColors } from '@/lib/design-tokens';
import WeatherDayWidget from '@/components/daily-reports/WeatherDayWidget';

interface TrendAnalytics {
  delayAnalysis: {
    byReason: Record<string, { count: number; totalHours: number }>;
    topReasons: Array<{ reason: string; count: number; percentage: number }>;
    totalDelayDays: number;
  };
  productivityTrend: Array<{
    week: string;
    avgCrewSize: number;
    avgHoursWorked: number;
    tasksCompleted: number;
  }>;
  weatherImpact: {
    daysLostToWeather: number;
    commonConditions: Record<string, number>;
  };
  safetyMetrics: {
    totalIncidents: number;
    incidentFrequency: number;
    daysWithoutIncident: number;
  };
}

interface CompletenessData {
  overall: number;
  sections: Array<{
    name: string;
    score: number;
    weight: number;
    missing: string[];
  }>;
  suggestions: string[];
}

interface EquipmentSummary {
  totalEquipment: number;
  activeCount: number;
  totalHours: number;
  totalFuel: number;
  maintenanceAlerts: Array<{
    equipmentName: string;
    hoursUsed: number;
    nextServiceAt: number;
    urgency: 'low' | 'medium' | 'high';
  }>;
  utilizationRate: number;
}

interface ReportAnalyticsDashboardProps {
  projectSlug: string;
}

export default function ReportAnalyticsDashboard({ projectSlug }: ReportAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<TrendAnalytics | null>(null);
  const [completeness, setCompleteness] = useState<CompletenessData | null>(null);
  const [equipment, setEquipment] = useState<EquipmentSummary | null>(null);
  const [days, setDays] = useState(30);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/daily-reports/analytics?days=${days}`
      );
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.trendAnalytics);
        setCompleteness(data.latestCompleteness);
        setEquipment(data.equipmentSummary);
      }
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [projectSlug, days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Daily Report Analytics</h3>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 60].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                days === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Report Quality */}
        {completeness && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <BarChart3 className="w-4 h-4" />
              Report Quality
            </div>
            <div className="text-3xl font-bold text-white">{completeness.overall}%</div>
            <div className="flex items-center gap-1 mt-1 text-sm">
              {completeness.overall >= 80 ? (
                <TrendingUp className="w-4 h-4 text-green-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-yellow-400" />
              )}
              <span className={completeness.overall >= 80 ? 'text-green-400' : 'text-yellow-400'}>
                {completeness.overall >= 80 ? 'Good' : 'Needs improvement'}
              </span>
            </div>
          </div>
        )}

        {/* Safety */}
        {analytics && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Shield className="w-4 h-4" />
              Days Without Incident
            </div>
            <div className="text-3xl font-bold text-white">
              {analytics.safetyMetrics.daysWithoutIncident}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              TRIR: {analytics.safetyMetrics.incidentFrequency}
            </div>
          </div>
        )}

        {/* Weather Impact */}
        {analytics && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Cloud className="w-4 h-4" />
              Weather Days Lost
            </div>
            <div className="text-3xl font-bold text-white">
              {analytics.weatherImpact.daysLostToWeather}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Last {days} days
            </div>
          </div>
        )}

        {/* Equipment Utilization */}
        {equipment && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Wrench className="w-4 h-4" />
              Equipment Utilization
            </div>
            <div className="text-3xl font-bold text-white">{equipment.utilizationRate}%</div>
            <div className="text-sm text-gray-400 mt-1">
              {equipment.totalEquipment} units tracked
            </div>
          </div>
        )}
      </div>

      {/* Weather Day Tracking */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h4 className="text-white font-medium mb-4 flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-blue-400" />
          Weather Day Tracking
        </h4>
        <WeatherDayWidget projectSlug={projectSlug} />
      </div>

      {/* Delay Analysis */}
      {analytics && analytics.delayAnalysis.topReasons.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            Delay Causes ({analytics.delayAnalysis.totalDelayDays} days total)
          </h4>
          <div className="space-y-3">
            {analytics.delayAnalysis.topReasons.map((reason, idx) => (
              <div key={reason.reason} className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-400 truncate">
                  {reason.reason}
                </div>
                <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${reason.percentage}%` }}
                  />
                </div>
                <div className="w-16 text-right text-sm">
                  <span className="text-white font-medium">{reason.count}</span>
                  <span className="text-gray-400"> ({reason.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completeness Breakdown */}
      {completeness && (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h4 className="text-white font-medium mb-4">Latest Report Completeness</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {completeness.sections.map(section => (
              <div key={section.name} className="text-center">
                <div className="relative w-16 h-16 mx-auto">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke={neutralColors.gray[700]}
                      strokeWidth="6"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke={section.score >= 80 ? semanticColors.success[500] : section.score >= 50 ? semanticColors.warning[500] : semanticColors.error[500]}
                      strokeWidth="6"
                      strokeDasharray={`${(section.score / 100) * 176} 176`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{section.score}%</span>
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-400">{section.name}</div>
              </div>
            ))}
          </div>

          {completeness.suggestions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-sm text-gray-400 mb-2">Missing from report:</div>
              <div className="flex flex-wrap gap-2">
                {completeness.suggestions.map((suggestion, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs"
                  >
                    {suggestion}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Equipment Maintenance Alerts */}
      {equipment && equipment.maintenanceAlerts.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-orange-400" />
            Maintenance Alerts
          </h4>
          <div className="space-y-2">
            {equipment.maintenanceAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  alert.urgency === 'high'
                    ? 'bg-red-500/10 border border-red-500/30'
                    : 'bg-orange-500/10 border border-orange-500/30'
                }`}
              >
                <div>
                  <div className="text-white font-medium">{alert.equipmentName}</div>
                  <div className="text-sm text-gray-400">
                    {alert.hoursUsed} hours used
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${
                    alert.urgency === 'high' ? 'text-red-400' : 'text-orange-400'
                  }`}>
                    Service at {alert.nextServiceAt} hrs
                  </div>
                  <div className="text-xs text-gray-400">
                    {alert.urgency === 'high' ? 'Urgent' : 'Due soon'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productivity Trend */}
      {analytics && analytics.productivityTrend.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Weekly Productivity
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2">Week</th>
                  <th className="text-right py-2">Avg Crew</th>
                  <th className="text-right py-2">Avg Hours</th>
                </tr>
              </thead>
              <tbody>
                {analytics.productivityTrend.slice(-4).map(week => (
                  <tr key={week.week} className="border-b border-gray-700/50">
                    <td className="py-2 text-white">{week.week}</td>
                    <td className="py-2 text-right text-gray-300">{week.avgCrewSize}</td>
                    <td className="py-2 text-right text-gray-300">{week.avgHoursWorked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
