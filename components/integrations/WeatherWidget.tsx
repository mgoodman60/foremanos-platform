'use client';

import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, Snowflake, Wind, Thermometer, Droplets, AlertTriangle, RefreshCw } from 'lucide-react';

interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  conditions: string;
  description: string;
  precipitation: number;
  sunrise: string;
  sunset: string;
}

interface WeatherForecast {
  date: string;
  high: number;
  low: number;
  conditions: string;
  precipChance: number;
  windSpeed: number;
}

interface WeatherImpact {
  severity: 'none' | 'low' | 'moderate' | 'high' | 'critical';
  recommendation: string;
  affectedActivities: string[];
  delayRisk: boolean;
}

interface WeatherWidgetProps {
  projectSlug: string;
  compact?: boolean;
}

export default function WeatherWidget({ projectSlug, compact = false }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<{
    current: WeatherData | null;
    forecast: WeatherForecast[];
    impact: WeatherImpact | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/weather`);
      if (!res.ok) throw new Error('Failed to fetch weather');
      const data = await res.json();
      setWeather(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Weather unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [projectSlug]);

  const getWeatherIcon = (conditions: string) => {
    switch (conditions.toLowerCase()) {
      case 'clear':
      case 'sunny':
        return <Sun className="h-8 w-8 text-yellow-400" />;
      case 'rain':
      case 'drizzle':
        return <CloudRain className="h-8 w-8 text-blue-400" />;
      case 'snow':
        return <Snowflake className="h-8 w-8 text-blue-200" />;
      case 'clouds':
      case 'overcast':
        return <Cloud className="h-8 w-8 text-gray-400" />;
      default:
        return <Cloud className="h-8 w-8 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 border-red-500 text-red-400';
      case 'high': return 'bg-orange-500/20 border-orange-500 text-orange-400';
      case 'moderate': return 'bg-yellow-500/20 border-yellow-500 text-yellow-400';
      case 'low': return 'bg-blue-500/20 border-blue-500 text-blue-400';
      default: return 'bg-green-500/20 border-green-500 text-green-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-dark-surface rounded-lg p-4 animate-pulse">
        <div className="h-20 bg-gray-700 rounded" />
      </div>
    );
  }

  if (error || !weather?.current) {
    return (
      <div className="bg-dark-surface rounded-lg p-4 text-center">
        <Cloud className="h-8 w-8 text-gray-500 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">{error || 'Weather unavailable'}</p>
        <button
          onClick={fetchWeather}
          className="mt-2 text-blue-400 text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  const { current, forecast, impact } = weather;

  if (compact) {
    return (
      <div className="bg-dark-surface rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getWeatherIcon(current.conditions)}
          <div>
            <span className="text-2xl font-bold text-white">{current.temperature}°F</span>
            <p className="text-sm text-gray-400 capitalize">{current.description}</p>
          </div>
        </div>
        {impact && impact.severity !== 'none' && (
          <div className={`px-2 py-1 rounded text-xs ${getSeverityColor(impact.severity)}`}>
            {impact.severity.toUpperCase()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-dark-surface rounded-lg overflow-hidden">
      {/* Current Weather */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Current Weather</h3>
          <button onClick={fetchWeather} className="text-gray-400 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          {getWeatherIcon(current.conditions)}
          <div>
            <span className="text-4xl font-bold text-white">{current.temperature}°F</span>
            <p className="text-gray-400 capitalize">{current.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex items-center gap-2 text-gray-300">
            <Thermometer className="h-4 w-4 text-orange-400" />
            <span className="text-sm">Feels {current.feelsLike}°F</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Wind className="h-4 w-4 text-blue-400" />
            <span className="text-sm">{current.windSpeed} mph {current.windDirection}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Droplets className="h-4 w-4 text-cyan-400" />
            <span className="text-sm">{current.humidity}%</span>
          </div>
        </div>
      </div>

      {/* Construction Impact */}
      {impact && impact.severity !== 'none' && (
        <div className={`p-4 border-b border-gray-700 ${getSeverityColor(impact.severity)} bg-opacity-10`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Weather Impact: {impact.severity.toUpperCase()}</p>
              <p className="text-sm mt-1 opacity-80">{impact.recommendation}</p>
              {impact.affectedActivities.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs opacity-70">Affected: </span>
                  <span className="text-sm">{impact.affectedActivities.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5-Day Forecast */}
      {forecast.length > 0 && (
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">5-Day Forecast</h4>
          <div className="flex gap-2 overflow-x-auto">
            {forecast.map((day, idx) => (
              <div key={idx} className="flex-1 min-w-[80px] bg-gray-800/50 rounded p-2 text-center">
                <p className="text-xs text-gray-400">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <p className="text-white font-medium">{day.high}°</p>
                <p className="text-gray-500 text-sm">{day.low}°</p>
                <p className="text-xs text-blue-400 mt-1">{day.precipChance}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
