"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  Wind,
  Thermometer,
  AlertTriangle,
  Calendar,
  RefreshCw,
  MapPin,
  CloudLightning,
  CloudFog,
  Droplets,
  CalendarDays
} from 'lucide-react';
import { format, addDays, isWeekend, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

export interface WeatherDay {
  date: string;
  temp: number;
  tempMin: number;
  tempMax: number;
  condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog';
  precipitation: number;
  windSpeed: number;
  humidity: number;
  description: string;
  icon: string;
  isOutdoorWorkday: boolean;
  workImpact: 'none' | 'low' | 'moderate' | 'high' | 'severe';
}

export interface ScheduleTask {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  isCritical: boolean;
  isOutdoorTask?: boolean;
  location?: string;
  percentComplete?: number;
}

interface WeatherScheduleOverlayProps {
  projectSlug: string;
  tasks?: ScheduleTask[];
  startDate?: Date;
  endDate?: Date;
}

const getWeatherIcon = (condition: string, size = 'h-5 w-5') => {
  switch (condition) {
    case 'clear': return <Sun className={cn(size, 'text-yellow-400')} />;
    case 'cloudy': return <Cloud className={cn(size, 'text-gray-400')} />;
    case 'rain': return <CloudRain className={cn(size, 'text-blue-400')} />;
    case 'snow': return <CloudSnow className={cn(size, 'text-blue-200')} />;
    case 'storm': return <CloudLightning className={cn(size, 'text-purple-400')} />;
    case 'fog': return <CloudFog className={cn(size, 'text-gray-500')} />;
    default: return <Cloud className={cn(size, 'text-gray-400')} />;
  }
};

const getImpactColor = (impact: string) => {
  switch (impact) {
    case 'none': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'severe': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const getDayBgColor = (day: WeatherDay) => {
  if (!day.isOutdoorWorkday) return 'bg-red-900/20';
  switch (day.workImpact) {
    case 'severe': return 'bg-red-900/30';
    case 'high': return 'bg-orange-900/20';
    case 'moderate': return 'bg-yellow-900/10';
    default: return 'bg-green-900/10';
  }
};

export function WeatherScheduleOverlay({
  projectSlug,
  tasks = [],
  startDate,
  endDate
}: WeatherScheduleOverlayProps) {
  const [forecast, setForecast] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationNotSet, setLocationNotSet] = useState(false);
  const [location, setLocation] = useState<{ city: string; state: string; lat: number; lon: number } | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'twoweek'>('twoweek');

  useEffect(() => {
    loadWeatherData();
  }, [projectSlug]);

  const loadWeatherData = async () => {
    setLoading(true);
    setError(null);
    setLocationNotSet(false);
    
    try {
      const response = await fetch(`/api/projects/${projectSlug}/weather`);
      const data = await response.json();
      
      if (data.error === 'PROJECT_LOCATION_NOT_SET') {
        setLocationNotSet(true);
        setForecast([]);
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch weather');
      }
      
      setForecast(data.forecast || []);
      if (data.coordinates) {
        setLocation({
          city: data.location?.split(', ')[0] || 'Unknown',
          state: data.location?.split(', ')[1] || '',
          lat: data.coordinates.lat,
          lon: data.coordinates.lon
        });
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  };

  // Calculate impact statistics
  const displayDays = viewMode === 'week' ? 7 : 14;
  const visibleForecast = forecast.slice(0, displayDays);
  
  const stats = {
    goodDays: visibleForecast.filter(d => d.workImpact === 'none' || d.workImpact === 'low').length,
    moderateDays: visibleForecast.filter(d => d.workImpact === 'moderate').length,
    badDays: visibleForecast.filter(d => d.workImpact === 'high' || d.workImpact === 'severe').length,
    nonWorkDays: visibleForecast.filter(d => !d.isOutdoorWorkday).length,
    avgTemp: visibleForecast.length > 0 
      ? Math.round(visibleForecast.reduce((sum, d) => sum + d.temp, 0) / visibleForecast.length)
      : 0,
    totalPrecip: visibleForecast.reduce((sum, d) => sum + d.precipitation, 0).toFixed(1)
  };

  // Find tasks that overlap with bad weather days
  const affectedTasks = tasks.filter(task => {
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);
    
    return visibleForecast.some(day => {
      const dayDate = new Date(day.date);
      const isInRange = dayDate >= taskStart && dayDate <= taskEnd;
      const hasBadWeather = day.workImpact === 'high' || day.workImpact === 'severe' || !day.isOutdoorWorkday;
      return isInRange && hasBadWeather && task.isOutdoorTask !== false;
    });
  });

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700 p-6">
        <div className="flex items-center justify-center gap-3 py-8 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading weather data from project location...</span>
        </div>
      </Card>
    );
  }

  if (locationNotSet) {
    return (
      <Card className="bg-dark-card border-gray-700 p-6">
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <MapPin className="h-12 w-12 text-yellow-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-200">Project Location Not Set</h3>
            <p className="text-sm text-gray-400 mt-1">Set the project location to get accurate weather forecasts</p>
          </div>
          <Button
            variant="outline"
            className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
            onClick={() => window.location.href = `/project/${projectSlug}/settings`}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Configure Location
          </Button>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-dark-card border-gray-700 p-6">
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <AlertTriangle className="h-12 w-12 text-red-500" />
          <p className="text-red-400">{error}</p>
          <Button variant="outline" onClick={loadWeatherData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-card border-gray-700 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Cloud className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-200">Weather Forecast Overlay</h3>
            {location && (
              <p className="text-sm text-gray-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location.city}, {location.state}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={viewMode} onValueChange={(v: 'week' | 'twoweek') => setViewMode(v)}>
            <SelectTrigger className="w-[140px] bg-dark-surface border-gray-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">7 Days</SelectItem>
              <SelectItem value="twoweek">14 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadWeatherData}
            className="border-gray-600"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
          <Sun className="h-5 w-5 text-green-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-400">{stats.goodDays}</p>
          <p className="text-xs text-gray-400">Good Days</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
          <Cloud className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-yellow-400">{stats.moderateDays}</p>
          <p className="text-xs text-gray-400">Moderate</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
          <CloudRain className="h-5 w-5 text-red-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-400">{stats.badDays}</p>
          <p className="text-xs text-gray-400">Poor Days</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
          <Thermometer className="h-5 w-5 text-blue-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-blue-400">{stats.avgTemp}°</p>
          <p className="text-xs text-gray-400">Avg Temp</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
          <Droplets className="h-5 w-5 text-purple-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-purple-400">{stats.totalPrecip}"</p>
          <p className="text-xs text-gray-400">Total Precip</p>
        </div>
      </div>

      {/* Forecast Grid */}
      <div className="overflow-x-auto">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${displayDays}, minmax(80px, 1fr))` }}>
          {visibleForecast.map((day, idx) => {
            const dayDate = new Date(day.date);
            const isToday = idx === 0;
            const dayOfWeek = format(dayDate, 'EEE');
            const weekend = isWeekend(dayDate);
            
            return (
              <TooltipProvider key={day.date}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'rounded-lg p-2 border transition-all cursor-pointer hover:scale-105',
                        getDayBgColor(day),
                        isToday ? 'ring-2 ring-blue-500' : '',
                        weekend ? 'border-gray-600' : 'border-gray-700'
                      )}
                    >
                      <div className="text-center">
                        <p className={cn(
                          'text-xs font-medium',
                          isToday ? 'text-blue-400' : weekend ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {isToday ? 'Today' : dayOfWeek}
                        </p>
                        <p className="text-xs text-gray-500">{format(dayDate, 'M/d')}</p>
                        
                        <div className="my-2 flex justify-center">
                          {getWeatherIcon(day.condition, 'h-8 w-8')}
                        </div>
                        
                        <p className="text-sm font-semibold text-gray-200">
                          {Math.round(day.tempMax)}°
                        </p>
                        <p className="text-xs text-gray-500">
                          {Math.round(day.tempMin)}°
                        </p>
                        
                        <Badge 
                          variant="outline" 
                          className={cn('mt-2 text-[10px] px-1', getImpactColor(day.workImpact))}
                        >
                          {day.workImpact === 'none' ? 'Good' : day.workImpact}
                        </Badge>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-dark-surface border-gray-700 p-3 max-w-[200px]">
                    <div className="space-y-2">
                      <p className="font-semibold text-gray-200">{format(dayDate, 'EEEE, MMM d')}</p>
                      <p className="text-sm text-gray-400 capitalize">{day.description}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <Wind className="h-3 w-3 text-gray-500" />
                          <span className="text-gray-400">{Math.round(day.windSpeed)} mph</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Droplets className="h-3 w-3 text-gray-500" />
                          <span className="text-gray-400">{day.humidity}%</span>
                        </div>
                      </div>
                      {day.precipitation > 0 && (
                        <p className="text-xs text-blue-400">
                          Precipitation: {day.precipitation.toFixed(1)} mm
                        </p>
                      )}
                      <Badge className={cn('text-xs', getImpactColor(day.workImpact))}>
                        Work Impact: {day.workImpact}
                      </Badge>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      {/* Affected Tasks Alert */}
      {affectedTasks.length > 0 && (
        <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            <h4 className="font-semibold text-orange-400">
              {affectedTasks.length} Task{affectedTasks.length > 1 ? 's' : ''} May Be Affected by Weather
            </h4>
          </div>
          <div className="space-y-2">
            {affectedTasks.slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  {task.isCritical && <span className="text-red-400 mr-1">●</span>}
                  {task.name}
                </span>
                <span className="text-gray-500">
                  {format(new Date(task.startDate), 'M/d')} - {format(new Date(task.endDate), 'M/d')}
                </span>
              </div>
            ))}
            {affectedTasks.length > 5 && (
              <p className="text-xs text-gray-500">+ {affectedTasks.length - 5} more tasks</p>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500/30" />
          <span className="text-gray-400">Good - Full outdoor work</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500/30" />
          <span className="text-gray-400">Moderate - Some impact</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-500/30" />
          <span className="text-gray-400">High - Limited work</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500/30" />
          <span className="text-gray-400">Severe - No outdoor work</span>
        </div>
      </div>
    </Card>
  );
}
