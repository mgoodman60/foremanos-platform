/**
 * Daily Report Permissions
 * Role-based permission logic for daily report CRUD and approval workflows.
 */

import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('DAILY_REPORT_PERMS');

/** Daily report permission roles */
export type DailyReportRole = 'VIEWER' | 'REPORTER' | 'SUPERVISOR' | 'ADMIN';

/** Valid status transitions for the approval state machine */
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: ['DRAFT'],
};

/** Map project member role strings to DailyReportRole */
const ROLE_MAP: Record<string, DailyReportRole> = {
  admin: 'ADMIN',
  owner: 'ADMIN',
  superintendent: 'SUPERVISOR',
  manager: 'SUPERVISOR',
  supervisor: 'SUPERVISOR',
  reporter: 'REPORTER',
  foreman: 'REPORTER',
  worker: 'REPORTER',
  member: 'REPORTER',
  client: 'VIEWER',
  viewer: 'VIEWER',
  guest: 'VIEWER',
};

/**
 * Get the user's daily report role for a given project.
 * Checks ProjectMember role AND project ownership.
 * Returns null if user has no access.
 */
export async function getDailyReportRole(
  userId: string,
  projectId: string
): Promise<DailyReportRole | null> {
  try {
    // Check if user is the project owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (project?.ownerId === userId) {
      return 'ADMIN';
    }

    // Check ProjectMember role
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { role: true },
    });

    if (!member) {
      return null;
    }

    const mappedRole = ROLE_MAP[member.role.toLowerCase()];
    if (!mappedRole) {
      log.warn('Unknown project member role', { role: member.role, userId, projectId });
      return 'VIEWER'; // Default to most restrictive for unknown roles
    }

    return mappedRole;
  } catch (error) {
    log.error('Failed to get daily report role', error as Error, { userId, projectId });
    return null;
  }
}

/** Can create new daily reports */
export function canCreateReport(role: DailyReportRole): boolean {
  return role === 'REPORTER' || role === 'SUPERVISOR' || role === 'ADMIN';
}

/** Can edit a daily report (depends on role, ownership, and report status) */
export function canEditReport(
  role: DailyReportRole,
  reportCreatedBy: string,
  userId: string,
  reportStatus: string
): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'SUPERVISOR') return true;
  if (role === 'REPORTER') {
    // Reporters can only edit their own reports that are DRAFT or REJECTED
    return reportCreatedBy === userId && (reportStatus === 'DRAFT' || reportStatus === 'REJECTED');
  }
  return false;
}

/** Can submit a report for approval */
export function canSubmitReport(
  role: DailyReportRole,
  reportCreatedBy: string,
  userId: string
): boolean {
  if (role === 'ADMIN' || role === 'SUPERVISOR') return true;
  if (role === 'REPORTER') return reportCreatedBy === userId;
  return false;
}

/** Can approve or reject reports */
export function canApproveReport(role: DailyReportRole): boolean {
  return role === 'SUPERVISOR' || role === 'ADMIN';
}

/** Can delete reports (soft delete) */
export function canDeleteReport(role: DailyReportRole): boolean {
  return role === 'ADMIN';
}

/** Can view reports */
export function canViewReport(role: DailyReportRole): boolean {
  return true; // All roles can view
}

/** Check if a status transition is valid */
export function isValidTransition(currentStatus: string, newStatus: string): boolean {
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

/** Sanitize text input by stripping HTML tags and script content */
export function sanitizeText(input: string): string {
  if (!input) return input;
  // Decode HTML entities FIRST so encoded tags become real tags for stripping
  let sanitized = input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
  // Remove script tags and their content (after decoding)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove all HTML tags (after decoding)
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  return sanitized.trim();
}
