import { z } from 'zod';

/**
 * Create project form schema
 */
export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_.,()]+$/, 'Project name contains invalid characters'),
  guestUsername: z
    .string()
    .min(3, 'Job Pin must be at least 3 characters')
    .max(30, 'Job Pin must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Job Pin can only contain letters, numbers, underscores, and hyphens'),
  guestPassword: z
    .string()
    .max(128, 'Password must be less than 128 characters')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
});

export type CreateProjectFormData = z.infer<typeof createProjectSchema>;

/**
 * Edit project form schema
 */
export const editProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  status: z.enum(['active', 'archived', 'completed']).optional(),
});

export type EditProjectFormData = z.infer<typeof editProjectSchema>;

/**
 * Rename project schema
 */
export const renameProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters'),
});

export type RenameProjectFormData = z.infer<typeof renameProjectSchema>;

/**
 * Invite member schema
 */
export const inviteMemberSchema = z.object({
  emailOrUsername: z
    .string()
    .min(1, 'Email or username is required')
    .max(100, 'Email or username must be less than 100 characters'),
  role: z.enum(['viewer', 'editor'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
});

export type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

/**
 * Guest credentials schema
 */
export const guestCredentialsSchema = z.object({
  guestUsername: z
    .string()
    .min(3, 'Job Pin must be at least 3 characters')
    .max(30, 'Job Pin must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Job Pin can only contain letters, numbers, underscores, and hyphens'),
  guestPassword: z
    .string()
    .max(128, 'Password must be less than 128 characters')
    .optional()
    .or(z.literal('')),
});

export type GuestCredentialsFormData = z.infer<typeof guestCredentialsSchema>;
