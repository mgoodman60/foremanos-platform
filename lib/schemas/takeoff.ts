import { z } from 'zod';

/**
 * Common takeoff units
 */
export const TAKEOFF_UNITS = [
  'SF',   // Square Feet
  'LF',   // Linear Feet
  'CY',   // Cubic Yards
  'EA',   // Each
  'SY',   // Square Yards
  'TON',  // Tons
  'LBS',  // Pounds
  'GAL',  // Gallons
  'CF',   // Cubic Feet
  'SQ',   // Roofing Squares
  'SFCA', // Contact Area
  'SET',  // Set
] as const;

export type TakeoffUnit = (typeof TAKEOFF_UNITS)[number];

/**
 * Takeoff add item schema
 */
export const takeoffAddItemSchema = z.object({
  category: z
    .string()
    .min(1, 'Category is required')
    .max(100, 'Category must be less than 100 characters'),
  itemName: z
    .string()
    .min(1, 'Item name is required')
    .max(200, 'Item name must be less than 200 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  quantity: z
    .number({
      required_error: 'Quantity is required',
      invalid_type_error: 'Quantity must be a number',
    })
    .min(0.01, 'Quantity must be greater than 0'),
  unit: z.enum(TAKEOFF_UNITS, {
    errorMap: () => ({ message: 'Please select a valid unit' }),
  }),
  unitCost: z
    .number({
      invalid_type_error: 'Unit cost must be a number',
    })
    .min(0, 'Unit cost cannot be negative')
    .optional(),
  location: z
    .string()
    .max(200, 'Location must be less than 200 characters')
    .optional(),
  sheetNumber: z
    .string()
    .max(50, 'Sheet number must be less than 50 characters')
    .optional(),
  gridLocation: z
    .string()
    .max(50, 'Grid location must be less than 50 characters')
    .optional(),
  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
});

export type TakeoffAddItemFormData = z.infer<typeof takeoffAddItemSchema>;

/**
 * Takeoff line item edit schema (extends add schema with additional fields)
 */
export const takeoffLineItemEditSchema = takeoffAddItemSchema.extend({
  verified: z.boolean().optional().default(false),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional(),
});

export type TakeoffLineItemEditFormData = z.infer<typeof takeoffLineItemEditSchema>;
