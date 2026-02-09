// Weather integration service for construction scheduling
import { logger } from '@/lib/logger';
export interface WeatherForecast {
  date: string;
  temp: number;
  tempMin: number;
  tempMax: number;
  condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog';
  precipitation: number; // mm
  windSpeed: number; // mph
  humidity: number;
  description: string;
  icon: string;
  isOutdoorWorkday: boolean;
  workImpact: 'none' | 'low' | 'moderate' | 'high' | 'severe';
}

export interface DailyWeatherData {
  date: string;
  high: number;
  low: number;
  highTemp?: number;
  lowTemp?: number;
  condition: string;
  conditions?: string;
  precipitation: number;
  precipChance: number;
  windSpeed: number;
  humidity: number;
  sunrise?: string;
  sunset?: string;
  isWorkDay: boolean;
}

// Convert WeatherForecast to DailyWeatherData
export function forecastToDailyWeather(forecast: WeatherForecast): DailyWeatherData {
  return {
    date: forecast.date,
    high: forecast.tempMax,
    low: forecast.tempMin,
    highTemp: forecast.tempMax,
    lowTemp: forecast.tempMin,
    condition: forecast.condition,
    conditions: forecast.description,
    precipitation: forecast.precipitation,
    precipChance: Math.min(100, Math.round(forecast.precipitation * 10)), // Estimate from mm
    windSpeed: forecast.windSpeed,
    humidity: forecast.humidity,
    isWorkDay: forecast.isOutdoorWorkday,
  };
}

// Convert array of WeatherForecast to DailyWeatherData
export function forecastsToDailyWeather(forecasts: WeatherForecast[]): DailyWeatherData[] {
  return forecasts.map(forecastToDailyWeather);
}

export interface WeatherAlert {
  type: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  headline: string;
  description: string;
  startTime: string;
  endTime: string;
}

const WORK_IMPACT_THRESHOLDS = {
  precipitation: { low: 5, moderate: 10, high: 20 }, // mm
  windSpeed: { low: 15, moderate: 25, high: 35 }, // mph
  tempMin: 32, // °F - below this is cold impact
  tempMax: 95, // °F - above this is heat impact
};

export function calculateWorkImpact(forecast: Partial<WeatherForecast>): 'none' | 'low' | 'moderate' | 'high' | 'severe' {
  const { precipitation = 0, windSpeed = 0, temp = 70, condition = 'clear' } = forecast;
  
  // Severe conditions
  if (condition === 'storm' || precipitation > WORK_IMPACT_THRESHOLDS.precipitation.high ||
      windSpeed > WORK_IMPACT_THRESHOLDS.windSpeed.high) {
    return 'severe';
  }
  
  // High impact
  if (condition === 'snow' || precipitation > WORK_IMPACT_THRESHOLDS.precipitation.moderate ||
      windSpeed > WORK_IMPACT_THRESHOLDS.windSpeed.moderate ||
      temp < WORK_IMPACT_THRESHOLDS.tempMin || temp > WORK_IMPACT_THRESHOLDS.tempMax) {
    return 'high';
  }
  
  // Moderate impact
  if (condition === 'rain' || precipitation > WORK_IMPACT_THRESHOLDS.precipitation.low ||
      windSpeed > WORK_IMPACT_THRESHOLDS.windSpeed.low) {
    return 'moderate';
  }
  
  // Low impact
  if (condition === 'fog' || condition === 'cloudy') {
    return 'low';
  }
  
  return 'none';
}

export function isOutdoorWorkday(forecast: Partial<WeatherForecast>): boolean {
  const impact = calculateWorkImpact(forecast);
  return impact !== 'severe' && impact !== 'high';
}

export async function getWeatherForecast(lat: number, lon: number, days: number = 14): Promise<WeatherForecast[]> {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      logger.warn('WEATHER_SERVICE', 'OpenWeatherMap API key not configured');
      return generateMockForecast(days);
    }
    
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial&cnt=${days * 8}`
    );
    
    if (!response.ok) {
      throw new Error('Weather API request failed');
    }
    
    const data = await response.json();
    return parseWeatherResponse(data);
  } catch (error) {
    logger.error('WEATHER_SERVICE', 'Weather fetch error', error instanceof Error ? error : new Error(String(error)));
    return generateMockForecast(days);
  }
}

function parseWeatherResponse(data: any): WeatherForecast[] {
  const dailyForecasts: Map<string, WeatherForecast> = new Map();
  
  for (const item of data.list || []) {
    const date = new Date(item.dt * 1000).toISOString().split('T')[0];
    
    if (!dailyForecasts.has(date)) {
      const condition = mapCondition(item.weather?.[0]?.main || 'Clear');
      const forecast: WeatherForecast = {
        date,
        temp: Math.round(item.main?.temp || 70),
        tempMin: Math.round(item.main?.temp_min || 60),
        tempMax: Math.round(item.main?.temp_max || 80),
        condition,
        precipitation: item.rain?.['3h'] || item.snow?.['3h'] || 0,
        windSpeed: Math.round(item.wind?.speed || 0),
        humidity: item.main?.humidity || 50,
        description: item.weather?.[0]?.description || 'Clear',
        icon: item.weather?.[0]?.icon || '01d',
        isOutdoorWorkday: true,
        workImpact: 'none'
      };
      
      forecast.workImpact = calculateWorkImpact(forecast);
      forecast.isOutdoorWorkday = isOutdoorWorkday(forecast);
      
      dailyForecasts.set(date, forecast);
    }
  }
  
  return Array.from(dailyForecasts.values());
}

function mapCondition(weatherMain: string): WeatherForecast['condition'] {
  const main = weatherMain.toLowerCase();
  if (main.includes('thunderstorm')) return 'storm';
  if (main.includes('rain') || main.includes('drizzle')) return 'rain';
  if (main.includes('snow')) return 'snow';
  if (main.includes('fog') || main.includes('mist') || main.includes('haze')) return 'fog';
  if (main.includes('cloud')) return 'cloudy';
  return 'clear';
}

function generateMockForecast(days: number): WeatherForecast[] {
  const forecasts: WeatherForecast[] = [];
  const conditions: WeatherForecast['condition'][] = ['clear', 'cloudy', 'clear', 'rain', 'clear', 'cloudy', 'clear'];
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const condition = conditions[i % conditions.length];
    const isRainy = condition === 'rain' || condition === 'storm';
    
    const forecast: WeatherForecast = {
      date: date.toISOString().split('T')[0],
      temp: Math.round(55 + Math.random() * 30),
      tempMin: Math.round(45 + Math.random() * 20),
      tempMax: Math.round(65 + Math.random() * 25),
      condition,
      precipitation: Math.round(isRainy ? 5 + Math.random() * 15 : 0),
      windSpeed: Math.round(5 + Math.random() * 20),
      humidity: Math.round(40 + Math.random() * 40),
      description: condition,
      icon: condition === 'clear' ? '01d' : condition === 'rain' ? '10d' : '03d',
      isOutdoorWorkday: true,
      workImpact: 'none'
    };
    
    forecast.workImpact = calculateWorkImpact(forecast);
    forecast.isOutdoorWorkday = isOutdoorWorkday(forecast);
    
    forecasts.push(forecast);
  }
  
  return forecasts;
}

export function getWorkImpactColor(impact: WeatherForecast['workImpact']): string {
  switch (impact) {
    case 'severe': return 'text-red-500 bg-red-500/20';
    case 'high': return 'text-orange-500 bg-orange-500/20';
    case 'moderate': return 'text-yellow-500 bg-yellow-500/20';
    case 'low': return 'text-blue-400 bg-blue-400/20';
    default: return 'text-green-500 bg-green-500/20';
  }
}

export function getWeatherIcon(condition: WeatherForecast['condition']): string {
  switch (condition) {
    case 'clear': return '☀️';
    case 'cloudy': return '☁️';
    case 'rain': return '🌧️';
    case 'snow': return '❄️';
    case 'storm': return '⛈️';
    case 'fog': return '🌫️';
    default: return '☀️';
  }
}

// Alias for backwards compatibility
export const fetchWeatherForecast = getWeatherForecast;

// Geocode a location to lat/lon
export async function geocodeLocation(location: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      // Return default coordinates for demo
      return { lat: 38.2085, lon: -85.7585 }; // Louisville, KY
    }
    
    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.length > 0) {
      return { lat: data[0].lat, lon: data[0].lon };
    }
    return null;
  } catch (error) {
    logger.error('WEATHER_SERVICE', 'Geocoding error', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

// Fetch current weather
export async function fetchCurrentWeather(lat: number, lon: number): Promise<WeatherForecast | null> {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      return generateMockForecast(1)[0];
    }
    
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const condition = mapCondition(data.weather?.[0]?.main || 'Clear');
    
    return {
      date: new Date().toISOString().split('T')[0],
      temp: Math.round(data.main?.temp || 70),
      tempMin: Math.round(data.main?.temp_min || 60),
      tempMax: Math.round(data.main?.temp_max || 80),
      condition,
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      windSpeed: Math.round(data.wind?.speed || 0),
      humidity: data.main?.humidity || 50,
      description: data.weather?.[0]?.description || 'Clear',
      icon: data.weather?.[0]?.icon || '01d',
      isOutdoorWorkday: true,
      workImpact: 'none'
    };
  } catch (error) {
    logger.error('WEATHER_SERVICE', 'Weather fetch error', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

// Get weather for a specific project
export async function getProjectWeather(projectSlug: string): Promise<WeatherForecast[]> {
  try {
    const { prisma } = await import('@/lib/db');
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { locationLat: true, locationLon: true },
    });

    const lat = project?.locationLat ?? 38.2085; // Default: Louisville, KY
    const lon = project?.locationLon ?? -85.7585;
    return getWeatherForecast(lat, lon, 7);
  } catch {
    return getWeatherForecast(38.2085, -85.7585, 7);
  }
}

// Auto-populate daily report weather
export async function autoPopulateDailyReportWeather(lat: number, lon: number): Promise<DailyWeatherData | null> {
  const forecast = await fetchCurrentWeather(lat, lon);
  if (!forecast) return null;
  
  return {
    date: forecast.date,
    high: forecast.tempMax,
    low: forecast.tempMin,
    highTemp: forecast.tempMax,
    lowTemp: forecast.tempMin,
    condition: forecast.description,
    conditions: forecast.description,
    precipitation: forecast.precipitation,
    precipChance: forecast.precipitation > 0 ? 50 : 0,
    windSpeed: forecast.windSpeed,
    humidity: forecast.humidity,
    isWorkDay: forecast.isOutdoorWorkday
  };
}
