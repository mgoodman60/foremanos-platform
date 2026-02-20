import {
  fetchWeatherForecast,
  forecastsToDailyWeather
} from './weather-service';
import { formatWeatherForIntro } from './weather-automation';
import { logger } from './logger';

/**
 * Generate intro message for Daily Report Chat
 * Includes weather forecast and context-aware follow-up
 */
export async function generateIntroMessage(
  projectLat: number,
  projectLon: number,
  projectCity: string,
  projectState?: string,
  hasExistingData: boolean = false,
  isLaterInDay: boolean = false
): Promise<string> {
  // Get weather forecast
  const weatherForecasts = await fetchWeatherForecast(projectLat, projectLon);

  // Format date
  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  const month = today.toLocaleDateString('en-US', { month: 'long' });
  const day = today.getDate();
  const year = today.getFullYear();

  // Build intro message
  let intro = `Good morning.\nToday is ${dayOfWeek}, ${month} ${day}, ${year}.\n\n`;

  // Add weather if available
  if (weatherForecasts && weatherForecasts.length > 0) {
    const dailyWeatherData = forecastsToDailyWeather(weatherForecasts);
    intro += `Weather forecast for today:\n`;
    intro += formatWeatherForIntro(dailyWeatherData);
    intro += `\n\n`;
  } else {
    intro += `Weather forecast unavailable. Please check local conditions.\n\n`;
  }

  intro += `Daily Report Chat activated. I'll guide you step-by-step to capture today's site activity and generate the official daily report.\n\n`;

  // Add context-aware follow-up
  if (isLaterInDay) {
    intro += `You can continue adding updates, photos, or corrections before the report finalizes at 6:00 PM.`;
  } else if (hasExistingData) {
    intro += `I've loaded what we have so far for today. We can continue or make updates as needed.`;
  } else {
    intro += `Let's start with today's work. I'll walk through this step-by-step — you can make updates anytime.`;
  }

  return intro;
}

/**
 * Get weather summary for a location (simple helper)
 */
export async function getWeatherSummary(
  lat: number,
  lon: number
): Promise<string> {
  try {
    const forecasts = await fetchWeatherForecast(lat, lon);
    if (forecasts && forecasts.length > 0) {
      const dailyWeatherData = forecastsToDailyWeather(forecasts);
      return formatWeatherForIntro(dailyWeatherData);
    }
    return 'Weather data unavailable.';
  } catch (error) {
    logger.error('DAILY_REPORT_INTRO', 'Weather fetch error', error as Error);
    return 'Unable to retrieve weather data.';
  }
}

/**
 * Get the first workflow question for daily report
 * @param hasExistingData Whether we're resuming an existing report
 */
export function getFirstWorkflowQuestion(hasExistingData: boolean): string {
  if (hasExistingData) {
    return "I've loaded your progress from earlier. Would you like to continue from where we left off, or would you prefer to review what we have so far?";
  }
  return "Let's start capturing today's site activity. What work activities took place today? Please describe the main tasks and progress made.";
}
