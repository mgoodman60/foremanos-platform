/**
 * Validation utilities for report finalization
 */

import { prisma } from '../db';
import type { ReportData, PhotoEntry } from '../types/report-data';

/**
 * Helper functions to replace date-fns-tz
 */
export function toZonedTime(date: Date, timezone: string): Date {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offset = tzDate.getTime() - utcDate.getTime();
  return new Date(date.getTime() + offset);
}

export function fromZonedTime(date: Date, timezone: string): Date {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offset = tzDate.getTime() - utcDate.getTime();
  return new Date(date.getTime() - offset);
}

/**
 * Check if report has any data to finalize
 */
export async function hasReportData(conversationId: string): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      reportData: true,
      weatherSnapshots: true,
      photos: true,
      scheduleUpdates: true,
      quantityCalculations: true,
      ChatMessage: {
        select: { id: true },
        take: 2, // Need at least 2 messages (intro + 1 user message)
      },
    },
  });

  if (!conversation) {
    return false;
  }

  // Check if there's meaningful data
  const hasMessages = (conversation.ChatMessage?.length || 0) > 1;
  const reportData = conversation.reportData as ReportData | null;
  const hasReportData = !!reportData && Object.keys(reportData).length > 0;
  const hasWeather = !!conversation.weatherSnapshots;
  const photos = conversation.photos as unknown as PhotoEntry[] | null;
  const hasPhotos = !!photos && photos.length > 0;
  const hasSchedule = !!conversation.scheduleUpdates;
  const hasCalculations = !!conversation.quantityCalculations;

  return hasMessages && (hasReportData || hasWeather || hasPhotos || hasSchedule || hasCalculations);
}

/**
 * Check if user is currently active in the conversation
 */
export async function isUserActive(conversationId: string, thresholdMinutes: number = 5): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { lastActivityAt: true },
  });

  if (!conversation?.lastActivityAt) {
    return false;
  }

  const now = new Date();
  const lastActivity = new Date(conversation.lastActivityAt);
  const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / 1000 / 60;

  return minutesSinceActivity < thresholdMinutes;
}

/**
 * Update last activity timestamp for a conversation
 */
export async function updateLastActivity(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastActivityAt: new Date() },
  });
}
