import { z } from 'zod';

/**
 * Allowed file types for document upload
 */
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
] as const;

/**
 * File extensions for display
 */
export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.xlsx',
  '.xls',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.txt',
  '.csv',
] as const;

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Document categories
 */
/**
 * Must match the Prisma DocumentCategory enum in schema.prisma
 */
export const DOCUMENT_CATEGORIES = [
  'budget_cost',
  'schedule',
  'plans_drawings',
  'specifications',
  'contracts',
  'daily_reports',
  'photos',
  'other',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/**
 * File upload validation schema (client-side validation)
 */
export const fileUploadSchema = z.object({
  file: z
    .custom<File>((val) => val instanceof File, {
      message: 'Please select a file',
    })
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
    )
    .refine(
      (file) => ALLOWED_FILE_TYPES.includes(file.type as typeof ALLOWED_FILE_TYPES[number]),
      `File type not supported. Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`
    ),
});

export type FileUploadData = z.infer<typeof fileUploadSchema>;

/**
 * Document upload metadata schema
 */
export const documentUploadSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name must be less than 255 characters'),
  category: z.enum(DOCUMENT_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a valid category' }),
  }),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  tags: z
    .array(z.string().max(50, 'Tag must be less than 50 characters'))
    .max(10, 'Maximum 10 tags allowed')
    .optional(),
});

export type DocumentUploadFormData = z.infer<typeof documentUploadSchema>;

/**
 * Document search schema
 */
export const documentSearchSchema = z.object({
  query: z
    .string()
    .max(500, 'Search query must be less than 500 characters')
    .optional(),
  category: z.enum([...DOCUMENT_CATEGORIES, 'all']).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  sortBy: z.enum(['name', 'date', 'category', 'size']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type DocumentSearchFormData = z.infer<typeof documentSearchSchema>;

/**
 * Document rename schema
 */
export const documentRenameSchema = z.object({
  name: z
    .string()
    .min(1, 'Document name is required')
    .max(255, 'Document name must be less than 255 characters')
    .regex(/^[^<>:"/\\|?*]+$/, 'Document name contains invalid characters'),
});

export type DocumentRenameFormData = z.infer<typeof documentRenameSchema>;

/**
 * Document category update schema
 */
export const documentCategorySchema = z.object({
  category: z.enum(DOCUMENT_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a valid category' }),
  }),
});

export type DocumentCategoryFormData = z.infer<typeof documentCategorySchema>;

/**
 * Batch upload validation
 */
export const batchUploadSchema = z.object({
  files: z
    .array(fileUploadSchema.shape.file)
    .min(1, 'Please select at least one file')
    .max(20, 'Maximum 20 files allowed per batch'),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
});

export type BatchUploadFormData = z.infer<typeof batchUploadSchema>;
