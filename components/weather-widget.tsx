'use client';

import { useState, useEffect } from 'react';
import {
  CloudRain,
  Cloud,
  Sun,
  CloudSnow,
  Wind,
  Droplets,
  Thermometer,
  AlertTriangle,
  Settings,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

interface WeatherWidgetProps {
  projectId: string;
  onOpenPreferences?: () => void;
}

interface WeatherSnapshot {
  id: string;
  temperature: number;
  feelsLike: number;
  conditions: string;
  description: string;
  windSpeed: number;
  humidity: number;
  precipitation: number;
  snapshotTime: string;
  snapshotType: string;
}

interface WeatherAlert {
  id: string;
  title: string;
  message: string;
  severity: string;
  alertType: string;
}

export default function WeatherWidget({
  projectId,
  onOpenPreferences,
}: WeatherWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [currentWeather, setCurrentWeather] = useState<WeatherSnapshot | null>(null);
  const [weekForecast, setWeekForecast] = useState<WeatherSnapshot[]>([]);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    loadWeatherData();
    // Refresh every 30 minutes
    const interval = setInterval(loadWeatherData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [projectId]);

  const loadWeatherData = async () => {
    try {
      setLoading(true);
      
      // Load snapshots (last 7 days)
      const snapshotsRes = await fetch(
        `/api/weather/snapshots?projectId=${projectId}&days=7`
      );
      if (snapshotsRes.ok) {
        const snapshots = await snapshotsRes.json();
        // Get most recent snapshot as current weather
        if (snapshots.length > 0) {
          setCurrentWeather(snapshots[0]);
        }
        // Group by date for week forecast
        const grouped = groupSnapshotsByDate(snapshots);
        setWeekForecast(grouped.slice(0, 5)); // Next 5 days
      }

      // Load active alerts
      const alertsRes = await fetch(
        `/api/weather/alerts?projectId=${projectId}&dismissed=false`
      );
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      }
    } catch (error) {
      console.error('Error loading weather data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupSnapshotsByDate = (snapshots: WeatherSnapshot[]): WeatherSnapshot[] => {
    const grouped = new Map<string, WeatherSnapshot[]>();
    
    snapshots.forEach((snapshot) => {
      const date = new Date(snapshot.snapshotTime).toDateString();
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(snapshot);
    });

    // Return one representative snapshot per date (afternoon preferred)
    return Array.from(grouped.values()).map((daySnapshots) => {
      const afternoon = daySnapshots.find((s) => s.snapshotType === 'afternoon');
      const noon = daySnapshots.find((s) => s.snapshotType === 'noon');
      return afternoon || noon || daySnapshots[0];
    });
  };

  const getWeatherIcon = (conditions: string) => {
    const lowerConditions = conditions.toLowerCase();
    if (lowerConditions.includes('rain')) return CloudRain;
    if (lowerConditions.includes('snow')) return CloudSnow;
    if (lowerConditions.includes('cloud')) return Cloud;
    return Sun;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/weather/alerts/${alertId}/dismiss`, {
        method: 'POST',
      });

      if (response.ok) {
        setAlerts(alerts.filter((a) => a.id !== alertId));
        toast.success('Alert dismissed');
      }
    } catch (error) {
      console.error('Error dismissing alert:', error);
      toast.error('Failed to dismiss alert');
    }
  };

  if (loading) {
    return (
      <div className="bg-dark-card border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  if (!currentWeather) {
    return (
      <div className="bg-dark-card border border-gray-700 rounded-xl p-6">
        <p className="text-gray-400 text-center">
          No weather data available. Make sure project location is set.
        </p>
      </div>
    );
  }

  const WeatherIcon = getWeatherIcon(currentWeather.conditions);

  return (
    <div className="bg-dark-card border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-orange-500" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-50">Weather Intelligence</h3>
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              {alerts.length} {alerts.length === 1 ? 'Alert' : 'Alerts'}
            </button>
          )}
          {onOpenPreferences && (
            <button
              onClick={onOpenPreferences}
              className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
              aria-label="Weather preferences"
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Alerts Section */}
      {showAlerts && alerts.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-700 space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
                  <p className="text-sm opacity-90">{alert.message}</p>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="text-sm hover:underline opacity-75 hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Weather */}
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-xl">
              <WeatherIcon className="w-10 h-10 text-orange-500" aria-hidden="true" />
            </div>
            <div>
              <div className="text-4xl font-bold text-slate-50">
                {Math.round(currentWeather.temperature)}°F
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Feels like {Math.round(currentWeather.feelsLike)}°F
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium text-slate-50 capitalize">
              {currentWeather.description}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {new Date(currentWeather.snapshotTime).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Weather Details Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-dark-surface rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Wind className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              <span className="text-xs text-gray-400">Wind</span>
            </div>
            <p className="text-lg font-semibold text-slate-50">
              {Math.round(currentWeather.windSpeed)} mph
            </p>
          </div>

          <div className="p-3 bg-dark-surface rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="w-4 h-4 text-blue-400" aria-hidden="true" />
              <span className="text-xs text-gray-400">Humidity</span>
            </div>
            <p className="text-lg font-semibold text-slate-50">
              {currentWeather.humidity}%
            </p>
          </div>

          <div className="p-3 bg-dark-surface rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <CloudRain className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              <span className="text-xs text-gray-400">Precip</span>
            </div>
            <p className="text-lg font-semibold text-slate-50">
              {currentWeather.precipitation > 0
                ? `${currentWeather.precipitation.toFixed(2)}"` 
                : 'None'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Week Forecast */}
      {weekForecast.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-gray-400" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
              This Week
            </h4>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {weekForecast.map((snapshot, index) => {
              const DayIcon = getWeatherIcon(snapshot.conditions);
              return (
                <div
                  key={snapshot.id}
                  className="text-center p-3 bg-dark-surface rounded-lg hover:bg-dark-hover transition-colors"
                >
                  <p className="text-xs text-gray-400 mb-2">
                    {getDayName(snapshot.snapshotTime)}
                  </p>
                  <DayIcon className="w-6 h-6 mx-auto mb-2 text-orange-500" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-50">
                    {Math.round(snapshot.temperature)}°
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
