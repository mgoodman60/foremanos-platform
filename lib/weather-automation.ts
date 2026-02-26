import { DailyWeatherData } from './weather-service';

/**
 * Weather snapshot structure for recording
 */
export interface WeatherSnapshot {
  time: string; // "07:00", "12:00", "16:00"
  timestamp: Date;
  temperature: number; // Fahrenheit
  conditions: string; // e.g., "Clear", "Rain", "Snow"
  rainChance: number; // percentage 0-100
  rainAmount?: string; // e.g., "0.1 in"
  humidity?: number; // percentage
  windSpeed?: number; // mph
}

/**
 * Weather impact assessment
 */
export interface WeatherImpactAssessment {
  hasImpact: boolean;
  severity: 'none' | 'minor' | 'moderate' | 'severe';
  warning: string | null;
  factors: string[]; // List of contributing factors
}

/**
 * Convert DailyWeatherData to WeatherSnapshot
 */
export function createWeatherSnapshot(
  data: DailyWeatherData,
  time: string,
  timestamp: Date
): WeatherSnapshot {
  return {
    time,
    timestamp,
    temperature: data.high, // Use high temp as default
    // @ts-expect-error strictNullChecks migration
    conditions: data.conditions,
    rainChance: data.precipChance || 0,
    rainAmount: data.precipChance > 0 ? 'Possible' : undefined,
    humidity: data.humidity,
    windSpeed: data.windSpeed,
  };
}

/**
 * Analyze weather impact on construction work from forecast data
 * Returns neutral warnings without assuming delays
 */
export function analyzeWeatherImpactFromForecast(
  forecast: DailyWeatherData
): WeatherImpactAssessment {
  const factors: string[] = [];
  let severity: 'none' | 'minor' | 'moderate' | 'severe' = 'none';

  // Check precipitation chance
  if (forecast.precipChance >= 70) {
    factors.push('High precipitation probability');
    severity = 'moderate';
  } else if (forecast.precipChance >= 40) {
    factors.push('Moderate precipitation probability');
    if (severity === 'none') severity = 'minor';
  }

  // Check temperature extremes (in Fahrenheit)
  if (forecast.high >= 95) {
    factors.push('High temperature warning');
    severity = severity === 'none' ? 'moderate' : severity;
  } else if (forecast.low <= 32) {
    factors.push('Freezing temperatures expected');
    severity = severity === 'none' ? 'moderate' : 'severe';
  }

  // Check wind speed
  if (forecast.windSpeed >= 25) {
    factors.push('High wind advisory');
    severity = 'severe';
  } else if (forecast.windSpeed >= 15) {
    factors.push('Elevated wind speeds');
    if (severity === 'none') severity = 'minor';
  }

  // Check conditions
  // @ts-expect-error strictNullChecks migration
  const lowerConditions = forecast.conditions.toLowerCase();
  if (lowerConditions.includes('thunder') || lowerConditions.includes('storm')) {
    factors.push('Storm conditions expected');
    severity = 'severe';
  } else if (lowerConditions.includes('snow') || lowerConditions.includes('ice')) {
    factors.push('Winter weather conditions');
    severity = severity === 'none' ? 'moderate' : 'severe';
  } else if (lowerConditions.includes('fog')) {
    factors.push('Reduced visibility from fog');
    if (severity === 'none') severity = 'minor';
  }

  // Generate warning message
  let warning: string | null = null;
  if (factors.length > 0) {
    warning = `Weather Advisory: ${factors.join(', ')}. Monitor conditions and adjust work plans as needed.`;
  }

  return {
    hasImpact: factors.length > 0,
    severity,
    warning,
    factors,
  };
}

/**
 * Get summary text for daily weather
 */
export function getDailySummary(forecast: DailyWeatherData): string {
  const parts: string[] = [
    `${forecast.conditions}`,
    `High: ${forecast.high}°F`,
    `Low: ${forecast.low}°F`,
  ];

  if (forecast.precipChance > 0) {
    parts.push(`${forecast.precipChance}% chance of precipitation`);
  }

  if (forecast.windSpeed >= 10) {
    parts.push(`Winds ${forecast.windSpeed} mph`);
  }

  return parts.join('. ');
}

/**
 * Format weather data for intro paragraph in daily report
 */
export function formatWeatherForIntro(
  forecasts: DailyWeatherData[]
): string {
  if (!forecasts || forecasts.length === 0) {
    return 'Weather data unavailable.';
  }

  const today = forecasts[0];
  const parts: string[] = [];

  // Basic conditions
  parts.push(`Today's weather: ${today.conditions}`);
  parts.push(`Temperature range: ${today.low}°F to ${today.high}°F`);

  // Precipitation
  if (today.precipChance >= 50) {
    parts.push(`${today.precipChance}% chance of precipitation - consider weather delays`);
  } else if (today.precipChance >= 20) {
    parts.push(`${today.precipChance}% chance of precipitation`);
  }

  // Wind
  if (today.windSpeed >= 20) {
    parts.push(`High winds expected (${today.windSpeed} mph) - crane operations may be affected`);
  } else if (today.windSpeed >= 15) {
    parts.push(`Moderate winds (${today.windSpeed} mph)`);
  }

  return parts.join('. ') + '.';
}

/**
 * Check if weather is suitable for outdoor work
 */
export function isSuitableForWork(forecast: DailyWeatherData): {
  suitable: boolean;
  reason?: string;
} {
  // Check for severe conditions
  const conditions = (forecast.conditions?.toLowerCase() || '');
  if (conditions.includes('thunder') || conditions.includes('lightning')) {
    return { suitable: false, reason: 'Lightning risk - outdoor work suspended' };
  }

  if (conditions.includes('tornado') || conditions.includes('hurricane')) {
    return { suitable: false, reason: 'Severe weather - all work suspended' };
  }

  // Check temperature extremes
  if (forecast.high >= 105 || forecast.low <= 20) {
    return { suitable: false, reason: 'Extreme temperature conditions' };
  }

  // Check wind
  if (forecast.windSpeed >= 35) {
    return { suitable: false, reason: 'Dangerous wind conditions' };
  }

  // Check precipitation
  if (forecast.precipChance >= 90) {
    return { suitable: false, reason: 'High probability of precipitation' };
  }

  return { suitable: true };
}

/**
 * Analyze weather impact (alias for backward compatibility)
 */
export function analyzeWeatherImpact(forecasts: DailyWeatherData[]): WeatherImpactAssessment {
  if (!forecasts || forecasts.length === 0) {
    return { hasImpact: false, severity: 'none', warning: null, factors: [] };
  }
  return analyzeWeatherImpactFromForecast(forecasts[0]);
}

/**
 * Get current time slot for weather recording
 * Returns the nearest recording time if within 30 minutes
 */
export function getCurrentTimeSlot(): string | null {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Recording windows (within 30 minutes of target time)
  const slots = [
    { target: '07:00', min: 6 * 60 + 30, max: 7 * 60 + 30 },
    { target: '12:00', min: 11 * 60 + 30, max: 12 * 60 + 30 },
    { target: '16:00', min: 15 * 60 + 30, max: 16 * 60 + 30 },
  ];

  for (const slot of slots) {
    if (totalMinutes >= slot.min && totalMinutes <= slot.max) {
      return slot.target;
    }
  }

  return null;
}

/**
 * Check if a snapshot should be recorded (not already exists for this time slot)
 */
export function shouldRecordSnapshot(
  existingSnapshots: WeatherSnapshot[] | null,
  timeSlot: string
): boolean {
  if (!existingSnapshots || existingSnapshots.length === 0) {
    return true;
  }
  return !existingSnapshots.some(s => s.time === timeSlot);
}

/**
 * Record a weather snapshot, adding to existing array
 */
export function recordWeatherSnapshot(
  existingSnapshots: WeatherSnapshot[] | null,
  newSnapshot: WeatherSnapshot
): WeatherSnapshot[] {
  const snapshots = existingSnapshots ? [...existingSnapshots] : [];
  
  // Check if already exists for this time slot
  const existingIndex = snapshots.findIndex(s => s.time === newSnapshot.time);
  if (existingIndex >= 0) {
    // Update existing
    snapshots[existingIndex] = newSnapshot;
  } else {
    // Add new
    snapshots.push(newSnapshot);
  }

  // Sort by time
  return snapshots.sort((a, b) => a.time.localeCompare(b.time));
}
