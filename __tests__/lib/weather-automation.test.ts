import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DailyWeatherData } from '@/lib/weather-service';
import {
  WeatherSnapshot,
  WeatherImpactAssessment,
  createWeatherSnapshot,
  analyzeWeatherImpactFromForecast,
  getDailySummary,
  formatWeatherForIntro,
  isSuitableForWork,
  analyzeWeatherImpact,
  getCurrentTimeSlot,
  shouldRecordSnapshot,
  recordWeatherSnapshot,
} from '@/lib/weather-automation';

describe('Weather Automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // createWeatherSnapshot Tests
  // ============================================

  describe('createWeatherSnapshot', () => {
    it('should create weather snapshot with all fields', () => {
      const data: DailyWeatherData = {
        date: '2024-01-15',
        high: 75,
        low: 55,
        conditions: 'Clear',
        condition: 'clear',
        precipitation: 0,
        precipChance: 20,
        windSpeed: 10,
        humidity: 65,
        isWorkDay: true,
      };

      const result = createWeatherSnapshot(data, '07:00', new Date('2024-01-15T07:00:00'));

      expect(result).toEqual({
        time: '07:00',
        timestamp: new Date('2024-01-15T07:00:00'),
        temperature: 75,
        conditions: 'Clear',
        rainChance: 20,
        rainAmount: 'Possible',
        humidity: 65,
        windSpeed: 10,
      });
    });

    it('should handle zero precipitation chance', () => {
      const data: DailyWeatherData = {
        date: '2024-01-15',
        high: 80,
        low: 60,
        conditions: 'Sunny',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 5,
        humidity: 50,
        isWorkDay: true,
      };

      const result = createWeatherSnapshot(data, '12:00', new Date('2024-01-15T12:00:00'));

      expect(result.rainChance).toBe(0);
      expect(result.rainAmount).toBeUndefined();
    });

    it('should handle missing optional fields', () => {
      const data: DailyWeatherData = {
        date: '2024-01-15',
        high: 70,
        low: 50,
        conditions: 'Partly Cloudy',
        condition: 'cloudy',
        precipitation: 0,
        precipChance: 10,
        windSpeed: 0,
        humidity: 0,
        isWorkDay: true,
      };

      const result = createWeatherSnapshot(data, '16:00', new Date('2024-01-15T16:00:00'));

      expect(result.humidity).toBe(0);
      expect(result.windSpeed).toBe(0);
    });

    it('should use high temperature for snapshot temperature', () => {
      const data: DailyWeatherData = {
        date: '2024-01-15',
        high: 95,
        low: 65,
        conditions: 'Hot',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 15,
        humidity: 30,
        isWorkDay: true,
      };

      const result = createWeatherSnapshot(data, '12:00', new Date('2024-01-15T12:00:00'));

      expect(result.temperature).toBe(95);
    });
  });

  // ============================================
  // analyzeWeatherImpactFromForecast Tests
  // ============================================

  describe('analyzeWeatherImpactFromForecast', () => {
    it('should return no impact for ideal conditions', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 72,
        low: 55,
        conditions: 'Clear',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 5,
        humidity: 50,
        isWorkDay: true,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(false);
      expect(result.severity).toBe('none');
      expect(result.warning).toBeNull();
      expect(result.factors).toEqual([]);
    });

    it('should detect high precipitation probability (>=70%)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 70,
        low: 60,
        conditions: 'Rain',
        condition: 'rain',
        precipitation: 10,
        precipChance: 80,
        windSpeed: 10,
        humidity: 90,
        isWorkDay: false,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('moderate');
      expect(result.factors).toContain('High precipitation probability');
      expect(result.warning).toContain('Weather Advisory');
    });

    it('should detect moderate precipitation probability (40-69%)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 68,
        low: 58,
        conditions: 'Cloudy',
        condition: 'cloudy',
        precipitation: 5,
        precipChance: 50,
        windSpeed: 8,
        humidity: 70,
        isWorkDay: true,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('minor');
      expect(result.factors).toContain('Moderate precipitation probability');
    });

    it('should detect high temperature warning (>=95°F)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-07-15',
        high: 98,
        low: 75,
        conditions: 'Clear',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 5,
        humidity: 40,
        isWorkDay: true,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('moderate');
      expect(result.factors).toContain('High temperature warning');
    });

    it('should detect freezing temperatures (<=32°F)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 40,
        low: 28,
        conditions: 'Clear',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 10,
        humidity: 50,
        isWorkDay: true,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('moderate');
      expect(result.factors).toContain('Freezing temperatures expected');
    });

    it('should escalate to severe for freezing + other factors', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 35,
        low: 25,
        conditions: 'Snow',
        condition: 'snow',
        precipitation: 5,
        precipChance: 80,
        windSpeed: 20,
        humidity: 85,
        isWorkDay: false,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('severe');
      expect(result.factors).toContain('Freezing temperatures expected');
    });

    it('should detect high wind advisory (>=25 mph)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 65,
        low: 50,
        conditions: 'Windy',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 30,
        humidity: 40,
        isWorkDay: false,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('severe');
      expect(result.factors).toContain('High wind advisory');
    });

    it('should detect elevated wind speeds (15-24 mph)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 68,
        low: 52,
        conditions: 'Breezy',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 18,
        humidity: 45,
        isWorkDay: true,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('minor');
      expect(result.factors).toContain('Elevated wind speeds');
    });

    it('should detect thunderstorm conditions', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 75,
        low: 65,
        conditions: 'Thunderstorms expected',
        condition: 'storm',
        precipitation: 20,
        precipChance: 90,
        windSpeed: 20,
        humidity: 95,
        isWorkDay: false,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('severe');
      expect(result.factors).toContain('Storm conditions expected');
    });

    it('should detect storm conditions (case insensitive)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 70,
        low: 60,
        conditions: 'STORM WARNING',
        condition: 'storm',
        precipitation: 15,
        precipChance: 85,
        windSpeed: 25,
        humidity: 90,
        isWorkDay: false,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('severe');
      expect(result.factors).toContain('Storm conditions expected');
    });

    it('should detect snow conditions', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 30,
        low: 20,
        conditions: 'Snow showers',
        condition: 'snow',
        precipitation: 10,
        precipChance: 70,
        windSpeed: 15,
        humidity: 80,
        isWorkDay: false,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('severe');
      expect(result.factors).toContain('Winter weather conditions');
    });

    it('should detect ice conditions', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 32,
        low: 28,
        conditions: 'Freezing rain and ice',
        condition: 'rain',
        precipitation: 5,
        precipChance: 80,
        windSpeed: 10,
        humidity: 90,
        isWorkDay: false,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('severe');
      expect(result.factors).toContain('Winter weather conditions');
    });

    it('should detect fog conditions', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 65,
        low: 55,
        conditions: 'Dense fog',
        condition: 'fog',
        precipitation: 0,
        precipChance: 10,
        windSpeed: 5,
        humidity: 95,
        isWorkDay: true,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('minor');
      expect(result.factors).toContain('Reduced visibility from fog');
    });

    it('should combine multiple factors and use highest severity', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 96,
        low: 75,
        conditions: 'Thunderstorms',
        condition: 'storm',
        precipitation: 25,
        precipChance: 85,
        windSpeed: 28,
        humidity: 95,
        isWorkDay: false,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('severe');
      expect(result.factors.length).toBeGreaterThan(2);
      expect(result.factors).toContain('High precipitation probability');
      expect(result.factors).toContain('High temperature warning');
      expect(result.factors).toContain('High wind advisory');
      expect(result.factors).toContain('Storm conditions expected');
    });

    it('should generate proper warning message', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 85,
        low: 65,
        conditions: 'Partly Cloudy',
        condition: 'cloudy',
        precipitation: 5,
        precipChance: 45,
        windSpeed: 16,
        humidity: 60,
        isWorkDay: true,
      };

      const result = analyzeWeatherImpactFromForecast(forecast);

      expect(result.warning).toBe(
        'Weather Advisory: Moderate precipitation probability, Elevated wind speeds. Monitor conditions and adjust work plans as needed.'
      );
    });
  });

  // ============================================
  // getDailySummary Tests
  // ============================================

  describe('getDailySummary', () => {
    it('should format basic weather summary', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 75,
        low: 55,
        conditions: 'Clear',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 5,
        humidity: 50,
        isWorkDay: true,
      };

      const result = getDailySummary(forecast);

      expect(result).toBe('Clear. High: 75°F. Low: 55°F');
    });

    it('should include precipitation when present', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 68,
        low: 58,
        conditions: 'Rain',
        condition: 'rain',
        precipitation: 10,
        precipChance: 60,
        windSpeed: 8,
        humidity: 80,
        isWorkDay: false,
      };

      const result = getDailySummary(forecast);

      expect(result).toBe('Rain. High: 68°F. Low: 58°F. 60% chance of precipitation');
    });

    it('should include wind speed when >= 10 mph', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 70,
        low: 52,
        conditions: 'Windy',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 20,
        humidity: 45,
        isWorkDay: true,
      };

      const result = getDailySummary(forecast);

      expect(result).toBe('Windy. High: 70°F. Low: 52°F. Winds 20 mph');
    });

    it('should include both precipitation and wind', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 65,
        low: 50,
        conditions: 'Rainy and Windy',
        condition: 'rain',
        precipitation: 15,
        precipChance: 80,
        windSpeed: 25,
        humidity: 85,
        isWorkDay: false,
      };

      const result = getDailySummary(forecast);

      expect(result).toBe('Rainy and Windy. High: 65°F. Low: 50°F. 80% chance of precipitation. Winds 25 mph');
    });

    it('should not include wind when < 10 mph', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 72,
        low: 54,
        conditions: 'Calm',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 5,
        humidity: 50,
        isWorkDay: true,
      };

      const result = getDailySummary(forecast);

      expect(result).not.toContain('Winds');
    });
  });

  // ============================================
  // formatWeatherForIntro Tests
  // ============================================

  describe('formatWeatherForIntro', () => {
    it('should handle empty forecast array', () => {
      const result = formatWeatherForIntro([]);

      expect(result).toBe('Weather data unavailable.');
    });

    it('should handle null forecast', () => {
      const result = formatWeatherForIntro(null as any);

      expect(result).toBe('Weather data unavailable.');
    });

    it('should format basic weather intro', () => {
      const forecasts: DailyWeatherData[] = [
        {
          date: '2024-01-15',
          high: 75,
          low: 55,
          conditions: 'Clear skies',
          condition: 'clear',
          precipitation: 0,
          precipChance: 10,
          windSpeed: 8,
          humidity: 50,
          isWorkDay: true,
        },
      ];

      const result = formatWeatherForIntro(forecasts);

      expect(result).toBe("Today's weather: Clear skies. Temperature range: 55°F to 75°F.");
    });

    it('should mention weather delays for high precipitation (>=50%)', () => {
      const forecasts: DailyWeatherData[] = [
        {
          date: '2024-01-15',
          high: 68,
          low: 58,
          conditions: 'Rain',
          condition: 'rain',
          precipitation: 20,
          precipChance: 70,
          windSpeed: 12,
          humidity: 85,
          isWorkDay: false,
        },
      ];

      const result = formatWeatherForIntro(forecasts);

      expect(result).toContain('70% chance of precipitation - consider weather delays');
    });

    it('should mention precipitation without delays for moderate chance (20-49%)', () => {
      const forecasts: DailyWeatherData[] = [
        {
          date: '2024-01-15',
          high: 72,
          low: 60,
          conditions: 'Partly Cloudy',
          condition: 'cloudy',
          precipitation: 5,
          precipChance: 30,
          windSpeed: 10,
          humidity: 65,
          isWorkDay: true,
        },
      ];

      const result = formatWeatherForIntro(forecasts);

      expect(result).toContain('30% chance of precipitation');
      expect(result).not.toContain('weather delays');
    });

    it('should not mention precipitation for low chance (<20%)', () => {
      const forecasts: DailyWeatherData[] = [
        {
          date: '2024-01-15',
          high: 80,
          low: 62,
          conditions: 'Mostly Sunny',
          condition: 'clear',
          precipitation: 1,
          precipChance: 15,
          windSpeed: 8,
          humidity: 45,
          isWorkDay: true,
        },
      ];

      const result = formatWeatherForIntro(forecasts);

      expect(result).not.toContain('precipitation');
    });

    it('should mention crane operations for high winds (>=20 mph)', () => {
      const forecasts: DailyWeatherData[] = [
        {
          date: '2024-01-15',
          high: 70,
          low: 55,
          conditions: 'Windy',
          condition: 'clear',
          precipitation: 0,
          precipChance: 5,
          windSpeed: 25,
          humidity: 40,
          isWorkDay: true,
        },
      ];

      const result = formatWeatherForIntro(forecasts);

      expect(result).toContain('High winds expected (25 mph) - crane operations may be affected');
    });

    it('should mention moderate winds (15-19 mph)', () => {
      const forecasts: DailyWeatherData[] = [
        {
          date: '2024-01-15',
          high: 72,
          low: 56,
          conditions: 'Breezy',
          condition: 'clear',
          precipitation: 0,
          precipChance: 0,
          windSpeed: 17,
          humidity: 50,
          isWorkDay: true,
        },
      ];

      const result = formatWeatherForIntro(forecasts);

      expect(result).toContain('Moderate winds (17 mph)');
      expect(result).not.toContain('crane');
    });

    it('should not mention winds for low speed (<15 mph)', () => {
      const forecasts: DailyWeatherData[] = [
        {
          date: '2024-01-15',
          high: 75,
          low: 58,
          conditions: 'Calm',
          condition: 'clear',
          precipitation: 0,
          precipChance: 0,
          windSpeed: 10,
          humidity: 50,
          isWorkDay: true,
        },
      ];

      const result = formatWeatherForIntro(forecasts);

      expect(result).not.toContain('wind');
    });

    it('should combine multiple weather factors', () => {
      const forecasts: DailyWeatherData[] = [
        {
          date: '2024-01-15',
          high: 68,
          low: 55,
          conditions: 'Rainy and Windy',
          condition: 'rain',
          precipitation: 15,
          precipChance: 75,
          windSpeed: 22,
          humidity: 90,
          isWorkDay: false,
        },
      ];

      const result = formatWeatherForIntro(forecasts);

      expect(result).toContain("Today's weather: Rainy and Windy");
      expect(result).toContain('Temperature range: 55°F to 68°F');
      expect(result).toContain('75% chance of precipitation - consider weather delays');
      expect(result).toContain('High winds expected (22 mph) - crane operations may be affected');
    });
  });

  // ============================================
  // isSuitableForWork Tests
  // ============================================

  describe('isSuitableForWork', () => {
    it('should return suitable for good conditions', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 72,
        low: 55,
        conditions: 'Clear',
        condition: 'clear',
        precipitation: 0,
        precipChance: 10,
        windSpeed: 8,
        humidity: 50,
        isWorkDay: true,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject thunder conditions', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 75,
        low: 65,
        conditions: 'Thunderstorms',
        condition: 'storm',
        precipitation: 20,
        precipChance: 80,
        windSpeed: 15,
        humidity: 90,
        isWorkDay: false,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Lightning risk - outdoor work suspended');
    });

    it('should reject lightning conditions', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 78,
        low: 68,
        conditions: 'Lightning possible',
        condition: 'storm',
        precipitation: 15,
        precipChance: 70,
        windSpeed: 18,
        humidity: 85,
        isWorkDay: false,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Lightning risk - outdoor work suspended');
    });

    it('should reject tornado conditions', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 80,
        low: 70,
        conditions: 'Tornado watch',
        condition: 'storm',
        precipitation: 30,
        precipChance: 95,
        windSpeed: 40,
        humidity: 95,
        isWorkDay: false,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Severe weather - all work suspended');
    });

    it('should reject hurricane conditions', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 85,
        low: 75,
        conditions: 'Hurricane warning',
        condition: 'storm',
        precipitation: 50,
        precipChance: 100,
        windSpeed: 80,
        humidity: 98,
        isWorkDay: false,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Severe weather - all work suspended');
    });

    it('should reject extreme high temperature (>=105°F)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-07-15',
        high: 108,
        low: 82,
        conditions: 'Clear',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 5,
        humidity: 25,
        isWorkDay: false,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Extreme temperature conditions');
    });

    it('should reject extreme low temperature (<=20°F)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 25,
        low: 15,
        conditions: 'Clear',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 10,
        humidity: 40,
        isWorkDay: false,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Extreme temperature conditions');
    });

    it('should accept borderline high temperature (104°F)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-07-15',
        high: 104,
        low: 78,
        conditions: 'Clear',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 8,
        humidity: 30,
        isWorkDay: true,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(true);
    });

    it('should accept borderline low temperature (21°F)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 35,
        low: 21,
        conditions: 'Clear',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 8,
        humidity: 45,
        isWorkDay: true,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(true);
    });

    it('should reject dangerous wind conditions (>=35 mph)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 68,
        low: 52,
        conditions: 'Very Windy',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 40,
        humidity: 40,
        isWorkDay: false,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Dangerous wind conditions');
    });

    it('should accept borderline wind (34 mph)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 70,
        low: 55,
        conditions: 'Windy',
        condition: 'clear',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 34,
        humidity: 45,
        isWorkDay: true,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(true);
    });

    it('should reject high precipitation probability (>=90%)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 65,
        low: 58,
        conditions: 'Heavy Rain',
        condition: 'rain',
        precipitation: 30,
        precipChance: 95,
        windSpeed: 12,
        humidity: 95,
        isWorkDay: false,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('High probability of precipitation');
    });

    it('should accept borderline precipitation (89%)', () => {
      const forecast: DailyWeatherData = {
        date: '2024-01-15',
        high: 68,
        low: 60,
        conditions: 'Rain',
        condition: 'rain',
        precipitation: 15,
        precipChance: 89,
        windSpeed: 10,
        humidity: 85,
        isWorkDay: true,
      };

      const result = isSuitableForWork(forecast);

      expect(result.suitable).toBe(true);
    });
  });

  // ============================================
  // analyzeWeatherImpact (Array) Tests
  // ============================================

  describe('analyzeWeatherImpact', () => {
    it('should handle empty forecast array', () => {
      const result = analyzeWeatherImpact([]);

      expect(result.hasImpact).toBe(false);
      expect(result.severity).toBe('none');
      expect(result.warning).toBeNull();
      expect(result.factors).toEqual([]);
    });

    it('should handle null forecast', () => {
      const result = analyzeWeatherImpact(null as any);

      expect(result.hasImpact).toBe(false);
      expect(result.severity).toBe('none');
      expect(result.warning).toBeNull();
      expect(result.factors).toEqual([]);
    });

    it('should analyze first forecast in array', () => {
      const forecasts: DailyWeatherData[] = [
        {
          date: '2024-01-15',
          high: 96,
          low: 70,
          conditions: 'Hot',
          condition: 'clear',
          precipitation: 0,
          precipChance: 0,
          windSpeed: 5,
          humidity: 35,
          isWorkDay: true,
        },
        {
          date: '2024-01-16',
          high: 72,
          low: 55,
          conditions: 'Clear',
          condition: 'clear',
          precipitation: 0,
          precipChance: 0,
          windSpeed: 8,
          humidity: 50,
          isWorkDay: true,
        },
      ];

      const result = analyzeWeatherImpact(forecasts);

      expect(result.hasImpact).toBe(true);
      expect(result.severity).toBe('moderate');
      expect(result.factors).toContain('High temperature warning');
    });
  });

  // ============================================
  // getCurrentTimeSlot Tests
  // ============================================

  describe('getCurrentTimeSlot', () => {
    it('should return "07:00" for 7:00 AM', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T07:00:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('07:00');

      vi.useRealTimers();
    });

    it('should return "07:00" for 6:45 AM (within 30 min window)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T06:45:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('07:00');

      vi.useRealTimers();
    });

    it('should return "07:00" for 7:25 AM (within 30 min window)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T07:25:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('07:00');

      vi.useRealTimers();
    });

    it('should return "12:00" for 12:00 PM', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('12:00');

      vi.useRealTimers();
    });

    it('should return "12:00" for 11:35 AM (within 30 min window)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T11:35:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('12:00');

      vi.useRealTimers();
    });

    it('should return "12:00" for 12:30 PM (within 30 min window)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:30:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('12:00');

      vi.useRealTimers();
    });

    it('should return "16:00" for 4:00 PM', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T16:00:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('16:00');

      vi.useRealTimers();
    });

    it('should return "16:00" for 3:40 PM (within 30 min window)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T15:40:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('16:00');

      vi.useRealTimers();
    });

    it('should return "16:00" for 4:30 PM (within 30 min window)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T16:30:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('16:00');

      vi.useRealTimers();
    });

    it('should return null for 8:00 AM (outside windows)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T08:00:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('should return null for 10:00 AM (outside windows)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('should return null for 2:00 PM (outside windows)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T14:00:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('should return null for 5:00 PM (outside windows)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T17:00:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('should return "07:00" at exact window boundary (6:30 AM start)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T06:30:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('07:00');

      vi.useRealTimers();
    });

    it('should return "07:00" at exact window boundary (7:30 AM end)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T07:30:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBe('07:00');

      vi.useRealTimers();
    });

    it('should return null just before window (6:29 AM)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T06:29:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('should return null just after window (7:31 AM)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T07:31:00'));

      const result = getCurrentTimeSlot();

      expect(result).toBeNull();

      vi.useRealTimers();
    });
  });

  // ============================================
  // shouldRecordSnapshot Tests
  // ============================================

  describe('shouldRecordSnapshot', () => {
    it('should return true for null existing snapshots', () => {
      const result = shouldRecordSnapshot(null, '07:00');

      expect(result).toBe(true);
    });

    it('should return true for empty existing snapshots', () => {
      const result = shouldRecordSnapshot([], '07:00');

      expect(result).toBe(true);
    });

    it('should return true when time slot does not exist', () => {
      const existing: WeatherSnapshot[] = [
        {
          time: '07:00',
          timestamp: new Date('2024-01-15T07:00:00'),
          temperature: 65,
          conditions: 'Clear',
          rainChance: 0,
        },
      ];

      const result = shouldRecordSnapshot(existing, '12:00');

      expect(result).toBe(true);
    });

    it('should return false when time slot already exists', () => {
      const existing: WeatherSnapshot[] = [
        {
          time: '07:00',
          timestamp: new Date('2024-01-15T07:00:00'),
          temperature: 65,
          conditions: 'Clear',
          rainChance: 0,
        },
        {
          time: '12:00',
          timestamp: new Date('2024-01-15T12:00:00'),
          temperature: 75,
          conditions: 'Sunny',
          rainChance: 5,
        },
      ];

      const result = shouldRecordSnapshot(existing, '12:00');

      expect(result).toBe(false);
    });

    it('should return true for different time slot with multiple existing', () => {
      const existing: WeatherSnapshot[] = [
        {
          time: '07:00',
          timestamp: new Date('2024-01-15T07:00:00'),
          temperature: 65,
          conditions: 'Clear',
          rainChance: 0,
        },
        {
          time: '12:00',
          timestamp: new Date('2024-01-15T12:00:00'),
          temperature: 75,
          conditions: 'Sunny',
          rainChance: 5,
        },
      ];

      const result = shouldRecordSnapshot(existing, '16:00');

      expect(result).toBe(true);
    });
  });

  // ============================================
  // recordWeatherSnapshot Tests
  // ============================================

  describe('recordWeatherSnapshot', () => {
    it('should add snapshot to empty array', () => {
      const newSnapshot: WeatherSnapshot = {
        time: '07:00',
        timestamp: new Date('2024-01-15T07:00:00'),
        temperature: 65,
        conditions: 'Clear',
        rainChance: 0,
      };

      const result = recordWeatherSnapshot(null, newSnapshot);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(newSnapshot);
    });

    it('should add snapshot to existing array', () => {
      const existing: WeatherSnapshot[] = [
        {
          time: '07:00',
          timestamp: new Date('2024-01-15T07:00:00'),
          temperature: 65,
          conditions: 'Clear',
          rainChance: 0,
        },
      ];

      const newSnapshot: WeatherSnapshot = {
        time: '12:00',
        timestamp: new Date('2024-01-15T12:00:00'),
        temperature: 75,
        conditions: 'Sunny',
        rainChance: 10,
      };

      const result = recordWeatherSnapshot(existing, newSnapshot);

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual(newSnapshot);
    });

    it('should update existing snapshot with same time', () => {
      const existing: WeatherSnapshot[] = [
        {
          time: '07:00',
          timestamp: new Date('2024-01-15T07:00:00'),
          temperature: 65,
          conditions: 'Clear',
          rainChance: 0,
        },
      ];

      const newSnapshot: WeatherSnapshot = {
        time: '07:00',
        timestamp: new Date('2024-01-15T07:05:00'),
        temperature: 68,
        conditions: 'Partly Cloudy',
        rainChance: 15,
      };

      const result = recordWeatherSnapshot(existing, newSnapshot);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(newSnapshot);
    });

    it('should sort snapshots by time', () => {
      const existing: WeatherSnapshot[] = [
        {
          time: '07:00',
          timestamp: new Date('2024-01-15T07:00:00'),
          temperature: 65,
          conditions: 'Clear',
          rainChance: 0,
        },
        {
          time: '16:00',
          timestamp: new Date('2024-01-15T16:00:00'),
          temperature: 78,
          conditions: 'Warm',
          rainChance: 5,
        },
      ];

      const newSnapshot: WeatherSnapshot = {
        time: '12:00',
        timestamp: new Date('2024-01-15T12:00:00'),
        temperature: 72,
        conditions: 'Sunny',
        rainChance: 10,
      };

      const result = recordWeatherSnapshot(existing, newSnapshot);

      expect(result).toHaveLength(3);
      expect(result[0].time).toBe('07:00');
      expect(result[1].time).toBe('12:00');
      expect(result[2].time).toBe('16:00');
    });

    it('should not mutate original array', () => {
      const existing: WeatherSnapshot[] = [
        {
          time: '07:00',
          timestamp: new Date('2024-01-15T07:00:00'),
          temperature: 65,
          conditions: 'Clear',
          rainChance: 0,
        },
      ];

      const originalLength = existing.length;

      const newSnapshot: WeatherSnapshot = {
        time: '12:00',
        timestamp: new Date('2024-01-15T12:00:00'),
        temperature: 75,
        conditions: 'Sunny',
        rainChance: 10,
      };

      recordWeatherSnapshot(existing, newSnapshot);

      expect(existing).toHaveLength(originalLength);
    });

    it('should handle multiple snapshots with update and sort', () => {
      const existing: WeatherSnapshot[] = [
        {
          time: '12:00',
          timestamp: new Date('2024-01-15T12:00:00'),
          temperature: 72,
          conditions: 'Cloudy',
          rainChance: 30,
        },
        {
          time: '16:00',
          timestamp: new Date('2024-01-15T16:00:00'),
          temperature: 75,
          conditions: 'Sunny',
          rainChance: 10,
        },
      ];

      const newSnapshot: WeatherSnapshot = {
        time: '07:00',
        timestamp: new Date('2024-01-15T07:00:00'),
        temperature: 60,
        conditions: 'Cool',
        rainChance: 5,
      };

      const result = recordWeatherSnapshot(existing, newSnapshot);

      expect(result).toHaveLength(3);
      expect(result[0].time).toBe('07:00');
      expect(result[1].time).toBe('12:00');
      expect(result[2].time).toBe('16:00');
    });

    it('should handle all optional fields in snapshot', () => {
      const newSnapshot: WeatherSnapshot = {
        time: '12:00',
        timestamp: new Date('2024-01-15T12:00:00'),
        temperature: 75,
        conditions: 'Rain',
        rainChance: 80,
        rainAmount: '0.5 in',
        humidity: 90,
        windSpeed: 15,
      };

      const result = recordWeatherSnapshot(null, newSnapshot);

      expect(result).toHaveLength(1);
      expect(result[0].rainAmount).toBe('0.5 in');
      expect(result[0].humidity).toBe(90);
      expect(result[0].windSpeed).toBe(15);
    });
  });
});
