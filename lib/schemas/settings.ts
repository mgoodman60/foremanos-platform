import { z } from 'zod';

/**
 * Common US timezones
 */
export const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
] as const;

export type CommonTimezone = (typeof COMMON_TIMEZONES)[number];

/**
 * Notification methods
 */
export const NOTIFICATION_METHODS = ['in_app', 'email'] as const;

export type NotificationMethod = (typeof NOTIFICATION_METHODS)[number];

/**
 * Weather preferences schema
 */
export const weatherPreferencesSchema = z.object({
  enableTemperatureAlerts: z.boolean().default(true),
  enablePrecipitationAlerts: z.boolean().default(true),
  enableWindAlerts: z.boolean().default(true),
  enableVisibilityAlerts: z.boolean().default(false),
  enableMorningBriefing: z.boolean().default(true),
  morningBriefingTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
    .default('07:00'),
  notificationMethod: z
    .enum(NOTIFICATION_METHODS)
    .default('in_app'),
});

export type WeatherPreferencesFormData = z.infer<typeof weatherPreferencesSchema>;

/**
 * Finalization settings schema
 */
export const finalizationSettingsSchema = z.object({
  timezone: z
    .string()
    .min(1, 'Timezone is required'),
  finalizationTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
    .default('18:00'),
  dailyReportsFolderId: z
    .string()
    .max(100, 'Folder ID must be less than 100 characters')
    .optional()
    .or(z.literal('')),
});

export type FinalizationSettingsFormData = z.infer<typeof finalizationSettingsSchema>;
