import { z } from 'zod';

/**
 * Trade types for photo annotations
 */
export const TRADE_TYPES = [
  'General Contractor',
  'Concrete & Masonry',
  'Carpentry & Framing',
  'Electrical',
  'Plumbing',
  'HVAC & Mechanical',
  'Drywall & Finishes',
  'Site Utilities',
  'Structural Steel',
  'Roofing',
  'Glazing & Windows',
  'Painting & Coating',
  'Flooring',
] as const;

export type TradeType = (typeof TRADE_TYPES)[number];

/**
 * Common photo tags
 */
export const COMMON_PHOTO_TAGS = [
  'Progress',
  'Issue',
  'Safety',
  'Quality',
  'Defect',
  'Completion',
  'Before',
  'After',
  'Detail',
  'Overview',
] as const;

export type PhotoTag = (typeof COMMON_PHOTO_TAGS)[number];

/**
 * Photo annotation schema
 */
export const photoAnnotationSchema = z.object({
  caption: z
    .string()
    .max(500, 'Caption must be less than 500 characters')
    .optional(),
  location: z
    .string()
    .max(200, 'Location must be less than 200 characters')
    .optional(),
  trade: z
    .string()
    .max(100, 'Trade must be less than 100 characters')
    .optional(),
  tags: z
    .array(z.string().max(50, 'Tag must be less than 50 characters'))
    .max(20, 'Maximum 20 tags allowed')
    .optional()
    .default([]),
});

export type PhotoAnnotationFormData = z.infer<typeof photoAnnotationSchema>;

/**
 * Quick capture schema
 */
export const quickCaptureSchema = z.object({
  location: z
    .string()
    .max(200, 'Location must be less than 200 characters')
    .optional(),
  trade: z
    .string()
    .max(100, 'Trade must be less than 100 characters')
    .optional(),
  caption: z
    .string()
    .max(500, 'Caption must be less than 500 characters')
    .optional(),
});

export type QuickCaptureFormData = z.infer<typeof quickCaptureSchema>;

/**
 * Document metadata schema (for editing existing documents)
 */
export const documentMetadataSchema = z.object({
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  tags: z
    .array(z.string().max(50, 'Tag must be less than 50 characters'))
    .max(20, 'Maximum 20 tags allowed')
    .optional()
    .default([]),
});

export type DocumentMetadataFormData = z.infer<typeof documentMetadataSchema>;
