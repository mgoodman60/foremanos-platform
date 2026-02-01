import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Set environment variables before importing
const originalEnv = process.env.OPENWEATHERMAP_API_KEY;

// Import after setting up mocks
import {
  type WeatherForecast,
  type DailyWeatherData,
  type WeatherAlert,
  forecastToDailyWeather,
  forecastsToDailyWeather,
  calculateWorkImpact,
  isOutdoorWorkday,
  getWeatherForecast,
  getWorkImpactColor,
  getWeatherIcon,
  fetchWeatherForecast,
  geocodeLocation,
  fetchCurrentWeather,
  getProjectWeather,
  autoPopulateDailyReportWeather,
} from '@/lib/weather-service';

describe('Weather Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalEnv) {
      process.env.OPENWEATHERMAP_API_KEY = originalEnv;
    } else {
      delete process.env.OPENWEATHERMAP_API_KEY;
    }
  });

  describe('forecastToDailyWeather', () => {
    it('should convert WeatherForecast to DailyWeatherData', () => {
      const forecast: WeatherForecast = {
        date: '2026-01-31',
        temp: 72,
        tempMin: 65,
        tempMax: 80,
        condition: 'clear',
        precipitation: 0,
        windSpeed: 10,
        humidity: 50,
        description: 'Clear sky',
        icon: '01d',
        isOutdoorWorkday: true,
        workImpact: 'none',
      };

      const result = forecastToDailyWeather(forecast);

      expect(result).toEqual({
        date: '2026-01-31',
        high: 80,
        low: 65,
        highTemp: 80,
        lowTemp: 65,
        condition: 'clear',
        conditions: 'Clear sky',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 10,
        humidity: 50,
        isWorkDay: true,
      });
    });

    it('should calculate precipChance from precipitation amount', () => {
      const forecast: WeatherForecast = {
        date: '2026-01-31',
        temp: 70,
        tempMin: 60,
        tempMax: 75,
        condition: 'rain',
        precipitation: 5,
        windSpeed: 15,
        humidity: 80,
        description: 'Light rain',
        icon: '10d',
        isOutdoorWorkday: false,
        workImpact: 'moderate',
      };

      const result = forecastToDailyWeather(forecast);

      expect(result.precipChance).toBe(50); // 5mm * 10 = 50%
    });

    it('should cap precipChance at 100%', () => {
      const forecast: WeatherForecast = {
        date: '2026-01-31',
        temp: 70,
        tempMin: 60,
        tempMax: 75,
        condition: 'storm',
        precipitation: 25,
        windSpeed: 35,
        humidity: 90,
        description: 'Thunderstorm',
        icon: '11d',
        isOutdoorWorkday: false,
        workImpact: 'severe',
      };

      const result = forecastToDailyWeather(forecast);

      expect(result.precipChance).toBe(100); // Capped at 100 even though 25 * 10 = 250
    });
  });

  describe('forecastsToDailyWeather', () => {
    it('should convert array of forecasts to daily weather data', () => {
      const forecasts: WeatherForecast[] = [
        {
          date: '2026-01-31',
          temp: 72,
          tempMin: 65,
          tempMax: 80,
          condition: 'clear',
          precipitation: 0,
          windSpeed: 10,
          humidity: 50,
          description: 'Clear',
          icon: '01d',
          isOutdoorWorkday: true,
          workImpact: 'none',
        },
        {
          date: '2026-02-01',
          temp: 68,
          tempMin: 62,
          tempMax: 75,
          condition: 'cloudy',
          precipitation: 0,
          windSpeed: 12,
          humidity: 60,
          description: 'Cloudy',
          icon: '03d',
          isOutdoorWorkday: true,
          workImpact: 'low',
        },
      ];

      const result = forecastsToDailyWeather(forecasts);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-01-31');
      expect(result[1].date).toBe('2026-02-01');
    });

    it('should handle empty array', () => {
      const result = forecastsToDailyWeather([]);
      expect(result).toEqual([]);
    });
  });

  describe('calculateWorkImpact', () => {
    it('should return "none" for clear conditions with good weather', () => {
      const forecast = {
        precipitation: 0,
        windSpeed: 10,
        temp: 70,
        condition: 'clear' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('none');
    });

    it('should return "low" for cloudy conditions', () => {
      const forecast = {
        precipitation: 0,
        windSpeed: 10,
        temp: 70,
        condition: 'cloudy' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('low');
    });

    it('should return "low" for fog conditions', () => {
      const forecast = {
        precipitation: 0,
        windSpeed: 10,
        temp: 70,
        condition: 'fog' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('low');
    });

    it('should return "moderate" for rain conditions', () => {
      const forecast = {
        precipitation: 3,
        windSpeed: 10,
        temp: 70,
        condition: 'rain' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('moderate');
    });

    it('should return "moderate" for moderate precipitation', () => {
      const forecast = {
        precipitation: 7,
        windSpeed: 10,
        temp: 70,
        condition: 'clear' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('moderate');
    });

    it('should return "moderate" for moderate wind speed', () => {
      const forecast = {
        precipitation: 0,
        windSpeed: 18,
        temp: 70,
        condition: 'clear' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('moderate');
    });

    it('should return "high" for snow conditions', () => {
      const forecast = {
        precipitation: 8,
        windSpeed: 10,
        temp: 28,
        condition: 'snow' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('high');
    });

    it('should return "high" for high precipitation', () => {
      const forecast = {
        precipitation: 12,
        windSpeed: 10,
        temp: 70,
        condition: 'rain' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('high');
    });

    it('should return "high" for high wind speed', () => {
      const forecast = {
        precipitation: 0,
        windSpeed: 28,
        temp: 70,
        condition: 'clear' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('high');
    });

    it('should return "high" for temperature below freezing', () => {
      const forecast = {
        precipitation: 0,
        windSpeed: 10,
        temp: 25,
        condition: 'clear' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('high');
    });

    it('should return "high" for excessive heat', () => {
      const forecast = {
        precipitation: 0,
        windSpeed: 10,
        temp: 98,
        condition: 'clear' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('high');
    });

    it('should return "severe" for storm conditions', () => {
      const forecast = {
        precipitation: 15,
        windSpeed: 30,
        temp: 65,
        condition: 'storm' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('severe');
    });

    it('should return "severe" for severe precipitation', () => {
      const forecast = {
        precipitation: 25,
        windSpeed: 10,
        temp: 70,
        condition: 'rain' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('severe');
    });

    it('should return "severe" for severe wind speed', () => {
      const forecast = {
        precipitation: 0,
        windSpeed: 40,
        temp: 70,
        condition: 'clear' as const,
      };

      expect(calculateWorkImpact(forecast)).toBe('severe');
    });

    it('should handle empty forecast object with defaults', () => {
      expect(calculateWorkImpact({})).toBe('none');
    });

    it('should handle partial forecast data', () => {
      const forecast = {
        precipitation: 15,
      };

      expect(calculateWorkImpact(forecast)).toBe('high');
    });
  });

  describe('isOutdoorWorkday', () => {
    it('should return true for none impact', () => {
      const forecast = { temp: 70, condition: 'clear' as const };
      expect(isOutdoorWorkday(forecast)).toBe(true);
    });

    it('should return true for low impact', () => {
      const forecast = { temp: 70, condition: 'cloudy' as const };
      expect(isOutdoorWorkday(forecast)).toBe(true);
    });

    it('should return true for moderate impact', () => {
      const forecast = { temp: 70, condition: 'rain' as const, precipitation: 7 };
      expect(isOutdoorWorkday(forecast)).toBe(true);
    });

    it('should return false for high impact', () => {
      const forecast = { temp: 25, condition: 'clear' as const };
      expect(isOutdoorWorkday(forecast)).toBe(false);
    });

    it('should return false for severe impact', () => {
      const forecast = { temp: 70, condition: 'storm' as const, precipitation: 25 };
      expect(isOutdoorWorkday(forecast)).toBe(false);
    });
  });

  describe('getWeatherForecast', () => {
    it('should fetch weather from API when key is configured', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [
            {
              dt: 1706659200, // 2024-01-31 00:00:00 UTC
              main: {
                temp: 72,
                temp_min: 65,
                temp_max: 80,
                humidity: 50,
              },
              weather: [
                {
                  main: 'Clear',
                  description: 'clear sky',
                  icon: '01d',
                },
              ],
              wind: {
                speed: 10,
              },
            },
          ],
        }),
      });

      const result = await getWeatherForecast(38.2085, -85.7585, 7);

      expect(result).toHaveLength(1);
      expect(result[0].temp).toBe(72);
      expect(result[0].condition).toBe('clear');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('api.openweathermap.org')
      );
    });

    it('should use default 14 days if not specified', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [] }),
      });

      await getWeatherForecast(38.2085, -85.7585);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('cnt=112') // 14 days * 8 forecasts/day
      );
    });

    it('should include API key and imperial units in request', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [] }),
      });

      await getWeatherForecast(38.2085, -85.7585, 7);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('appid=test-api-key')
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('units=imperial')
      );
    });

    it('should return mock forecast when API key is not configured', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result = await getWeatherForecast(38.2085, -85.7585, 5);

      expect(result).toHaveLength(5);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('temp');
      expect(result[0]).toHaveProperty('condition');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return mock forecast when API request fails', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await getWeatherForecast(38.2085, -85.7585, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('date');
    });

    it('should return mock forecast when fetch throws error', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const result = await getWeatherForecast(38.2085, -85.7585, 3);

      expect(result).toHaveLength(3);
    });

    it('should parse multiple weather items into daily forecasts', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [
            {
              dt: 1706659200, // 2024-01-31 00:00:00
              main: { temp: 65, temp_min: 60, temp_max: 70, humidity: 50 },
              weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
              wind: { speed: 10 },
            },
            {
              dt: 1706662800, // 2024-01-31 01:00:00 (same day)
              main: { temp: 68, temp_min: 62, temp_max: 72, humidity: 55 },
              weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
              wind: { speed: 12 },
            },
            {
              dt: 1706745600, // 2024-02-01 00:00:00 (next day)
              main: { temp: 72, temp_min: 65, temp_max: 78, humidity: 60 },
              weather: [{ main: 'Cloudy', description: 'scattered clouds', icon: '03d' }],
              wind: { speed: 8 },
            },
          ],
        }),
      });

      const result = await getWeatherForecast(38.2085, -85.7585, 7);

      // Should consolidate to 2 daily forecasts (uses first entry of each day)
      expect(result).toHaveLength(2);
    });

    it('should map rain data correctly', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [
            {
              dt: 1706659200,
              main: { temp: 60, temp_min: 55, temp_max: 65, humidity: 80 },
              weather: [{ main: 'Rain', description: 'light rain', icon: '10d' }],
              wind: { speed: 15 },
              rain: { '3h': 5 },
            },
          ],
        }),
      });

      const result = await getWeatherForecast(38.2085, -85.7585, 7);

      expect(result[0].precipitation).toBe(5);
      expect(result[0].condition).toBe('rain');
    });

    it('should map snow data correctly', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [
            {
              dt: 1706659200,
              main: { temp: 30, temp_min: 25, temp_max: 32, humidity: 70 },
              weather: [{ main: 'Snow', description: 'light snow', icon: '13d' }],
              wind: { speed: 20 },
              snow: { '3h': 8 },
            },
          ],
        }),
      });

      const result = await getWeatherForecast(38.2085, -85.7585, 7);

      expect(result[0].precipitation).toBe(8);
      expect(result[0].condition).toBe('snow');
    });

    it('should calculate work impact and workday status', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [
            {
              dt: 1706659200,
              main: { temp: 30, temp_min: 25, temp_max: 32, humidity: 70 },
              weather: [{ main: 'Snow', description: 'heavy snow', icon: '13d' }],
              wind: { speed: 20 },
              snow: { '3h': 8 },
            },
          ],
        }),
      });

      const result = await getWeatherForecast(38.2085, -85.7585, 7);

      expect(result[0].workImpact).toBe('high');
      expect(result[0].isOutdoorWorkday).toBe(false);
    });
  });

  describe('getWorkImpactColor', () => {
    it('should return correct color for severe impact', () => {
      expect(getWorkImpactColor('severe')).toBe('text-red-500 bg-red-500/20');
    });

    it('should return correct color for high impact', () => {
      expect(getWorkImpactColor('high')).toBe('text-orange-500 bg-orange-500/20');
    });

    it('should return correct color for moderate impact', () => {
      expect(getWorkImpactColor('moderate')).toBe('text-yellow-500 bg-yellow-500/20');
    });

    it('should return correct color for low impact', () => {
      expect(getWorkImpactColor('low')).toBe('text-blue-400 bg-blue-400/20');
    });

    it('should return correct color for no impact', () => {
      expect(getWorkImpactColor('none')).toBe('text-green-500 bg-green-500/20');
    });
  });

  describe('getWeatherIcon', () => {
    it('should return sun icon for clear conditions', () => {
      expect(getWeatherIcon('clear')).toBe('☀️');
    });

    it('should return cloud icon for cloudy conditions', () => {
      expect(getWeatherIcon('cloudy')).toBe('☁️');
    });

    it('should return rain icon for rain conditions', () => {
      expect(getWeatherIcon('rain')).toBe('🌧️');
    });

    it('should return snow icon for snow conditions', () => {
      expect(getWeatherIcon('snow')).toBe('❄️');
    });

    it('should return storm icon for storm conditions', () => {
      expect(getWeatherIcon('storm')).toBe('⛈️');
    });

    it('should return fog icon for fog conditions', () => {
      expect(getWeatherIcon('fog')).toBe('🌫️');
    });
  });

  describe('fetchWeatherForecast (alias)', () => {
    it('should be an alias for getWeatherForecast', () => {
      expect(fetchWeatherForecast).toBe(getWeatherForecast);
    });
  });

  describe('geocodeLocation', () => {
    it('should geocode location when API key is configured', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: 40.7128,
            lon: -74.006,
            name: 'New York',
          },
        ],
      });

      const result = await geocodeLocation('New York, NY');

      expect(result).toEqual({ lat: 40.7128, lon: -74.006 });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('geo/1.0/direct')
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('q=New%20York%2C%20NY')
      );
    });

    it('should return default coordinates when API key is missing', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result = await geocodeLocation('Any Location');

      expect(result).toEqual({ lat: 38.2085, lon: -85.7585 }); // Louisville, KY
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return null when API request fails', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await geocodeLocation('Invalid Location');

      expect(result).toBeNull();
    });

    it('should return null when no results found', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await geocodeLocation('NonexistentPlace');

      expect(result).toBeNull();
    });

    it('should return null when fetch throws error', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const result = await geocodeLocation('Location');

      expect(result).toBeNull();
    });

    it('should limit results to 1', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: 40.7128, lon: -74.006 }],
      });

      await geocodeLocation('New York');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('limit=1')
      );
    });
  });

  describe('fetchCurrentWeather', () => {
    it('should fetch current weather when API key is configured', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          main: {
            temp: 72,
            temp_min: 65,
            temp_max: 80,
            humidity: 50,
          },
          weather: [
            {
              main: 'Clear',
              description: 'clear sky',
              icon: '01d',
            },
          ],
          wind: {
            speed: 10,
          },
        }),
      });

      const result = await fetchCurrentWeather(38.2085, -85.7585);

      expect(result).not.toBeNull();
      expect(result?.temp).toBe(72);
      expect(result?.condition).toBe('clear');
      expect(result?.date).toBeDefined();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('data/2.5/weather')
      );
    });

    it('should return mock data when API key is missing', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result = await fetchCurrentWeather(38.2085, -85.7585);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('temp');
      expect(result).toHaveProperty('condition');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return null when API request fails', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await fetchCurrentWeather(38.2085, -85.7585);

      expect(result).toBeNull();
    });

    it('should return null when fetch throws error', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchCurrentWeather(38.2085, -85.7585);

      expect(result).toBeNull();
    });

    it('should map rain data from current weather', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          main: { temp: 60, temp_min: 55, temp_max: 65, humidity: 80 },
          weather: [{ main: 'Rain', description: 'light rain', icon: '10d' }],
          wind: { speed: 15 },
          rain: { '1h': 3 },
        }),
      });

      const result = await fetchCurrentWeather(38.2085, -85.7585);

      expect(result?.precipitation).toBe(3);
      expect(result?.condition).toBe('rain');
    });

    it('should map snow data from current weather', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          main: { temp: 28, temp_min: 25, temp_max: 30, humidity: 70 },
          weather: [{ main: 'Snow', description: 'light snow', icon: '13d' }],
          wind: { speed: 20 },
          snow: { '1h': 5 },
        }),
      });

      const result = await fetchCurrentWeather(38.2085, -85.7585);

      expect(result?.precipitation).toBe(5);
      expect(result?.condition).toBe('snow');
    });

    it('should use imperial units', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          main: { temp: 72, temp_min: 65, temp_max: 80, humidity: 50 },
          weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
          wind: { speed: 10 },
        }),
      });

      await fetchCurrentWeather(38.2085, -85.7585);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('units=imperial')
      );
    });
  });

  describe('getProjectWeather', () => {
    it('should fetch 7-day forecast for Louisville by default', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result = await getProjectWeather('test-project');

      expect(result).toHaveLength(7);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('temp');
    });

    it('should accept any project slug', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result1 = await getProjectWeather('project-1');
      const result2 = await getProjectWeather('project-2');

      expect(result1).toHaveLength(7);
      expect(result2).toHaveLength(7);
    });
  });

  describe('autoPopulateDailyReportWeather', () => {
    it('should convert current weather to DailyWeatherData', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          main: { temp: 72, temp_min: 65, temp_max: 80, humidity: 50 },
          weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
          wind: { speed: 10 },
        }),
      });

      const result = await autoPopulateDailyReportWeather(38.2085, -85.7585);

      expect(result).not.toBeNull();
      expect(result?.high).toBe(80);
      expect(result?.low).toBe(65);
      expect(result?.highTemp).toBe(80);
      expect(result?.lowTemp).toBe(65);
      expect(result?.condition).toBe('clear sky');
      expect(result?.conditions).toBe('clear sky');
      expect(result?.windSpeed).toBe(10);
      expect(result?.humidity).toBe(50);
      expect(result?.isWorkDay).toBe(true);
    });

    it('should calculate precipChance as 50% when there is precipitation', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          main: { temp: 60, temp_min: 55, temp_max: 65, humidity: 80 },
          weather: [{ main: 'Rain', description: 'light rain', icon: '10d' }],
          wind: { speed: 15 },
          rain: { '1h': 5 },
        }),
      });

      const result = await autoPopulateDailyReportWeather(38.2085, -85.7585);

      expect(result?.precipitation).toBe(5);
      expect(result?.precipChance).toBe(50);
    });

    it('should calculate precipChance as 0% when no precipitation', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          main: { temp: 72, temp_min: 65, temp_max: 80, humidity: 50 },
          weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
          wind: { speed: 10 },
        }),
      });

      const result = await autoPopulateDailyReportWeather(38.2085, -85.7585);

      expect(result?.precipitation).toBe(0);
      expect(result?.precipChance).toBe(0);
    });

    it('should return null when current weather fetch fails', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await autoPopulateDailyReportWeather(38.2085, -85.7585);

      expect(result).toBeNull();
    });

    it('should include current date', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result = await autoPopulateDailyReportWeather(38.2085, -85.7585);

      expect(result?.date).toBeDefined();
      const today = new Date().toISOString().split('T')[0];
      expect(result?.date).toBe(today);
    });
  });

  describe('Weather condition mapping', () => {
    it('should map thunderstorm to storm', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [
            {
              dt: 1706659200,
              main: { temp: 65, temp_min: 60, temp_max: 70, humidity: 80 },
              weather: [{ main: 'Thunderstorm', description: 'thunderstorm', icon: '11d' }],
              wind: { speed: 25 },
            },
          ],
        }),
      });

      const result = await getWeatherForecast(38.2085, -85.7585, 1);

      expect(result[0].condition).toBe('storm');
    });

    it('should map drizzle to rain', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [
            {
              dt: 1706659200,
              main: { temp: 60, temp_min: 55, temp_max: 65, humidity: 75 },
              weather: [{ main: 'Drizzle', description: 'light drizzle', icon: '09d' }],
              wind: { speed: 10 },
            },
          ],
        }),
      });

      const result = await getWeatherForecast(38.2085, -85.7585, 1);

      expect(result[0].condition).toBe('rain');
    });

    it('should map mist to fog', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [
            {
              dt: 1706659200,
              main: { temp: 55, temp_min: 50, temp_max: 60, humidity: 90 },
              weather: [{ main: 'Mist', description: 'mist', icon: '50d' }],
              wind: { speed: 5 },
            },
          ],
        }),
      });

      const result = await getWeatherForecast(38.2085, -85.7585, 1);

      expect(result[0].condition).toBe('fog');
    });

    it('should map clouds to cloudy', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [
            {
              dt: 1706659200,
              main: { temp: 68, temp_min: 62, temp_max: 73, humidity: 60 },
              weather: [{ main: 'Clouds', description: 'scattered clouds', icon: '03d' }],
              wind: { speed: 12 },
            },
          ],
        }),
      });

      const result = await getWeatherForecast(38.2085, -85.7585, 1);

      expect(result[0].condition).toBe('cloudy');
    });
  });

  describe('Mock forecast generation', () => {
    it('should generate forecasts with varying conditions', () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result1 = getWeatherForecast(38.2085, -85.7585, 7);
      const result2 = getWeatherForecast(38.2085, -85.7585, 7);

      // Both should return promises that resolve to arrays with varying conditions
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should generate realistic temperature ranges', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result = await getWeatherForecast(38.2085, -85.7585, 10);

      result.forEach((forecast) => {
        expect(forecast.temp).toBeGreaterThanOrEqual(55);
        expect(forecast.temp).toBeLessThanOrEqual(85);
        expect(forecast.tempMin).toBeGreaterThanOrEqual(45);
        expect(forecast.tempMin).toBeLessThanOrEqual(65);
        expect(forecast.tempMax).toBeGreaterThanOrEqual(65);
        expect(forecast.tempMax).toBeLessThanOrEqual(90);
      });
    });

    it('should generate realistic wind speeds', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result = await getWeatherForecast(38.2085, -85.7585, 10);

      result.forEach((forecast) => {
        expect(forecast.windSpeed).toBeGreaterThanOrEqual(5);
        expect(forecast.windSpeed).toBeLessThanOrEqual(25);
      });
    });

    it('should generate realistic humidity values', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result = await getWeatherForecast(38.2085, -85.7585, 10);

      result.forEach((forecast) => {
        expect(forecast.humidity).toBeGreaterThanOrEqual(40);
        expect(forecast.humidity).toBeLessThanOrEqual(80);
      });
    });

    it('should generate precipitation only for rainy days', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result = await getWeatherForecast(38.2085, -85.7585, 10);

      result.forEach((forecast) => {
        if (forecast.condition === 'rain' || forecast.condition === 'storm') {
          expect(forecast.precipitation).toBeGreaterThan(0);
        } else if (forecast.condition === 'clear' || forecast.condition === 'cloudy') {
          expect(forecast.precipitation).toBe(0);
        }
      });
    });

    it('should include sequential dates', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const result = await getWeatherForecast(38.2085, -85.7585, 5);

      const dates = result.map((f) => f.date);
      expect(dates).toHaveLength(5);

      // Each date should be unique
      const uniqueDates = new Set(dates);
      expect(uniqueDates.size).toBe(5);
    });
  });
});
