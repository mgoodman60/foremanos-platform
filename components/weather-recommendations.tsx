/**
 * Weather-Based Recommendations Widget
 * AI suggestions based on weather forecast for construction work
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Cloud,
  CloudRain,
  Sun,
  Wind,
  Thermometer,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Lightbulb,
  Snowflake,
} from 'lucide-react';

interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  precipitation: number;
}

interface Recommendation {
  type: 'warning' | 'suggestion' | 'good';
  title: string;
  description: string;
  trades?: string[];
}

interface WeatherRecommendationsProps {
  projectSlug: string;
  compact?: boolean;
}

export default function WeatherRecommendations({
  projectSlug,
  compact = false,
}: WeatherRecommendationsProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeatherAndRecommendations();
  }, [projectSlug]);

  const fetchWeatherAndRecommendations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectSlug}/weather`);
      const data = await res.json();

      if (data.weather) {
        setWeather(data.weather);
        generateRecommendations(data.weather);
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = (w: WeatherData) => {
    const recs: Recommendation[] = [];

    // Temperature-based
    if (w.temp < 35) {
      recs.push({
        type: 'warning',
        title: 'Freezing Conditions',
        description: 'Concrete work not recommended. Protect materials from freezing. Consider heaters for interior work.',
        trades: ['Concrete', 'Masonry', 'Painting'],
      });
    } else if (w.temp < 45) {
      recs.push({
        type: 'suggestion',
        title: 'Cold Weather Precautions',
        description: 'Use cold-weather concrete additives. Plan for extended cure times.',
        trades: ['Concrete', 'Masonry'],
      });
    } else if (w.temp > 95) {
      recs.push({
        type: 'warning',
        title: 'Extreme Heat',
        description: 'Schedule outdoor work for early morning. Ensure crew hydration. Concrete may cure too fast.',
        trades: ['All Trades'],
      });
    } else if (w.temp >= 55 && w.temp <= 75) {
      recs.push({
        type: 'good',
        title: 'Ideal Working Conditions',
        description: 'Temperature is optimal for most construction activities.',
        trades: ['All Trades'],
      });
    }

    // Rain/Precipitation
    if (w.condition.toLowerCase().includes('rain') || w.precipitation > 0.1) {
      recs.push({
        type: 'warning',
        title: 'Rain Expected',
        description: 'Focus on interior work. Protect excavations and exposed materials. Defer roofing and exterior painting.',
        trades: ['Roofing', 'Painting', 'Excavation', 'Concrete'],
      });
    }

    // Wind
    if (w.windSpeed > 25) {
      recs.push({
        type: 'warning',
        title: 'High Winds',
        description: 'Suspend crane operations. Secure loose materials. Exercise caution with elevated work.',
        trades: ['Crane Ops', 'Steel Erection', 'Roofing'],
      });
    } else if (w.windSpeed > 15) {
      recs.push({
        type: 'suggestion',
        title: 'Windy Conditions',
        description: 'Monitor conditions for lifting operations. Secure materials and tarps.',
        trades: ['Crane Ops', 'General'],
      });
    }

    // Humidity
    if (w.humidity > 80) {
      recs.push({
        type: 'suggestion',
        title: 'High Humidity',
        description: 'Painting may require extended dry time. Monitor adhesive applications.',
        trades: ['Painting', 'Flooring', 'Drywall'],
      });
    }

    // Snow
    if (w.condition.toLowerCase().includes('snow')) {
      recs.push({
        type: 'warning',
        title: 'Snow Expected',
        description: 'Plan for snow removal. Protect work areas. Consider site shutdown for safety.',
        trades: ['All Trades'],
      });
    }

    setRecommendations(recs);
  };

  const getWeatherIcon = () => {
    if (!weather) return <Cloud className="h-8 w-8 text-gray-400" />;
    const cond = weather.condition.toLowerCase();
    if (cond.includes('rain')) return <CloudRain className="h-8 w-8 text-blue-500" />;
    if (cond.includes('snow')) return <Snowflake className="h-8 w-8 text-blue-300" />;
    if (cond.includes('clear') || cond.includes('sun')) return <Sun className="h-8 w-8 text-yellow-500" />;
    if (cond.includes('wind')) return <Wind className="h-8 w-8 text-gray-500" />;
    return <Cloud className="h-8 w-8 text-gray-400" />;
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'suggestion':
        return <Lightbulb className="h-5 w-5 text-blue-500" />;
      case 'good':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Lightbulb className="h-5 w-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!weather) {
    return null;
  }

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getWeatherIcon()}
            <div>
              <div className="font-medium text-gray-900">{weather.temp}°F • {weather.condition}</div>
              <div className="text-xs text-gray-500">Wind: {weather.windSpeed} mph • Humidity: {weather.humidity}%</div>
            </div>
          </div>
          {recommendations.filter((r) => r.type === 'warning').length > 0 && (
            <div className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">
              {recommendations.filter((r) => r.type === 'warning').length} Alerts
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Weather Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getWeatherIcon()}
            <div>
              <div className="text-2xl font-semibold text-gray-900">{weather.temp}°F</div>
              <div className="text-gray-600">{weather.condition}</div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Wind className="h-4 w-4" /> {weather.windSpeed} mph
            </div>
            <div>Humidity: {weather.humidity}%</div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Work Recommendations</h4>
          <button
            onClick={fetchWeatherAndRecommendations}
            className="p-1 hover:bg-gray-100 rounded"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            No special precautions needed today.
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  rec.type === 'warning'
                    ? 'bg-orange-50 border-orange-200'
                    : rec.type === 'good'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {getRecommendationIcon(rec.type)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{rec.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{rec.description}</div>
                    {rec.trades && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rec.trades.map((trade) => (
                          <span
                            key={trade}
                            className="text-xs px-2 py-0.5 bg-white/50 rounded text-gray-600"
                          >
                            {trade}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
