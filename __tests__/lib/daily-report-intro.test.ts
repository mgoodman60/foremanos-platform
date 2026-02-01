import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock weather service
const mocks = vi.hoisted(() => ({
  fetchWeatherForecast: vi.fn(),
  forecastsToDailyWeather: vi.fn(),
  formatWeatherForIntro: vi.fn(),
}));

vi.mock('@/lib/weather-service', () => ({
  fetchWeatherForecast: mocks.fetchWeatherForecast,
  forecastsToDailyWeather: mocks.forecastsToDailyWeather,
}));

vi.mock('@/lib/weather-automation', () => ({
  formatWeatherForIntro: mocks.formatWeatherForIntro,
}));

import {
  generateIntroMessage,
  getWeatherSummary,
  getFirstWorkflowQuestion,
} from '@/lib/daily-report-intro';

describe('Daily Report Intro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Date to a fixed time for consistent tests - Friday, January 31, 2026
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T14:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateIntroMessage', () => {
    const mockWeatherForecasts = [
      {
        date: '2026-01-31',
        temp: 72,
        tempMin: 65,
        tempMax: 80,
        condition: 'clear' as const,
        precipitation: 0,
        windSpeed: 10,
        humidity: 50,
        description: 'Clear sky',
        icon: '01d',
        isOutdoorWorkday: true,
        workImpact: 'none' as const,
      },
    ];

    const mockDailyWeatherData = [
      {
        date: '2026-01-31',
        high: 80,
        low: 65,
        condition: 'clear',
        conditions: 'Clear sky',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 10,
        humidity: 50,
        isWorkDay: true,
      },
    ];

    beforeEach(() => {
      mocks.fetchWeatherForecast.mockResolvedValue(mockWeatherForecasts);
      mocks.forecastsToDailyWeather.mockReturnValue(mockDailyWeatherData);
      mocks.formatWeatherForIntro.mockReturnValue(
        "Today's weather: Clear sky. Temperature range: 65°F to 80°F."
      );
    });

    it('should generate intro message with weather forecast', async () => {
      const result = await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(result).toContain('Good morning');
      expect(result).toContain('Saturday, January 31, 2026');
      expect(result).toContain('Weather forecast for today');
      expect(result).toContain("Today's weather: Clear sky");
      expect(result).toContain('Daily Report Chat activated');
    });

    it('should call fetchWeatherForecast with correct coordinates', async () => {
      await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(mocks.fetchWeatherForecast).toHaveBeenCalledWith(38.2085, -85.7585);
    });

    it('should call forecastsToDailyWeather to convert forecast data', async () => {
      await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(mocks.forecastsToDailyWeather).toHaveBeenCalledWith(mockWeatherForecasts);
    });

    it('should call formatWeatherForIntro with daily weather data', async () => {
      await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(mocks.formatWeatherForIntro).toHaveBeenCalledWith(mockDailyWeatherData);
    });

    it('should include correct date formatting', async () => {
      const result = await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(result).toMatch(/Today is Saturday, January 31, 2026/);
    });

    it('should show default follow-up message when no existing data and early in day', async () => {
      const result = await generateIntroMessage(
        38.2085,
        -85.7585,
        'Louisville',
        'KY',
        false,
        false
      );

      expect(result).toContain(
        "Let's start with today's work. I'll walk through this step-by-step — you can make updates anytime."
      );
    });

    it('should show existing data message when hasExistingData is true', async () => {
      const result = await generateIntroMessage(
        38.2085,
        -85.7585,
        'Louisville',
        'KY',
        true,
        false
      );

      expect(result).toContain(
        "I've loaded what we have so far for today. We can continue or make updates as needed."
      );
    });

    it('should show later-in-day message when isLaterInDay is true', async () => {
      const result = await generateIntroMessage(
        38.2085,
        -85.7585,
        'Louisville',
        'KY',
        false,
        true
      );

      expect(result).toContain(
        'You can continue adding updates, photos, or corrections before the report finalizes at 6:00 PM.'
      );
    });

    it('should prioritize isLaterInDay over hasExistingData', async () => {
      const result = await generateIntroMessage(
        38.2085,
        -85.7585,
        'Louisville',
        'KY',
        true,
        true
      );

      expect(result).toContain('before the report finalizes at 6:00 PM');
      expect(result).not.toContain('what we have so far for today');
    });

    it('should handle weather forecast unavailable', async () => {
      mocks.fetchWeatherForecast.mockResolvedValue([]);

      const result = await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(result).toContain('Weather forecast unavailable. Please check local conditions.');
      expect(mocks.formatWeatherForIntro).not.toHaveBeenCalled();
    });

    it('should handle null weather forecast', async () => {
      mocks.fetchWeatherForecast.mockResolvedValue(null);

      const result = await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(result).toContain('Weather forecast unavailable. Please check local conditions.');
    });

    it('should work with different coordinates', async () => {
      await generateIntroMessage(40.7128, -74.006, 'New York', 'NY');

      expect(mocks.fetchWeatherForecast).toHaveBeenCalledWith(40.7128, -74.006);
    });

    it('should work with different city names', async () => {
      const result = await generateIntroMessage(34.0522, -118.2437, 'Los Angeles', 'CA');

      expect(result).toBeDefined();
      expect(result).toContain('Good morning');
    });

    it('should work without state parameter', async () => {
      const result = await generateIntroMessage(38.2085, -85.7585, 'Louisville');

      expect(result).toBeDefined();
      expect(result).toContain('Daily Report Chat activated');
    });

    it('should handle weather fetch errors gracefully', async () => {
      mocks.fetchWeatherForecast.mockRejectedValue(new Error('Weather API error'));

      // Should throw the error as the function doesn't catch it
      await expect(
        generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY')
      ).rejects.toThrow('Weather API error');
    });

    it('should format complete message structure', async () => {
      const result = await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      // Check structure
      expect(result).toContain('Good morning.\nToday is');
      expect(result).toContain('Weather forecast for today:\n');
      expect(result).toContain('Daily Report Chat activated.');
    });

    it('should handle different days of week correctly', async () => {
      vi.setSystemTime(new Date('2026-02-01T08:00:00.000Z')); // Sunday

      const result = await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(result).toContain('Sunday, February 1, 2026');
    });

    it('should handle edge case dates', async () => {
      vi.setSystemTime(new Date('2026-12-31T08:00:00.000Z')); // End of year

      const result = await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(result).toContain('Thursday, December 31, 2026');
    });

    it('should handle formatWeatherForIntro returning empty string', async () => {
      mocks.formatWeatherForIntro.mockReturnValue('');

      const result = await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(result).toContain('Weather forecast for today:\n');
      expect(result).toContain('Daily Report Chat activated');
    });
  });

  describe('getWeatherSummary', () => {
    const mockWeatherForecasts = [
      {
        date: '2026-01-31',
        temp: 72,
        tempMin: 65,
        tempMax: 80,
        condition: 'clear' as const,
        precipitation: 0,
        windSpeed: 10,
        humidity: 50,
        description: 'Clear sky',
        icon: '01d',
        isOutdoorWorkday: true,
        workImpact: 'none' as const,
      },
    ];

    const mockDailyWeatherData = [
      {
        date: '2026-01-31',
        high: 80,
        low: 65,
        condition: 'clear',
        conditions: 'Clear sky',
        precipitation: 0,
        precipChance: 0,
        windSpeed: 10,
        humidity: 50,
        isWorkDay: true,
      },
    ];

    beforeEach(() => {
      mocks.fetchWeatherForecast.mockResolvedValue(mockWeatherForecasts);
      mocks.forecastsToDailyWeather.mockReturnValue(mockDailyWeatherData);
      mocks.formatWeatherForIntro.mockReturnValue(
        "Today's weather: Clear sky. Temperature range: 65°F to 80°F."
      );
    });

    it('should return formatted weather summary', async () => {
      const result = await getWeatherSummary(38.2085, -85.7585);

      expect(result).toBe("Today's weather: Clear sky. Temperature range: 65°F to 80°F.");
      expect(mocks.fetchWeatherForecast).toHaveBeenCalledWith(38.2085, -85.7585);
    });

    it('should handle weather data unavailable', async () => {
      mocks.fetchWeatherForecast.mockResolvedValue([]);

      const result = await getWeatherSummary(38.2085, -85.7585);

      expect(result).toBe('Weather data unavailable.');
    });

    it('should handle null weather forecast', async () => {
      mocks.fetchWeatherForecast.mockResolvedValue(null);

      const result = await getWeatherSummary(38.2085, -85.7585);

      expect(result).toBe('Weather data unavailable.');
    });

    it('should handle fetch errors with error message', async () => {
      mocks.fetchWeatherForecast.mockRejectedValue(new Error('Network error'));

      const result = await getWeatherSummary(38.2085, -85.7585);

      expect(result).toBe('Unable to retrieve weather data.');
    });

    it('should log error when fetch fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('API error');
      mocks.fetchWeatherForecast.mockRejectedValue(error);

      await getWeatherSummary(38.2085, -85.7585);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[DailyReportIntro] Weather fetch error:',
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should work with different coordinates', async () => {
      await getWeatherSummary(40.7128, -74.006);

      expect(mocks.fetchWeatherForecast).toHaveBeenCalledWith(40.7128, -74.006);
    });

    it('should handle empty forecasts array', async () => {
      mocks.fetchWeatherForecast.mockResolvedValue([]);

      const result = await getWeatherSummary(38.2085, -85.7585);

      expect(result).toBe('Weather data unavailable.');
    });

    it('should call forecastsToDailyWeather when forecasts exist', async () => {
      await getWeatherSummary(38.2085, -85.7585);

      expect(mocks.forecastsToDailyWeather).toHaveBeenCalledWith(mockWeatherForecasts);
    });

    it('should call formatWeatherForIntro with converted data', async () => {
      await getWeatherSummary(38.2085, -85.7585);

      expect(mocks.formatWeatherForIntro).toHaveBeenCalledWith(mockDailyWeatherData);
    });

    it('should handle timeout errors', async () => {
      mocks.fetchWeatherForecast.mockRejectedValue(new Error('Request timeout'));

      const result = await getWeatherSummary(38.2085, -85.7585);

      expect(result).toBe('Unable to retrieve weather data.');
    });

    it('should handle JSON parse errors', async () => {
      mocks.fetchWeatherForecast.mockRejectedValue(new Error('Invalid JSON'));

      const result = await getWeatherSummary(38.2085, -85.7585);

      expect(result).toBe('Unable to retrieve weather data.');
    });

    it('should handle formatWeatherForIntro errors gracefully', async () => {
      mocks.formatWeatherForIntro.mockImplementation(() => {
        throw new Error('Format error');
      });

      // The function catches errors and returns a fallback message
      const result = await getWeatherSummary(38.2085, -85.7585);

      expect(result).toBe('Unable to retrieve weather data.');
    });
  });

  describe('getFirstWorkflowQuestion', () => {
    it('should return continuation question when hasExistingData is true', () => {
      const result = getFirstWorkflowQuestion(true);

      expect(result).toBe(
        "I've loaded your progress from earlier. Would you like to continue from where we left off, or would you prefer to review what we have so far?"
      );
    });

    it('should return initial question when hasExistingData is false', () => {
      const result = getFirstWorkflowQuestion(false);

      expect(result).toBe(
        "Let's start capturing today's site activity. What work activities took place today? Please describe the main tasks and progress made."
      );
    });

    it('should handle hasExistingData explicitly set to false', () => {
      const result = getFirstWorkflowQuestion(false);

      expect(result).toContain("Let's start capturing today's site activity");
    });

    it('should handle hasExistingData explicitly set to true', () => {
      const result = getFirstWorkflowQuestion(true);

      expect(result).toContain("I've loaded your progress from earlier");
    });

    it('should return string type', () => {
      const result = getFirstWorkflowQuestion(false);

      expect(typeof result).toBe('string');
    });

    it('should have different messages for different states', () => {
      const withData = getFirstWorkflowQuestion(true);
      const withoutData = getFirstWorkflowQuestion(false);

      expect(withData).not.toBe(withoutData);
    });

    it('should provide clear guidance in initial message', () => {
      const result = getFirstWorkflowQuestion(false);

      expect(result).toContain('work activities');
      expect(result).toContain('tasks and progress');
    });

    it('should offer options in continuation message', () => {
      const result = getFirstWorkflowQuestion(true);

      expect(result).toContain('continue from where we left off');
      expect(result).toContain('review what we have so far');
    });

    it('should be concise and user-friendly', () => {
      const withData = getFirstWorkflowQuestion(true);
      const withoutData = getFirstWorkflowQuestion(false);

      expect(withData.length).toBeGreaterThan(50);
      expect(withData.length).toBeLessThan(200);
      expect(withoutData.length).toBeGreaterThan(50);
      expect(withoutData.length).toBeLessThan(200);
    });
  });

  describe('Edge Cases and Integration', () => {
    beforeEach(() => {
      // Reset mocks to default behavior for this describe block
      const mockWeatherForecasts = [
        {
          date: '2026-01-31',
          temp: 72,
          tempMin: 65,
          tempMax: 80,
          condition: 'clear' as const,
          precipitation: 0,
          windSpeed: 10,
          humidity: 50,
          description: 'Clear sky',
          icon: '01d',
          isOutdoorWorkday: true,
          workImpact: 'none' as const,
        },
      ];

      const mockDailyWeatherData = [
        {
          date: '2026-01-31',
          high: 80,
          low: 65,
          condition: 'clear',
          conditions: 'Clear sky',
          precipitation: 0,
          precipChance: 0,
          windSpeed: 10,
          humidity: 50,
          isWorkDay: true,
        },
      ];

      mocks.fetchWeatherForecast.mockResolvedValue(mockWeatherForecasts);
      mocks.forecastsToDailyWeather.mockReturnValue(mockDailyWeatherData);
      mocks.formatWeatherForIntro.mockReturnValue(
        "Today's weather: Clear sky. Temperature range: 65°F to 80°F."
      );
    });

    it('should handle multiple weather forecasts', async () => {
      const multiDayForecasts = [
        {
          date: '2026-01-31',
          temp: 72,
          tempMin: 65,
          tempMax: 80,
          condition: 'clear' as const,
          precipitation: 0,
          windSpeed: 10,
          humidity: 50,
          description: 'Clear sky',
          icon: '01d',
          isOutdoorWorkday: true,
          workImpact: 'none' as const,
        },
        {
          date: '2026-02-01',
          temp: 68,
          tempMin: 62,
          tempMax: 75,
          condition: 'cloudy' as const,
          precipitation: 0,
          windSpeed: 12,
          humidity: 60,
          description: 'Cloudy',
          icon: '03d',
          isOutdoorWorkday: true,
          workImpact: 'low' as const,
        },
      ];

      mocks.fetchWeatherForecast.mockResolvedValue(multiDayForecasts);

      await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');

      expect(mocks.forecastsToDailyWeather).toHaveBeenCalledWith(multiDayForecasts);
    });

    it('should handle extreme coordinates', async () => {
      await generateIntroMessage(90, 180, 'North Pole', '');

      expect(mocks.fetchWeatherForecast).toHaveBeenCalledWith(90, 180);
    });

    it('should handle negative coordinates', async () => {
      await generateIntroMessage(-33.8688, 151.2093, 'Sydney', 'NSW');

      expect(mocks.fetchWeatherForecast).toHaveBeenCalledWith(-33.8688, 151.2093);
    });

    it('should maintain consistent message structure across all conditions', async () => {
      const conditions = [
        { hasData: false, isLater: false },
        { hasData: true, isLater: false },
        { hasData: false, isLater: true },
        { hasData: true, isLater: true },
      ];

      for (const condition of conditions) {
        const result = await generateIntroMessage(
          38.2085,
          -85.7585,
          'Louisville',
          'KY',
          condition.hasData,
          condition.isLater
        );

        expect(result).toContain('Good morning');
        expect(result).toContain('Daily Report Chat activated');
      }
    });

    it('should handle very long city names', async () => {
      const result = await generateIntroMessage(
        38.2085,
        -85.7585,
        'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch',
        'Wales'
      );

      expect(result).toBeDefined();
      expect(result).toContain('Good morning');
    });

    it('should handle special characters in city names', async () => {
      const result = await generateIntroMessage(
        48.8566,
        2.3522,
        'Saint-Étienne-du-Rouvray',
        'France'
      );

      expect(result).toBeDefined();
      expect(result).toContain('Good morning');
    });
  });

  describe('Performance and Reliability', () => {
    beforeEach(() => {
      // Reset mocks to default behavior for this describe block
      const mockWeatherForecasts = [
        {
          date: '2026-01-31',
          temp: 72,
          tempMin: 65,
          tempMax: 80,
          condition: 'clear' as const,
          precipitation: 0,
          windSpeed: 10,
          humidity: 50,
          description: 'Clear sky',
          icon: '01d',
          isOutdoorWorkday: true,
          workImpact: 'none' as const,
        },
      ];

      const mockDailyWeatherData = [
        {
          date: '2026-01-31',
          high: 80,
          low: 65,
          condition: 'clear',
          conditions: 'Clear sky',
          precipitation: 0,
          precipChance: 0,
          windSpeed: 10,
          humidity: 50,
          isWorkDay: true,
        },
      ];

      mocks.fetchWeatherForecast.mockResolvedValue(mockWeatherForecasts);
      mocks.forecastsToDailyWeather.mockReturnValue(mockDailyWeatherData);
      mocks.formatWeatherForIntro.mockReturnValue(
        "Today's weather: Clear sky. Temperature range: 65°F to 80°F."
      );
    });

    it('should complete within reasonable time', async () => {
      const start = Date.now();
      await generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY');
      const duration = Date.now() - start;

      // Should complete in less than 100ms with mocked weather service
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent calls', async () => {
      const promises = [
        generateIntroMessage(38.2085, -85.7585, 'Louisville', 'KY'),
        generateIntroMessage(40.7128, -74.006, 'New York', 'NY'),
        generateIntroMessage(34.0522, -118.2437, 'Los Angeles', 'CA'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toContain('Good morning');
      });
    });

    it('should not mutate input parameters', async () => {
      const lat = 38.2085;
      const lon = -85.7585;
      const city = 'Louisville';
      const state = 'KY';

      await generateIntroMessage(lat, lon, city, state);

      expect(lat).toBe(38.2085);
      expect(lon).toBe(-85.7585);
      expect(city).toBe('Louisville');
      expect(state).toBe('KY');
    });
  });
});
